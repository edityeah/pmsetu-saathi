// Attendance bot (Module B) — one session at a time. Five marks (present,
// absent, late, excused, roster issue), delivery status kept separate,
// offline save, principal confirm/return. Nothing counts until submitted.
import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Pill, Section, Loading, Btn, useLoad, Chips, fmtDate, stateKind, titleCase, inputCls } from './_ui.jsx'
import { Check, X, Clock, FileQuestion, AlertTriangle, WifiOff, Wifi } from 'lucide-react'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

const MARKS = [['present', Check, 'bg-emerald-500'], ['late', Clock, 'bg-amber-500'], ['excused', FileQuestion, 'bg-sky-500'], ['absent', X, 'bg-rose-500'], ['roster_issue', AlertTriangle, 'bg-violet-500']]

export default function AttendanceBotCanvas({ context }) {
  const { role, showToast } = useApp()
  const isPrincipal = role === 'iti_principal' || role === 'spv_ceo'
  const [filter, setFilter] = useState(isPrincipal ? 'submitted' : 'open')
  const { data: list, reload: reloadList } = useLoad(() => api.sessions({ from: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10) }))
  const [sessionId, setSessionId] = useState(context?.sessionId || null)
  const { data, reload } = useLoad(() => sessionId ? api.session(sessionId) : Promise.resolve(null), [sessionId])
  const [marks, setMarks] = useState({})
  const [reasons, setReasons] = useState({})
  const [offline, setOffline] = useState(false)
  const [delivery, setDelivery] = useState('delivered')
  const [deliveryReason, setDeliveryReason] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (!data) return; const m = {}, r = {}; for (const t of data.roster) { m[t.id] = t.mark?.status || 'present'; if (t.mark?.reason) r[t.id] = t.mark.reason }; setMarks(m); setReasons(r); setDelivery(data.session.delivery === 'scheduled' ? 'delivered' : data.session.delivery) }, [data])
  useSaathiContext(list ? `Sessions (last 10 days, my scope): ${list.sessions.slice(0, 40).map(s => `${String(s.date).slice(0, 10)} ${s.startTime} ${s.batch.name} ${s.subject.name}: delivery ${s.delivery}, attendance ${s.attendanceState}${s.presentCount != null ? ` ${s.presentCount}/${(s.presentCount || 0) + (s.absentCount || 0)}` : ''}${s.syncState === 'saved_on_device' ? ' (on device)' : ''}`).join('; ')}. ${data ? `Open session ${data.session.batch.name} ${data.session.subject.name} ${String(data.session.date).slice(0, 10)}: state ${data.session.attendanceState}, roster ${data.roster.length}, students with repeated absence: ${data.roster.filter(t => t.recent.absent >= 4).map(t => t.name).join(', ') || 'none'}.` : ''}` : '', ['Which sessions are not reported yet?', 'Who has been absent repeatedly in this batch?', 'What does roster issue mean and who resolves it?'])
  if (!list) return <Loading />
  const sessions = list.sessions.filter(s => filter === 'all' ? true : filter === 'open' ? s.attendanceState === 'not_reported' && !['cancelled', 'rescheduled'].includes(s.delivery) : filter === 'submitted' ? ['submitted', 'needs_review'].includes(s.attendanceState) : s.attendanceState === filter)
  const active = sessionId ? data : null
  const counts = active ? Object.values(marks).reduce((a, v) => { a[v] = (a[v] || 0) + 1; return a }, {}) : {}
  const locked = active && active.session.attendanceState === 'confirmed' && !isPrincipal

  async function submit() {
    if (!active) return
    setSaving(true)
    try {
      if (delivery === 'cancelled' || delivery === 'rescheduled') { await api.sessionDelivery(active.session.id, { delivery, reason: deliveryReason || 'No reason given' }); showToast({ kind: 'success', text: `Session marked ${delivery}. No attendance recorded.` }) }
      else { const r = await api.submitAttendance(active.session.id, { marks: active.roster.map(t => ({ traineeId: t.id, status: marks[t.id] || 'present', reason: reasons[t.id] || undefined })), captureMethod: offline ? 'offline_sync' : 'trainer_mobile', offline, delivery }); showToast({ kind: 'success', text: offline ? 'Saved on device. Will sync when online.' : r.session.attendanceState === 'needs_review' ? 'Submitted — roster issue flagged for the principal.' : 'Attendance submitted.' }) }
      reload(); reloadList()
    } catch (e) { showToast({ kind: 'danger', text: e.message }) } finally { setSaving(false) }
  }
  async function sync() { await api.sessionSync(active.session.id); showToast({ kind: 'success', text: 'Synced.' }); reload(); reloadList() }
  async function confirm(decision) { await api.sessionConfirm(active.session.id, { decision, note: decision === 'return' ? 'Please re-check the roster issue and resubmit.' : undefined }); showToast({ kind: 'success', text: decision === 'confirm' ? 'Confirmed.' : 'Returned to trainer.' }); reload(); reloadList() }

  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="amber" eyebrow={isPrincipal ? 'Attendance review' : 'Attendance bot'} title={active ? `${active.session.batch.name}` : isPrincipal ? 'Sessions submitted by trainers' : 'Pick a session'} subtitle={active ? `${active.session.subject.name} · ${fmtDate(active.session.date)} ${active.session.startTime} · ${active.session.room} · ${active.session.trainer?.name || 'no trainer named'}` : 'One session at a time. Delivery status (delivered / partial / rescheduled / cancelled) is recorded separately from who was present.'}
        right={<div className="flex items-center gap-2"><button onClick={() => setOffline(o => !o)} className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-pill text-[10px] font-bold border ${offline ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-white border-bdr text-txt-secondary'}`}>{offline ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}{offline ? 'Offline mode' : 'Online'}</button></div>} />
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] min-h-0">
        <div className="border-b lg:border-b-0 lg:border-r border-bdr-light p-3 space-y-2 max-h-[40vh] lg:max-h-none overflow-y-auto">
          <Chips options={[{ id: 'open', label: 'Not reported' }, { id: 'submitted', label: 'Submitted' }, { id: 'needs_review', label: 'Needs review' }, { id: 'confirmed', label: 'Confirmed' }, { id: 'all', label: 'All' }]} value={filter} onChange={setFilter} />
          <ul className="space-y-1.5">{sessions.slice(0, 60).map(s => (
            <li key={s.id}><button onClick={() => setSessionId(s.id)} className={`w-full text-left rounded-xl border p-2 ${sessionId === s.id ? 'border-primary bg-primary-light/30' : 'border-bdr-light bg-white'}`}>
              <div className="text-[11px] font-bold truncate">{s.batch.name}</div>
              <div className="text-[10px] text-txt-secondary truncate">{fmtDate(s.date)} {s.startTime} · {s.subject.name}{isPrincipal && s.trainer ? ` · ${s.trainer.name}` : ''}</div>
              <div className="mt-1 flex gap-1 flex-wrap"><Pill kind={stateKind(s.delivery)}>{s.delivery}</Pill><Pill kind={s.attendanceState === 'not_reported' ? 'info' : stateKind(s.attendanceState)}>{s.attendanceState.replace(/_/g, ' ')}</Pill>{s.syncState === 'saved_on_device' && <Pill kind="warn">on device</Pill>}{s.presentCount != null && <span className="text-[10px] text-txt-tertiary">{s.presentCount}/{(s.presentCount || 0) + (s.absentCount || 0)}</span>}</div>
            </button></li>))}{sessions.length === 0 && <li className="text-[12px] text-txt-tertiary p-2">No sessions in this filter.</li>}</ul>
        </div>
        <div className="p-4 space-y-4">
          {!active ? <div className="text-[12px] text-txt-tertiary">Select a session on the left.</div> : (<>
            <StatGrid>
              <Stat label="Present" value={`${(counts.present || 0) + (counts.late || 0)}/${active.roster.length}`} sub={`${counts.late || 0} late`} tone="emerald" />
              <Stat label="Absent" value={counts.absent || 0} sub={`${counts.excused || 0} excused`} tone={counts.absent ? 'rose' : 'emerald'} />
              <Stat label="Roster issues" value={counts.roster_issue || 0} sub="goes to principal" tone={counts.roster_issue ? 'violet' : 'slate'} />
              <Stat label="State" value={titleCase(active.session.attendanceState)} sub={active.session.syncState === 'saved_on_device' ? 'saved on device' : active.session.captureMethod ? titleCase(active.session.captureMethod) : 'not submitted'} tone="sky" />
            </StatGrid>
            <Section title="Delivery status" hint="Was the session held? Cancelled or rescheduled sessions record no attendance.">
              <div className="flex gap-2 flex-wrap items-center"><Chips options={['delivered', 'partial', 'rescheduled', 'cancelled']} value={delivery} onChange={setDelivery} />{(delivery === 'partial' || delivery === 'rescheduled' || delivery === 'cancelled') && <input value={deliveryReason} onChange={e => setDeliveryReason(e.target.value)} placeholder="Reason (power cut, trainer leave, room…)" className={`${inputCls} max-w-xs`} />}</div>
              {active.session.deliveryReason && <div className="text-[11px] text-txt-secondary mt-1">Recorded: {active.session.deliveryReason}</div>}
            </Section>
            {delivery !== 'cancelled' && delivery !== 'rescheduled' && (
              <Section title={`Register · ${active.roster.length} students`} hint="Tap a mark. Roster issue = student not in this batch any more, or missing from the list." right={!locked && <div className="flex gap-1"><Btn small tone="ghost" onClick={() => setMarks(Object.fromEntries(active.roster.map(t => [t.id, 'present'])))}>All present</Btn>{!isPrincipal && <Btn small onClick={submit} disabled={saving}>{saving ? 'Saving…' : offline ? 'Save on device' : 'Submit'}</Btn>}</div>}>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {active.roster.map(t => { const m = marks[t.id] || 'present'; return (
                    <li key={t.id} className="rounded-xl border border-bdr-light px-2.5 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0"><div className="text-[12px] font-semibold truncate">{t.name}</div><div className="text-[10px] text-txt-tertiary">{t.recent.pct == null ? 'no history' : `${t.recent.pct}% · 15d`}{t.recent.absent >= 4 ? ' · ⚠ repeated absence' : ''}{t.mark?.correctedAt ? ' · corrected' : ''}</div></div>
                        <div className="flex rounded-pill bg-surface-page p-0.5">{MARKS.map(([v, Icon, bg]) => <button key={v} disabled={locked} title={titleCase(v)} onClick={() => setMarks(x => ({ ...x, [t.id]: v }))} className={`w-7 h-7 rounded-pill flex items-center justify-center ${m === v ? `${bg} text-white` : 'text-txt-tertiary'}`}><Icon className="w-3.5 h-3.5" /></button>)}</div>
                      </div>
                      {(m === 'excused' || m === 'roster_issue') && <input value={reasons[t.id] || ''} onChange={e => setReasons(r => ({ ...r, [t.id]: e.target.value }))} placeholder={m === 'excused' ? 'Reason (medical, family…)' : 'What is wrong with the roster?'} className="mt-1.5 w-full rounded-lg border border-bdr px-2 py-1 text-[11px]" />}
                    </li>) })}
                </ul>
              </Section>
            )}
            <div className="flex gap-2 justify-end flex-wrap">
              {(delivery === 'cancelled' || delivery === 'rescheduled') && !isPrincipal && <Btn onClick={submit} disabled={saving}>Record {delivery}</Btn>}
              {active.session.syncState === 'saved_on_device' && !isPrincipal && <Btn tone="amber" onClick={sync}><Wifi className="w-3.5 h-3.5" /> Sync now</Btn>}
              {isPrincipal && ['submitted', 'needs_review'].includes(active.session.attendanceState) && <><Btn tone="danger" onClick={() => confirm('return')}>Return to trainer</Btn><Btn tone="ok" onClick={() => confirm('confirm')}>Confirm</Btn></>}
              {isPrincipal && active.session.attendanceState === 'confirmed' && <Pill kind="ok">confirmed {fmtDate(active.session.confirmedAt)}</Pill>}
            </div>
          </>)}
        </div>
      </div>
    </div>
  )
}
