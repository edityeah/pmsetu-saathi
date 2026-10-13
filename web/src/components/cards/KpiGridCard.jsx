// KpiGridCard — hero KPI strip rendered as a responsive tile grid. Used for
// "show me the national overview" / "what are the headline numbers" queries.
// Each item: { label, value, delta?, tone?, hint?, onClick? }
//
// tone drives a pastel background + a darker accent stripe so the eye can
// scan 4-12 numbers without colour collisions.
// Pass `onClick` per item (or a master `onItemClick(item, idx)` on the card)
// to make a tile drillable; the tile gets a hover ring + cursor.

const TONES = {
  primary: 'bg-primary-light/60 text-primary-dark border-primary/20',
  sky:     'bg-sky-50      text-sky-700      border-sky-200/60',
  violet:  'bg-violet-50   text-violet-700   border-violet-200/60',
  emerald: 'bg-emerald-50  text-emerald-700  border-emerald-200/60',
  amber:   'bg-amber-50    text-amber-700    border-amber-200/60',
  rose:    'bg-rose-50     text-rose-700     border-rose-200/60',
  indigo:  'bg-indigo-50   text-indigo-700   border-indigo-200/60',
  teal:    'bg-teal-50     text-teal-700     border-teal-200/60',
  fuchsia: 'bg-fuchsia-50  text-fuchsia-700  border-fuchsia-200/60',
}

export default function KpiGridCard({ card, onItemClick }) {
  const items = Array.isArray(card.items) ? card.items : []
  return (
    <div className="rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden">
      {card.title && (
        <div className="px-4 py-2.5 bg-gradient-to-r from-surface-page/50 to-white border-b border-bdr-light">
          <div className="text-[11px] font-bold uppercase tracking-wider text-primary">{card.title}</div>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-3">
        {items.map((it, i) => {
          const tone = TONES[it.tone] || TONES.primary
          const deltaUp = typeof it.delta === 'string' && /^\+|↑|up/i.test(it.delta)
          const deltaDn = typeof it.delta === 'string' && /^-|↓|down|dip|drop/i.test(it.delta)
          const handler = it.onClick || (onItemClick ? () => onItemClick(it, i) : null)
          const interactive = !!handler
          const Wrapper = interactive ? 'button' : 'div'
          return (
            <Wrapper
              key={i}
              onClick={handler || undefined}
              type={interactive ? 'button' : undefined}
              className={`text-left rounded-xl border ${tone} p-3 transition hover:shadow-card ${interactive ? 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-current/30 focus:outline-none focus:ring-2 focus:ring-current/40' : ''}`}>
              <div className="text-[10px] uppercase tracking-wider font-bold opacity-70 truncate inline-flex items-center gap-1 w-full">
                <span className="truncate">{it.label}</span>
                {interactive && <span className="ml-auto opacity-60 text-[9px]">›</span>}
              </div>
              <div className="text-[20px] md:text-[22px] font-bold leading-tight mt-0.5">{it.value}</div>
              {it.delta && (
                <div className={`text-[10px] font-bold mt-1 inline-flex items-center gap-1 ${deltaDn ? 'text-rose-600' : deltaUp ? 'text-emerald-700' : 'text-txt-secondary'}`}>
                  {it.delta}
                </div>
              )}
              {it.hint && (
                <div className="text-[10px] italic opacity-70 leading-snug mt-1">{it.hint}</div>
              )}
            </Wrapper>
          )
        })}
      </div>
    </div>
  )
}
