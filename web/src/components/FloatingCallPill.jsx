// FloatingCallPill — compact "call-in-progress" widget. Lives INLINE in the
// app header (left of the Saathi button). Surfaces:
//  - Hidden when no call is active.
//  - When the call's canvas IS open and showing the AvatarCall, hide the
//    pill (the user is already seeing the call full-size).
//  - Otherwise show a compact pill with persona name, state, mute, maximize
//    (re-open canvas) and end call.
//
// Maximize maps the call's persona slug → canvas type so the user lands back
// inside the original conversation canvas with the full call UI.

import { useApp } from '../context/AppContext.jsx'
import { useCall } from '../context/CallProvider.jsx'
import { Phone, Mic, MicOff, PhoneOff, Maximize2, Sparkles } from 'lucide-react'

import { PERSONA_TO_CANVAS, callSplit } from '../utils/callView.js'

export default function FloatingCallPill() {
  const { canvas, openCanvas } = useApp() || {}
  const { activeCall, toggleMute, endCall } = useCall() || {}
  if (!activeCall) return null

  const callCanvasType = PERSONA_TO_CANVAS[activeCall.persona] || 'saathi_assistant'
  const onMatchingCanvas = canvas?.type === callCanvasType

  // If user is already viewing the call's canvas, the AvatarCall in there is
  // already showing the full call UI — don't double up with the pill.
  if (onMatchingCanvas) return null
  // On desktop the call panel beside the screen already shows the call.
  const splitView = callSplit(activeCall, canvas)

  const status =
    activeCall.state === 'connecting' ? 'Connecting…' :
    activeCall.state === 'error'      ? 'Call error'  :
    activeCall.muted                  ? 'Muted'       :
    activeCall.screenSharing          ? 'Sharing screen' :
    'On call'

  const persona = activeCall.title || activeCall.persona || 'Assistant'

  function reopen() {
    openCanvas?.({ type: callCanvasType, threadId: activeCall.threadId || undefined })
  }

  return (
    <div className={`${splitView ? 'md:hidden ' : ''}flex items-center gap-1.5 pl-1.5 pr-1.5 py-1 rounded-pill bg-white border border-bdr shadow-card animate-fade-in`}
         role="status" aria-label="Active call">
      {/* Persona avatar + pulse */}
      <div className="relative w-7 h-7 flex-shrink-0">
        {activeCall.state === 'live' && (
          <span className="absolute inset-0 rounded-full bg-primary/30 animate-pulse-ring" />
        )}
        <div className="relative w-7 h-7 rounded-full bg-gradient-to-br from-primary to-primary-dark text-white flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      </div>

      <button onClick={reopen} className="text-left max-w-[140px] min-w-0 hidden md:block">
        <div className="text-[11px] font-bold text-txt-primary truncate leading-tight">{persona}</div>
        <div className="text-[10px] text-txt-secondary truncate leading-tight">{status}</div>
      </button>

      <button onClick={toggleMute} title={activeCall.muted ? 'Unmute' : 'Mute'}
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${activeCall.muted ? 'bg-danger text-white' : 'bg-surface-page text-txt-secondary hover:text-txt-primary'}`}>
        {activeCall.muted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
      </button>

      <button onClick={reopen} title="Re-open call window"
        className="w-7 h-7 rounded-full bg-surface-page text-txt-secondary hover:text-txt-primary flex items-center justify-center flex-shrink-0">
        <Maximize2 className="w-3 h-3" />
      </button>

      <button onClick={endCall} title="End call"
        className="w-7 h-7 rounded-full bg-danger text-white flex items-center justify-center flex-shrink-0">
        <PhoneOff className="w-3 h-3" />
      </button>
    </div>
  )
}
