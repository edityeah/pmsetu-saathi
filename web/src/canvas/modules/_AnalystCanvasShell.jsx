// AnalystCanvasShell — shared layout used by every NSDC analyst module
// (National Overview, Training Partners, Candidates, Batches, Sectors,
// Outcomes). Each module supplies a hero block, a list of dashboard cells
// (any React node — usually a chart card), a list of quick-ask prompts,
// and the per-module Saathi context.
//
// Layout:
//   ┌─────────────────────────────────────────────────────────┐
//   │  Hero (module-specific colour + title + meta)           │
//   ├─────────────────────────────────────────────────────────┤
//   │  Scrollable dashboard:                                  │
//   │   ─ cells (charts / tables) wrapped in "Ask Saathi" tag │
//   │   ─ "Try asking" quick-prompt grid                      │
//   ├─────────────────────────────────────────────────────────┤
//   │  Saathi chat (full AvatarCall) — bottom, max 50vh       │
//   └─────────────────────────────────────────────────────────┘

import { useMemo, useState } from 'react'
import AvatarCall from '../../components/AvatarCall.jsx'
import ResizableSaathiSplit from '../../components/ResizableSaathiSplit.jsx'
import { Sparkles, Calendar, Database } from 'lucide-react'

export default function AnalystCanvasShell({
  // Hero
  eyebrow,
  title,                     // big bold title
  subtitle,                  // one-line description
  toneClass = 'from-primary-light/50 via-white to-white',
  refreshedOn,               // optional "06/05/2026"
  dataMartOn,                // optional "04/05/2026"
  // Body
  cells = [],                // array of { node: ReactNode, prompt: string, span?: 'full' | 'half' }
  quickAsks = [],            // array of strings — pre-written analyst prompts
  filterSlot,                // optional React node rendered as a sticky filter row under the hero
  // Saathi
  persona = 'general',
  saathiTitle = 'Saathi',
  saathiContext = '',        // per-module extraSystem
  threadId,
}) {
  const [pending, setPending] = useState(null)
  const ask = (text) => setPending({ text, nonce: Date.now() })

  const half = cells.filter(c => c.span === 'half')
  const full = cells.filter(c => c.span !== 'half')

  const extraSystem = useMemo(() => (
    "You are inside the " + (title || 'analyst') + " module of PM-SETU Saathi. " +
    "Treat every analytic question as: 1-2 sentence narrative + ONE chart card + (if a problem was surfaced) an action_panel. Use the data baked into your system prompt — no clarifying questions before answering.\n\n" +
    (saathiContext || '')
  ), [title, saathiContext])

  const dashboard = (
    <div className="h-full overflow-y-auto">
        {/* Hero band */}
        <div className={`px-5 pt-5 pb-3 bg-gradient-to-br ${toneClass} border-b border-bdr-light`}>
          {eyebrow && (
            <div className="text-[11px] font-bold uppercase tracking-[2px] text-primary">{eyebrow}</div>
          )}
          {title && (
            <h2 className="text-[22px] font-bold text-txt-primary leading-tight mt-1">{title}</h2>
          )}
          {subtitle && (
            <div className="text-[12px] text-txt-secondary mt-1">{subtitle}</div>
          )}
          {(refreshedOn || dataMartOn) && (
            <div className="text-[11px] text-txt-secondary mt-2 inline-flex items-center gap-3 flex-wrap">
              {refreshedOn && <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />Dashboard refreshed {refreshedOn}</span>}
              {dataMartOn && <span className="inline-flex items-center gap-1"><Database className="w-3 h-3" />Data mart {dataMartOn}</span>}
              <span className="inline-flex items-center gap-1"><Sparkles className="w-3 h-3 text-primary" />Tap any chart to talk to it</span>
            </div>
          )}
        </div>

        {/* Optional filter row (e.g. scheme filter) pinned below the hero. */}
        {filterSlot && (
          <div className="px-5 py-2.5 bg-white border-b border-bdr-light">
            {filterSlot}
          </div>
        )}

        {/* "Try asking" lives ONLY in the chat panel — not duplicated here.
            The dashboard is the data canvas; the chat is where you talk to it. */}

        <div className="p-4 space-y-4">
          {/* Half-span cells laid out 2-up on large screens */}
          {half.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {half.map((c, i) => (
                <Cell key={`h-${i}`} prompt={c.prompt} onAsk={ask}>{c.node}</Cell>
              ))}
            </div>
          )}
          {/* Full-span cells */}
          {full.map((c, i) => (
            <Cell key={`f-${i}`} prompt={c.prompt} onAsk={ask}>{c.node}</Cell>
          ))}
        </div>
    </div>
  )

  const chat = (
    <AvatarCall
      persona={persona}
      title={saathiTitle}
      useWebSearch={true}
      extraSystem={extraSystem}
      pendingPrompt={pending}
      threadId={threadId}
      // Persistent prompt strip ABOVE the message thread so the user always
      // sees example questions, regardless of conversation state.
      quickAsks={quickAsks}
    />
  )

  // Resizable split — user can drag the handle between dashboard and chat to
  // give either side more room. Persists to localStorage.
  return <ResizableSaathiSplit top={dashboard} bottom={chat} />
}

// "Ask Saathi about this" overlay revealed on hover. Click → fires a
// pre-baked prompt at the chat below.
function Cell({ children, prompt, onAsk }) {
  return (
    <div className="group relative">
      {children}
      <button
        onClick={() => onAsk(prompt)}
        title="Ask Saathi about this"
        className="absolute top-2 right-2 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-pill bg-primary/90 text-white text-[11px] font-bold opacity-0 group-hover:opacity-100 transition shadow-card hover:bg-primary"
      >
        <Sparkles className="w-3 h-3" /> Ask Saathi
      </button>
    </div>
  )
}
