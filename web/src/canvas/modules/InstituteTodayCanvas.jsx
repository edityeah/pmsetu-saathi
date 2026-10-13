// Institute today (Module B, principal) — coverage before averages: which
// classes reported, which did not, who is on leave, what needs review, and
// the support queue. Missing data is shown as missing.
import { useState } from 'react'
import KpiGridCard from '../../components/cards/KpiGridCard.jsx'
import LineChartCard from '../../components/cards/LineChartCard.jsx'
import BarChartCard from '../../components/cards/BarChartCard.jsx'
import AnalystCanvasShell from './_AnalystCanvasShell.jsx'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading, Section, Table, Pill, Btn, fmtDate, fmtPct, stateKind, titleCase, NoFeed } from './_ui.jsx'

export default function InstituteTodayCanvas({ context }) {
  const { role, openCanvas, showToast } = useApp()
  const { data: itis } = useLoad(() => api.itis())
  const [itiId, setItiId] = useState(context?.itiId || undefined)
  const { data, reload } = useLoad(() => api.instituteToday(itiId), [itiId])
  if (!data) return <Loading />
  const canSwitch = role !== 'iti_principal' && role !== 'trainer' && itis
  const filter = canSwitch ? <select value={itiId || ''} onChange={e => setItiId(e.target.value || undefined)} className="text-[12px] rounded-lg border border-bdr px-2 py-1.5 bg-white">{itis.itis.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select> : null
  if (!data.registryConnected) return (
    <AnalystCanvasShell eyebrow={`${data.iti.name} · operations`} title="No registry feed yet." subtitle={data.note} toneClass="from-amber-50/70 via-white to-white" filterSlot={filter} saathiTitle="Saathi · Institute" saathiContext={`${data.iti.name} has no registry connection; operations data unavailable.`} threadId={context?.threadId}
      cells={[{ node: <NoFeed>{data.note} Until then this ITI's attendance, assessments and support figures are blank, not zero. Plan data (budget, tasks, gates) is in the institute profile.</NoFeed>, prompt: 'What do we need to connect this ITI to the registry?' }]} quickAsks={['What is needed for the registry connection?']} />
  )
  const { iti, today, trainees, batches, sessionsToday, todayStats, coverage, attendancePct, trend, byProgramme, classesWithoutReport, leave, needsReview, assessments, issues, findings, support } = data
  async function confirm(s, decision) { await api.sessionConfirm(s.id, { decision }); showToast({ kind: 'success', text: decision === 'confirm' ? 'Confirmed' : 'Returned' }); reload() }
  const grid = { title: `${new Date(today).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · ${trainees.toLocaleString('en-IN')} students · ${batches} running batches`, items: [
    { label: 'Sessions today', value: `${todayStats.reported}/${todayStats.scheduled}`, hint: 'reported so far', tone: 'indigo', onClick: () => openCanvas({ type: 'attendance_bot' }) },
    { label: 'Coverage (15 days)', value: fmtPct(coverage.pct), hint: `${coverage.reported} of ${coverage.scheduled} sessions reported · ${coverage.confirmed} confirmed`, tone: coverage.pct >= 90 ? 'emerald' : 'amber' },
    { label: 'Attendance (reported)', value: fmtPct(attendancePct), hint: 'present ÷ (present + absent), reported sessions only', tone: attendancePct >= 85 ? 'emerald' : 'amber' },
    { label: 'Classes silent', value: classesWithoutReport.length, hint: '≥3 days without a report', tone: classesWithoutReport.length ? 'rose' : 'emerald' },
    { label: 'Trainers on leave / late', value: leave.length, hint: leave.map(l => l.trainer.name.split(' ')[0]).join(', ') || 'none', tone: leave.length ? 'amber' : 'emerald' },
    { label: 'Attendance to review', value: needsReview.length, hint: 'roster issues flagged', tone: needsReview.length ? 'violet' : 'emerald', onClick: () => openCanvas({ type: 'attendance_bot' }) },
    { label: 'Marks to review', value: assessments.needsReview.length, hint: `${assessments.marksPending} plans still without marks`, tone: assessments.needsReview.length ? 'amber' : 'emerald', onClick: () => openCanvas({ type: 'assessments', tab: 'review' }) },
    { label: 'Support queue', value: support.open, hint: `${support.overdue} overdue · ${support.referralsOpen} referrals`, tone: support.overdue ? 'rose' : 'sky', onClick: () => openCanvas({ type: 'support_queue' }) },
  ] }
  const line = { title: 'Attendance by day (reported sessions)', yAxis: '% present', series: [{ name: 'Present %', color: 'primary', data: trend }] }
  const prog = { title: 'Attendance by programme (15 days)', unit: '%', orient: 'horizontal', data: byProgramme.sort((a, b) => (a.pct || 0) - (b.pct || 0)).map(p => ({ label: `${p.trade} (${p.sessions})`, value: p.pct || 0, color: (p.pct || 0) < 80 ? 'rose' : (p.pct || 0) < 88 ? 'amber' : 'emerald' })) }
  const silent = (
    <Section title="Classes without a report" hint="No attendance submitted for 3+ working days, or 2+ unreported sessions. Check the trainer, the device, or the timetable." right={<button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'attendance_bot' })}>Open attendance →</button>}>
      <Table columns={[{ key: 'name', label: 'Batch', render: r => <div><div className="font-semibold">{r.name}</div><div className="text-[10px] text-txt-tertiary">{r.tradeId} · lead {r.lead?.name || '—'} · {r._count.trainees} students</div></div> }, { key: 'lastReportAt', label: 'Last report', render: r => r.lastReportAt ? fmtDate(r.lastReportAt) : 'never' }, { key: 'daysSince', label: 'Days', align: 'right', render: r => <b className="text-rose-700">{r.daysSince >= 99 ? '—' : r.daysSince}</b> }, { key: 'unreported', label: 'Unreported sessions', align: 'right' }]} rows={classesWithoutReport} empty="Every class has reported in the last 3 days." />
    </Section>
  )
  const review = (
    <Section title="Awaiting your confirmation" hint="Attendance with roster issues, and marks entered by trainers.">
      <ul className="space-y-1.5 text-[12px]">
        {needsReview.map(s => <li key={s.id} className="flex items-center gap-2"><Pill kind="violet">roster issue</Pill><span className="flex-1 truncate">{fmtDate(s.date)} · {s.batch.name} · {s.subject.name}</span><Btn small tone="ghost" onClick={() => openCanvas({ type: 'attendance_bot', sessionId: s.id })}>Open</Btn><Btn small tone="ok" onClick={() => confirm(s, 'confirm')}>Confirm</Btn></li>)}
        {assessments.needsReview.map(a => <li key={a.id} className="flex items-center gap-2"><Pill kind={stateKind(a.state)}>{a.state.replace(/_/g, ' ')}</Pill><span className="flex-1 truncate">{a.title} · {a.batch.name} · {a._count.entries} entries</span><Btn small tone="ghost" onClick={() => openCanvas({ type: 'assessments', tab: 'review', planId: a.id })}>Review</Btn></li>)}
        {needsReview.length + assessments.needsReview.length === 0 && <li className="text-txt-tertiary">Nothing waiting.</li>}
      </ul>
    </Section>
  )
  const todayList = (
    <Section title={`Today's timetable · ${sessionsToday.length} sessions`} hint="Trainer on leave = cover needed.">
      <Table columns={[{ key: 'startTime', label: 'Time' }, { key: 'batch', label: 'Batch', render: r => <div><div className="font-semibold">{r.batch.name}</div><div className="text-[10px] text-txt-tertiary">{r.subject.name} · {r.room}</div></div> }, { key: 'trainer', label: 'Trainer', render: r => <span className={leave.some(l => l.trainer.id === r.trainer?.id) ? 'text-rose-700 font-bold' : ''}>{r.trainer?.name || '—'}{leave.some(l => l.trainer.id === r.trainer?.id) ? ' · on leave' : ''}</span> }, { key: 'delivery', label: 'Delivery', render: r => <Pill kind={stateKind(r.delivery)}>{r.delivery}</Pill> }, { key: 'attendanceState', label: 'Attendance', render: r => <Pill kind={r.attendanceState === 'not_reported' ? 'info' : stateKind(r.attendanceState)}>{r.attendanceState.replace(/_/g, ' ')}</Pill> }]} rows={sessionsToday} />
    </Section>
  )
  const issuesBox = (
    <Section title="Issues and findings" right={<button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'daily_ops' })}>Daily ops →</button>}>
      <ul className="space-y-1.5 text-[12px]">{issues.slice(0, 6).map(i => <li key={i.id} className="flex items-center gap-2"><Pill kind={i.severity === 'high' ? 'bad' : 'warn'}>{i.category}</Pill><span className="flex-1 truncate">{i.title}</span><span className="text-[10px] text-txt-tertiary">{i.ownerRole}</span></li>)}{findings.slice(0, 4).map(f => <li key={f.id} className="flex items-center gap-2"><Pill kind="neutral">finding</Pill><span className="flex-1 truncate">{f.item} · {f.visit.workshop}</span><span className="text-[10px] text-txt-tertiary">{fmtDate(f.dueAt)}</span></li>)}{issues.length + findings.length === 0 && <li className="text-txt-tertiary">None open.</li>}</ul>
    </Section>
  )
  const saathiContext = `Institute today for ${iti.name}: sessions today ${todayStats.reported}/${todayStats.scheduled} reported; 15-day coverage ${coverage.pct}% (${coverage.reported}/${coverage.scheduled}); attendance ${attendancePct}% on reported sessions; silent classes ${classesWithoutReport.map(b => `${b.name} (${b.daysSince}d)`).join(', ') || 'none'}; trainers on leave ${leave.map(l => l.trainer.name).join(', ') || 'none'}; attendance needing review ${needsReview.length}; assessments needing review ${assessments.needsReview.length}, marks pending ${assessments.marksPending}; open issues ${issues.length}; support open ${support.open} (${JSON.stringify(support.byReason)}).`
  return (
    <AnalystCanvasShell eyebrow={`${iti.name} · principal ${iti.principal?.name || ''}`} title="What needs you today." subtitle="Coverage first, then averages. A class with no report is a gap to chase." toneClass="from-indigo-50/70 via-white to-white" filterSlot={filter} refreshedOn={new Date().toLocaleDateString('en-IN')} saathiTitle="Saathi · Institute" saathiContext={saathiContext} threadId={context?.threadId}
      cells={[
        { node: <KpiGridCard card={grid} />, prompt: 'What are the three things I should act on before noon?' },
        { node: silent, prompt: 'Why might these classes be silent and what should I check first?', span: 'half' },
        { node: review, prompt: 'Summarise what is waiting for my confirmation.', span: 'half' },
        { node: todayList, prompt: 'Which sessions today lack a trainer and who could cover?' },
        { node: <LineChartCard card={line} />, prompt: 'Is attendance trending down anywhere this fortnight?', span: 'half' },
        { node: <BarChartCard card={prog} />, prompt: 'Which programme has the weakest attendance and what does Student Voice say about it?', span: 'half' },
        { node: issuesBox, prompt: 'Which open issues are blocking practicals?', span: 'half' },
      ]}
      quickAsks={['Which classes have not reported since Monday?', 'Who is on leave and which sessions are affected?', 'Draft a message to batch leads about pending attendance.', 'What does the support queue look like by reason?']} />
  )
}
