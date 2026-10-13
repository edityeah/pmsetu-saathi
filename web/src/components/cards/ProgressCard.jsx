// ProgressCard — overall course completion % + ETA + module checklist.
// "Will I finish the course on time?" / "How much have I completed?"

import { Check, Clock, Calendar } from 'lucide-react'

export default function ProgressCard({ card }) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(card.percent) || 0)))
  const done = Array.isArray(card.completedModules) ? card.completedModules : []
  const left = Array.isArray(card.remaining)        ? card.remaining        : []
  return (
    <div className="rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] uppercase tracking-wider font-bold text-txt-tertiary">Course progress</div>
          {card.onTrack !== undefined && (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-pill ${card.onTrack ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {card.onTrack ? 'On track' : 'Behind schedule'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className="text-[24px] font-bold text-primary leading-none">{pct}%</div>
          <div className="text-[12px] text-txt-secondary">complete</div>
        </div>
        <div className="h-2 rounded-full bg-surface-page overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary to-primary-dark" style={{ width: `${pct}%` }} />
        </div>
        {card.etaDate && (
          <div className="mt-2 text-[12px] text-txt-secondary inline-flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Expected finish: <span className="font-bold text-txt-primary">{card.etaDate}</span>
          </div>
        )}
      </div>
      {(done.length > 0 || left.length > 0) && (
        <div className="px-4 pb-4 border-t border-bdr-light pt-3 grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 mb-1">Done</div>
            <ul className="space-y-1">
              {done.map((m, i) => (
                <li key={i} className="text-[12px] text-txt-secondary inline-flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" /><span>{m}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-amber-700 mb-1">Remaining</div>
            <ul className="space-y-1">
              {left.map((m, i) => (
                <li key={i} className="text-[12px] text-txt-secondary inline-flex items-start gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" /><span>{m}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
