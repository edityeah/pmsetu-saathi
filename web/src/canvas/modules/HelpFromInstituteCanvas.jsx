// Help from institute (Module C, student) — the KB support directory for the
// student's ITI: who handles what, the consent step, and the expected
// response time. The student chooses what to share; the reply comes back here.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Pill, Section, Loading, Btn, useLoad, fmtDate, stateKind, titleCase, inputCls } from './_ui.jsx'
import { BookOpen, LifeBuoy, HeartHandshake, Mic, UserPen, CalendarClock, Scale } from 'lucide-react'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

// Support_Type (KB) → referral kind + recipient role in this app
const TYPE_MAP = {
  'Course counselling': { kind: 'counselling', toRole: 'counsellor', icon: HeartHandshake },
  'Learning support': { kind: 'doubt', toRole: 'trainer', icon: BookOpen },
  'Placement support': { kind: 'mock_interview', toRole: 'trainer', icon: Mic },
  'Attendance and timetable': { kind: 'registry_correction', toRole: 'principal', icon: CalendarClock },
  'Financial or accessibility guidance': { kind: 'support', toRole: 'principal', icon: LifeBuoy },
  'Grievance referral': { kind: 'support', toRole: 'principal', icon: Scale },
}

export default function HelpFromInstituteCanvas({ context }) {
  const { showToast, meExtra } = useApp()
  const { data, reload } = useLoad(() => api.referrals())
  const { data: kb } = useLoad(() => api.companionKb({}))
  const [sel, setSel] = useState(null)
  const [summary, setSummary] = useState(context?.summary || '')
  const [share, setShare] = useState({ attendance: true, marks: false, practicals: false })
  useSaathiContext(data && kb ? `Support directory: ${kb.support.map(c => `${c.supportType} → ${c.responsibleRole} (${c.responseTime}; consent: ${c.consentAction})`).join('; ')}. My requests: ${data.referrals.map(r => `${r.kind} to ${r.toUser?.name || r.toRole}: ${r.summary} [${r.state}]${r.response ? '; reply: ' + r.response : ''}`).join(' || ') || 'none'}.` : '', ['Kis se baat karun is problem ke liye?', 'Mera request ka kya hua?', 'Kya share hoga agar main bhejun?'])
  if (!data || !kb) return <Loading />
  const contacts = kb.support
  async function send(e) {
    e.preventDefault(); if (!sel || !summary) return
    const m = TYPE_MAP[sel.supportType] || { kind: 'support', toRole: 'principal' }
    const shared = { recipient: `${sel.responsibleRole} (${sel.supportType})`, attendance: share.attendance ? 'last 15 days' : 'not shared', marks: share.marks ? 'latest test' : 'not shared', practicals: share.practicals ? 'results' : 'not shared' }
    await api.createReferral({ kind: m.kind, summary, toRole: m.toRole, share: shared }); showToast({ kind: 'success', text: `Sent to the ${sel.responsibleRole}. Expected reply: ${sel.responseTime}.` }); setSel(null); setSummary(''); reload()
  }
  return (
    <div className="h-full overflow-y-auto bg-surface-page/40">
      <Hero tone="sky" eyebrow={`Help from ${meExtra?.trainee?.iti?.name || 'my institute'}`} title={`Aapka trainer: ${meExtra?.trainee?.batch?.lead?.name || '—'}`} subtitle="Pick who you need. Saathi shows exactly what it will share before sending, and tells you how long a reply usually takes." />
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{contacts.map(c => { const Icon = TYPE_MAP[c.supportType]?.icon || UserPen; return (
          <button key={c.id} onClick={() => setSel(c)} className={`text-left rounded-2xl border p-2.5 flex items-start gap-2 bg-white ${sel?.id === c.id ? 'border-primary' : 'border-bdr-light'}`}>
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0"><Icon className="w-4 h-4" /></div>
            <div className="min-w-0"><div className="font-bold text-[12px] leading-tight">{c.supportType}</div><div className="text-[10px] text-txt-secondary">{c.responsibleRole} · replies in {c.responseTime}</div><div className="text-[10px] text-txt-tertiary mt-0.5 line-clamp-2">{c.issuesHandled}</div></div>
          </button>) })}</div>
        {sel && (
          <form onSubmit={send} className="rounded-2xl border border-primary/30 bg-white p-3 space-y-2">
            <div className="text-[12px] font-bold">{sel.supportType} → {sel.responsibleRole}</div>
            <div className="text-[11px] text-txt-secondary">Consent step: <b>{sel.consentAction}</b> · channel {sel.contactChannel}</div>
            <textarea autoFocus value={summary} onChange={e => setSummary(e.target.value)} rows={3} placeholder="Kya chahiye? Ek-do line likho." className={inputCls} />
            <div className="text-[11px] text-txt-secondary">This will be shared:</div>
            <div className="flex gap-3 text-[12px] flex-wrap">{[['attendance', 'My attendance (15 days)'], ['marks', 'My latest marks'], ['practicals', 'My practical results']].map(([key, label]) => <label key={key} className="inline-flex items-center gap-1.5"><input type="checkbox" checked={share[key]} onChange={e => setShare(s => ({ ...s, [key]: e.target.checked }))} className="accent-primary" />{label}</label>)}</div>
            <div className="rounded-lg bg-surface-page p-2 text-[11px]"><b>Preview:</b> "{summary || '…'}" · to {sel.responsibleRole} · attendance {share.attendance ? 'shared' : 'not shared'} · marks {share.marks ? 'shared' : 'not shared'} · practicals {share.practicals ? 'shared' : 'not shared'}</div>
            <div className="flex justify-end gap-2"><Btn small tone="ghost" type="button" onClick={() => setSel(null)}>Cancel</Btn><Btn small type="submit">Confirm and send</Btn></div>
          </form>
        )}
        <Section tone="indigo" title="My requests">
          <ul className="space-y-2">{data.referrals.map(r => (
            <li key={r.id} className="rounded-xl border border-bdr-light bg-white p-2.5 text-[12px]">
              <div className="flex items-center gap-2 flex-wrap"><Pill kind="neutral">{titleCase(r.kind)}</Pill><Pill kind={stateKind(r.state)}>{r.state.replace(/_/g, ' ')}</Pill><span className="text-[10px] text-txt-tertiary">to {r.toUser?.name || r.shared?.recipient || r.toRole} · {fmtDate(r.createdAt)}</span></div>
              <div className="mt-0.5">{r.summary}</div>
              <div className="text-[10px] text-txt-tertiary">Shared: {Object.entries(r.shared || {}).filter(([k]) => k !== 'recipient').map(([k, v]) => `${k}: ${v}`).join(' · ') || 'note only'}</div>
              {r.response && <div className="mt-1 rounded-lg bg-emerald-50 text-emerald-800 p-2">{r.toUser?.name || 'Reply'}: {r.response}</div>}
              {!r.response && r.state === 'sent' && <div className="mt-1 text-[11px] text-txt-tertiary">Waiting for a reply. Saathi reminds them if nothing comes within the expected time.</div>}
            </li>))}{data.referrals.length === 0 && <li className="text-[12px] text-txt-tertiary">No requests yet.</li>}</ul>
        </Section>
      </div>
    </div>
  )
}
