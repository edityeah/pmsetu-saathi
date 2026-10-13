// SkillGapCard — side-by-side "what you have" vs "what the role needs", with
// a "top three to learn next" call-out. Used for skill-gap-analysis style
// questions ("What should I learn next to become a Field Technician?").

import { Check, Plus, Target } from 'lucide-react'

export default function SkillGapCard({ card, onChip }) {
  const have = Array.isArray(card.have) ? card.have : []
  const need = Array.isArray(card.need) ? card.need : []
  const top3 = Array.isArray(card.topThree) ? card.topThree : []
  return (
    <div className="rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden">
      <div className="px-4 py-2.5 bg-gradient-to-r from-fuchsia-50 to-white border-b border-bdr-light">
        <div className="text-[11px] font-bold uppercase tracking-wider text-fuchsia-700 inline-flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5" />Skill gap
        </div>
        {card.targetRole && (
          <div className="font-bold text-[14px] text-txt-primary mt-0.5">For: {card.targetRole}</div>
        )}
      </div>

      <div className="p-3 grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 mb-1.5 inline-flex items-center gap-1">
            <Check className="w-3 h-3" />Skills you have
          </div>
          <ul className="space-y-1">
            {have.map((s, i) => (
              <li key={i} className="text-[12px] text-txt-primary inline-flex items-start gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" /><span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-rose-700 mb-1.5 inline-flex items-center gap-1">
            <Plus className="w-3 h-3" />Skills to add
          </div>
          <ul className="space-y-1">
            {need.map((s, i) => (
              <li key={i} className="text-[12px] text-txt-primary inline-flex items-start gap-1.5">
                <Plus className="w-3.5 h-3.5 text-rose-500 mt-0.5 flex-shrink-0" /><span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {top3.length > 0 && (
        <div className="px-3 pb-3 border-t border-bdr-light pt-2.5">
          <div className="text-[10px] uppercase tracking-wider font-bold text-primary mb-1.5">Learn these next</div>
          <ol className="space-y-1.5">
            {top3.map((s, i) => (
              <li key={i}>
                <button
                  onClick={() => onChip?.(`Find me a course for: ${s}`)}
                  className="w-full text-left text-[12px] py-2 px-2.5 rounded-lg bg-primary-light/40 hover:bg-primary-light text-txt-primary inline-flex items-start gap-2"
                >
                  <span className="text-primary font-bold flex-shrink-0">{i + 1}.</span>
                  <span>{s}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
