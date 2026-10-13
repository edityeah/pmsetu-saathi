// TicketCard — grievance / support ticket status with timeline.
// "Status of my complaint?" / "Status of ticket #1245 raised on 8 October"

import { Hash, Clock, Check, AlertTriangle } from 'lucide-react'

const STATUS = {
  open:        { color: 'bg-amber-100 text-amber-700',     label: 'Open',        icon: Clock },
  in_progress: { color: 'bg-sky-100 text-sky-700',         label: 'In progress', icon: Clock },
  resolved:    { color: 'bg-emerald-100 text-emerald-700', label: 'Resolved',    icon: Check },
  escalated:   { color: 'bg-rose-100 text-rose-700',       label: 'Escalated',   icon: AlertTriangle },
}

export default function TicketCard({ card }) {
  const s = STATUS[card.status] || STATUS.open
  const Icon = s.icon
  const timeline = Array.isArray(card.timeline) ? card.timeline : []
  return (
    <div className="rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden">
      <div className="px-4 py-3 border-b border-bdr-light">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider font-bold text-txt-tertiary inline-flex items-center gap-1">
              <Hash className="w-3 h-3" />{card.id || 'Ticket'}
            </div>
            <div className="font-bold text-[13px] text-txt-primary mt-0.5 leading-tight">{card.subject}</div>
          </div>
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-pill ${s.color}`}>
            <Icon className="w-3 h-3" />{s.label}
          </span>
        </div>
      </div>
      {timeline.length > 0 && (
        <ol className="p-3 space-y-2 relative">
          {timeline.map((t, i) => (
            <li key={i} className="flex gap-3 text-[12px]">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                {i < timeline.length - 1 && <div className="flex-1 w-px bg-bdr-light" />}
              </div>
              <div className="flex-1 pb-1">
                <div className="text-txt-tertiary text-[10px] uppercase tracking-wider">{t.at}</div>
                <div className="text-txt-secondary">{t.note}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
