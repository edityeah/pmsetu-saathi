// PlacementDrivesCard — upcoming campus / on-site placement drives.
// "Any placement drives coming up?" / "Voltas placement drive at my centre next week"

import { Calendar, MapPin, Building2 } from 'lucide-react'

export default function PlacementDrivesCard({ card, onChip }) {
  const items = Array.isArray(card.items) ? card.items : []
  return (
    <div className="rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden">
      <div className="px-4 py-2.5 bg-gradient-to-r from-violet-50 to-white border-b border-bdr-light">
        <div className="text-[11px] font-bold uppercase tracking-wider text-violet-700">{card.title || 'Upcoming placement drives'}</div>
      </div>
      <ul className="divide-y divide-bdr-light">
        {items.map((d, i) => (
          <li key={i} className="p-3 flex gap-3 hover:bg-surface-page transition">
            <div className="w-12 flex-shrink-0 text-center">
              <div className="text-[10px] uppercase tracking-wider text-violet-700 font-bold">{(d.date || '').split(' ')[1] || ''}</div>
              <div className="text-[18px] font-bold text-violet-900 leading-none">{(d.date || '').split(' ')[0] || '?'}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[13px] text-txt-primary leading-tight inline-flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-violet-700" />{d.employer}
              </div>
              <div className="text-[11px] text-txt-secondary mt-0.5">
                {(Array.isArray(d.roles) ? d.roles : []).join(', ')}
              </div>
              {d.location && (
                <div className="text-[11px] text-txt-tertiary mt-1 inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" />{d.location}
                </div>
              )}
            </div>
            <button
              onClick={() => onChip?.(`Register for the ${d.employer} drive on ${d.date}`)}
              className="self-center text-[11px] font-bold px-3 py-1.5 rounded-pill bg-violet-600 text-white hover:opacity-90 active:scale-95 flex-shrink-0"
            >
              Register
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
