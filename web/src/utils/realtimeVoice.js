// RealtimeVoice — bidirectional voice loop on OpenAI Realtime API via WebRTC.
//
// Replaces the DIY pipeline (MediaRecorder → Whisper REST → LLM stream →
// phrase-split → Cartesia REST → audio blobs) with a single peer connection
// to OpenAI that does mic capture, server-side VAD, LLM, TTS, and barge-in
// natively. Perceived latency drops from 3–5 s to ~500 ms; interrupting the
// AI works because the API itself implements "speech_started → cancel
// response → speak the new turn".
//
// Architecture:
//   * /api/realtime/session (our server) mints an ephemeral OpenAI key tied
//     to a persona + extraSystem.
//   * Browser opens an RTCPeerConnection straight to OpenAI:
//       - one outbound audio track (mic, getUserMedia)
//       - one inbound audio track (assistant TTS → <audio> element)
//       - one data channel for transcripts / status / extra prompts
//   * SDP offer goes to api.openai.com/v1/realtime, response is plain SDP.
//
// Events surfaced to the caller:
//   onUserTranscript(text)        ← what the user said (final)
//   onAssistantDelta(text)        ← assistant text as it's being spoken
//   onAssistantDone(fullText)     ← assistant finished a turn
//   onState('connecting'|'live'|'closed'|'error', detail?)
//
// Lifecycle: new RealtimeVoice({...}).connect()  →  ...  →  .close()

import { getToken } from '../api/client.js'

export class RealtimeVoice {
  constructor({
    persona = 'general',
    extraSystem = '',
    voice,
    role,
    onUserTranscript,
    onAssistantDelta,
    onAssistantDone,
    onState,
    onError,
    // Called when the model completes a function-call. Signature:
    //   onToolCall({ callId, name, args }) → any (serialisable)
    // The return value is JSON-encoded and posted back to the model as
    // a function_call_output item, followed by a response.create so
    // the model finishes speaking. If the callback throws or returns
    // undefined, we post { ok: true } as a neutral acknowledgement.
    onToolCall,
  } = {}) {
    this.persona = persona
    this.extraSystem = extraSystem
    this.voice = voice
    this.role = role
    this.onUserTranscript = onUserTranscript
    this.onAssistantDelta = onAssistantDelta
    this.onAssistantDone = onAssistantDone
    this.onState = onState
    this.onError = onError
    this.onToolCall = onToolCall

    this.pc = null              // RTCPeerConnection
    this.dc = null              // RTCDataChannel for control + transcript events
    this.localStream = null     // user mic MediaStream
    this.audioEl = null         // hidden <audio> for assistant playback
    this.assistantBuffer = ''   // current turn's accumulated assistant text
    // OpenAI streams function-call arguments in deltas, keyed by call_id.
    // We buffer per-call until the corresponding .done event arrives.
    this.toolArgBuffers = new Map()
    this.closed = false
  }

  _setState(s, detail) { try { this.onState?.(s, detail) } catch {} }

  async connect() {
    this._setState('connecting')
    try {
      // 1) Get the ephemeral session token from our server.
      const tok = getToken()
      const r = await fetch('/api/realtime/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${tok}` },
        body: JSON.stringify({
          persona: this.persona,
          extraSystem: this.extraSystem,
          voice: this.voice,
          role: this.role,
        }),
      })
      if (!r.ok) {
        const txt = await r.text().catch(() => '')
        throw new Error(`session mint failed: ${r.status} ${txt.slice(0, 200)}`)
      }
      const { clientSecret, model } = await r.json()
      if (!clientSecret) throw new Error('no client_secret in session response')

      // 2) Capture mic — echoCancellation is critical for barge-in (without it
      // the model would hear its own voice via the speakers and never stop).
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })

      // 3) Build the peer connection. Audio out element is created on the fly
      // so the browser honours autoplay-with-sound after the user gesture
      // that triggered .connect().
      const pc = new RTCPeerConnection()
      this.pc = pc

      this.audioEl = document.createElement('audio')
      this.audioEl.autoplay = true
      this.audioEl.style.display = 'none'
      // Attach to <body> so the element lives outside any React tree and
      // keeps playing even after the AvatarCall view that started the call
      // unmounts (canvas closed). Without this, some browsers refuse to play
      // audio from a detached <audio> element.
      try { document.body.appendChild(this.audioEl) } catch {}
      pc.ontrack = (ev) => {
        if (this.audioEl) this.audioEl.srcObject = ev.streams[0]
      }
      pc.addTrack(this.localStream.getAudioTracks()[0], this.localStream)

      // 4) Data channel for events (transcripts, response control, etc).
      this.dc = pc.createDataChannel('oai-events')
      this.dc.addEventListener('message', (ev) => this._handleEvent(ev.data))
      this.dc.addEventListener('open', () => this._setState('live'))

      pc.onconnectionstatechange = () => {
        const s = pc.connectionState
        if (s === 'failed' || s === 'disconnected' || s === 'closed') {
          if (!this.closed) this._setState('closed', s)
        }
      }

      // 5) SDP offer/answer with OpenAI Realtime.
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // GA Realtime API SDP exchange endpoint. Path moved from /v1/realtime
      // to /v1/realtime/calls when the API went GA. The old path returns 400
      // on a valid offer; only /calls accepts it.
      const sdpRes = await fetch(`https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(model)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${clientSecret}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      })
      if (!sdpRes.ok) {
        const txt = await sdpRes.text().catch(() => '')
        throw new Error(`SDP exchange failed: ${sdpRes.status} ${txt.slice(0, 200)}`)
      }
      const answer = { type: 'answer', sdp: await sdpRes.text() }
      await pc.setRemoteDescription(answer)
    } catch (e) {
      this._setState('error', e?.message || String(e))
      this.onError?.(e)
      this.close()
      throw e
    }
  }

  // Parse a server event off the data channel. We care about a small subset:
  //   conversation.item.input_audio_transcription.completed → user said X
  //   response.output_audio_transcript.delta (GA) / response.audio_transcript.delta (beta) → assistant text (live)
  //   response.output_audio_transcript.done  (GA) / response.audio_transcript.done  (beta) → assistant turn done
  //   error                                                → surface to caller
  _handleEvent(raw) {
    let e
    try { e = JSON.parse(raw) } catch { return }
    switch (e.type) {
      case 'conversation.item.input_audio_transcription.completed': {
        const t = (e.transcript || '').trim()
        if (t) this.onUserTranscript?.(t)
        break
      }
      // GA event names use the `output_` prefix; beta names kept as fallback.
      case 'response.output_audio_transcript.delta':
      case 'response.audio_transcript.delta': {
        const d = e.delta || ''
        if (!d) break
        this.assistantBuffer += d
        this.onAssistantDelta?.(d)
        break
      }
      case 'response.output_audio_transcript.done':
      case 'response.audio_transcript.done':
      case 'response.done': {
        const full = (e.transcript || this.assistantBuffer || '').trim()
        if (full) this.onAssistantDone?.(full)
        this.assistantBuffer = ''
        break
      }
      case 'input_audio_buffer.speech_started': {
        // User started speaking — OpenAI will auto-cancel the current
        // response when interrupt_response is true (we set that on the
        // session), but we also clear our local assistant buffer so the
        // next done event doesn't include cancelled-out text.
        this.assistantBuffer = ''
        break
      }
      case 'error': {
        console.warn('[realtime] server error', e)
        this.onError?.(new Error(e.error?.message || 'realtime_error'))
        break
      }
      // ── Function-call plumbing ──────────────────────────────────────
      // Arguments arrive as a stream of deltas keyed by call_id; when
      // the model finishes emitting them, a .done event fires with the
      // final JSON (also mirrored in `arguments`).
      case 'response.function_call_arguments.delta': {
        if (e.call_id && e.delta != null) {
          const prev = this.toolArgBuffers.get(e.call_id) || ''
          this.toolArgBuffers.set(e.call_id, prev + e.delta)
        }
        break
      }
      case 'response.function_call_arguments.done': {
        const callId = e.call_id
        const name   = e.name
        const argsRaw = (e.arguments != null && e.arguments !== '')
          ? e.arguments
          : (this.toolArgBuffers.get(callId) || '{}')
        this.toolArgBuffers.delete(callId)
        let args
        try { args = JSON.parse(argsRaw) }
        catch (err) {
          console.warn('[realtime] malformed tool args for', name, '— skipping dispatch', err)
          break
        }
        this._dispatchToolCall({ callId, name, args }).catch(err =>
          console.warn('[realtime] tool dispatch threw', err))
        break
      }
      default:
        // Many other events flow by (rate.limits.updated, session.updated, etc).
        // Logging at debug level only.
        // console.debug('[realtime]', e.type)
        break
    }
  }

  // Dispatch a completed function-call to the caller's onToolCall
  // callback, then post the result back into the data channel as a
  // function_call_output + response.create so the model can finish its
  // spoken turn once it sees the tool succeeded.
  async _dispatchToolCall({ callId, name, args }) {
    let result
    try {
      result = this.onToolCall
        ? await this.onToolCall({ callId, name, args })
        : { ok: false, error: 'no tool handler on client' }
    } catch (err) {
      result = { ok: false, error: String(err?.message || err) }
    }
    // Fall back to a neutral ack so the model doesn't stall waiting
    // for output that never arrives.
    if (result === undefined || result === null) result = { ok: true }
    let output
    try { output = JSON.stringify(result) }
    catch { output = JSON.stringify({ ok: false, error: 'result not serialisable' }) }

    if (!this.dc || this.dc.readyState !== 'open') {
      console.warn('[realtime] tool result not delivered — data channel not open', { name, callId })
      return
    }
    this.dc.send(JSON.stringify({
      type: 'conversation.item.create',
      item: { type: 'function_call_output', call_id: callId, output },
    }))
    // Ask the model to continue speaking now that it has the result.
    this.dc.send(JSON.stringify({ type: 'response.create' }))
  }

  // Inject an additional user message (e.g. when caller types a prompt while
  // the voice call is live). Triggers an assistant response immediately.
  sendText(text) {
    if (!this.dc || this.dc.readyState !== 'open' || !text) return
    this.dc.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    }))
    this.dc.send(JSON.stringify({ type: 'response.create' }))
  }

  // Inject a silent context note (no response triggered). Used to feed the
  // model what the user is currently looking at when screen-sharing, so when
  // the user asks "where do I click?" the agent already knows the layout.
  sendContext(text) {
    if (!this.dc || this.dc.readyState !== 'open' || !text) return
    this.dc.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'system',
        content: [{ type: 'input_text', text }],
      },
    }))
    // Deliberately NO response.create — this is background context, not a turn.
  }

  // Mute / unmute the outgoing mic track without tearing down the connection.
  setMuted(muted) {
    this.localStream?.getAudioTracks().forEach(t => { t.enabled = !muted })
  }

  close() {
    if (this.closed) return
    this.closed = true
    try { this.dc?.close() } catch {}
    try { this.pc?.getSenders().forEach(s => s.track?.stop()) } catch {}
    try { this.pc?.close() } catch {}
    try { this.localStream?.getTracks().forEach(t => t.stop()) } catch {}
    try { if (this.audioEl) this.audioEl.srcObject = null } catch {}
    try { this.audioEl?.parentNode?.removeChild(this.audioEl) } catch {}
    this.pc = null; this.dc = null; this.localStream = null; this.audioEl = null
    this._setState('closed')
  }
}
