// Support queue (Module B) — students flagged for repeated absence, low
// results, rechecks, and referrals they raised themselves. Owner, next
// action, due date; closed with an outcome.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Pill, Section, Loading, Btn, useLoad, Chips, fmtDate, stateKind, titleCase, inputCls } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

export default function SupportQueueCanvas() {
  const { role, showToast, openCanvas } = useApp()
  const { data, reload } = useLoad(() => api.support({}))
  const [reason, setReason] = useState('all')
  const [state, setState] = useState('open')
  const [reply, setReply] = useState({})
  useSaathiContext(data ? brief(data) : '', ['Who is overdue for follow-up?', 'Group the queue by reason and suggest an order.', 'Draft a reply to the open referral.'])
  if (!data) return <Loading />
  const { actions, referrals, byReason } = data
  const list = actions.filter(a => (reason === 'all' || a.reason === reason) && (state === 'all' ? true : state === 'open' ? a.state !== 'closed' : a.state === state))
  async function update(a, st) { await api.updateSupport(a.id, { state: st, outcome: st === 'closed' ? (reply[a.id] || 'Followed up') : undefined }); showToast({ kind: 'success', text: `${a.trainee.name}: ${st.replace(/_/g, ' ')}` }); reload() }
  async function respond(r, st) { await api.respondReferral(r.id, { state: st, response: reply[r.id] || undefined }); showToast({ kind: 'success', text: `Replied: ${st.replace(/_/g, ' ')}` }); reload() }
  const open = actions.filter(a => a.state !== 'closed')
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="rose" eyebrow="Support queue" title={`${open.length} students need follow-up · ${referrals.filter(r => ['sent', 'accepted'].includes(r.state)).length} referrals open`} subtitle="Flags come from attendance (repeated absence), marks (below 40%), practicals (needs re-practice) and students' own requests. Each has an owner and a next action." />
      <div className="p-4 space-y-4">
        <StatGrid>{Object.entries(byReason).map(([k, v]) => <Stat key={k} label={titleCase(k)} value={v} tone={k === 'repeated_absence' ? 'rose' : k === 'low_result' ? 'amber' : k === 'recheck_due' ? 'violet' : 'sky'} onClick={() => setReason(k)} />)}<Stat label="Overdue" value={open.filter(a => a.dueAt && new Date(a.dueAt) < new Date()).length} tone="rose" /></StatGrid>
        <div className="flex gap-3 flex-wrap"><Chips options={[{ id: 'all', label: 'All reasons' }, ...Object.keys(byReason).map(k => ({ id: k, label: titleCase(k) }))]} value={reason} onChange={setReason} /><Chips options={[{ id: 'open', label: 'Open' }, 'in_progress', 'closed', { id: 'all', label: 'All' }]} value={state} onChange={setState} /></div>
        <Section title="Actions">
          <ul className="space-y-2">{list.map(a => (
            <li key={a.id} className="rounded-xl border border-bdr-light bg-white p-2.5">
              <div className="flex items-start gap-2 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap"><button className="text-[13px] font-bold text-primary" onClick={() => openCanvas({ type: 'student_profile', traineeId: a.trainee.id })}>{a.trainee.name}</button><Pill kind={a.reason === 'repeated_absence' ? 'bad' : a.reason === 'low_result' ? 'warn' : 'violet'}>{titleCase(a.reason)}</Pill><Pill kind={stateKind(a.state)}>{a.state.replace(/_/g, ' ')}</Pill></div>
                  <div className="text-[11px] text-txt-secondary">{a.trainee.batch?.name} · {a.detail}</div>
                  <div className="text-[11px] mt-0.5"><b>Next:</b> {a.nextAction || '—'} · owner {a.owner?.name || '—'} · due <span className={a.dueAt && new Date(a.dueAt) < new Date() && a.state !== 'closed' ? 'text-rose-700 font-bold' : ''}>{fmtDate(a.dueAt)}</span></div>
                  {a.outcome && <div className="text-[11px] text-emerald-700">Outcome: {a.outcome}</div>}
                </div>
                {a.state !== 'closed' && (role === 'trainer' || role === 'iti_principal' || role === 'spv_ceo') && <div className="flex flex-col gap-1 min-w-[180px]"><input value={reply[a.id] || ''} onChange={e => setReply(r => ({ ...r, [a.id]: e.target.value }))} placeholder="Outcome / note" className={inputCls} /><div className="flex gap-1">{a.state === 'open' && <Btn small tone="ghost" onClick={() => update(a, 'in_progress')}>Start</Btn>}<Btn small tone="ok" onClick={() => update(a, 'closed')}>Close</Btn></div></div>}
              </div>
            </li>))}{list.length === 0 && <li className="text-[12px] text-txt-tertiary">Nothing in this filter.</li>}</ul>
        </Section>
        <Section title="Referrals from students" hint="What the student chose to share is shown; reply moves the state (accepted → contacted → action agreed → resolved).">
          <ul className="space-y-2">{referrals.map(r => (
            <li key={r.id} className="rounded-xl border border-bdr-light bg-white p-2.5">
              <div className="flex items-center gap-2 flex-wrap"><b className="text-[12px]">{r.trainee.name}</b><Pill kind="neutral">{titleCase(r.kind)}</Pill><Pill kind={stateKind(r.state)}>{r.state.replace(/_/g, ' ')}</Pill><span className="text-[10px] text-txt-tertiary">to {r.toUser?.name || r.toRole} · {fmtDate(r.createdAt)}</span></div>
              <div className="text-[12px] mt-0.5">{r.summary}</div>
              {r.shared && Object.keys(r.shared).length > 0 && <div className="text-[10px] text-txt-tertiary mt-0.5">Shared: {Object.entries(r.shared).map(([k, v]) => `${k}: ${v}`).join(' · ')}</div>}
              {r.response && <div className="text-[11px] text-emerald-700 mt-0.5">Reply: {r.response}</div>}
              {(role === 'trainer' || role === 'iti_principal') && r.state !== 'resolved' && <div className="mt-1.5 flex gap-1.5 flex-wrap items-center"><input value={reply[r.id] || ''} onChange={e => setReply(x => ({ ...x, [r.id]: e.target.value }))} placeholder="Reply to the student" className={`${inputCls} max-w-xs`} />{r.state === 'sent' && <Btn small tone="ghost" onClick={() => respond(r, 'accepted')}>Accept</Btn>}{['accepted'].includes(r.state) && <Btn small tone="ghost" onClick={() => respond(r, 'contacted')}>Contacted</Btn>}<Btn small tone="ghost" onClick={() => respond(r, 'action_agreed')}>Action agreed</Btn><Btn small tone="ok" onClick={() => respond(r, 'resolved')}>Resolve</Btn></div>}
            </li>))}{referrals.length === 0 && <li className="text-[12px] text-txt-tertiary">No referrals.</li>}</ul>
        </Section>
      </div>
    </div>
  )
}
