// JobsCard — open vacancies near the trainee.
// "Any jobs for my course?" / "Field Technician AC jobs in Patna with CTC above 2 lakh".

import { MapPin, IndianRupee, Briefcase, ChevronRight } from 'lucide-react'

export default function JobsCard({ card, onChip }) {
  const items = Array.isArray(card.items) ? card.items : []
  return (
    <div className="rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden">
      <div className="px-4 py-2.5 bg-gradient-to-r from-amber-50 to-white border-b border-bdr-light">
        <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">{card.title || 'Open jobs'}</div>
      </div>
      <ul className="divide-y divide-bdr-light">
        {items.map((j, i) => (
          <li key={i} className="p-3 flex gap-3 hover:bg-surface-page transition">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[13px] text-txt-primary leading-tight truncate">{j.role}</div>
              <div className="text-[11px] text-txt-secondary mt-0.5 font-medium">{j.employer}</div>
              <div className="text-[11px] text-txt-tertiary mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                {j.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{j.location}{typeof j.distanceKm === 'number' ? ` · ${j.distanceKm} km` : ''}</span>}
                {j.ctc && <span className="inline-flex items-center gap-1 text-emerald-700 font-medium"><IndianRupee className="w-3 h-3" />{j.ctc}</span>}
              </div>
            </div>
            <button
              onClick={() => onChip?.(`Apply to ${j.employer} for ${j.role}`)}
              className="self-center text-[11px] font-bold px-3 py-1.5 rounded-pill bg-primary text-white hover:opacity-90 active:scale-95 inline-flex items-center gap-1 flex-shrink-0"
            >
              Apply <ChevronRight className="w-3 h-3" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
