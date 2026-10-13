// Trainer's day (Module B) — availability, today's sessions, what is still
// owed (attendance, marks, rechecks, referrals, support), and what is
// saved on the device but not yet synced.
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Pill, Section, Loading, Btn, useLoad, fmtDate, stateKind, titleCase } from './_ui.jsx'
import { Clock, MapPin, WifiOff } from 'lucide-react'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

export default function TrainerMyDayCanvas() {
  const { openCanvas, showToast, user } = useApp()
  const { data, reload } = useLoad(() => api.myDay())
  useSaathiContext(data ? brief(data) : '', ['What do I still owe today?', 'Which students should I talk to this week?', 'Draft a message to the principal about my cancelled session.'])
  if (!data) return <Loading />
  const { iti, sessions, pendingAttendance, marksPending, upcomingAssessments, rechecks, referrals, support, availability, issues, unsynced } = data
  const status = availability?.status || 'available'
  async function setAvail(s) { await api.setAvailability({ status: s, note: s === 'late' ? 'Reaching late' : s === 'leave' ? 'On leave today' : undefined }); showToast({ kind: 'success', text: `Marked ${s}. ${s !== 'available' ? 'Principal notified.' : ''}` }); reload() }
  const owed = pendingAttendance.length + marksPending.length + rechecks.filter(r => new Date(r.recheckAt) <= new Date()).length + referrals.filter(r => r.state === 'sent').length
  return (
    <div className="h-full overflow-y-auto bg-surface-page/40">
      <Hero tone="indigo" eyebrow={`${iti?.name || ''} · ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}`} title={`Namaste, ${user?.name?.split(' ')[0]}`} subtitle={owed ? `${owed} thing${owed > 1 ? 's' : ''} waiting on you today.` : 'Nothing pending. Sessions below.'}
        right={<div className="flex gap-1 rounded-pill bg-white border border-bdr p-0.5">{['available', 'late', 'leave'].map(s => <button key={s} onClick={() => setAvail(s)} className={`px-2.5 py-1 rounded-pill text-[10px] font-bold ${status === s ? (s === 'available' ? 'bg-emerald-500 text-white' : s === 'late' ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white') : 'text-txt-secondary'}`}>{titleCase(s)}</button>)}</div>} />
      <div className="p-4 space-y-4">
        {unsynced > 0 && <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-[12px] flex items-center gap-2"><WifiOff className="w-4 h-4 text-amber-700" /><span><b>{unsynced}</b> submission{unsynced > 1 ? 's' : ''} saved on this device, not yet synced. They upload when you are back online.</span></div>}
        <StatGrid>
          <Stat label="Sessions today" value={sessions.length} sub={`${sessions.filter(s => s.attendanceState !== 'not_reported').length} reported`} tone="indigo" />
          <Stat label="Attendance owed" value={pendingAttendance.length} sub="past sessions" tone={pendingAttendance.length ? 'rose' : 'emerald'} onClick={() => openCanvas({ type: 'attendance_bot' })} />
          <Stat label="Marks to enter" value={marksPending.length} tone={marksPending.length ? 'amber' : 'emerald'} onClick={() => openCanvas({ type: 'assessments', tab: 'enter' })} />
          <Stat label="Rechecks due" value={rechecks.length} tone="violet" onClick={() => openCanvas({ type: 'practical_bot' })} />
        </StatGrid>
        <Section title="Today's sessions" hint="Tap a session to submit attendance. Delivery status is separate from attendance.">
          {sessions.length === 0 ? <div className="text-[12px] text-txt-tertiary">No sessions scheduled for you today.</div> : <ul className="space-y-2">{sessions.map(s => (
            <li key={s.id} className="rounded-xl border border-bdr-light bg-white p-2.5 flex items-center gap-3">
              <div className="w-12 text-center"><div className="text-[14px] font-bold text-primary leading-none">{s.startTime}</div><div className="text-[9px] text-txt-tertiary uppercase mt-0.5">{s.kind}</div></div>
              <div className="flex-1 min-w-0"><div className="text-[12px] font-bold truncate">{s.batch.name}</div><div className="text-[10px] text-txt-secondary truncate">{s.subject.name} · <MapPin className="w-3 h-3 inline" /> {s.room} · {s.batch._count.trainees} students</div><div className="mt-1 flex gap-1 flex-wrap"><Pill kind={stateKind(s.delivery)}>{s.delivery}</Pill><Pill kind={s.attendanceState === 'not_reported' ? 'info' : stateKind(s.attendanceState)}>{s.attendanceState.replace(/_/g, ' ')}</Pill></div></div>
              <Btn small onClick={() => openCanvas({ type: 'attendance_bot', sessionId: s.id })}>{s.attendanceState === 'not_reported' ? 'Attendance' : 'Open'}</Btn>
            </li>))}</ul>}
        </Section>
        {pendingAttendance.length > 0 && <Section title="Attendance not yet submitted" hint="Past sessions still open — submit or mark cancelled/rescheduled.">
          <ul className="space-y-1.5 text-[12px]">{pendingAttendance.map(s => <li key={s.id} className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-rose-500" /><span className="flex-1 truncate">{fmtDate(s.date)} {s.startTime} · {s.batch.name} · {s.subject.name}</span><Btn small tone="ghost" onClick={() => openCanvas({ type: 'attendance_bot', sessionId: s.id })}>Submit</Btn></li>)}</ul>
        </Section>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Section title="Marks and tests" right={<button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'assessments' })}>Assessments →</button>}>
            <ul className="space-y-1.5 text-[12px]">{marksPending.map(a => <li key={a.id} className="flex items-center gap-2"><Pill kind="warn">marks pending</Pill><span className="flex-1 truncate">{a.title} · {a.batch.name}</span></li>)}{upcomingAssessments.map(a => <li key={a.id} className="flex items-center gap-2"><Pill kind="info">{fmtDate(a.date)}</Pill><span className="flex-1 truncate">{a.title} · {a.batch.name}</span></li>)}{marksPending.length + upcomingAssessments.length === 0 && <li className="text-txt-tertiary">Nothing this week.</li>}</ul>
          </Section>
          <Section title="Students asking for help" right={<button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'support_queue' })}>Support queue →</button>}>
            <ul className="space-y-1.5 text-[12px]">{referrals.map(r => <li key={r.id} className="flex items-center gap-2"><Pill kind={stateKind(r.state)}>{r.state.replace(/_/g, ' ')}</Pill><span className="flex-1 truncate"><b>{r.trainee.name}</b>: {r.summary}</span></li>)}{support.map(s => <li key={s.id} className="flex items-center gap-2"><Pill kind="warn">{titleCase(s.reason)}</Pill><span className="flex-1 truncate"><b>{s.trainee.name}</b> · {s.nextAction}</span><span className="text-[10px] text-txt-tertiary">{fmtDate(s.dueAt)}</span></li>)}{referrals.length + support.length === 0 && <li className="text-txt-tertiary">None.</li>}</ul>
          </Section>
          <Section title="Rechecks" right={<button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'practical_bot' })}>Practical bot →</button>}>
            <ul className="space-y-1.5 text-[12px]">{rechecks.map(r => <li key={r.id} className="flex items-center gap-2"><span className="flex-1 truncate"><b>{r.trainee.name}</b> · {r.task.title}</span><span className="text-[10px] text-txt-tertiary">{fmtDate(r.recheckAt)}</span></li>)}{rechecks.length === 0 && <li className="text-txt-tertiary">None due.</li>}</ul>
          </Section>
          <Section title="Issues I raised" right={<button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'daily_ops' })}>Daily ops →</button>}>
            <ul className="space-y-1.5 text-[12px]">{issues.map(i => <li key={i.id} className="flex items-center gap-2"><Pill kind={stateKind(i.state)}>{i.state}</Pill><span className="flex-1 truncate">{i.title}</span></li>)}{issues.length === 0 && <li className="text-txt-tertiary">None open.</li>}</ul>
          </Section>
        </div>
      </div>
    </div>
  )
}
