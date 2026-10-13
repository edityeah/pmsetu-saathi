// EligibilityCard — answers "Can I do this course?" with a green / red status
// banner, a per-criterion checklist, and alternates if the user doesn't qualify.

import { Check, X, ArrowRight } from 'lucide-react'

export default function EligibilityCard({ card, onChip }) {
  const eligible = card.status === 'eligible'
  const criteria = Array.isArray(card.criteria) ? card.criteria : []
  const alternates = Array.isArray(card.alternates) ? card.alternates : []
  return (
    <div className="rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden">
      <div className={`px-4 py-3 border-b border-bdr-light ${eligible ? 'bg-emerald-50' : 'bg-rose-50'}`}>
        <div className={`text-[11px] font-bold uppercase tracking-wider ${eligible ? 'text-emerald-700' : 'text-rose-700'}`}>
          {eligible ? 'You qualify' : 'Not eligible yet'}
        </div>
        <div className="text-[14px] font-bold text-txt-primary mt-0.5">{card.course}</div>
      </div>
      {criteria.length > 0 && (
        <ul className="p-3 space-y-1.5">
          {criteria.map((c, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px]">
              {c.met
                ? <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                : <X className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />}
              <span className={c.met ? 'text-txt-primary' : 'text-txt-primary line-through decoration-rose-300/50'}>{c.label}</span>
            </li>
          ))}
        </ul>
      )}
      {!eligible && alternates.length > 0 && (
        <div className="px-3 pb-3 border-t border-bdr-light pt-2">
          <div className="text-[10px] uppercase tracking-wider font-bold text-txt-tertiary mb-1.5">Try these instead</div>
          <div className="flex flex-col gap-1">
            {alternates.map((alt, i) => (
              <button
                key={i}
                onClick={() => onChip?.(`Tell me about the ${alt} course`)}
                className="text-left text-[12px] py-2 px-2.5 rounded-lg bg-surface-page hover:bg-primary-light/40 inline-flex items-center justify-between"
              >
                <span className="font-medium text-txt-primary">{alt}</span>
                <ArrowRight className="w-3.5 h-3.5 text-txt-tertiary" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
