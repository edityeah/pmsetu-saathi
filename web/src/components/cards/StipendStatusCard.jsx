// StipendStatusCard — month-by-month DBT payments timeline.
// "When will my stipend come?" / "Why didn't I get stipend this month?"

import { Check, Clock, AlertTriangle, IndianRupee } from 'lucide-react'

const STATUS = {
  paid:    { color: 'text-emerald-700 bg-emerald-50', icon: Check,          label: 'Paid' },
  pending: { color: 'text-amber-700 bg-amber-50',     icon: Clock,          label: 'Pending' },
  failed:  { color: 'text-rose-700 bg-rose-50',       icon: AlertTriangle,  label: 'Failed' },
}

export default function StipendStatusCard({ card }) {
  const months = Array.isArray(card.months) ? card.months : []
  const currency = card.currency || 'INR'
  return (
    <div className="rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden">
      <div className="p-4 flex items-center justify-between bg-gradient-to-br from-emerald-50 to-white border-b border-bdr-light">
        <div>
          <div className="text-[11px] uppercase tracking-wider font-bold text-emerald-700">Stipend received</div>
          <div className="text-[20px] font-bold text-txt-primary mt-0.5 inline-flex items-center">
            <IndianRupee className="w-4 h-4 mr-0.5 text-emerald-700" />{Number(card.totalReceived || 0).toLocaleString('en-IN')}
            <span className="text-[12px] text-txt-tertiary font-medium ml-1">{currency}</span>
          </div>
        </div>
        <div className="text-[11px] text-txt-tertiary">{months.length} month{months.length === 1 ? '' : 's'}</div>
      </div>
      <ul className="divide-y divide-bdr-light">
        {months.map((m, i) => {
          const s = STATUS[m.status] || STATUS.pending
          const Icon = s.icon
          return (
            <li key={i} className="p-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${s.color} flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[13px] text-txt-primary leading-tight">{m.month}</div>
                <div className="text-[11px] text-txt-tertiary mt-0.5">
                  {m.status === 'paid' && m.paidOn && <>Paid on {m.paidOn}</>}
                  {m.status === 'pending' && (m.note || 'Awaiting disbursal')}
                  {m.status === 'failed' && (m.note || 'Transfer failed — check bank link')}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[13px] font-bold text-txt-primary inline-flex items-center">
                  <IndianRupee className="w-3.5 h-3.5 mr-0.5" />{Number(m.amount || 0).toLocaleString('en-IN')}
                </div>
                <div className={`text-[10px] uppercase tracking-wider font-bold mt-0.5 ${s.color.split(' ')[0]}`}>{s.label}</div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
