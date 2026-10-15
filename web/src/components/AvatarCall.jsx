// AvatarCall — WhatsApp-style AI persona conversation panel.
//
// UX:
//   * Voice + Video call icons live in the CanvasPanel HEADER (top right),
//     injected via CanvasHeaderActionsContext. One click = call starts. No
//     "Start Call" panel inside the body.
//   * When a call is live, a compact ribbon at the top shows the avatar
//     thumbnail (or full video), mute and end-call controls.
//   * Chat thread fills the main body. Suggestions + text input are at the
//     bottom. Whole canvas scrolls naturally.
//   * Anam minutes are only consumed when the user explicitly taps a call
//     icon and end-call stops them deterministically.
//
// SDK plumbing (validated):
//   - client.streamToVideoElement(elementId)   ← element id STRING
//   - client.createTalkMessageStream()         ← per-reply object
//   - talkStream.streamMessageChunk(delta)     ← TTS pipe
//   - talkStream.endMessage()                  ← finalises
//   - MESSAGE_HISTORY_UPDATED listener         ← user speech transcript

import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
  Mic, MicOff, PhoneOff, Phone, Video, ScreenShare, ScreenShareOff,
  Send, Loader2,
} from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import { useCall } from '../context/CallProvider.jsx'
import { api, getToken } from '../api/client.js'

// Build the global "who is the user" block that every persona should see,
// so the AI knows the trainee's education / batch / location / etc without
// each canvas having to remember to pass it in.
function buildProfileBlock(meExtra, role) {
  if (!meExtra) return ''
  const t = meExtra.trainee
  if (role === 'trainee' && t) {
    return [
      'User profile (always consider this when answering):',
      t.name ? `- Name: ${t.name}` : '',
      t.education ? `- Education: ${t.education} pass` : '',
      t.batch ? `- Currently in: ${t.batch.trade?.name || ''} (${t.batch.name}, module ${t.batch.currentModule}) at ${t.iti?.name || ''}, batch lead ${t.batch.lead?.name || ''}` : '- Not currently enrolled in a batch',
      t.district ? `- Location: ${t.district}, Delhi` : '',
      t.category ? `- Social category: ${t.category}` : '',
      t.gender ? `- Gender: ${t.gender}` : '',
      Array.isArray(t.applications) && t.applications.length ? `- Applications: ${t.applications.slice(0, 3).map(a => `${a.opportunity?.title} (${a.stage}, ${a.evidenceLevel})`).join('; ')}` : '',
      Array.isArray(t.spells) && t.spells.length ? `- Current spell: ${t.spells[0].type} as ${t.spells[0].role} at ${t.spells[0].employer?.name}` : '',
    ].filter(Boolean).join('\n')
  }
  if (meExtra.cluster) {
    return `User: ${meExtra.user?.name || ''} (${role}) · Cluster: ${meExtra.cluster.name}, AIP ${meExtra.cluster.aipName}, scheme year ${meExtra.cluster.currentYear}${meExtra.iti ? ' · ITI: ' + meExtra.iti.name : ''}${meExtra.employer ? ' · Employer: ' + meExtra.employer.name : ''}`
  }
  // Non-trainee roles: at least give name + role so greetings are personal.
  return meExtra?.user?.name ? `User: ${meExtra.user.name} (${role})` : ''
}
import { loadAnam } from '../utils/anamSdk.js'
import { RealtimeVoice } from '../utils/realtimeVoice.js'
import { CanvasHeaderActionsContext } from '../canvas/CanvasHeaderActions.js'
import ChatBubble from './ChatBubble.jsx'
import CardRenderer from './cards/CardRenderer.jsx'

export default function AvatarCall({
  persona, title, intro, useWebSearch, extraSystem,
  suggestions = [], quickAsks = [], pendingPrompt,
  threadId: initialThreadId,
  // Optional { title, canvasState }: title prefixes the saved thread name
  // ("Cluster Home · Which ITI is slipping…"); canvasState is stored on the
  // thread so reopening it from the sidebar restores the screen context.
  threadMeta,
  onCallStateChange,
  // ARISE-classroom-specific hooks. When the ai/stream backend detects
  // persona=arise_mx_teacher it emits `board` and `diagram` SSE events
  // (parsed out of the streaming text via BoardParser). Pass these
  // callbacks from AriseClassroomCanvas so the blackboard updates in
  // real time from text-chat replies too, not only from voice-tool
  // dispatches.
  onBoardBlock,
  onDiagram,
  // Called with the trainee's most recent user text on every turn.
  // Parent can inspect it (e.g. for language detection) before the
  // request goes out.
  onUserMessage,
  // Optional function called at request-build time to compute a fresh
  // `extraSystem` string for that turn — takes precedence over the
  // static `extraSystem` prop when provided. Lets a parent inject
  // turn-specific directives (e.g. "reply in English because that's
  // what the trainee just wrote").
  getExtraSystem,
}) {
  const { showToast, meExtra, role, refreshThreads, openCanvas } = useApp()
  const { setActions } = useContext(CanvasHeaderActionsContext) || {}
  const threadIdRef = useRef(initialThreadId || null)        // persisted thread id (server)
  const profileBlock = buildProfileBlock(meExtra, role)
  const effectiveSystem = [profileBlock, extraSystem].filter(Boolean).join('\n\n')

  const [messages, setMessages] = useState([])
  const [thinking, setThinking] = useState(false)
  const [input, setInput] = useState('')
  const messagesRef = useRef([])
  useEffect(() => { messagesRef.current = messages }, [messages])

  // ── Call state now lives in app-level CallProvider so it survives canvas
  // close. We derive local-looking variables from the global activeCall —
  // BUT only if the active call's persona matches this view (otherwise some
  // other persona is in a call and we should appear idle).
  const call = useCall() || {}
  const { activeCall, startVoiceCall, startVideoCall, endCall,
          toggleMute: ctxToggleMute, sendText: ctxSendText,
          startScreenShare, stopScreenShare,
          bindHandlers, bindVideoElement, screenStreamRef } = call
  const isMyCall = activeCall && activeCall.persona === persona
  const callState = isMyCall ? activeCall.state : 'idle'
  const callMode  = isMyCall ? activeCall.mode  : null
  const muted     = isMyCall ? activeCall.muted : false
  const screenSharing = isMyCall ? activeCall.screenSharing : false
  const callError = isMyCall ? activeCall.error : null
  const listening = isMyCall && callState === 'live' && !muted

  const mediaRef = useRef(null)                // <video> element for Anam in video mode
  const assistantPlaceholderRef = useRef(-1)   // index of the current streaming bot bubble
  const streamAbortRef = useRef(null)          // AbortController for in-flight /api/ai/stream

  // Bind transcript handlers to the global call session while this view is
  // mounted. On unmount we DELIBERATELY do not end the call — we just clear
  // the binding so the call continues in the background.
  useEffect(() => {
    if (!bindHandlers || !isMyCall) return
    bindHandlers({
      onUserTranscript: (text) => {
        setMessages(m => {
          const next = [...m, { role: 'user', text }, { role: 'bot', text: '' }]
          assistantPlaceholderRef.current = next.length - 1
          return next
        })
      },
      onAssistantDelta: (delta) => {
        const idx = assistantPlaceholderRef.current
        if (idx < 0) return
        setMessages(m => {
          const c = m.slice()
          if (c[idx]) c[idx] = { ...c[idx], text: (c[idx].text || '') + delta }
          return c
        })
      },
      onAssistantDone: (full) => {
        const idx = assistantPlaceholderRef.current
        if (idx >= 0) {
          setMessages(m => {
            const c = m.slice()
            if (c[idx]) c[idx] = { ...c[idx], text: full || c[idx].text }
            return c
          })
        }
        assistantPlaceholderRef.current = -1
      },
    })
    return () => bindHandlers(null)
  }, [bindHandlers, isMyCall])

  // Video mode needs its <video> element registered with the Anam client.
  // When the canvas re-opens during an existing video call, re-bind so the
  // video frame renders again.
  useEffect(() => {
    if (isMyCall && callMode === 'video' && mediaRef.current) {
      try { bindVideoElement?.(mediaRef.current) } catch {}
    }
    return () => { try { bindVideoElement?.(null) } catch {} }
  }, [isMyCall, callMode, bindVideoElement])

  // Tell the parent canvas about call state transitions so it can collapse
  // hero / quick-action cards while a call is live.
  useEffect(() => {
    try { onCallStateChange?.(callState, callMode) } catch {}
  }, [callState, callMode, onCallStateChange])

  // Restore history if a thread was opened from the sidebar.
  useEffect(() => {
    if (!initialThreadId) return
    threadIdRef.current = initialThreadId
    let cancelled = false
    ;(async () => {
      try {
        const r = await api.threadMessages(initialThreadId)
        if (cancelled) return
        const restored = (r.messages || []).map(m => ({ role: m.role, text: m.text }))
        setMessages(restored)
      } catch (e) {
        console.warn('[thread] restore failed', e?.message || e)
      }
    })()
    return () => { cancelled = true }
  }, [initialThreadId])

  // Fire a prompt provided externally (e.g. a card click). The prompt itself
  // is the dependency — sending the same value again requires a different ref
  // (caller can append a nonce: { text, nonce }).
  const lastPendingRef = useRef(null)
  useEffect(() => {
    if (!pendingPrompt) return
    const key = typeof pendingPrompt === 'object' ? `${pendingPrompt.nonce}::${pendingPrompt.text}` : pendingPrompt
    if (lastPendingRef.current === key) return
    lastPendingRef.current = key
    const text = typeof pendingPrompt === 'object' ? pendingPrompt.text : pendingPrompt
    if (!text) return
    // During a live voice call, send the prompt through the realtime channel
    // so the AI speaks the answer. Otherwise use the text streaming path.
    if (isMyCall && callMode === 'voice' && ctxSendText) {
      ctxSendText(text)
    } else {
      streamReply(text, null)
    }
  }, [pendingPrompt, isMyCall, callMode, ctxSendText])

  // ── Start a call (mode = 'voice' | 'video') ───────────────────────────
  // All session work happens in CallProvider so the connection survives
  // canvas close. We just translate the user gesture → context call.
  const startCall = useCallback(async (mode) => {
    if (activeCall) {
      // Another persona is already on a call — don't silently steal it.
      showToast({ kind: 'warn', text: 'You\'re already in a call. End it first.' })
      return
    }
    if (mode === 'voice') {
      await startVoiceCall?.({
        persona, title, extraSystem: effectiveSystem,
        threadId: threadIdRef.current, role,
      })
    } else {
      await startVideoCall?.({
        persona, title, extraSystem: effectiveSystem,
        threadId: threadIdRef.current, role,
        mediaElement: mediaRef.current,
        onHistory: async (history, client) => {
          // Anam transcribes on its own — we forward the user turn into the
          // existing /api/ai/stream pipeline so the assistant reply uses our
          // server prompts (cards, persona, etc.).
          const last = history[history.length - 1]
          if (last?.content) await streamReply(last.content, client)
        },
      })
    }
  }, [activeCall, startVoiceCall, startVideoCall, persona, title, effectiveSystem, role, showToast])

  // Wrapper so the call buttons in the header keep their old call name. The
  // global endCall() in context tears down realtime + anam + screen share.
  function stopCall() { endCall?.() }

  // Persist a message to the server thread. Lazily creates the thread on the
  // first call. Best-effort — failures don't block the user.
  async function persistMessage(role, text) {
    try {
      if (!threadIdRef.current) {
        const first = (text || '').slice(0, 60).trim()
        const seed = threadMeta?.title ? `${threadMeta.title}${first ? ' · ' + first : ''}` : (first || title || persona || 'Conversation')
        const r = await api.createThread(seed, persona || null, threadMeta?.canvasState)
        threadIdRef.current = r.thread?.id || null
        refreshThreads?.()
      }
      if (threadIdRef.current) {
        await api.postMessage(threadIdRef.current, role, text || '')
        refreshThreads?.()
      }
    } catch (e) {
      console.warn('[thread] persist failed', e?.message || e)
    }
  }

  async function streamReply(userText, anamClient = null) {
    console.log('[reply] streamReply called', { text: userText.slice(0, 60), hasAnamClient: !!anamClient })
    // Give the parent a chance to inspect the user's message (e.g. run
    // language detection) BEFORE we assemble the request body — its
    // getExtraSystem() call below reads whatever it decided.
    try { onUserMessage?.(userText) } catch {}
    setThinking(true)
    setMessages(m => [...m, { role: 'user', text: userText }])
    const allMessages = [...messagesRef.current, { role: 'user', text: userText }]
    persistMessage('user', userText)
    const token = getToken()
    // Compute turn-specific extraSystem via getExtraSystem() when the
    // parent provides one; fall back to the static effectiveSystem.
    let perTurnExtra = effectiveSystem
    if (typeof getExtraSystem === 'function') {
      try {
        const dyn = getExtraSystem(userText)
        if (typeof dyn === 'string' && dyn.length) {
          perTurnExtra = [profileBlock, dyn].filter(Boolean).join('\n\n')
        }
      } catch (e) { console.warn('[reply] getExtraSystem threw', e) }
    }
    const body = {
      persona,
      messages: allMessages.map(m => ({ role: m.role === 'bot' ? 'assistant' : m.role, content: m.text || '' })),
      // Voice + video both skip web search to keep first-token latency under
      // Anam's 500 ms "pipeline stalled" threshold. Text-only mode keeps it
      // enabled (Career Counsellor needs fresh scheme/job lookups).
      useWebSearch: (callMode === 'voice' || callMode === 'video') ? false : !!useWebSearch,
      // `fast` flag tells the server to: use gpt-4o-mini, skip Zep awaits,
      // skip the CARD_TOOLBOX prompt block, and add a "≤2 sentences" hint.
      // Cuts first-token latency by ~500-800 ms vs the default path.
      fast: (callMode === 'voice' || callMode === 'video'),
      extraSystem: perTurnExtra || undefined,
      role: role || undefined,                  // role-aware persona context
    }
    // Anam SDK 4.13.1: don't use createTalkMessageStream/streamMessageChunk
    // for multi-turn. The SDK has a 500 ms "pipeline stalled" watchdog that
    // fires between chunks and closes the connection (CONNECTION_CLOSED_NORMAL)
    // as soon as the first endMessage() runs. Using client.talk(fullText)
    // with a single buffered string avoids the watchdog entirely — Anam
    // takes the whole reply, lip-syncs it, and the session stays open for
    // the next user turn.
    let buffer = ''
    const citations = []
    let placeholderIndex = -1
    let pendingNavigate = null
    // Fresh AbortController per turn so barge-in can cancel the in-flight stream.
    try { streamAbortRef.current?.abort() } catch {}
    const ctrl = new AbortController()
    streamAbortRef.current = ctrl
    try {
      console.log('[reply] fetching /api/ai/stream …')
      const res = await fetch('/api/ai/stream', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      })
      console.log('[reply] fetch resolved', { status: res.status, hasBody: !!res.body })
      if (!res.ok || !res.body) throw new Error(`stream HTTP ${res.status}`)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let leftover = ''
      setMessages(m => { placeholderIndex = m.length; return [...m, { role: 'bot', text: '' }] })
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        const lines = (leftover + chunk).split('\n')
        leftover = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let p; try { p = JSON.parse(line.slice(6)) } catch { continue }
          if (p.delta) {
            buffer += p.delta
            const idx = placeholderIndex
            // Collapse runs of 3+ newlines to a single blank line — when the
            // server strips a <<<KSKCARD>>> fence out of the stream, the
            // newlines around it stay behind and leave a visible gap inside
            // the bubble. Trim leading / trailing whitespace too.
            const cleaned = buffer.replace(/[ \t]*\n[ \t]*\n[ \t\n]+/g, '\n\n').replace(/^\s+|\s+$/g, '')
            setMessages(m => { const c = m.slice(); if (idx >= 0 && c[idx]) c[idx] = { ...c[idx], text: cleaned }; return c })
            /* Anam audio is sent once at p.done — see comment above. */
          }
          if (p.citation?.url) citations.push(p.citation)
          // Screen tool from the server: remember the resolved canvas and
          // open it once the reply has finished streaming (opening a canvas
          // replaces this view, so the answer must land in the thread first).
          if (p.navigate?.canvas?.type) pendingNavigate = p.navigate
              // Card events from the server's card parser — append to the
          // current assistant bubble's `cards` list so ChatBubble can render
          // the rich component below the text.
          if (p.card && typeof p.card === 'object') {
            const idx = placeholderIndex
            setMessages(m => {
              const c = m.slice()
              if (idx >= 0 && c[idx]) {
                const cards = c[idx].cards ? [...c[idx].cards, p.card] : [p.card]
                c[idx] = { ...c[idx], cards }
              }
              return c
            })
          }
          if (p.done) {
            console.log('[reply] done', { bufferLen: buffer.length, hasAnamClient: !!anamClient })
            if (pendingNavigate) {
              const nav = pendingNavigate; pendingNavigate = null
              setTimeout(() => { try { openCanvas?.(nav.canvas); showToast?.({ kind: 'info', text: `Opened: ${nav.label || nav.canvas.type}` }) } catch {} }, 600)
            }
            if (citations.length) {
              const idx = placeholderIndex
              setMessages(m => { const c = m.slice(); if (idx >= 0) c[idx] = { ...c[idx], citations }; return c })
            }
            // Strip card fences before sending to Anam — those are JSON
            // payloads meant for the chat renderer, not for the avatar to
            // narrate. Whatever's left is the conversational text.
            const speakText = buffer
              .replace(/<<<KSKCARD>>>[\s\S]*?<<<END>>>/g, '')
              .replace(/\s+/g, ' ')
              .trim()
            if (anamClient && typeof anamClient.talk === 'function' && speakText) {
              try {
                await anamClient.talk(speakText)
                console.log('[reply] anam.talk dispatched', { len: speakText.length })
              } catch (e) {
                console.warn('[reply] anam.talk threw', e?.message || e)
              }
            }
            // Persist the final assistant text once the stream is complete.
            if (buffer.trim()) persistMessage('bot', buffer)
          }
          if (p.error) {
            const idx = placeholderIndex
            setMessages(m => { const c = m.slice(); if (idx >= 0) c[idx] = { ...c[idx], text: `(error) ${p.error}` }; return c })
          }
        }
      }
    } catch (e) {
      // AbortError = barge-in cancelled the stream; not a real failure.
      if (e?.name === 'AbortError') {
        console.log('[stream] aborted (barge-in)')
      } else {
        // Surface the actual error to both console and the chat bubble so we
        // can diagnose, instead of the generic "lost connection" message.
        console.error('[stream]', e)
        const detail = e?.message || String(e) || 'unknown error'
        const friendly =
          /\b401\b|unauthorized/i.test(detail) ? "Your session expired — please sign in again." :
          /\b429\b|rate/i.test(detail)         ? "You're sending requests too fast. Wait a moment and retry." :
          /\b5\d\d\b/.test(detail)             ? `Server error: ${detail}. Check server logs.` :
          /failed to fetch|network/i.test(detail) ? "Network error — can't reach the server." :
                                                  `Request failed: ${detail}`
        setMessages(m => [...m, { role: 'bot', text: friendly }])
      }
    } finally {
      setThinking(false)
      if (streamAbortRef.current === ctrl) streamAbortRef.current = null
    }
  }

  function sendText() {
    const t = input.trim()
    if (!t || thinking) return
    setInput('')
    // Active voice call → route through the global call so the AI speaks back.
    // Otherwise use the text streaming path.
    if (isMyCall && callMode === 'voice' && ctxSendText?.(t)) return
    streamReply(t, null)
  }
  function toggleMute() {
    if (!isMyCall) return
    ctxToggleMute?.()
  }
  async function toggleScreenShare() {
    if (!isMyCall) {
      showToast({ kind: 'warn', text: 'Start the call first, then share your screen.' })
      return
    }
    if (screenSharing) {
      stopScreenShare?.()
    } else {
      await startScreenShare?.()
    }
  }

  // ── Inject the WhatsApp-style call icons into the canvas header ─────────
  useEffect(() => {
    if (!setActions) return
    if (callState === 'idle') {
      setActions(
        <>
          <HeaderIconBtn onClick={() => startCall('voice')} title="Voice call" tone="primary">
            <Phone className="w-4 h-4" />
          </HeaderIconBtn>
          <HeaderIconBtn onClick={() => startCall('video')} title="Video call" tone="primary">
            <Video className="w-4 h-4" />
          </HeaderIconBtn>
        </>
      )
    } else if (callState === 'live') {
      setActions(
        <>
          <HeaderIconBtn onClick={toggleMute} tone={muted ? 'danger' : 'neutral'} title={muted ? 'Unmute' : 'Mute'}>
            {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </HeaderIconBtn>
          <HeaderIconBtn onClick={toggleScreenShare} tone={screenSharing ? 'primary' : 'neutral'} title={screenSharing ? 'Stop sharing' : 'Share screen'}>
            {screenSharing ? <ScreenShareOff className="w-4 h-4" /> : <ScreenShare className="w-4 h-4" />}
          </HeaderIconBtn>
          <button onClick={() => stopCall()} title="End call"
            className="inline-flex items-center gap-1 px-2.5 md:px-3 py-1.5 rounded-pill bg-danger text-white font-bold text-[11px] md:text-[12px] hover:bg-danger/90 ml-1">
            <PhoneOff className="w-3.5 h-3.5" /> <span className="hidden sm:inline">End</span>
          </button>
        </>
      )
    } else if (callState === 'connecting') {
      setActions(<div className="inline-flex items-center gap-1 text-[12px] font-bold text-primary"><Loader2 className="w-4 h-4 animate-spin" /> Connecting…</div>)
    } else if (callState === 'error') {
      setActions(<button onClick={() => { setCallState('idle'); setCallMode(null) }} className="text-[12px] font-bold text-danger">Retry</button>)
    }
    return () => setActions(null)
  }, [setActions, callState, callMode, muted, screenSharing, startCall])

  // ── Live-call ribbon (avatar visual + status) ───────────────────────────
  const showRibbon = callState !== 'idle'
  const personaShort = (title || '').split(' · ')[0] || 'Assistant'

  // Mount the screen-share PiP into a video element via a callback ref so
  // that whenever the stream is (re)created the element gets it without
  // needing a manual srcObject assignment.
  const sharePipRef = (el) => {
    if (el && screenStreamRef.current && el.srcObject !== screenStreamRef.current) {
      el.srcObject = screenStreamRef.current
      try { el.play() } catch {}
    }
  }

  return (
    <div className="h-full flex flex-col bg-white relative" style={{ fontFamily: 'Montserrat, sans-serif' }}>

      {/* Picture-in-picture preview of the user's shared screen — only when
          screen-sharing during a live call. Floats bottom-right of the canvas
          so it never blocks chat content. */}
      {screenSharing && callState === 'live' && (
        <div className="absolute bottom-20 right-3 md:right-5 z-20 w-44 md:w-56 rounded-xl overflow-hidden bg-slate-900 shadow-modal border border-bdr">
          <video
            ref={sharePipRef}
            muted
            playsInline
            autoPlay
            className="w-full h-auto object-contain bg-slate-900"
          />
          <div className="px-2 py-1 bg-slate-900 text-white text-[10px] flex items-center justify-between">
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Sharing screen
            </span>
            <button onClick={() => stopScreenShare()} className="text-[10px] text-rose-300 hover:text-rose-200 font-bold">Stop</button>
          </div>
        </div>
      )}
      {/* Zone 1 — Call surface. Two presentations:
          • voice call → big pulsing orb in the middle, name + status, no chat
            visible below (call mode owns the whole canvas like a phone call)
          • video call → contained 220px video band with caption, chat below */}
      {/* Always-mounted video element. Anam needs `mediaRef.current` to be
          a real DOM node at click time — the SDK won't start its session
          until streamToVideoElement is called against a live element. If we
          only mounted it inside the callMode==='video' branch, the ref
          would still be null when startVideoCall fires, so the avatar
          never renders. Visibility is controlled by callMode below. */}
      <video
        ref={mediaRef}
        id={`anam-media-${persona}`}
        playsInline
        autoPlay
        className={callMode === 'video' && showRibbon
          ? 'rounded-2xl bg-slate-900 w-auto h-[180px] md:h-[220px] aspect-video object-cover shadow-card mx-auto block'
          : 'hidden'}
      />
      {showRibbon && callMode === 'voice' && (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center bg-gradient-to-b from-primary-light/60 to-white px-6 py-10">

          {/* Pulsing orb — animated rings around a solid centre. */}
          <div className="relative w-48 h-48 flex items-center justify-center">
            {callState === 'live' && (
              <>
                <span className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-ring" />
                <span className="absolute inset-4 rounded-full bg-primary/30 animate-pulse-ring" style={{ animationDelay: '0.4s' }} />
              </>
            )}
            <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-primary to-primary-dark text-white flex items-center justify-center text-[40px] font-bold shadow-modal">
              {personaShort.charAt(0)}
            </div>
          </div>

          <div className="mt-8 text-[20px] font-bold text-txt-primary">{personaShort}</div>
          <div className="mt-1 text-[13px] text-txt-secondary">
            {callState === 'connecting' ? 'Connecting…' : callState === 'live' ? (listening ? 'Listening…' : 'Speak naturally') : ''}
          </div>
          {callState === 'error' && callError && (
            <div className="mt-3 text-[12px] text-danger">{callError}</div>
          )}
        </div>
      )}

      {showRibbon && callMode === 'video' && (
        <div className="flex-shrink-0 bg-gradient-to-b from-primary-light/50 to-white border-b border-bdr">
          <div className="px-4 py-3 flex flex-col items-center gap-2">
            {/* The actual <video> element is rendered at the top of the
                component so its ref is always populated; this block only
                holds the caption + status below it. */}
            <div className="flex items-center gap-2 text-[12px] font-bold text-txt-primary">
              {callState === 'connecting' ? 'Connecting…' : `On a video call with ${personaShort}`}
              {listening && callState === 'live' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-rose-100 text-rose-700 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" /> listening
                </span>
              )}
            </div>
            {callState === 'error' && callError && (
              <div className="text-[11px] text-danger">{callError}</div>
            )}
          </div>
        </div>
      )}

      {/* Zone 2 — Chat thread. Takes the rest of the height and scrolls.
          Hidden during a voice call (Zone 1 already fills the canvas like a
          phone call). Visible in video mode (under the video) and in text mode. */}
      <div className={`${callMode === 'voice' && callState !== 'idle' ? 'hidden' : 'flex'} flex-1 min-h-0 overflow-y-auto px-4 md:px-5 py-4 flex-col gap-2.5`}>
        {/* "Try asking" — vertical grid of prompts at the top of the chat
            thread. ALWAYS visible (scrolls with the thread, so it sits above
            the messages and the user can scroll back to it at any time).
            `quickAsks` is the analyst-canvas prop (long list, one per row).
            `suggestions` is the legacy learner-canvas prop (shown only when
            the conversation is empty, smaller chips). */}
        {quickAsks.length > 0 && (
          <div className="mb-3 rounded-2xl border border-bdr-light bg-gradient-to-b from-primary-light/30 to-white p-3">
            <div className="text-[11px] uppercase tracking-wider font-bold text-primary mb-2 inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Try asking
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quickAsks.map((q, i) => (
                <button key={i} onClick={() => streamReply(q, null)}
                  className="text-left text-[12px] px-3 py-2 rounded-xl border border-bdr-light bg-white hover:border-primary hover:bg-primary-light/40 transition leading-snug">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.length === 0 && suggestions.length > 0 && quickAsks.length === 0 && (
          <div className="mb-3">
            <div className="text-[11px] uppercase tracking-wider font-bold text-txt-tertiary mb-2">Try asking</div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => streamReply(s, null)}
                  className="text-left text-[12px] px-3 py-2 rounded-2xl border border-bdr bg-white hover:border-primary">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.length === 0 && suggestions.length === 0 && quickAsks.length === 0 && (
          <div className="text-center py-6 text-txt-secondary text-[13px]">Type below, or tap the phone / video icon above to call.</div>
        )}
        {messages.map((m, i) => (
          <div key={i}>
            <ChatBubble role={m.role} text={m.text} />
            {Array.isArray(m.cards) && m.cards.map((card, j) => (
              <CardRenderer key={j} card={card} onChip={(text) => streamReply(text, null)} />
            ))}
            {m.citations?.length > 0 && (
              <div className="text-[10px] text-txt-tertiary mt-1 ml-2 flex flex-wrap gap-x-3">
                {m.citations.map((c, j) => (
                  <a key={j} href={c.url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate max-w-[260px]">{c.title || c.url}</a>
                ))}
              </div>
            )}
          </div>
        ))}
        {thinking && <div className="text-[11px] text-txt-tertiary px-2">thinking…</div>}
      </div>

      {/* Zone 3 — Input. flex-shrink-0 so it never gets squeezed. */}
      <div className="flex-shrink-0 px-3 md:px-4 py-3 border-t border-bdr bg-gradient-to-t from-surface-page/40 to-white">
        <div className="flex items-center gap-2 rounded-pill border border-bdr bg-white shadow-card px-2 py-1.5">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendText()}
            placeholder={`Message ${personaShort}…`}
            className="flex-1 bg-transparent text-[14px] px-3 py-1.5 outline-none placeholder:text-txt-tertiary" />
          <button onClick={sendText} disabled={!input.trim() || thinking}
            className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center disabled:bg-slate-300">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Header-tray icon button — small, circular, brand-coloured. WhatsApp vibe.
function HeaderIconBtn({ children, onClick, tone = 'primary', title }) {
  const css = tone === 'primary'
    ? 'bg-primary text-white hover:opacity-90'
    : tone === 'danger'
      ? 'bg-danger text-white hover:bg-danger/90'
      : 'bg-white text-txt-primary border border-bdr-light hover:bg-slate-50'
  return (
    <button onClick={onClick} title={title}
      className={`w-9 h-9 md:w-10 md:h-10 rounded-full shadow-card flex items-center justify-center transition ${css}`}>
      {children}
    </button>
  )
}
