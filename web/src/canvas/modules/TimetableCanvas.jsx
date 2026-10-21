// Timetable (student) — today's sessions, the week, and the exams coming
// up, from the batch's own session register with my attendance mark.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading, Hero, Stat, StatGrid, Section, Pill, Empty, fmtDate, titleCase } from './_ui.jsx'
import { useSaathiContext } from '../CanvasSaathi.jsx'

const iso = d => new Date(d).toISOString().slice(0, 10)
const ATT = { present: 'ok', late: 'warn', absent: 'bad', excused: 'neutral' }

export default function TimetableCanvas() {
  const { openCanvas } = useApp()
  const [from, setFrom] = useState(null)
  const { data: d } = useLoad(() => api.timetable(from ? { from } : {}), [from])
  useSaathiContext(d?.enrolled ? `Timetable for ${d.batch.name} (${d.batch.trade}), week of ${fmtDate(d.from)}: ${d.summary.classes} classes, ${d.summary.practicals} practicals. Today: ${d.today.map(s => `${s.startTime} ${s.subject} (${s.kind}${s.room ? ', ' + s.room : ''}${s.trainer ? ', ' + s.trainer : ''})`).join('; ') || 'no sessions'}. Exams: ${d.exams.map(e => `${e.title} ${e.type} ${fmtDate(e.date)}${e.pct != null ? ' scored ' + e.pct + '%' : e.daysLeft >= 0 ? ' in ' + e.daysLeft + ' days' : ''}`).join('; ')}.` : '', ['Aaj kaunsi class hai?', 'Mera agla exam kab hai?'])
  if (!d) return <Loading />
  if (!d.enrolled) return <div className="p-4"><Empty>You are not enrolled in a batch yet.</Empty></div>
  const nx = d.summary.nextExam
  const shift = n => setFrom(iso(new Date(new Date(d.from).getTime() + n * 7 * 86400000)))
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="indigo" eyebrow={`Timetable · ${d.batch.name}`} title={d.today.length ? `${d.today.length} session${d.today.length === 1 ? '' : 's'} today` : 'No sessions today'} subtitle={`${d.batch.trade} · batch lead ${d.batch.lead || '—'} · from your ITI's session register`} />
      <div className="p-4 space-y-5">
        <StatGrid>
          <Stat label="Classes this week" value={d.summary.classes} sub={`${d.summary.practicals} practicals`} tone="indigo" />
          <Stat label="Next exam" value={nx ? `${nx.daysLeft} day${nx.daysLeft === 1 ? '' : 's'}` : '—'} sub={nx ? `${nx.title} · ${titleCase(nx.type)}` : 'nothing scheduled'} tone={nx && nx.daysLeft <= 7 ? 'amber' : 'sky'} />
          <Stat label="Exams in 30 days" value={d.exams.filter(e => e.daysLeft >= 0).length} sub={`${d.exams.filter(e => e.pct != null).length} scored recently`} tone="violet" onClick={() => openCanvas({ type: 'marks_analytics' })} />
          <Stat label="Today" value={d.today.length} sub={d.today.filter(s => s.kind === 'practical').length ? `${d.today.filter(s => s.kind === 'practical').length} practical` : 'theory only'} tone="emerald" />
        </StatGrid>
        <Section title="Today's timetable" hint={fmtDate(new Date())}>
          {d.today.length === 0 ? <div className="text-[12px] text-txt-tertiary">No sessions scheduled today.</div> : <ol className="space-y-2">{d.today.map(s => <li key={s.id} className={`flex items-start gap-3 rounded-xl px-3 py-2.5 border-l-4 ${s.kind === 'practical' ? 'border-amber-400 bg-amber-50/60' : 'border-primary bg-primary-light/40'}`}><span className="text-[12px] font-bold tabular-nums w-12 pt-0.5">{s.startTime}</span><div className="flex-1 min-w-0"><div className="text-[13px] font-semibold text-txt-primary">{s.subject}</div><div className="text-[10px] text-txt-tertiary">{titleCase(s.kind)}{s.room ? ` · ${s.room}` : ''}{s.trainer ? ` · ${s.trainer}` : ''}{s.delivery === 'cancelled' ? ' · cancelled' : ''}</div></div>{s.attendance && <Pill kind={ATT[s.attendance] || 'neutral'}>{titleCase(s.attendance)}</Pill>}</li>)}</ol>}
        </Section>
        <Section title="This week" hint={`${fmtDate(d.from)} to ${fmtDate(new Date(new Date(d.to).getTime() - 86400000))}`} right={<div className="flex gap-2 text-[11px] font-bold text-primary"><button onClick={() => shift(-1)}>← Previous</button><button onClick={() => setFrom(null)}>This week</button><button onClick={() => shift(1)}>Next →</button></div>}>
          <div className="space-y-3">{d.week.filter(day => day.sessions.length).map(day => <div key={day.label}><div className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${day.isToday ? 'text-primary' : 'text-txt-tertiary'}`}>{day.label}{day.isToday ? ' · today' : ''}</div><ul className="divide-y divide-bdr-light/60">{day.sessions.map(s => <li key={s.id} className="py-1.5 flex items-center gap-3 text-[12px]"><span className="w-12 font-bold tabular-nums">{s.startTime}</span><span className="flex-1 min-w-0 truncate">{s.subject}<span className="text-txt-tertiary"> · {titleCase(s.kind)}{s.room ? ` · ${s.room}` : ''}</span></span>{s.attendance ? <Pill kind={ATT[s.attendance] || 'neutral'}>{titleCase(s.attendance)}</Pill> : s.delivery === 'cancelled' ? <Pill kind="bad">Cancelled</Pill> : null}</li>)}</ul></div>)}{d.week.every(day => !day.sessions.length) && <div className="text-[12px] text-txt-tertiary">No sessions this week.</div>}</div>
        </Section>
        <Section title="Exams" hint="Scheduled by your batch. Scores show once the institute confirms them.">
          <ul className="divide-y divide-bdr-light/60">{d.exams.map(e => <li key={e.id} className="py-2.5 flex items-center gap-3"><div className="flex-1 min-w-0"><div className="text-[13px] font-semibold">{e.title}</div><div className="text-[10px] text-txt-tertiary">{titleCase(e.type)}{e.subject ? ` · ${e.subject}` : ''} · {fmtDate(e.date)} · {e.maxMarks} marks</div></div>{e.pct != null ? <Pill kind={e.pct >= 60 ? 'ok' : 'warn'}>Score {e.pct}%</Pill> : e.daysLeft >= 0 ? <Pill kind={e.daysLeft <= 7 ? 'warn' : 'info'}>{e.daysLeft === 0 ? 'Today' : `in ${e.daysLeft} days`}</Pill> : <Pill kind="neutral">{e.state === 'planned' ? 'Planned' : 'Awaiting marks'}</Pill>}</li>)}</ul>
        </Section>
      </div>
    </div>
  )
}
