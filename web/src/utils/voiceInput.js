// VoiceInput — mic capture with silence-based VAD (voice activity detection).
//
// Flow: getUserMedia → MediaRecorder records continuously → AnalyserNode
// monitors audio level → when speech ends (≥ ~1.2s of silence after speech),
// stop & POST the audio chunk to /api/whisper/transcribe → call onTranscript
// → restart recorder for the next utterance.
//
// Also supports barge-in: while the AI is speaking (audioQueue is playing),
// detecting fresh user speech pauses the audio queue. Caller wires this via
// the onSpeechStart callback.

import { getToken } from '../api/client.js'

// Reject transcripts that are obviously noise / Whisper hallucinations.
function looksLikeJunk(raw) {
  const t = (raw || '').trim()
  if (t.length < 3) return true
  // Reject single-word filler responses
  const lower = t.toLowerCase().replace(/[.!?,]/g, '')
  if (['you', 'thank you', 'thanks', 'okay', 'mm', 'hmm', 'uh', 'um', 'hi', 'oh', 'ah', 'huh'].includes(lower)) return true
  // Require ≥50% of characters to be Latin, Devanagari, or supported Indian scripts.
  // (Whisper sometimes hallucinates Japanese/Chinese on silence; filter that out.)
  const meaningful = (t.match(/[a-zA-Z0-9ऀ-ॿঀ-৿਀-੿઀-૿଀-୿஀-௿ఀ-౿ಀ-೿ഀ-ൿ\s]/g) || []).length
  if (meaningful / t.length < 0.5) return true
  // Require at least one vowel (in Latin or Indian scripts).
  if (!/[aeiouAEIOUअ-औा-ौ]/.test(t)) return true
  return false
}


export class VoiceInput {
  constructor({ onTranscript, onSpeechStart, onSpeechEnd, onBargeIn, onError, language = 'en' }) {
    this.onTranscript = onTranscript
    this.onSpeechStart = onSpeechStart
    this.onSpeechEnd = onSpeechEnd
    this.onBargeIn = onBargeIn       // fired when user speaks while AI is talking
    this.onError = onError
    this.language = language

    this.mediaStream = null
    this.mediaRecorder = null
    this.audioContext = null
    this.analyser = null
    this.chunks = []

    this.running = false
    this.speakingSince = null
    this.silenceSince = null
    this.aiSpeaking = false           // true while AI audio is playing through speakers
    this.barginCandidateSince = null  // when user-louder-than-AI began during ducked mode

    // Tunables
    this.SPEECH_THRESHOLD     = 32     // 0–255; normal listening threshold
    this.DUCKED_THRESHOLD     = 70     // higher bar while AI is talking (filters echo)
    this.BARGE_IN_MS          = 250    // sustained loud audio needed to count as barge-in
    this.SILENCE_END_MS       = 800    // hang-up after this much silence following speech
    this.MIN_SPEECH_MS        = 350    // ignore chunks shorter than this (clicks, breath)
    this.MAX_CHUNK_MS         = 15_000 // safety cap — force-cut after 15 s
  }

  async start() {
    if (this.running) return
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
    } catch (e) {
      this.onError?.(new Error('Mic permission denied'))
      throw e
    }
    this._paused = false

    this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const source = this.audioContext.createMediaStreamSource(this.mediaStream)
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 512
    this.analyser.smoothingTimeConstant = 0.7
    source.connect(this.analyser)

    this._startRecorder()
    this.running = true
    this._monitor()
  }

  stop() {
    this.running = false
    try { this.mediaRecorder?.state === 'recording' && this.mediaRecorder.stop() } catch {}
    try { this.mediaStream?.getTracks().forEach(t => t.stop()) } catch {}
    try { this.audioContext?.close() } catch {}
    this.chunks = []
    this.speakingSince = null
    this.silenceSince = null
  }

  // setAiSpeaking(true/false) — called by the caller while AI audio is playing.
  // Instead of muting the mic (which kills barge-in), we "duck" by raising the
  // detection threshold so the AI's own voice leaking through the speakers
  // (already attenuated by getUserMedia echoCancellation) is ignored, but a
  // real user interjection still triggers onBargeIn.
  setAiSpeaking(speaking) {
    this.aiSpeaking = !!speaking
    this.barginCandidateSince = null
    // Reset utterance state on transition — don't carry pre-AI noise forward.
    if (this.aiSpeaking) {
      this.speakingSince = null
      this.silenceSince = null
      this.chunks = []
      // Drop whatever the recorder has already captured during AI speech so
      // the next user turn doesn't start with leaked AI audio.
      const stale = this.mediaRecorder
      this.mediaRecorder = null
      try { if (stale?.state === 'recording') stale.stop() } catch {}
      if (this.running) setTimeout(() => this._startRecorder(), 30)
    }
  }
  // Back-compat shims (callers still using pause/resume work, but barge-in is lost).
  pause()  { this.setAiSpeaking(true) }
  resume() { this.setAiSpeaking(false) }

  // ── internals ──
  _startRecorder() {
    if (!this.mediaStream) return
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
    const recorder = new MediaRecorder(this.mediaStream, mime ? { mimeType: mime } : undefined)
    const chunks = []
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
    // Closure-bound identity check: only finalize if this recorder is still the
    // active one. Prevents stale onstop events (from pause/_cutChunk/replaced
    // recorders) from submitting empty or partial blobs.
    recorder.onstop = () => {
      if (this.mediaRecorder !== recorder) return
      this._finalizeChunk(chunks)
    }
    this.mediaRecorder = recorder
    this.chunks = chunks  // keep ref for legacy reads (unused for finalize)
    recorder.start(100)
    this._recorderStartedAt = Date.now()
  }

  _monitor() {
    if (!this.running) return
    const buf = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(buf)
    let sum = 0
    for (let i = 0; i < buf.length; i++) sum += buf[i]
    const level = sum / buf.length
    const now = Date.now()

    // ── Ducked mode: AI is speaking. Watch for barge-in only.
    if (this.aiSpeaking) {
      if (level > this.DUCKED_THRESHOLD) {
        if (!this.barginCandidateSince) this.barginCandidateSince = now
        if (now - this.barginCandidateSince > this.BARGE_IN_MS) {
          // Real user speech during AI playback → barge in.
          this.barginCandidateSince = null
          // Discard whatever the recorder has buffered so far (AI echo) — the
          // closure-captured array is the same reference as this.chunks, so
          // truncating it cleans the upcoming Whisper payload in place.
          if (Array.isArray(this.chunks)) this.chunks.length = 0
          try { this.onBargeIn?.() } catch {}
          // setAiSpeaking(false) is expected to be called by onBargeIn after
          // it stops the audio queue. As a safety, flip it ourselves so we
          // begin a normal turn even if the caller forgets.
          this.aiSpeaking = false
          this.speakingSince = now
          this.silenceSince = null
          this.onSpeechStart?.()
        }
      } else {
        this.barginCandidateSince = null
      }
      requestAnimationFrame(() => this._monitor())
      return
    }

    // ── Normal listening mode.
    if (level > this.SPEECH_THRESHOLD) {
      if (!this.speakingSince) {
        this.speakingSince = now
        this.onSpeechStart?.()
      }
      this.silenceSince = null
    } else if (this.speakingSince) {
      if (!this.silenceSince) this.silenceSince = now
      if (now - this.silenceSince > this.SILENCE_END_MS) {
        this._cutChunk('silence')
      }
    }

    if (this.speakingSince && (now - this._recorderStartedAt) > this.MAX_CHUNK_MS) {
      this._cutChunk('max-chunk')
    }

    requestAnimationFrame(() => this._monitor())
  }

  _cutChunk(reason) {
    const speechDuration = this.speakingSince ? Date.now() - this.speakingSince : 0
    this.speakingSince = null
    this.silenceSince = null
    this.onSpeechEnd?.()
    if (speechDuration < this.MIN_SPEECH_MS) {
      // too short — just restart recorder, ignore
      this._restartRecorder()
      return
    }
    try { if (this.mediaRecorder?.state === 'recording') this.mediaRecorder.stop() } catch {}
    // mediaRecorder.onstop will fire → _finalizeChunk → restart recorder
  }

  _restartRecorder() {
    // Detach first so the stale onstop is a no-op — _startRecorder below will
    // own the new recorder. Avoids double-restart / overlapping recorders.
    const stale = this.mediaRecorder
    this.mediaRecorder = null
    try { if (stale?.state === 'recording') stale.stop() } catch {}
    setTimeout(() => { if (this.running && !this._paused) this._startRecorder() }, 50)
  }

  async _finalizeChunk(chunks) {
    chunks = chunks || []
    // Restart recorder for the next utterance immediately
    if (this.running && !this._paused) setTimeout(() => this._startRecorder(), 50)

    if (!chunks.length) return
    const blob = new Blob(chunks, { type: chunks[0].type || 'audio/webm' })
    if (blob.size < 4000) return // tiny chunk — likely noise

    try {
      const res = await fetch('/api/whisper/transcribe', {
        method: 'POST',
        headers: {
          'content-type': blob.type || 'audio/webm',
          'authorization': `Bearer ${getToken()}`,
          'x-language': this.language,
        },
        body: blob,
      })
      if (!res.ok) throw new Error(`transcribe ${res.status}`)
      const { text } = await res.json()
      if (text && !looksLikeJunk(text)) {
        this.onTranscript?.(text.trim())
      } else if (text) {
        console.log('[voiceInput] dropped junk transcript:', JSON.stringify(text))
      }
    } catch (e) {
      console.warn('[voiceInput] transcribe failed:', e?.message || e)
    }
  }
}
