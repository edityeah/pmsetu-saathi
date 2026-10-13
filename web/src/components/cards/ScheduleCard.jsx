// ScheduleCard — today's / upcoming session timeline.
// "What's my schedule today?" / "When is my final exam?"

import { Clock, MapPin } from 'lucide-react'

export default function ScheduleCard({ card }) {
  const items = Array.isArray(card.items) ? card.items : []
  return (
    <div className="rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden">
      <div className="px-4 py-2.5 bg-gradient-to-r from-primary-light/60 to-white border-b border-bdr-light">
        <div className="text-[11px] font-bold uppercase tracking-wider text-primary">{card.title || 'Schedule'}</div>
      </div>
      {items.length === 0 ? (
        <div className="p-4 text-[12px] text-txt-secondary">No sessions on the schedule.</div>
      ) : (
        <ol className="relative">
          {items.map((it, i) => (
            <li key={i} className="flex gap-3 px-4 py-3 border-b border-bdr-light last:border-0">
              <div className="w-16 flex-shrink-0 text-right">
                <div className="text-[12px] font-bold text-primary">{it.time}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-txt-primary leading-tight">{it.title}</div>
                {it.location && (
                  <div className="text-[11px] text-txt-tertiary mt-0.5 inline-flex items-center gap-1">
                    <MapPin className="w-3 h-3" />{it.location}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
