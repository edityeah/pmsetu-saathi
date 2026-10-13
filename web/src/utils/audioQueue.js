// Audio queue — buffers LLM text by phrase, requests Cartesia MP3 per phrase,
// plays them sequentially on a single HTMLAudioElement so the next phrase
// starts as soon as the previous finishes.
//
// Usage:
//   const q = new AudioQueue({ language: 'en' })
//   q.start()           // resume audio context on user gesture
//   q.feed(delta)        // call repeatedly as LLM tokens arrive
//   q.flush()           // when stream is done — flush any partial phrase
//   q.stop()            // hard stop, abort all queued/playing
//
// The element is `<audio>` (no UI); we create it on the fly so the browser
// honours autoplay-with-sound after the user gesture.

import { getToken } from '../api/client.js'

// Sentence-end delimiters always force a flush. Soft delimiters (comma /
// semicolon / em-dash) only flush once we've accumulated enough text — never
// before, otherwise short openers like "Bilkul," get sliced off and dropped.
const HARD_END = /([.!?。！？।])\s*/
const SOFT_END = /(,\s|;\s|—\s*)/
const MIN_PHRASE_LEN = 40

// Detect the dominant Indian script in a phrase so we can tell Cartesia which
// language to render. Without this, Devanagari text is voiced with the English
// model and comes out as gibberish.
function detectLang(text) {
  if (!text) return 'en'
  if (/[ऀ-ॿ]/.test(text)) return 'hi'   // Devanagari → Hindi
  if (/[஀-௿]/.test(text)) return 'ta'   // Tamil
  if (/[ঀ-৿]/.test(text)) return 'bn'   // Bengali
  if (/[਀-੿]/.test(text)) return 'pa'   // Gurmukhi → Punjabi
  if (/[઀-૿]/.test(text)) return 'gu'   // Gujarati
  if (/[଀-୿]/.test(text)) return 'or'   // Odia
  if (/[ఀ-౿]/.test(text)) return 'te'   // Telugu
  if (/[ಀ-೿]/.test(text)) return 'kn'   // Kannada
  if (/[ഀ-ൿ]/.test(text)) return 'ml'   // Malayalam
  return 'en'
}

export class AudioQueue {
  constructor({ language = 'en', onPlayStart, onIdle } = {}) {
    this.language = language
    this.onPlayStart = onPlayStart
    this.onIdle = onIdle
    this.buffer = ''
    this.queue = []        // pending phrases waiting to be synthesised
    this.playing = false
    this.aborted = false
    this._audio = null
    this._objectUrls = []
    this._announced = false
    this._idleTimer = null
  }

  _announce() {
    if (this._idleTimer) { clearTimeout(this._idleTimer); this._idleTimer = null }
    if (!this._announced) {
      this._announced = true
      try { this.onPlayStart?.() } catch {}
    }
  }
  _scheduleIdle() {
    if (this._idleTimer) clearTimeout(this._idleTimer)
    this._idleTimer = setTimeout(() => {
      // True idle: nothing queued, nothing playing, no more deltas being fed.
      if (this._announced && this.queue.length === 0 && !this.playing) {
        this._announced = false
        try { this.onIdle?.() } catch {}
      }
    }, 400)
  }

  start() {
    if (this._audio) return
    const a = new Audio()
    a.autoplay = true
    a.preload = 'auto'
    this._audio = a
  }

  feed(delta) {
    if (this.aborted) return
    this.buffer += delta
    // Drain phrases out of the buffer. Two pass strategy:
    //   1. Always flush at a sentence terminator (. ! ? । etc).
    //   2. Flush at a comma/semicolon/dash ONLY if the chunk before it is
    //      already long enough — otherwise wait and bundle with what's next.
    // Never advance the buffer without enqueueing — that's how words get lost.
    while (true) {
      const hard = HARD_END.exec(this.buffer)
      if (hard) {
        const cut = hard.index + hard[0].length
        const phrase = this.buffer.slice(0, cut).trim()
        this.buffer = this.buffer.slice(cut)
        if (phrase) this._enqueue(phrase)
        continue
      }
      const soft = SOFT_END.exec(this.buffer)
      if (soft && soft.index >= MIN_PHRASE_LEN) {
        const cut = soft.index + soft[0].length
        const phrase = this.buffer.slice(0, cut).trim()
        this.buffer = this.buffer.slice(cut)
        if (phrase) this._enqueue(phrase)
        continue
      }
      break
    }
    // Safety: long buffer with no punctuation at all — emit it anyway so we
    // don't stall waiting for a period that may never come.
    if (this.buffer.length > 200) {
      this._enqueue(this.buffer.trim())
      this.buffer = ''
    }
  }

  flush() {
    const tail = this.buffer.trim()
    this.buffer = ''
    if (tail) this._enqueue(tail)
  }

  stop() {
    this.aborted = true
    this.queue = []
    try { this._audio?.pause(); if (this._audio) this._audio.src = '' } catch {}
    for (const u of this._objectUrls) { try { URL.revokeObjectURL(u) } catch {} }
    this._objectUrls = []
    if (this._idleTimer) { clearTimeout(this._idleTimer); this._idleTimer = null }
    if (this._announced) {
      this._announced = false
      try { this.onIdle?.() } catch {}
    }
  }

  async _enqueue(text) {
    if (!text || this.aborted) return
    this.queue.push(text)
    this._announce()                       // tell the world we're about to talk
    if (!this.playing) this._drain()
  }

  async _drain() {
    if (this.aborted) return
    this.playing = true
    while (this.queue.length && !this.aborted) {
      const phrase = this.queue.shift()
      try {
        const blob = await this._synthesize(phrase)
        if (this.aborted) break
        await this._play(blob)
      } catch (e) {
        console.warn('[audioQueue] failed:', e?.message || e)
      }
    }
    this.playing = false
    this._scheduleIdle()                   // debounced: fire after 400ms of no new phrases
  }

  async _synthesize(text) {
    // Per-phrase language detection — the LLM may reply in Hindi even though
    // the call started in English (user code-switched). Cartesia needs the
    // right language tag or it pronounces Devanagari as English garbage.
    const lang = detectLang(text) || this.language || 'en'
    const res = await fetch('/api/tts/synthesize', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'authorization': `Bearer ${getToken()}` },
      body: JSON.stringify({ text, language: lang }),
    })
    if (!res.ok) throw new Error(`tts ${res.status}`)
    return await res.blob()
  }

  _play(blob) {
    return new Promise((resolve) => {
      if (this.aborted) return resolve()
      const url = URL.createObjectURL(blob)
      this._objectUrls.push(url)
      const a = this._audio
      a.src = url
      const cleanup = () => {
        a.removeEventListener('ended', cleanup)
        a.removeEventListener('error', cleanup)
        try { URL.revokeObjectURL(url) } catch {}
        resolve()
      }
      a.addEventListener('ended', cleanup)
      a.addEventListener('error', cleanup)
      a.play().catch(cleanup)
    })
  }
}
