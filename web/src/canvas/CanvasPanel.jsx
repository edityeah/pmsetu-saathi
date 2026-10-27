// CanvasPanel — overlay (default) or expanded (fills main panel).
//
// Layout modes:
//   * Overlay: right-side panel ~720px wide, greeting/chat still visible behind
//   * Expanded: fills the whole main panel (absolute inset-0)
//   * Mobile (md:): always full-screen — the overlay would be too cramped
//
// Header right side hosts:
//   * Module-injected actions (call icons etc. via CanvasHeaderActionsContext)
//   * Expand / Collapse toggle
//   * Close
//
// The CanvasPanel is positioned absolutely inside its parent — HomePage's main
// area is `relative`, so the overlay sits inside the main area, NOT over the
// sidebar.

import { Component, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { X, ArrowLeft, Maximize2, Minimize2, Sparkles } from 'lucide-react'
import { moduleFor, getCanvasMeta } from './modules/index.js'
import { CanvasHeaderActionsContext } from './CanvasHeaderActions.js'
import { CanvasSaathiProvider, usePublishedSaathi } from './CanvasSaathi.jsx'

// Canvases that ARE a conversation (Saathi itself and the companion
// personas). Every other canvas is a standalone screen with an "Ask Saathi"
// button in its header that starts a saved thread about that screen.
const IS_CHAT = new Set(['doubt_solver', 'course_selection', 'career_counsellor', 'job_prep', 'on_job_buddy', 'grievance', 'course_builder', 'saathi_assistant'])

// `fill` makes the panel fill its parent (the dashboard half of the
// screen-share split view) instead of sliding in as an overlay.
export default function CanvasPanel({ fill = false }) {
  const { canvas, closeCanvas, openCanvas } = useApp()
  const [expanded, setExpanded] = useState(false)
  const [headerActions, setHeaderActions] = useState(null)
  // No reset effect for headerActions — when the canvas TYPE changes, React
  // unmounts the old Module which fires AvatarCall's effect cleanup
  // (setActions(null)), then mounts the new Module whose effect fires
  // setActions(<new icons>). The natural lifecycle handles it correctly.
  //
  // The previous reset effect ran AFTER AvatarCall's effect (effects commit
  // child-first), so it overwrote the icons with null on every canvas open —
  // which is why the Phone / Video buttons never appeared in the header.
  // Collapse-on-type-change is handled via the key on the wrapper below.

  if (!canvas) return null
  const meta = getCanvasMeta(canvas.type)
  const Module = moduleFor(canvas.type)
  const isChat = IS_CHAT.has(canvas.type)
  // A Saathi thread started from a screen shows that screen's name and its
  // Back arrow returns to the screen it came from.
  const title = canvas.type === 'saathi_assistant' && canvas.about?.title ? `Saathi · ${canvas.about.title}` : (meta?.title || canvas.type)
  const subtitle = canvas.type === 'saathi_assistant' && canvas.about?.title ? 'This conversation is saved in your chats' : (meta?.subtitle || '')
  const back = () => { if (canvas.from) openCanvas(canvas.from); else closeCanvas() }

  // On mobile (default), force expanded full-screen layout
  const expandedDesktop = expanded || fill
  return (
    <>
      {/* Mobile backdrop when overlay (only relevant on tablets where overlay shows) */}
      {!expandedDesktop && (
        <button
          aria-label="Close canvas"
          onClick={closeCanvas}
          className="absolute inset-0 z-30 bg-black/20 md:hidden"
        />
      )}
      <div
        className={
          expandedDesktop
            ? 'absolute inset-0 z-40 bg-white flex flex-col'
            : 'absolute inset-0 md:inset-y-0 md:right-0 md:left-auto md:w-[min(820px,72%)] md:border-l md:border-bdr-strong md:shadow-canvas md:animate-canvas-slide z-40 bg-white flex flex-col'
        }
      >
        <CanvasSaathiProvider key={canvas.type} screen={{ type: canvas.type, title, subtitle, tab: canvas.tab || null }}>
        <header className="flex items-center gap-2 md:gap-3 px-3 md:px-5 py-3 border-b border-bdr bg-gradient-to-b from-surface-page/50 to-white sticky top-0 z-10">
          <button onClick={back} title="Back" className="p-1.5 rounded-pill hover:bg-slate-100 flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-txt-secondary" />
          </button>
          <div className="w-9 h-9 rounded bg-primary-light text-primary-dark flex items-center justify-center text-lg flex-shrink-0">{meta?.icon || '🗂'}</div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] md:text-[15px] font-bold text-txt-primary truncate">{title}</div>
            <div className="text-[11px] md:text-[12px] text-txt-secondary truncate">{subtitle}</div>
          </div>

          {!isChat && <AskSaathiButton canvas={canvas} meta={meta} />}

          {/* Module-injected actions (e.g. voice + video call icons) */}
          {headerActions && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {headerActions}
            </div>
          )}

          {/* Expand / collapse — desktop only */}
          <button
            onClick={() => setExpanded(e => !e)}
            title={expanded ? 'Collapse' : 'Expand'}
            className="hidden md:flex p-1.5 rounded-pill hover:bg-slate-100 flex-shrink-0"
          >
            {expanded ? <Minimize2 className="w-4 h-4 text-txt-secondary" /> : <Maximize2 className="w-4 h-4 text-txt-secondary" />}
          </button>

          <button onClick={closeCanvas} title="Close" className="p-1.5 rounded-pill hover:bg-slate-100 flex-shrink-0">
            <X className="w-5 h-5 text-txt-secondary" />
          </button>
        </header>

        <CanvasHeaderActionsContext.Provider value={{ setActions: setHeaderActions }}>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <CanvasErrorBoundary key={`${canvas.type}:${canvas._k || ''}`}>{Module ? <Module context={canvas} /> : <NotImplemented type={canvas.type} />}</CanvasErrorBoundary>
          </div>
        </CanvasHeaderActionsContext.Provider>
        </CanvasSaathiProvider>
      </div>
    </>
  )
}

// "Ask Saathi" in a screen's header: starts a new saved thread that knows
// what is on this screen (the canvas publishes it via useSaathiContext).
function AskSaathiButton({ canvas, meta }) {
  const { askSaathi } = useApp()
  const { context, quickAsks } = usePublishedSaathi()
  const about = { canvasType: canvas.type, title: meta?.title || canvas.type, subtitle: meta?.subtitle || '', context, quickAsks }
  return (
    <button onClick={() => askSaathi({ about })} title="Ask Saathi about this screen" className="inline-flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-pill bg-gradient-to-r from-primary to-primary-dark text-white font-bold text-[11px] md:text-[12px] shadow-card hover:opacity-90 active:scale-95 transition flex-shrink-0">
      <Sparkles className="w-3.5 h-3.5" /><span className="hidden sm:inline">Ask Saathi</span>
    </button>
  )
}

function NotImplemented({ type }) {
  return (
    <div className="p-6 text-sm text-txt-secondary">
      <div className="font-medium text-txt-primary mb-2">This screen is not available yet</div>
      <div>Ask Saathi for help, or go back and open another app.</div>
    </div>
  )
}

// Keeps one broken canvas from unmounting the whole home page.
class CanvasErrorBoundary extends Component {
  constructor(p) { super(p); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  componentDidCatch(err) { console.error('[canvas]', err) }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div className="p-6 text-sm">
        <div className="font-bold text-danger mb-1">Something went wrong on this screen</div>
        <pre className="text-[11px] bg-slate-900 text-slate-100 rounded p-3 overflow-auto">{String(this.state.err?.message || this.state.err)}</pre>
      </div>
    )
  }
}
