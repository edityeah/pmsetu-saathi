// CourseListCard — list of course tiles for queries like
// "What courses can I do at my nearest centre?" / "Digital marketing course
// in my district?" / "Any free courses for me?".

import { Clock, BadgeCheck, MapPin, IndianRupee, ChevronRight } from 'lucide-react'

export default function CourseListCard({ card, onChip }) {
  const items = Array.isArray(card.items) ? card.items : []
  return (
    <div className="rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden">
      <div className="px-4 py-2.5 bg-gradient-to-r from-primary-light/60 to-white border-b border-bdr-light">
        <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
          {card.title || 'Courses'}
        </div>
      </div>
      <ul className="divide-y divide-bdr-light">
        {items.map((c, i) => (
          <li key={i} className="p-3 flex gap-3 hover:bg-surface-page transition">
            <div className="w-10 h-10 rounded-xl bg-primary-light text-primary-dark flex items-center justify-center flex-shrink-0 font-bold text-[13px]">
              {(c.name || '?').slice(0, 1)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[13px] text-txt-primary leading-tight truncate">{c.name}</div>
              <div className="text-[11px] text-txt-tertiary mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                {c.code && <span>QP {c.code}</span>}
                {c.ssc && <span>· {c.ssc}</span>}
              </div>
              <div className="text-[11px] text-txt-secondary mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                {c.hours && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{c.hours} hrs</span>}
                {c.mode && <span className="inline-flex items-center gap-1"><BadgeCheck className="w-3 h-3" />{c.mode}</span>}
                {c.centre && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{c.centre}</span>}
                {c.fee && <span className="inline-flex items-center gap-1 text-emerald-700 font-medium"><IndianRupee className="w-3 h-3" />{c.fee}</span>}
              </div>
            </div>
            <button
              onClick={() => onChip?.(`Tell me more about ${c.name}${c.code ? ' (' + c.code + ')' : ''}`)}
              className="self-center text-primary p-1 rounded-full hover:bg-primary-light flex-shrink-0"
              title="View details"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
