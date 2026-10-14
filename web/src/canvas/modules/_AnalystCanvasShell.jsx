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
//   └─────────────────────────────────────────────────────────┘
// There is no chat on the screen itself: "Ask Saathi" (header, any card,
// or a ready question) opens a saved thread about this screen.

import { useMemo } from 'react'
import { Sparkles, Calendar, Database } from 'lucide-react'
import { useApp } from '../../context/AppContext.jsx'
import { useSaathiContext } from '../CanvasSaathi.jsx'
import { getCanvasMeta } from './index.js'

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
  saathiContext = '',        // live data on this screen, given to the thread
}) {
  const { askSaathi, canvas } = useApp()
  const extraSystem = useMemo(() => (
    "Treat every analytic question as: 1-2 sentence narrative + ONE chart card + (if a problem was surfaced) an action_panel. Use the data baked into your system prompt — no clarifying questions before answering.\n\n" +
    (saathiContext || '')
  ), [saathiContext])
  // Publish for the header "Ask Saathi" button.
  useSaathiContext(extraSystem, quickAsks)
  const meta = getCanvasMeta(canvas?.type)
  const about = { canvasType: canvas?.type, title: meta?.title || title, subtitle: meta?.subtitle || subtitle || '', context: extraSystem, quickAsks }
  const ask = (text) => askSaathi({ about, prompt: text })

  const half = cells.filter(c => c.span === 'half')
  const full = cells.filter(c => c.span !== 'half')

  return (
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
              {refreshedOn && <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />Refreshed {refreshedOn}</span>}
              {dataMartOn && <span className="inline-flex items-center gap-1"><Database className="w-3 h-3" />Data mart {dataMartOn}</span>}
              <span className="inline-flex items-center gap-1"><Sparkles className="w-3 h-3 text-primary" />Ask Saathi about any card</span>
            </div>
          )}
        </div>

        {/* Optional filter row (e.g. scheme filter) pinned below the hero. */}
        {filterSlot && (
          <div className="px-5 py-2.5 bg-white border-b border-bdr-light">
            {filterSlot}
          </div>
        )}

        <div className="p-4 space-y-4">
          {half.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {half.map((c, i) => (
                <Cell key={`h-${i}`} prompt={c.prompt} onAsk={ask}>{c.node}</Cell>
              ))}
            </div>
          )}
          {full.map((c, i) => (
            <Cell key={`f-${i}`} prompt={c.prompt} onAsk={ask}>{c.node}</Cell>
          ))}

          {/* Ready questions — each opens a saved Saathi thread about this screen. */}
          {quickAsks.length > 0 && (
            <div className="pt-2">
              <div className="text-[11px] uppercase tracking-wider font-bold text-txt-tertiary mb-2 inline-flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-primary" /> Ask Saathi</div>
              <div className="flex flex-wrap gap-2">
                {quickAsks.map((q, i) => (
                  <button key={i} onClick={() => ask(q)} className="px-3.5 py-2 rounded-pill bg-surface-page hover:bg-primary-light border border-bdr-light text-[13px] text-txt-primary text-left">{q}</button>
                ))}
              </div>
            </div>
          )}
        </div>
    </div>
  )
}

// "Ask Saathi about this" on each card. Always visible on touch screens,
// revealed on hover with a mouse. Click → opens a Saathi thread with the
// card's question already sent.
function Cell({ children, prompt, onAsk }) {
  return (
    <div className="group relative">
      {children}
      <button
        onClick={() => onAsk(prompt)}
        title="Ask Saathi about this"
        className="absolute top-2 right-2 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-pill bg-primary/90 text-white text-[11px] font-bold opacity-80 md:opacity-0 md:group-hover:opacity-100 transition shadow-card hover:bg-primary"
      >
        <Sparkles className="w-3 h-3" /> Ask Saathi
      </button>
    </div>
  )
}
