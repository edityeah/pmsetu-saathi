// ActionPanelCard — the "now what?" surface for analysts. When Saathi
// surfaces a problem (lagging placement, anomalous TP, scheme drift), it
// pairs the chart with this card listing 2-4 concrete platform actions:
// broadcast, audit, nudge, schedule, ticket, etc.
//
// Each action has: { id, label, kind, severity, target }. We render them as
// chunky tappable rows with a severity dot and a per-kind icon. Tapping
// fires a toast (prototype) — real backend wiring is iteration 2.

import { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import {
  Megaphone, ShieldAlert, Bell, Calendar, FileWarning, ArrowRight,
  CheckCircle2, AlertTriangle, Mail,
} from 'lucide-react'

const KIND_META = {
  broadcast: { icon: Megaphone,    label: 'Broadcast',  color: 'text-violet-700 bg-violet-100' },
  audit:     { icon: ShieldAlert,  label: 'Audit',      color: 'text-rose-700   bg-rose-100' },
  nudge:     { icon: Bell,         label: 'Nudge',      color: 'text-amber-700  bg-amber-100' },
  meeting:   { icon: Calendar,     label: 'Schedule',   color: 'text-sky-700    bg-sky-100' },
  ticket:    { icon: FileWarning,  label: 'Ticket',     color: 'text-fuchsia-700 bg-fuchsia-100' },
  email:     { icon: Mail,         label: 'Email',      color: 'text-indigo-700 bg-indigo-100' },
}
const SEV_DOT = {
  high:   'bg-danger',
  medium: 'bg-amber-500',
  low:    'bg-emerald-500',
}

export default function ActionPanelCard({ card }) {
  const { showToast } = useApp() || {}
  const [fired, setFired] = useState({})  // id → true once tapped

  function trigger(action) {
    if (fired[action.id]) return
    setFired(f => ({ ...f, [action.id]: true }))
    const verb =
      action.kind === 'broadcast' ? 'Broadcast queued' :
      action.kind === 'audit'     ? 'Audit ticket raised' :
      action.kind === 'nudge'     ? 'Nudge sent' :
      action.kind === 'meeting'   ? 'Meeting requested' :
      action.kind === 'ticket'    ? 'Ticket filed' :
      action.kind === 'email'     ? 'Email queued' : 'Action queued'
    showToast?.({ kind: 'success', text: `${verb}${action.target ? ` · ${action.target}` : ''}` })
  }

  const actions = Array.isArray(card.actions) ? card.actions : []

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 shadow-card overflow-hidden">
      <div className="px-4 py-2.5 bg-gradient-to-r from-amber-50 to-white border-b border-amber-200">
        <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800 inline-flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />{card.title || 'Recommended actions'}
        </div>
        {card.reason && (
          <div className="text-[12px] text-txt-secondary mt-1">{card.reason}</div>
        )}
      </div>
      <ul className="divide-y divide-amber-100">
        {actions.map(a => {
          const meta = KIND_META[a.kind] || KIND_META.broadcast
          const Icon = meta.icon
          const isFired = !!fired[a.id]
          return (
            <li key={a.id}>
              <button
                onClick={() => trigger(a)}
                disabled={isFired}
                className="w-full text-left px-3 py-3 flex items-start gap-3 hover:bg-amber-100/40 transition disabled:opacity-60 disabled:cursor-default"
              >
                <span className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${SEV_DOT[a.severity] || SEV_DOT.medium}`} />
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-txt-tertiary">{meta.label}</div>
                  <div className="font-bold text-[13px] text-txt-primary leading-snug">{a.label}</div>
                  {a.target && <div className="text-[11px] text-txt-secondary mt-0.5 truncate">{a.target}</div>}
                </div>
                {isFired
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-1" />
                  : <ArrowRight className="w-3.5 h-3.5 text-txt-tertiary flex-shrink-0 mt-1.5" />}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
