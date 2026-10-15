// Home — sidebar (chat history + profile/role switcher) · greeting · "Open an app"
// grid (sectioned for roles that define ROLE_SECTIONS) · Saathi message box ·
// canvas overlay on the right. Mobile collapses the sidebar.

import { useEffect, useRef, useState } from 'react'
import RoleSwitcher from '../components/RoleSwitcher.jsx'
import { useApp } from '../context/AppContext.jsx'
import { api } from '../api/client.js'
import { defaultBotsFor, suggestionsFor, homeLayoutFor, sectionsFor, ROLE_LABELS, ROLE_SCOPES, ROLE_TAGLINE } from '../roles/roleConfig.js'
import { dispatchActionForRole } from '../nlp/dispatch.js'
import ChatBubble from '../components/ChatBubble.jsx'
import TypingIndicator from '../components/TypingIndicator.jsx'
import Logo from '../components/Logo.jsx'
import { Bell, Plus, Search, Sparkles, Send, Mic, Phone, ChevronUp, MessageSquare, Menu } from 'lucide-react'
import HeadlineStrip from '../components/HeadlineStrip.jsx'
import CanvasPanel from '../canvas/CanvasPanel.jsx'
import FloatingCallPill from '../components/FloatingCallPill.jsx'

const TONES = {
  indigo:  { bg: 'bg-indigo-100',  fg: 'text-indigo-600',  ring: 'hover:border-indigo-300' },
  emerald: { bg: 'bg-emerald-100', fg: 'text-emerald-600', ring: 'hover:border-emerald-300' },
  amber:   { bg: 'bg-amber-100',   fg: 'text-amber-600',   ring: 'hover:border-amber-300' },
  sky:     { bg: 'bg-sky-100',     fg: 'text-sky-600',     ring: 'hover:border-sky-300' },
  rose:    { bg: 'bg-rose-100',    fg: 'text-rose-600',    ring: 'hover:border-rose-300' },
  violet:  { bg: 'bg-violet-100',  fg: 'text-violet-600',  ring: 'hover:border-violet-300' },
  orange:  { bg: 'bg-orange-100',  fg: 'text-orange-600',  ring: 'hover:border-orange-300' },
  teal:    { bg: 'bg-teal-100',    fg: 'text-teal-600',    ring: 'hover:border-teal-300' },
  fuchsia: { bg: 'bg-fuchsia-100', fg: 'text-fuchsia-600', ring: 'hover:border-fuchsia-300' },
  lime:    { bg: 'bg-lime-100',    fg: 'text-lime-700',    ring: 'hover:border-lime-300' },
  pink:    { bg: 'bg-pink-100',    fg: 'text-pink-600',    ring: 'hover:border-pink-300' },
}

export default function HomePage() {
  const ctx = useApp()
  const [messages, setMessages] = useState([])
  const [typing, setTyping] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const bots = defaultBotsFor(ctx.role)
  const chips = suggestionsFor(ctx.role)
  const threads = ctx.threads || []
  const mobile = homeLayoutFor(ctx.role) === 'mobile'

  const now = Date.now(), DAY = 86400000
  const todayT = threads.filter(t => now - new Date(t.updatedAt).getTime() < DAY)
  const weekT = threads.filter(t => { const d = now - new Date(t.updatedAt).getTime(); return d >= DAY && d < 7 * DAY })
  const earlierT = threads.filter(t => now - new Date(t.updatedAt).getTime() >= 7 * DAY)

  function startNewChat() { setMessages([]); setShowSidebar(false); ctx.newChat?.() }
  function openThread(t) { setShowSidebar(false); ctx.openThread?.(t) }

  async function send(text) {
    if (!text?.trim()) return
    setMessages(m => [...m, { role: 'user', text }])
    setTyping(true)
    try { handleResponse(await api.aiMessage(text, ctx.lang)) }
    catch { setMessages(m => [...m, { role: 'bot', text: 'Sorry, I could not reach the server.' }]) }
    finally { setTyping(false) }
  }
  function handleResponse(r) {
    if (r.responseType === 'action') {
      setMessages(m => [...m, { role: 'bot', text: r.meta?.assistantText || 'Opening…', actions: (r.meta?.chips || []).map(c => ({ label: c, kind: 'chip', value: c })) }])
      if (r.canvas?.type) ctx.openCanvas(r.canvas)
      else dispatchActionForRole({ actionId: r.actionId, entities: r.entities, role: ctx.role, openCanvas: ctx.openCanvas, showToast: ctx.showToast })
    } else if (r.responseType === 'answer') {
      const cits = (r.answer.citations || []).map(c => c.source).join(' · ')
      setMessages(m => [...m, { role: 'bot', text: r.answer.text, html: `<div>${r.answer.text}</div>${cits ? `<div class="mt-2 text-[10px] text-slate-500">Sources: ${cits}</div>` : ''}` }])
    } else if (r.responseType === 'none' && r.reason === 'openai_not_configured') {
      setMessages(m => [...m, { role: 'bot', text: 'Saathi needs an OpenAI key on the server to understand free text. Tap an app tile below — every screen works without AI.' }])
    } else {
      setMessages(m => [...m, { role: 'bot', text: r.assistantText || "I'm not sure how to help with that yet.", actions: (r.chips || []).map(c => ({ label: c, kind: 'chip', value: c })) }])
    }
  }
  function openBot(b) { if (b.canvas) ctx.openCanvas({ type: b.canvas, ...(b.tab ? { tab: b.tab } : {}) }); else send(`Open ${b.name}`) }
  const greeted = messages.length === 0

  return (
    <div className="h-screen flex bg-white overflow-hidden" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      <aside className={`${showSidebar ? 'fixed inset-0 z-40' : 'hidden'} md:flex md:static w-[280px] flex-shrink-0 flex-col border-r border-bdr-strong bg-surface-secondary`}>
        <div className="px-4 pt-5 pb-4 flex items-center justify-center"><Logo size={44} showText /></div>
        <div className="px-4"><button onClick={startNewChat} className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-pill bg-primary text-white font-bold text-[14px] shadow-modal active:opacity-80"><Plus className="w-4 h-4" /> New chat</button></div>
        <div className="px-4 mt-3"><div className="flex items-center gap-2 px-3 py-2 rounded-pill bg-white border border-bdr"><Search className="w-3.5 h-3.5 text-txt-tertiary" /><input placeholder="Search chats" className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-txt-tertiary" /></div></div>
        <div className="flex-1 overflow-y-auto px-3 mt-3 pb-3">
          {threads.length === 0 ? <div className="px-3 py-4 text-[11px] text-txt-tertiary leading-relaxed">No conversations yet. Open an app or ask Saathi.</div> : (<><ThreadGroup title="Today" threads={todayT} onPick={openThread} /><ThreadGroup title="This week" threads={weekT} onPick={openThread} /><ThreadGroup title="Earlier" threads={earlierT} onPick={openThread} /></>)}
        </div>
        <div className="p-3 border-t border-bdr"><ProfilePill /></div>
      </aside>
      {showSidebar && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setShowSidebar(false)} />}

      <main className="relative flex-1 flex flex-col min-w-0 bg-white">
        <div className="flex items-center justify-between md:justify-end px-3 md:px-6 py-3 border-b border-bdr bg-gradient-to-b from-surface-page/40 to-white flex-shrink-0">
          <button onClick={() => setShowSidebar(true)} className="md:hidden p-2 rounded-lg hover:bg-slate-100"><Menu className="w-5 h-5 text-txt-secondary" /></button>
          <div className="md:hidden"><Logo size={28} /></div>
          <div className="flex items-center gap-2 md:gap-3">
            <FloatingCallPill />
            <button onClick={() => ctx.openCanvas({ type: 'saathi_assistant' })} title="Talk to Saathi" className="inline-flex items-center gap-1.5 md:gap-2 pl-2.5 pr-3 md:pl-3 md:pr-4 py-1.5 md:py-2 rounded-pill bg-gradient-to-r from-primary to-primary-dark text-white font-bold text-[11px] md:text-[12px] shadow-card hover:opacity-90 active:scale-95 transition"><Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4" /><span className="hidden sm:inline">Saathi</span></button>
            <BellButton />
          </div>
        </div>
        {greeted ? <GreetingPanel ctx={ctx} bots={bots} chips={chips} onSend={send} onPickBot={openBot} mobile={mobile} /> : <ChatThread messages={messages} typing={typing} onPick={(c) => c.kind === 'chip' && send(c.value)} />}
        <MessageInput onSend={send} />
        <CanvasPanel />
      </main>
    </div>
  )
}

function ThreadGroup({ title, threads, onPick }) {
  if (!threads?.length) return null
  return (
    <div className="mb-4">
      <div className="text-[10px] uppercase tracking-wider font-bold text-txt-tertiary px-2 mb-1">{title}</div>
      {threads.map(t => (
        <button key={t.id} onClick={() => onPick(t)} className="w-full text-left px-3 py-2 rounded-xl text-[13px] text-txt-primary hover:bg-surface-page flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-txt-tertiary flex-shrink-0" /><span className="truncate flex-1">{t.title || 'Conversation'}</span>
        </button>
      ))}
    </div>
  )
}

function ProfilePill() {
  const { user, role, meExtra } = useApp()
  const initials = (user?.name || '?').split(' ').map(s => s[0]).slice(0, 2).join('')
  const subline = user?.profile?.designation || meExtra?.iti?.name || meExtra?.employer?.name || `${ROLE_LABELS[role]} · ${ROLE_SCOPES[role]}`
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => { if (!open) return; const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [open])
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-2 py-2 rounded-2xl hover:bg-surface-page">
        <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-[13px] font-bold flex-shrink-0">{initials}</div>
        <div className="flex-1 min-w-0 text-left"><div className="text-[13px] font-bold text-txt-primary truncate">{user?.name}</div><div className="text-[11px] text-txt-secondary truncate">{subline}</div></div>
        <ChevronUp className={`w-4 h-4 text-txt-tertiary transition-transform ${open ? '' : 'rotate-180'}`} />
      </button>
      {open && <div className="absolute bottom-full mb-2 left-0 right-0 z-10"><RoleSwitcher onClose={() => setOpen(false)} /></div>}
    </div>
  )
}

function BellButton() {
  const { notifications, openCanvas } = useApp()
  const unread = notifications.filter(n => !n.readAt).length
  return (
    <button onClick={() => openCanvas({ type: 'notifications' })} className="relative w-10 h-10 rounded-full hover:bg-surface-page border border-bdr-light flex items-center justify-center">
      <Bell className="w-[18px] h-[18px] text-txt-secondary" />
      {unread > 0 && <span className="absolute -top-1 -right-1 bg-danger text-white text-[10px] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-bold border-2 border-white">{unread}</span>}
    </button>
  )
}

function GreetingPanel({ ctx, bots, chips, onSend, onPickBot, mobile }) {
  const first = ctx.user?.name?.split(' ')[0] || 'there'
  const sections = sectionsFor(ctx.role)
  const cluster = ctx.meExtra?.cluster
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-10 pt-6 md:pt-10 pb-6">
        <div className="text-center">
          <div className="text-[12px] font-bold uppercase tracking-[3px] text-primary mb-3">{ROLE_TAGLINE[ctx.role] || 'Saathi'}</div>
          <h1 className="text-[26px] md:text-[40px] font-bold text-txt-primary leading-tight">Hi {first} <span aria-hidden>👋</span>,</h1>
          <h2 className="text-[20px] md:text-[32px] font-bold text-txt-primary leading-tight mt-1">what can I help with?</h2>
          {cluster && <p className="text-[13px] text-txt-secondary mt-3 max-w-2xl mx-auto">{cluster.name} · {cluster.aipName} · SIP ₹{cluster.sipAmountCr} Cr · scheme year {cluster.currentYear}</p>}
          <div className="mt-5">
            <button onClick={() => ctx.openCanvas({ type: 'saathi_assistant' })} className="inline-flex items-center gap-2.5 px-6 py-3 rounded-pill bg-primary text-white font-bold text-[15px] shadow-modal hover:opacity-90 active:scale-95 transition"><Phone className="w-4 h-4" /> Talk to Saathi</button>
          </div>
        </div>
        <HeadlineStrip />
        {sections ? <SectionedGrid bots={bots} sections={sections} onPickBot={onPickBot} /> : (
          <div className="mt-10">
            <div className="flex items-center gap-2 mb-4"><Sparkles className="w-4 h-4 text-primary" /><div className="text-[12px] font-bold uppercase tracking-[2px] text-primary">Open an app</div></div>
            <div className={`grid gap-3 ${mobile ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>{bots.map(b => <FeatureCard key={b.id} bot={b} onClick={() => onPickBot(b)} />)}</div>
          </div>
        )}
        {chips.length > 0 && (
          <div className="mt-10">
            <div className="text-[11px] uppercase tracking-wider font-bold text-txt-tertiary mb-2">Try asking</div>
            <div className="flex flex-wrap gap-2">{chips.slice(0, 5).map((c, i) => <button key={i} onClick={() => onSend(c)} className="px-3.5 py-2 rounded-pill bg-surface-page hover:bg-primary-light border border-bdr-light text-[13px] text-txt-primary">{c}</button>)}</div>
          </div>
        )}
      </div>
    </div>
  )
}

function SectionedGrid({ bots, sections, onPickBot }) {
  const groups = sections.order.map(key => ({ key, meta: sections.meta[key], tiles: bots.filter(b => b.section === key) })).filter(g => g.tiles.length)
  return (
    <div className="mt-8 space-y-5">
      {groups.map(({ key, meta, tiles }) => (
        <section key={key} className={`rounded-2xl bg-gradient-to-br ${meta.accent} border border-bdr-light ring-1 ${meta.ring}/40 p-4`}>
          <div className="mb-3"><div className="text-[13px] font-bold text-txt-primary inline-flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />{meta.title}</div><div className="text-[12px] text-txt-secondary mt-0.5">{meta.subtitle}</div></div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">{tiles.map(b => <FeatureCard key={b.id} bot={b} onClick={() => onPickBot(b)} />)}</div>
        </section>
      ))}
    </div>
  )
}

function FeatureCard({ bot, onClick }) {
  const t = TONES[bot.tone] || TONES.indigo
  return (
    <button onClick={onClick} className={`text-left rounded-2xl bg-white border border-bdr-light p-4 transition-all hover:shadow-card ${t.ring}`}>
      <div className={`w-11 h-11 rounded-2xl ${t.bg} ${t.fg} flex items-center justify-center text-[20px] mb-3`}>{bot.icon}</div>
      <div className="font-bold text-[14px] text-txt-primary leading-tight">{bot.name}</div>
      <p className="text-[12px] text-txt-secondary leading-snug mt-1 line-clamp-2">{bot.desc}</p>
    </button>
  )
}

function ChatThread({ messages, typing, onPick }) {
  return (
    <div className="flex-1 overflow-y-auto"><div className="max-w-3xl mx-auto px-6 md:px-10 py-8 flex flex-col gap-3">
      {messages.map((m, i) => <ChatBubble key={i} role={m.role} text={m.text} html={m.html} actions={m.actions} onAction={onPick} />)}
      {typing && <TypingIndicator />}
    </div></div>
  )
}

function MessageInput({ onSend }) {
  const [v, setV] = useState('')
  function submit(e) { e?.preventDefault?.(); const t = v.trim(); if (!t) return; setV(''); onSend(t) }
  return (
    <div className="flex-shrink-0 border-t border-bdr bg-gradient-to-t from-surface-page/40 to-white px-4 md:px-10 py-4">
      <form onSubmit={submit} className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2.5 rounded-pill border border-bdr bg-white px-2 py-1.5 shadow-card">
          <button type="button" className="w-9 h-9 rounded-full bg-white shadow-card flex items-center justify-center flex-shrink-0"><Mic className="w-4 h-4 text-primary" /></button>
          <input value={v} onChange={e => setV(e.target.value)} placeholder="Message Saathi…" className="flex-1 bg-transparent text-[14px] py-1.5 outline-none placeholder:text-txt-tertiary" />
          <button type="submit" disabled={!v.trim()} className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0 disabled:bg-slate-300"><Send className="w-4 h-4" /></button>
        </div>
        <div className="text-center text-[11px] text-txt-tertiary mt-2">Voice · ગુજરાતી · हिन्दी · English · मराठी · Odia · Bengali</div>
      </form>
    </div>
  )
}
