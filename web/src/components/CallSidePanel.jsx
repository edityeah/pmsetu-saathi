// CallSidePanel — the conversation half of the screen-share split view.
// While the user shares their screen on a voice call, the dashboard the
// agent opens sits on the left and this panel on the right: who is on the
// call, the live transcript (both sides, the agent's reply streaming in),
// mute, stop sharing and end, and a text box that goes into the same call.
import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, PhoneOff, ScreenShareOff, Send, Sparkles } from 'lucide-react'
import { useCall } from '../context/CallProvider.jsx'
import { useApp } from '../context/AppContext.jsx'
import ChatBubble from './ChatBubble.jsx'

export default function CallSidePanel() {
  const { activeCall, transcript = [], toggleMute, endCall, stopScreenShare, sendText } = useCall() || {}
  const { openCanvas } = useApp() || {}
  const [input, setInput] = useState('')
  const endRef = useRef(null)
  useEffect(() => { try { endRef.current?.scrollIntoView({ block: 'end' }) } catch {} }, [transcript.length, transcript[transcript.length - 1]?.text?.length])
  if (!activeCall) return null
  const name = (activeCall.title || activeCall.persona || 'Saathi').split(' · ')[0]
  const status = activeCall.state === 'connecting' ? 'Connecting…' : activeCall.state === 'error' ? (activeCall.error || 'Call error') : activeCall.muted ? 'Muted · sharing screen' : 'Listening · sharing screen'
  function submit(e) { e?.preventDefault?.(); const t = input.trim(); if (!t) return; setInput(''); sendText?.(t) }
  return (
    <aside className="hidden md:flex w-1/2 max-w-[640px] min-w-[360px] flex-shrink-0 flex-col border-l border-bdr-strong bg-white">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-bdr bg-gradient-to-b from-primary-light/50 to-white">
        <div className="relative w-10 h-10 flex-shrink-0">
          {activeCall.state === 'live' && !activeCall.muted && <span className="absolute inset-0 rounded-full bg-primary/30 animate-pulse-ring" />}
          <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary-dark text-white flex items-center justify-center"><Sparkles className="w-4 h-4" /></div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-bold text-txt-primary truncate">{name}</div>
          <div className="text-[11px] text-txt-secondary truncate inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{status}</div>
        </div>
        <button onClick={toggleMute} title={activeCall.muted ? 'Unmute' : 'Mute'} className={`w-9 h-9 rounded-full flex items-center justify-center ${activeCall.muted ? 'bg-danger text-white' : 'bg-white border border-bdr-light text-txt-primary hover:bg-slate-50'}`}>{activeCall.muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}</button>
        <button onClick={stopScreenShare} title="Stop sharing" className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center hover:opacity-90"><ScreenShareOff className="w-4 h-4" /></button>
        <button onClick={endCall} title="End call" className="inline-flex items-center gap-1 px-3 py-2 rounded-pill bg-danger text-white font-bold text-[12px] hover:bg-danger/90"><PhoneOff className="w-3.5 h-3.5" /> End</button>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-2.5">
        <div className="rounded-2xl border border-bdr-light bg-gradient-to-b from-primary-light/30 to-white p-3 text-[12px] text-txt-secondary">
          <div className="text-[11px] uppercase tracking-wider font-bold text-primary mb-1">Screen share is on</div>
          {name} sees the screen on the left and answers from its live figures. Ask about anything you see; when another screen is relevant an Open button appears here and you choose when to open it.
        </div>
        {transcript.length === 0 && <div className="text-center py-6 text-txt-tertiary text-[12px]">Speak, or type below. What you both say appears here.</div>}
        {transcript.map((m, i) => (
          <div key={i}>
            <ChatBubble role={m.role} text={m.text || '…'} />
            {m.offer && (m.offer.canvas?.type || m.offer.followUps?.length > 0) && (
              <div className="mt-1.5 ml-2 flex flex-wrap gap-2">
                {m.offer.canvas?.type && <button onClick={() => openCanvas?.(m.offer.canvas)} className="px-3 py-1.5 text-xs font-bold rounded-pill bg-primary text-white hover:opacity-90">Open {m.offer.label} →</button>}
                {(m.offer.followUps || []).slice(0, 3).map((q, k) => <button key={k} onClick={() => sendText?.(q)} className="px-3 py-1.5 text-xs rounded-pill bg-white border border-primary text-primary-dark hover:bg-primary-light/40">{k + 1}. {q}</button>)}
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="flex-shrink-0 px-3 py-3 border-t border-bdr bg-gradient-to-t from-surface-page/40 to-white">
        <div className="flex items-center gap-2 rounded-pill border border-bdr bg-white shadow-card px-2 py-1.5">
          <input value={input} onChange={e => setInput(e.target.value)} placeholder={`Message ${name}…`} className="flex-1 bg-transparent text-[14px] px-3 py-1.5 outline-none placeholder:text-txt-tertiary" />
          <button type="submit" disabled={!input.trim()} className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center disabled:bg-slate-300"><Send className="w-4 h-4" /></button>
        </div>
      </form>
    </aside>
  )
}
