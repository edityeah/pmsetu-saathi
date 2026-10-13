// Updates & Alerts — notifications inbox (all roles).
//
// Rebuilt from a bare placeholder. Shows:
//   • Hero summary — unread count, urgent / high counts
//   • Filter chips (All / Unread / Urgent / Reminders / Broadcasts)
//   • Per-notification cards with priority pill, category, action button
//   • Mark-all-read action
//
// Data source: notifications from AppContext (refreshed via api.markRead / refreshNotifications).

import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { api } from '../../api/client.js'
import { dispatchActionForRole } from '../../nlp/dispatch.js'
import { Bell, AlertTriangle, AlertCircle, Megaphone, Clock, CheckCircle2, Calendar, Filter, Loader2 } from 'lucide-react'

const PRIORITY_STYLE = {
  urgent: { pill: 'bg-rose-100   text-rose-800   border-rose-200',   icon: AlertTriangle, label: 'Urgent' },
  high:   { pill: 'bg-amber-100  text-amber-800  border-amber-200',  icon: AlertCircle,   label: 'High'   },
  normal: { pill: 'bg-sky-100    text-sky-800    border-sky-200',    icon: Bell,          label: 'Info'   },
  low:    { pill: 'bg-slate-100  text-slate-700  border-slate-200',  icon: Bell,          label: 'Low'    },
}

const CATEGORY_LABEL = {
  tranche:              'Tranche readiness',
  milestone:            'IMA milestone',
  report:               'Report / AOP',
  placement:            'Placement',
  learning:             'Learning',
  tracer:               'On-job check-in',
  attendance:           'Attendance',
  civil:                'Civil works',
  curriculum:           'Curriculum',
  grievance:            'Grievance',
  scheme_announcement:  'Scheme update',
  broadcast:            'Broadcast',
  default:              'Notification',
}

function relativeTime(iso) {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export default function NotificationsCanvas() {
  const { notifications, refreshNotifications, openCanvas, showToast, role } = useApp()
  const [filter, setFilter] = useState('all')
  const [marking, setMarking] = useState(false)

  const counts = useMemo(() => {
    const all = notifications.length
    const unread = notifications.filter(n => !n.readAt).length
    const urgent = notifications.filter(n => n.priority === 'urgent').length
    const high = notifications.filter(n => n.priority === 'high').length
    return { all, unread, urgent, high }
  }, [notifications])

  const filtered = useMemo(() => {
    const sorted = [...notifications].sort((a, b) => {
      // Unread first, then by createdAt desc
      const aUnread = !a.readAt ? 1 : 0
      const bUnread = !b.readAt ? 1 : 0
      if (aUnread !== bUnread) return bUnread - aUnread
      const ta = new Date(a.createdAt || a.scheduledAt || 0).getTime()
      const tb = new Date(b.createdAt || b.scheduledAt || 0).getTime()
      return tb - ta
    })
    if (filter === 'unread')     return sorted.filter(n => !n.readAt)
    if (filter === 'urgent')     return sorted.filter(n => n.priority === 'urgent' || n.priority === 'high')
    if (filter === 'reminders')  return sorted.filter(n => n.type === 'reminder')
    if (filter === 'broadcasts') return sorted.filter(n => n.type === 'broadcast' || n.category === 'broadcast')
    return sorted
  }, [notifications, filter])

  async function read(n) {
    if (!n.readAt) {
      try { await api.markRead(n.id) } catch {}
      refreshNotifications()
    }
  }
  function act(n) {
    read(n)
    if (n.action?.type) {
      dispatchActionForRole({ actionId: n.action.type, entities: n.action.payload || {}, role, openCanvas, showToast })
    }
  }
  async function markAllRead() {
    setMarking(true)
    try {
      await Promise.all(notifications.filter(n => !n.readAt).map(n => api.markRead(n.id).catch(() => {})))
      refreshNotifications()
    } finally {
      setMarking(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Hero */}
      <div className="px-5 pt-5 pb-4 bg-gradient-to-br from-indigo-50/70 via-white to-white border-b border-bdr-light">
        <div className="text-[11px] font-bold uppercase tracking-[2px] text-indigo-700 inline-flex items-center gap-1">
          <Bell className="w-3 h-3" /> Updates & Alerts
        </div>
        <h2 className="text-[22px] font-bold text-txt-primary leading-tight mt-1">
          {counts.unread > 0
            ? `${counts.unread} unread update${counts.unread === 1 ? '' : 's'}`
            : counts.all > 0 ? 'All caught up' : 'No notifications yet'}
        </h2>
        <div className="text-[12px] text-txt-secondary mt-1">
          IMA queries, tranche deadlines, placement confirmations, learning reminders and SPV broadcasts land here in real time.
        </div>

        {counts.all > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            <SummaryTile label="Unread" value={counts.unread} tone={counts.unread > 0 ? 'amber' : 'emerald'} />
            <SummaryTile label="Urgent" value={counts.urgent} tone={counts.urgent > 0 ? 'rose' : 'slate'} />
            <SummaryTile label="High"   value={counts.high}   tone={counts.high > 0 ? 'amber' : 'slate'} />
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Filters + mark-all-read */}
        {counts.all > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[10px] uppercase tracking-wider font-bold text-txt-tertiary inline-flex items-center gap-1 mr-1">
              <Filter className="w-3 h-3" /> Filter
            </div>
            {[
              { key: 'all',        label: 'All',         n: counts.all },
              { key: 'unread',     label: 'Unread',      n: counts.unread },
              { key: 'urgent',     label: 'Urgent + High', n: counts.urgent + counts.high },
              { key: 'reminders',  label: 'Reminders',   n: notifications.filter(x => x.type === 'reminder').length },
              { key: 'broadcasts', label: 'Broadcasts',  n: notifications.filter(x => x.type === 'broadcast' || x.category === 'broadcast').length },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`text-[11px] px-2.5 py-1 rounded-pill border ${filter === f.key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-bdr text-txt-secondary hover:border-indigo-400'}`}>
                {f.label}{f.n > 0 && <span className={`ml-1 ${filter === f.key ? 'opacity-80' : 'text-txt-tertiary'}`}>· {f.n}</span>}
              </button>
            ))}
            {counts.unread > 0 && (
              <button onClick={markAllRead} disabled={marking}
                className="ml-auto text-[11px] inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-white border border-bdr text-txt-primary hover:border-indigo-400 disabled:opacity-50">
                {marking ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                Mark all read
              </button>
            )}
          </div>
        )}

        {/* Empty state */}
        {counts.all === 0 && (
          <div className="rounded-2xl border border-dashed border-bdr-light bg-surface-page/40 p-8 text-center">
            <Bell className="w-6 h-6 text-txt-tertiary mx-auto" />
            <div className="text-[14px] font-bold text-txt-primary mt-2">No notifications yet</div>
            <div className="text-[12px] text-txt-secondary mt-1 leading-snug max-w-md mx-auto">
              You'll get alerts here when there's a milestone to verify, a placement to confirm, a check-in due,
              a scheme deadline coming up, or a broadcast from the SPV or your ITI.
            </div>
          </div>
        )}

        {/* Filter applied but no matches */}
        {counts.all > 0 && filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-bdr-light bg-surface-page/40 p-6 text-center text-[12px] text-txt-secondary">
            Nothing in this filter. Try "All" to see everything.
          </div>
        )}

        {/* List */}
        {filtered.length > 0 && (
          <div className="space-y-2.5">
            {filtered.map(n => (
              <NotificationCard key={n.id} n={n} onRead={() => read(n)} onAct={() => act(n)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NotificationCard({ n, onRead, onAct }) {
  const p = PRIORITY_STYLE[n.priority] || PRIORITY_STYLE.normal
  const PIcon = p.icon
  const isUnread = !n.readAt
  const category = CATEGORY_LABEL[n.category] || CATEGORY_LABEL.default

  return (
    <div onClick={onRead}
      className={`relative rounded-2xl border bg-white p-3.5 cursor-pointer transition shadow-card ${
        isUnread ? 'border-indigo-300 ring-1 ring-indigo-200/50' : 'border-bdr-light'
      }`}>
      {isUnread && <span className="absolute -left-1 top-4 w-1.5 h-1.5 rounded-full bg-indigo-500" />}

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider font-bold text-txt-tertiary">{category}</span>
            {(n.priority === 'urgent' || n.priority === 'high') && (
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-pill border text-[10px] font-bold ${p.pill}`}>
                <PIcon className="w-3 h-3" /> {p.label}
              </span>
            )}
            {n.type === 'broadcast' && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-pill border bg-violet-100 text-violet-800 border-violet-200 text-[10px] font-bold">
                <Megaphone className="w-3 h-3" /> Broadcast
              </span>
            )}
          </div>
          <div className="text-[14px] font-bold text-txt-primary mt-1 leading-snug">{n.title}</div>
          {n.message && <div className="text-[12px] text-txt-secondary mt-0.5 leading-snug">{n.message}</div>}
          <div className="text-[10px] text-txt-tertiary mt-1.5 inline-flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {relativeTime(n.createdAt || n.scheduledAt)}</span>
            {n.scheduledAt && n.scheduledAt !== n.createdAt && (
              <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> Due {new Date(n.scheduledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
            )}
          </div>
        </div>
      </div>

      {n.action && (
        <div className="mt-3 pt-3 border-t border-bdr-light/60 flex items-center justify-between">
          <button onClick={(e) => { e.stopPropagation(); onAct() }}
            className="px-3 py-1.5 rounded-pill bg-indigo-600 text-white text-[12px] font-bold hover:opacity-90">
            {n.action.label || 'Open'}
          </button>
          {isUnread && <span className="text-[10px] text-txt-tertiary">tap card to mark read</span>}
        </div>
      )}
    </div>
  )
}

const SUMMARY_TONE = {
  emerald: { ring: 'border-emerald-200', val: 'text-emerald-700', bg: 'bg-emerald-50/50' },
  amber:   { ring: 'border-amber-200',   val: 'text-amber-700',   bg: 'bg-amber-50/50' },
  rose:    { ring: 'border-rose-200',    val: 'text-rose-700',    bg: 'bg-rose-50/50' },
  slate:   { ring: 'border-slate-200',   val: 'text-slate-700',   bg: 'bg-slate-50/50' },
}
function SummaryTile({ label, value, tone }) {
  const t = SUMMARY_TONE[tone] || SUMMARY_TONE.slate
  return (
    <div className={`rounded-xl border ${t.ring} ${t.bg} px-3 py-2`}>
      <div className="text-[10px] uppercase tracking-wider font-bold text-txt-tertiary">{label}</div>
      <div className={`text-[20px] font-bold leading-tight ${t.val}`}>{value}</div>
    </div>
  )
}
