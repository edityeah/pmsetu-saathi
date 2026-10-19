// Daily Operations — section 4. Overview, Attendance, Assessments,
// Infrastructure readiness, Upcoming events. Hero numbers first, charts
// over lists, every list five rows with View more. Read-only for the CEO.
import { useMemo, useState } from 'react'
import { BarChart, Bar as RBar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, LabelList } from 'recharts'
import FilterBar from './_FilterBar.jsx'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading, Hero, Stat, StatGrid, Bar, Section, Table, Tabs, Pill, Btn, fmtDate, fmtPct, fmtNum, NoFeed, Empty, titleCase } from './_ui.jsx'
import { useSaathiContext } from '../CanvasSaathi.jsx'

const TABS = [{ id: 'overview', label: 'Overview' }, { id: 'attendance', label: 'Attendance' }, { id: 'assessment', label: 'Assessments' }, { id: 'infrastructure', label: 'Infrastructure readiness' }, { id: 'events', label: 'Upcoming events' }]
const todayIso = () => new Date().toISOString().slice(0, 10)
const C = { primary: '#386AF6', sky: '#0EA5E9', emerald: '#10B981', amber: '#F59E0B', rose: '#F43F5E', violet: '#8B5CF6', teal: '#14B8A6', slate: '#64748B', indigo: '#6366F1' }
const ITI_COLORS = ['#386AF6', '#10B981', '#F59E0B', '#8B5CF6', '#F43F5E', '#0EA5E9', '#14B8A6', '#D946EF', '#F97316', '#64748B', '#84CC16', '#6366F1']
const KIND = { assessment: { kind: 'violet', label: 'Assessment day', color: C.violet }, milestone: { kind: 'ok', label: 'IMA milestone', color: C.emerald }, report: { kind: 'info', label: 'Report due', color: C.sky }, placement: { kind: 'warn', label: 'Applications close', color: C.amber }, employer: { kind: 'neutral', label: 'Employer engagement', color: C.slate }, visit: { kind: 'info', label: 'Field visit', color: C.teal } }
const READY = { ready: { kind: 'ok', label: 'Ready', color: C.emerald }, restricted: { kind: 'warn', label: 'Restricted', color: C.amber }, unavailable: { kind: 'bad', label: 'Unavailable', color: C.rose } }
const card = 'rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden h-full flex flex-col'
const head = 'px-4 py-2.5 bg-gradient-to-r from-surface-page/50 to-white border-b border-bdr-light'
const tip = { background: 'white', border: '1px solid #CFD8E6', borderRadius: 8, fontSize: 11 }
const Card = ({ title, sub, children, right }) => <div className={card}><div className={`${head} flex items-center gap-2`}><div className="flex-1 min-w-0"><div className="text-[11px] font-bold uppercase tracking-wider text-primary">{title}</div>{sub && <div className="text-[10px] text-txt-tertiary">{sub}</div>}</div>{right}</div><div className="p-3 flex-1 flex flex-col justify-center">{children}</div></div>

// A list that shows five rows and opens the rest on request.
function TopFive({ columns, rows, empty, label = 'records' }) {
  const [all, setAll] = useState(false)
  const shown = all ? rows : rows.slice(0, 5)
  return (<>
    <Table columns={columns} rows={shown} empty={empty} />
    {rows.length > 5 && <div className="flex items-center justify-between pt-2 text-[11px] text-txt-tertiary"><span>Showing {shown.length} of {rows.length} {label}</span><button className="text-primary font-bold" onClick={() => setAll(a => !a)}>{all ? 'Show five' : `View more (${rows.length - 5})`} →</button></div>}
  </>)
}

export default function DailyOperationsCanvas({ context }) {
  const { role, openCanvas } = useApp()
  const f0 = context?.filters || {}
  const [tab, setTab] = useState(context?.tab || 'overview')
  const [date, setDate] = useState(f0.date || todayIso())
  const [scope, setScope] = useState(f0.scope || 'all')
  const [trade, setTrade] = useState('all')
  const [batch, setBatch] = useState('all')
  const { data: itis } = useLoad(() => api.itis())
  const canSwitch = role !== 'iti_principal' && role !== 'trainer'
  const common = { date, itiId: scope === 'all' ? undefined : scope, trade, batchId: batch }
  const base = { date, setDate, scope, setScope, trade, setTrade: v => { setTrade(v); setBatch('all') }, batch, setBatch, common, canSwitch, itis: itis?.itis || [], openCanvas, setTab, f0 }
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="indigo" eyebrow="Daily operations" title={TABS.find(t => t.id === tab)?.label === 'Overview' ? 'Daily operations' : TABS.find(t => t.id === tab)?.label} subtitle={{ overview: 'Read-only view of attendance, assessments, infrastructure readiness and scheduled events.', attendance: 'Student attendance and reporting coverage from submitted registers.', assessment: 'Scheduled assessments, conduct status and marks-upload coverage.', infrastructure: 'Recorded readiness of workshops and facilities scheduled for use.', events: 'What is coming up: assessment days, IMA deadlines, reports, employer dates.' }[tab]} />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'overview' && <OverviewTab {...base} />}
      {tab === 'attendance' && <AttendanceTab {...base} />}
      {tab === 'assessment' && <AssessmentsTab {...base} />}
      {tab === 'infrastructure' && <ReadinessTab {...base} />}
      {tab === 'events' && <EventsTab {...base} />}
    </div>
  )
}

function baseFilters(b, opts = {}) {
  return [
    { label: 'Date', type: 'date', value: b.date, onChange: b.setDate },
    ...(b.canSwitch ? [{ label: 'ITI', value: b.scope, options: [{ id: 'all', label: 'All reporting ITIs' }, ...b.itis.map(i => ({ id: i.id, label: i.name }))], onChange: b.setScope }] : []),
    { label: 'Trade', value: b.trade, options: [{ id: 'all', label: 'All trades' }, ...((opts.trades || []).map(t => ({ id: t.id, label: t.name })))], onChange: b.setTrade },
    ...(opts.batches ? [{ label: 'Batch', value: b.batch, options: [{ id: 'all', label: 'All batches' }, ...opts.batches.map(x => ({ id: x.id, label: x.name }))], onChange: b.setBatch }] : []),
  ]
}

// ── Overview ───────────────────────────────────────────────────────────────
function OverviewTab(b) {
  const { data: d } = useLoad(() => api.dailyOverview(b.common), [b.date, b.scope, b.trade, b.batch])
  const { data: opt } = useLoad(() => api.dailyAttendance(b.common), [b.date, b.scope, b.trade])
  useSaathiContext(d ? `Daily operations on ${fmtDate(d.attendance.date)}: attendance ${d.attendance.attendancePct}% (${d.attendance.reported} of ${d.attendance.scheduled} registers); assessments ${d.assessments.scheduled} scheduled, ${d.assessments.conducted} conducted, ${d.assessments.marksUploaded} marks uploaded (${fmtDate(d.assessments.date)}); readiness ${d.readiness.ready} of ${d.readiness.inScope} workshops ready (${d.readiness.restricted} restricted, ${d.readiness.unavailable} unavailable); ${d.events.total} events in 30 days; by ITI ${d.byIti.map(i => `${i.code} attendance ${i.attendancePct}% coverage ${i.coveragePct}% workshops ${i.workshopsReady}/${i.workshops}`).join('; ')}.` : '', ['What is cluster attendance today?', 'Which workshop is unavailable today and why?', 'What is due this week?'])
  if (!d) return <><FilterBar items={baseFilters(b, opt?.options)} /><Loading /></>
  const a = d.attendance, as = d.assessments, r = d.readiness, ev = d.events
  const readyPct = r.inScope ? Math.round(100 * r.ready / r.inScope) : null
  return (<>
    <FilterBar items={baseFilters(b, opt?.options)} note={`Data as of ${fmtDate(a.date)}${a.fallback ? ' (latest reported day)' : ''}`} />
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <OverviewCard icon="🗓️" title="Attendance" big={`${fmtPct(a.attendancePct)} attendance`} sub={`${a.reported} of ${a.scheduled} registers submitted`} link="View attendance records" onOpen={() => b.setTab('attendance')}>
          <div className="w-full" style={{ height: 130 }}><ResponsiveContainer><BarChart data={a.byIti.map(i => ({ ...i, v: i.attendancePct || 0 }))} margin={{ top: 16, right: 6, left: 0, bottom: 0 }}><XAxis dataKey="name" fontSize={10} stroke="#7383A5" interval={0} /><Tooltip formatter={v => `${v}%`} contentStyle={tip} /><RBar dataKey="v" name="Attendance" radius={[4, 4, 0, 0]} fill={C.primary}><LabelList dataKey="v" position="top" fontSize={10} formatter={v => `${v}%`} /></RBar></BarChart></ResponsiveContainer></div>
        </OverviewCard>
        <OverviewCard icon="📝" title="Assessments" big={`${as.scheduled} scheduled ${as.fallback ? '· ' + fmtDate(as.date).replace(/ \d{4}$/, '') : 'today'}`} sub={`${as.conducted} conducted · ${as.marksUploaded} marks uploaded`} link="View assessment status" onOpen={() => b.setTab('assessment')}>
          <div className="w-full"><Bar pct={as.scheduled ? 100 * as.conducted / as.scheduled : 0} label={`${as.conducted} of ${as.scheduled} conducted · ${as.scheduled ? Math.round(100 * as.conducted / as.scheduled) : 0}%`} tone="emerald" /><div className="mt-2"><Bar pct={as.scheduled ? 100 * as.marksUploaded / as.scheduled : 0} label={`${as.marksUploaded} marks uploaded`} tone="violet" /></div></div>
        </OverviewCard>
        <OverviewCard icon="🔧" title="Infrastructure readiness" big={`${r.ready} of ${r.inScope} workshops ready`} sub={<span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />{r.restricted} restricted · <span className="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1" />{r.unavailable} unavailable</span>} link="View readiness records" onOpen={() => b.setTab('infrastructure')}>
          <Donut data={[{ name: 'Ready', value: r.ready, color: C.emerald }, { name: 'Restricted', value: r.restricted, color: C.amber }, { name: 'Unavailable', value: r.unavailable, color: C.rose }]} centre={readyPct == null ? '—' : `${readyPct}%`} centreSub="ready" size={130} />
        </OverviewCard>
        <OverviewCard icon="📅" title="Upcoming events" big={`${ev.total} upcoming events`} sub={Object.entries(ev.byKind).map(([k, n]) => `${n} ${(KIND[k]?.label || k).toLowerCase()}${n === 1 ? '' : 's'}`).join(' · ')} link="View event calendar" onOpen={() => b.setTab('events')} wide>
          <TimelineStrip events={ev.next} />
        </OverviewCard>
      </div>
      <Section title="Operational flow by ITI" hint="Attendance reporting for the day, assessments on the latest assessment day, workshops ready now, next scheduled event.">
        <Table columns={[
          { key: 'name', label: 'ITI', render: x => <b>{x.name}</b> },
          { key: 'coveragePct', label: 'Attendance reporting', render: x => <Pill kind={x.coveragePct >= 90 ? 'ok' : x.coveragePct >= 75 ? 'warn' : 'bad'}>{fmtPct(x.coveragePct)}</Pill> },
          { key: 'attendancePct', label: 'Attendance', align: 'right', render: x => fmtPct(x.attendancePct) },
          { key: 'assessments', label: 'Assessments', render: x => <Pill kind="info">{x.assessments} scheduled · {x.assessmentsConducted} conducted</Pill> },
          { key: 'workshops', label: 'Workshops ready', render: x => <Pill kind={x.workshopsReady === x.workshops ? 'ok' : x.workshopsReady ? 'warn' : 'bad'}>{x.workshopsReady} of {x.workshops}</Pill> },
          { key: 'nextEvent', label: 'Next event', render: x => x.nextEvent ? <span className="text-[11px]">{x.nextEvent.title.replace(/ · \d+ batches/, '')} · {fmtDate(x.nextEvent.date)}</span> : <span className="text-txt-tertiary">—</span> },
        ]} rows={d.byIti} />
      </Section>
    </div>
  </>)
}

function OverviewCard({ icon, title, big, sub, link, onOpen, children, wide }) {
  return (
    <button onClick={onOpen} className="text-left rounded-2xl border border-bdr-light bg-white shadow-card p-4 hover:shadow-modal transition flex flex-col">
      <div className={`flex ${wide ? 'flex-col' : 'flex-col sm:flex-row'} gap-4 flex-1`}>
        <div className="flex items-start gap-3 flex-1 min-w-0"><span className="w-11 h-11 rounded-2xl bg-primary-light text-[20px] flex items-center justify-center flex-shrink-0" aria-hidden>{icon}</span><div className="min-w-0"><div className="text-[13px] font-bold text-txt-primary">{title}</div><div className="text-[17px] font-bold text-txt-primary leading-tight mt-0.5">{big}</div><div className="text-[12px] text-txt-secondary mt-1">{sub}</div></div></div>
        <div className={wide ? 'w-full' : 'sm:w-[45%] sm:border-l sm:border-bdr-light sm:pl-4 flex items-center min-w-0'}>{children}</div>
      </div>
      <div className="mt-3 text-[11px] text-primary font-bold">{link} →</div>
    </button>
  )
}

function Donut({ data, centre, centreSub, size = 150 }) {
  return (
    <div className="flex items-center gap-3 w-full">
      <div style={{ width: size, height: size }} className="relative flex-shrink-0">
        <ResponsiveContainer><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={size * 0.3} outerRadius={size * 0.45} paddingAngle={2} stroke="white">{data.map((d, i) => <Cell key={i} fill={d.color} />)}</Pie><Tooltip contentStyle={tip} /></PieChart></ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><div className="text-[18px] font-bold text-txt-primary leading-none">{centre}</div>{centreSub && <div className="text-[10px] text-txt-tertiary">{centreSub}</div>}</div>
      </div>
      <ul className="text-[11px] space-y-1 min-w-0">{data.map(d => <li key={d.name} className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} /><span className="flex-1 truncate text-txt-secondary">{d.name}</span><b className="tabular-nums">{fmtNum(d.value)}</b></li>)}</ul>
    </div>
  )
}

function TimelineStrip({ events }) {
  if (!events?.length) return <div className="text-[12px] text-txt-tertiary">Nothing scheduled.</div>
  return (
    <div className="relative mt-2">
      <div className="absolute left-2 right-2 top-[7px] h-0.5 bg-bdr-light" />
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${events.length}, minmax(0, 1fr))` }}>
        {events.map((e, i) => <div key={e.id} className="min-w-0"><div className={`w-4 h-4 rounded-full border-2 border-white ${i === 0 ? 'bg-primary' : 'bg-slate-300'} shadow`} /><div className="text-[11px] font-bold text-txt-primary mt-1">{fmtDate(e.date).replace(/ \d{4}$/, '')}</div><div className="text-[10px] text-txt-secondary leading-tight line-clamp-2">{e.title.replace(/ · \d+ batches/, '')}</div></div>)}
      </div>
    </div>
  )
}

// ── Attendance ─────────────────────────────────────────────────────────────
function AttendanceTab(b) {
  const [time, setTime] = useState('all')
  const { data: d } = useLoad(() => api.dailyAttendance({ ...b.common, time }), [b.date, b.scope, b.trade, b.batch, time])
  useSaathiContext(d ? `Attendance on ${fmtDate(d.date)}${d.fallback ? ' (latest reported day)' : ''}: rate ${d.totals.attendancePct}% (${d.totals.attended} of ${d.totals.expected} learner-sessions), coverage ${d.totals.reported} of ${d.totals.scheduled} registers, ${d.totals.pending} pending; present ${d.totals.present}, late ${d.totals.late}, absent ${d.totals.absent}, excused ${d.totals.excused}; by ITI ${d.byIti.map(i => `${i.name} ${i.attendancePct}% (${i.reported}/${i.scheduled})`).join(', ')}.` : '', ['Which ITI has lower attendance today?', 'Which registers are still pending?'])
  const filters = [...baseFilters(b, d?.options), { label: 'Session', value: time, options: [{ id: 'all', label: 'All sessions' }, ...((d?.options.times || []).map(t => ({ id: t, label: t })))], onChange: setTime }]
  if (!d) return <><FilterBar items={filters} /><Loading /></>
  const t = d.totals
  return (<>
    <FilterBar items={filters} note={`Data as of ${fmtDate(d.date)}${d.fallback ? ' (latest reported day)' : ''}`} />
    <div className="p-4 space-y-4">
      {d.fallback && <NoFeed>No attendance has been reported for {fmtDate(d.requestedDate)} yet. Showing the latest reported day, <b>{fmtDate(d.date)}</b>.</NoFeed>}
      <StatGrid>
        <Stat label="Attendance rate" value={fmtPct(t.attendancePct)} sub="present + late ÷ expected learners in submitted registers" tone={t.attendancePct >= 85 ? 'emerald' : 'amber'} />
        <Stat label="Reporting coverage" value={`${t.reported} of ${t.scheduled}`} sub="sessions with a register" tone={t.coveragePct >= 90 ? 'emerald' : 'amber'} />
        <Stat label="Attended learner-sessions" value={`${fmtNum(t.attended)} of ${fmtNum(t.expected)}`} sub={`${t.rosterIssues} roster issues flagged`} tone="indigo" />
        <Stat label="Registers pending" value={t.pending} sub="scheduled, not yet submitted" tone={t.pending ? 'amber' : 'emerald'} />
      </StatGrid>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
        <div className="lg:col-span-3"><Card title="Seven-day attendance trend" sub={d.trendBy === 'trade' ? '% present on reported sessions, by trade' : '% present on reported sessions, by ITI'}>
          <div style={{ height: 240 }}><ResponsiveContainer><LineChart data={d.trend} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} /><XAxis dataKey="label" fontSize={11} stroke="#7383A5" /><YAxis domain={[60, 100]} fontSize={10} stroke="#7383A5" width={34} tickFormatter={v => `${v}%`} /><Tooltip formatter={v => `${v}%`} contentStyle={tip} /><Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />{(d.trendKeys || d.itiCodes.map(c => ({ id: c, label: c }))).map((k, i) => <Line key={k.id} type="monotone" dataKey={k.id} name={k.label} stroke={ITI_COLORS[i % ITI_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />)}</LineChart></ResponsiveContainer></div>
        </Card></div>
        <div className="lg:col-span-2"><Card title="Attendance status" sub={`${fmtNum(t.expected)} submitted learner-sessions`}>
          <Donut data={[{ name: 'Present', value: t.present, color: C.primary }, { name: 'Late', value: t.late, color: C.teal }, { name: 'Absent', value: t.absent, color: C.amber }, { name: 'Excused', value: t.excused, color: C.slate }]} centre={fmtNum(t.expected)} centreSub="learner-sessions" size={150} />
        </Card></div>
      </div>
      {d.earlyWarning ? <EarlyWarning ew={d.earlyWarning} openCanvas={b.openCanvas} /> : (
      <Section title="ITI comparison" hint="Rates are on submitted registers only; a missing register is a gap to chase, not an absence.">
        <Table columns={[
          { key: 'name', label: 'ITI', render: x => <b>{x.name}</b> },
          { key: 'attendancePct', label: 'Attendance rate', align: 'right', render: x => <b>{fmtPct(x.attendancePct)}</b> },
          { key: 'reported', label: 'Registers submitted', align: 'right', render: x => `${x.reported} of ${x.scheduled}` },
          { key: 'coveragePct', label: 'Reporting coverage', render: x => <div className="min-w-[110px]"><Bar pct={x.coveragePct || 0} label={fmtPct(x.coveragePct)} tone="auto" /></div> },
          { key: 'marks', label: 'Named marks', align: 'right', render: x => `${fmtNum(x.marks)} learner marks` },
        ]} rows={d.byIti} />
      </Section>)}
      <Section title="Registers pending" hint="Sessions scheduled on this day without a submitted register.">
        <TopFive label="pending registers" columns={[{ key: 'startTime', label: 'Session' }, { key: 'batch', label: 'Batch' }, { key: 'itiCode', label: 'ITI' }]} rows={d.pending} empty="Every scheduled session has a register." />
      </Section>
    </div>
  </>)
}

// ── Assessments ────────────────────────────────────────────────────────────
function AssessmentsTab(b) {
  const [type, setType] = useState('all'), [status, setStatus] = useState('all')
  const { data: d } = useLoad(() => api.dailyAssessments({ ...b.common, type, status }), [b.date, b.scope, b.trade, b.batch, type, status])
  useSaathiContext(d ? `Assessments on ${fmtDate(d.date)}${d.fallback ? ' (latest assessment day)' : ''}: ${d.totals.scheduled} scheduled, ${d.totals.conducted} conducted, ${d.totals.marksUploaded} marks uploaded, ${d.totals.pending} marks pending, ${d.totals.review} awaiting review; by ITI ${d.byIti.map(i => `${i.name} ${i.scheduled}/${i.conducted}/${i.marksUploaded}`).join(', ')}; next assessment days ${d.upcoming.map(u => `${fmtDate(u.date)} (${u.n})`).join(', ')}.` : '', ['Which conducted assessments still need marks?', 'When is the next assessment day?'])
  const filters = [...baseFilters(b, d?.options), { label: 'Type', value: type, options: [{ id: 'all', label: 'All types' }, { id: 'theory', label: 'Theory' }, { id: 'practical', label: 'Practical' }], onChange: setType }, { label: 'Status', value: status, options: [{ id: 'all', label: 'All statuses' }, { id: 'scheduled', label: 'Not conducted' }, { id: 'conducted', label: 'Conducted' }, { id: 'pending', label: 'Marks pending' }, { id: 'review', label: 'Marks in review' }, { id: 'uploaded', label: 'Marks uploaded' }], onChange: setStatus }]
  if (!d) return <><FilterBar items={filters} /><Loading /></>
  const t = d.totals
  const p = (a, c) => c ? Math.round(100 * a / c) : 0
  return (<>
    <FilterBar items={filters} note={`Data as of ${fmtDate(d.date)}${d.fallback ? ' (latest assessment day)' : ''}`} />
    <div className="p-4 space-y-4">
      {d.fallback && <NoFeed>No assessments were scheduled on {fmtDate(d.requestedDate)}. Showing the latest assessment day, <b>{fmtDate(d.date)}</b>{d.upcoming[0] ? <>; the next one is <b>{fmtDate(d.upcoming[0].date)}</b> with {d.upcoming[0].n} assessments.</> : '.'}</NoFeed>}
      <StatGrid>
        <Stat label="Scheduled" value={t.scheduled} sub={d.fallback ? `on ${fmtDate(d.date)}` : 'today'} tone="indigo" />
        <Stat label="Conducted" value={t.conducted} sub={`${t.notConducted} not conducted`} tone={t.notConducted ? 'amber' : 'emerald'} />
        <Stat label="Marks uploaded" value={t.marksUploaded} sub={`${t.review} awaiting principal review`} tone="violet" />
        <Stat label="Results pending" value={t.pending} sub="conducted, marks not entered" tone={t.pending ? 'amber' : 'emerald'} />
      </StatGrid>
      {d.byIti.length === 1 ? <AssessmentByTypeAndTrade d={d} /> : (
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
        <div className="lg:col-span-3"><Card title="Assessment flow" sub="scheduled → conducted → marks uploaded">
          <div className="grid grid-cols-3 gap-2 items-stretch">
            {[['📅', 'Scheduled', t.scheduled, '', 'bg-sky-50 text-sky-800'], ['✅', 'Conducted', t.conducted, `${p(t.conducted, t.scheduled)}% of scheduled`, 'bg-emerald-50 text-emerald-800'], ['📄', 'Marks uploaded', t.marksUploaded, `${p(t.marksUploaded, t.scheduled)}% of scheduled · ${p(t.marksUploaded, t.conducted)}% of conducted`, 'bg-violet-50 text-violet-800']].map(([ic, l, v, s, cls], i) => (
              <div key={l} className={`rounded-xl p-3 ${cls} relative`}><div className="text-[18px]" aria-hidden>{ic}</div><div className="text-[11px] font-bold mt-1">{l}</div><div className="text-[24px] font-bold leading-tight">{v}</div>{s && <div className="text-[10px] opacity-80 mt-0.5">{s}</div>}{i < 2 && <span className="absolute -right-2.5 top-1/2 -translate-y-1/2 text-txt-tertiary font-bold">→</span>}</div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]">
            <div />
            <div className={`rounded-lg px-2 py-1 text-center ${t.notConducted ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{t.notConducted ? `${t.notConducted} not conducted` : 'all conducted'}</div>
            <div className={`rounded-lg px-2 py-1 text-center ${t.pending ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}>{t.pending ? `${t.pending} conducted, marks pending` : 'no marks pending'}</div>
          </div>
        </Card></div>
        <div className="lg:col-span-2"><Card title="Status by ITI" sub="scheduled · conducted · marks uploaded">
          <div style={{ height: Math.max(180, d.byIti.length * 44) }}><ResponsiveContainer><BarChart data={d.byIti} layout="vertical" margin={{ top: 4, right: 20, left: 4, bottom: 0 }} barGap={2}><XAxis type="number" fontSize={10} stroke="#7383A5" /><YAxis type="category" dataKey="name" width={64} fontSize={10} stroke="#7383A5" /><Tooltip contentStyle={tip} /><Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} /><RBar dataKey="scheduled" name="Scheduled" fill={C.primary} radius={[0, 3, 3, 0]} /><RBar dataKey="conducted" name="Conducted" fill={C.emerald} radius={[0, 3, 3, 0]} /><RBar dataKey="marksUploaded" name="Marks uploaded" fill={C.violet} radius={[0, 3, 3, 0]} /></BarChart></ResponsiveContainer></div>
        </Card></div>
      </div>)}
      <Section title="Assessment records" hint="Scheduled, conducted and marks uploaded are separate states; blank marks are not zero.">
        <TopFive label="assessments" columns={[
          { key: 'title', label: 'Assessment', render: x => <div><div className="font-semibold">{x.title}</div><div className="text-[10px] text-txt-tertiary">{titleCase(x.type)} · {x.maxMarks} marks</div></div> },
          { key: 'iti', label: 'ITI / trade', render: x => `${x.itiCode} · ${x.trade}` },
          { key: 'batch', label: 'Batch', render: x => <span className="text-[11px]">{x.batch}</span> },
          { key: 'conducted', label: 'Conducted', render: x => <Pill kind={x.conducted ? 'ok' : 'neutral'}>{x.conducted ? 'Conducted' : 'Not yet'}</Pill> },
          { key: 'marksStatus', label: 'Marks status', render: x => <Pill kind={{ uploaded: 'ok', review: 'info', pending: 'warn', not_expected: 'neutral' }[x.marksStatus]}>{{ uploaded: 'Uploaded', review: 'In review', pending: 'Pending', not_expected: 'Not expected' }[x.marksStatus]}</Pill> },
        ]} rows={d.rows} empty="No assessments in this scope." />
      </Section>
    </div>
  </>)
}

// ── Infrastructure readiness ───────────────────────────────────────────────
function ReadinessTab(b) {
  const [kind, setKind] = useState(b.f0.kind || 'all'), [status, setStatus] = useState(b.f0.status || 'all')
  const [compIti, setCompIti] = useState(null), [compLab, setCompLab] = useState(null)
  const { data: d } = useLoad(() => api.dailyReadiness({ ...b.common, kind, status }), [b.date, b.scope, b.trade, kind, status])
  useSaathiContext(d ? `Infrastructure readiness on ${fmtDate(d.date)}: ${d.totals.ready} of ${d.totals.inScope} workshops ready, ${d.totals.restricted} restricted, ${d.totals.unavailable} unavailable; components ${d.components.map(c => `${c.key} ${c.ok}/${c.total}`).join(', ')}; not ready: ${d.rows.filter(r => r.status !== 'ready').map(r => `${r.name} (${r.itiCode}, ${r.status}: ${r.reasons.join('; ')})`).join('; ') || 'none'}.` : '', ['Which facility is unavailable today?', 'What is restricting the Pusa electrical workshop?'])
  const filters = [...baseFilters(b, d?.options), { label: 'Facility type', value: kind, options: [{ id: 'all', label: 'All' }, { id: 'workshop', label: 'Workshops' }, { id: 'lab', label: 'Labs' }], onChange: setKind }, { label: 'Readiness', value: status, options: [{ id: 'all', label: 'All statuses' }, { id: 'ready', label: 'Ready' }, { id: 'restricted', label: 'Restricted' }, { id: 'unavailable', label: 'Unavailable' }], onChange: setStatus }]
  const rows = d?.rows || []
  // Components panel: one ITI and one lab are pre-selected (the first that is not ready, else the first).
  const defaultRow = rows.find(r => r.status !== 'ready') || rows[0]
  const selIti = compIti ?? defaultRow?.itiId ?? null
  const labs = rows.filter(r => r.itiId === selIti)
  const selLab = compLab === 'all' ? null : (labs.find(r => r.id === compLab) || (compLab ? null : labs.find(r => r.id === defaultRow?.id) || labs[0]))
  if (!d) return <><FilterBar items={filters} /><Loading /></>
  const t = d.totals
  const COMP = { space: 'Space', electricity: 'Electricity', safety: 'Safety', equipment: 'Equipment', consumables: 'Consumables' }
  const compRows = selLab ? Object.keys(COMP).map(k => ({ key: k, ok: selLab.checks[k] ? 1 : 0, total: 1 })) : Object.keys(COMP).map(k => ({ key: k, ok: labs.filter(r => r.checks[k]).length, total: labs.length }))
  return (<>
    <FilterBar items={filters} note={`Data as of ${fmtDate(d.date)}`} />
    <div className="p-4 space-y-4">
      <StatGrid>
        <Stat label="Workshops in scope" value={t.inScope} sub="scheduled for use" tone="indigo" />
        <Stat label="Ready" value={t.ready} sub="all checks met" tone="emerald" />
        <Stat label="Restricted use" value={t.restricted} sub="one check failing" tone="amber" />
        <Stat label="Unavailable" value={t.unavailable} sub="no usable equipment or a high safety issue" tone="rose" />
      </StatGrid>
      {d.byIti.length === 1 ? <ReadinessForPrincipal rows={rows} openCanvas={b.openCanvas} /> : (
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
        <div className="lg:col-span-3"><Card title="Readiness by ITI" sub="ready · restricted · unavailable">
          <div style={{ height: Math.max(180, d.byIti.length * 44) }}><ResponsiveContainer><BarChart data={d.byIti} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 0 }}><XAxis type="number" fontSize={10} stroke="#7383A5" allowDecimals={false} /><YAxis type="category" dataKey="name" width={64} fontSize={10} stroke="#7383A5" /><Tooltip contentStyle={tip} /><Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} /><RBar dataKey="ready" name="Ready" stackId="a" fill={C.emerald}><LabelList dataKey="ready" position="center" fontSize={10} fill="white" formatter={v => v || ''} /></RBar><RBar dataKey="restricted" name="Restricted" stackId="a" fill={C.amber}><LabelList dataKey="restricted" position="center" fontSize={10} fill="white" formatter={v => v || ''} /></RBar><RBar dataKey="unavailable" name="Unavailable" stackId="a" fill={C.rose} radius={[0, 4, 4, 0]}><LabelList dataKey="total" position="right" fontSize={10} fill="#1A1F36" /></RBar></BarChart></ResponsiveContainer></div>
        </Card></div>
        <div className="lg:col-span-2"><Card title="Readiness components" sub={selLab ? `${selLab.name} · ${selLab.itiName}` : `${labs.length} facilities at ${b.itis.find(i => i.id === selIti)?.name?.replace('Government ITI ', '') || 'the ITI'}`} right={<div className="flex gap-1"><select className="text-[10px] rounded-lg border border-bdr px-1.5 py-1 bg-white max-w-[110px]" value={selIti || ''} onChange={e => { setCompIti(e.target.value); setCompLab(null) }}>{[...new Map(rows.map(r => [r.itiId, r.itiName])).entries()].map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select><select className="text-[10px] rounded-lg border border-bdr px-1.5 py-1 bg-white max-w-[130px]" value={selLab ? selLab.id : 'all'} onChange={e => setCompLab(e.target.value)}><option value="all">All labs</option>{labs.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>}>
          <div className="space-y-2.5">{compRows.map(c => <div key={c.key} className="flex items-center gap-2 text-[11px]"><span className="w-20 text-txt-secondary">{COMP[c.key]}</span><div className="flex-1"><Bar pct={c.total ? 100 * c.ok / c.total : 0} tone={c.ok === c.total ? 'emerald' : c.ok ? 'amber' : 'rose'} /></div><span className="w-14 text-right tabular-nums font-semibold">{selLab ? (c.ok ? 'Met' : 'Not met') : `${c.ok}/${c.total}`}</span></div>)}</div>
          {selLab && selLab.reasons.length > 0 && <div className="mt-3 text-[11px] text-rose-700">{selLab.reasons.join(' · ')}</div>}
          <div className="mt-3 text-[10px] text-txt-tertiary">A facility is ready only when all five checks for its scheduled use are met.</div>
        </Card></div>
      </div>)}
      <Section title="Facility readiness records" hint="Recorded readiness is operational evidence, not formal safety certification.">
        <TopFive label="facilities" columns={[
          { key: 'name', label: 'Facility', render: x => <button className="text-left hover:text-primary" onClick={() => { setCompIti(x.itiId); setCompLab(x.id) }}><div className="font-semibold">{x.name}</div><div className="text-[10px] text-txt-tertiary">{titleCase(x.kind)}</div></button> },
          { key: 'iti', label: 'ITI / trade', render: x => `${x.itiName} · ${x.tradeName}` },
          { key: 'scheduledUse', label: 'Scheduled use', render: x => x.scheduledUse },
          { key: 'status', label: 'Recorded status', render: x => <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: READY[x.status].color }} /><Pill kind={READY[x.status].kind}>{READY[x.status].label}</Pill></span> },
          { key: 'lastChecked', label: 'Last checked', render: x => fmtDate(x.lastChecked) },
        ]} rows={rows} empty="No facilities in this scope." />
      </Section>
    </div>
  </>)
}

// ── Upcoming events (designed here: what has a date in the next weeks) ─────
function EventsTab(b) {
  const [from, setFrom] = useState(b.f0.from || todayIso()), [days, setDays] = useState(Number(b.f0.days || 30)), [kind, setKind] = useState('all')
  const { data: d } = useLoad(() => api.dailyEvents({ from, days, kind, itiId: b.scope === 'all' ? undefined : b.scope, trade: b.trade }), [from, days, kind, b.scope, b.trade])
  useSaathiContext(d ? `Upcoming events (${d.days} days from ${fmtDate(d.from)}): ${d.totals.total} events, ${d.totals.thisWeek} this week, ${d.totals.deadlines} IMA or report deadlines, ${d.totals.employer} employer dates, ${d.totals.assessmentDays} assessment days; next: ${d.next.map(e => `${fmtDate(e.date)} ${e.title}`).join('; ')}.` : '', ['What is due this week?', 'Which IMA milestones fall in the next 30 days?'])
  const filters = [{ label: 'From', type: 'date', value: from, onChange: setFrom }, { label: 'Period', value: String(days), options: [{ id: '7', label: 'Next 7 days' }, { id: '14', label: 'Next 14 days' }, { id: '30', label: 'Next 30 days' }, { id: '60', label: 'Next 60 days' }], onChange: v => setDays(Number(v)) }, { label: 'Kind', value: kind, options: [{ id: 'all', label: 'All kinds' }, ...Object.entries(KIND).map(([k, v]) => ({ id: k, label: v.label }))], onChange: setKind }, ...(b.canSwitch ? [{ label: 'ITI', value: b.scope, options: [{ id: 'all', label: 'All ITIs' }, ...b.itis.map(i => ({ id: i.id, label: i.name }))], onChange: b.setScope }] : [])]
  if (!d) return <><FilterBar items={filters} /><Loading /></>
  const t = d.totals
  const kinds = Object.entries(d.byKind).map(([k, n]) => ({ name: KIND[k]?.label || k, value: n, color: KIND[k]?.color || C.slate }))
  return (<>
    <FilterBar items={filters} note={`${fmtDate(d.from)} → ${fmtDate(d.to)}`} />
    <div className="p-4 space-y-4">
      <StatGrid>
        <Stat label="Upcoming events" value={t.total} sub={`next ${d.days} days`} tone="indigo" />
        <Stat label="This week" value={t.thisWeek} sub="in the next 7 days" tone={t.thisWeek ? 'amber' : 'emerald'} />
        <Stat label="IMA and report deadlines" value={t.deadlines} sub="milestones due and reports due" tone="rose" onClick={() => setKind('milestone')} />
        <Stat label="Employer dates" value={t.employer} sub="engagements and application closings" tone="teal" onClick={() => setKind('employer')} />
      </StatGrid>
      <Card title="What is next" sub="the next four dated items">
        <TimelineStrip events={d.next} />
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
        <div className="lg:col-span-3"><Card title="Events by week" sub="count per week in the period">
          <div style={{ height: 200 }}><ResponsiveContainer><BarChart data={d.byWeek.map(w => ({ ...w, label: `${w.label} · ${fmtDate(w.from).replace(/ \d{4}$/, '')}` }))} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} /><XAxis dataKey="label" fontSize={10} stroke="#7383A5" /><YAxis fontSize={10} stroke="#7383A5" width={30} allowDecimals={false} /><Tooltip contentStyle={tip} /><RBar dataKey="count" name="Events" fill={C.primary} radius={[4, 4, 0, 0]}><LabelList dataKey="count" position="top" fontSize={10} /></RBar></BarChart></ResponsiveContainer></div>
        </Card></div>
        <div className="lg:col-span-2"><Card title="By kind" sub={`${t.total} events`}>
          <Donut data={kinds} centre={t.total} centreSub="events" size={140} />
        </Card></div>
      </div>
      <Section title="Event schedule" hint="Tap an event to open where it is managed.">
        <TopFive label="events" columns={[
          { key: 'date', label: 'Date', render: e => <b>{fmtDate(e.date)}</b> },
          { key: 'kind', label: 'Kind', render: e => <Pill kind={KIND[e.kind]?.kind || 'neutral'}>{KIND[e.kind]?.label || e.kind}</Pill> },
          { key: 'title', label: 'Event', render: e => <button className="text-left hover:text-primary" onClick={() => b.openCanvas(e.canvas === 'daily_operations' ? { type: 'daily_operations', tab: e.tab, filters: { date: String(e.date).slice(0, 10) } } : { type: e.canvas })}>{e.title}</button> },
          { key: 'itiCode', label: 'ITI', render: e => e.itiCode || 'Cluster' },
        ]} rows={d.list} empty="Nothing scheduled in this period." />
      </Section>
    </div>
  </>)
}

// Early warning: students below the attendance thresholds, by gender and by
// course, for one institute. Thresholds match the batch roster risk flag.
function EarlyWarning({ ew, openCanvas }) {
  const [all, setAll] = useState(false)
  const g = [{ name: 'Male', value: ew.byGender.male, color: C.primary }, { name: 'Female', value: ew.byGender.female, color: C.violet }]
  const rows = ew.byTrade.map(t => ({ ...t, label: t.name }))
  const shown = all ? ew.students : ew.students.slice(0, 5)
  return (<>
    <StatGrid>
      <Stat label="Students under early warning" value={ew.total} sub={`below ${ew.thresholdPct}% attendance in ${ew.windowDays} days · ${ew.studentsWithData} students with data`} tone={ew.total ? 'rose' : 'emerald'} />
      <Stat label="High" value={ew.high} sub={`below ${ew.highPct}%`} tone="rose" />
      <Stat label="Watch" value={ew.watch} sub={`${ew.highPct}–${ew.thresholdPct - 1}%`} tone="amber" />
      <Stat label="Women under warning" value={ew.byGender.female} sub={`${ew.total ? Math.round(100 * ew.byGender.female / ew.total) : 0}% of flagged · ${ew.byGender.male} men`} tone="violet" />
    </StatGrid>
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-stretch">
      <div className="xl:col-span-2"><Card title="Early warning by gender" sub="students below the threshold">
        <div className="flex items-center gap-4">
          <div style={{ width: 150, height: 150 }} className="relative flex-shrink-0"><ResponsiveContainer><PieChart><Pie data={g} dataKey="value" nameKey="name" innerRadius={44} outerRadius={68} paddingAngle={2} stroke="white">{g.map(x => <Cell key={x.name} fill={x.color} />)}</Pie><Tooltip contentStyle={tip} /></PieChart></ResponsiveContainer><div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><div className="text-[20px] font-bold leading-none">{ew.total}</div><div className="text-[10px] text-txt-tertiary">flagged</div></div></div>
          <ul className="text-[12px] space-y-2 flex-1">{g.map(x => <li key={x.name} className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: x.color }} /><span className="flex-1 text-txt-secondary">{x.name}</span><b>{x.value}</b><span className="text-[10px] text-txt-tertiary w-10 text-right">{ew.total ? Math.round(100 * x.value / ew.total) : 0}%</span></li>)}</ul>
        </div>
      </Card></div>
      <div className="xl:col-span-3"><Card title="Early warning by course" sub="students below the threshold, men and women">
        <div style={{ height: Math.max(180, rows.length * 34 + 24) }}><ResponsiveContainer><BarChart data={rows} layout="vertical" margin={{ top: 4, right: 36, left: 8, bottom: 0 }} barCategoryGap={6}><XAxis type="number" hide allowDecimals={false} /><YAxis type="category" dataKey="label" width={150} fontSize={10} stroke="#7383A5" interval={0} /><Tooltip contentStyle={tip} /><Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} /><RBar dataKey="male" name="Men" stackId="g" fill={C.primary} /><RBar dataKey="female" name="Women" stackId="g" fill={C.violet} radius={[0, 6, 6, 0]}><LabelList dataKey="total" position="right" fontSize={10} fill="#1A1F36" /></RBar></BarChart></ResponsiveContainer></div>
      </Card></div>
    </div>
    <Section title="Students under early warning" hint={`Lowest attendance first. Showing ${shown.length} of ${ew.students.length}. Tap a student for the record.`}>
      <Table columns={[
        { key: 'name', label: 'Student', render: t => <button className="text-left hover:text-primary" onClick={() => openCanvas({ type: 'student_profile', traineeId: t.id })}><div className="font-semibold">{t.name}</div><div className="text-[10px] text-txt-tertiary">{t.gender === 'F' ? 'F' : 'M'} · {t.batch}</div></button> },
        { key: 'trade', label: 'Course' },
        { key: 'attendancePct', label: 'Attendance (15d)', render: t => <div className="min-w-[120px]"><Bar pct={t.attendancePct} label={`${t.attendancePct}%`} tone="auto" /></div> },
        { key: 'absences', label: 'Absences', align: 'right', render: t => `${t.absences} of ${t.marks}` },
        { key: 'level', label: 'Level', render: t => <Pill kind={t.level === 'high' ? 'bad' : 'warn'}>{t.level === 'high' ? 'High' : 'Watch'}</Pill> },
      ]} rows={shown} empty="No student is below the threshold." />
      {ew.students.length > 5 && <div className="flex items-center justify-between pt-2 text-[11px] text-txt-tertiary"><span>Showing {shown.length} of {ew.students.length}</span><button className="text-primary font-bold" onClick={() => setAll(x => !x)}>{all ? 'Show five' : `View more (${ew.students.length - 5})`} →</button></div>}
    </Section>
  </>)
}

// One institute: assessments by type this term (pie) beside status by trade
// for the day (bars). Both cards share one height so neither looks bigger.
const TYPE_COLORS = { theory: C.primary, practical: C.emerald, viva: C.amber }
function AssessmentByTypeAndTrade({ d }) {
  const term = d.termByType.filter(x => x.total > 0)
  const total = term.reduce((s, x) => s + x.total, 0)
  const h = Math.max(240, d.byTrade.length * 34 + 40)
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
      <div className="lg:col-span-2"><Card title="Assessments by type" sub="this term · conducted and planned">
        <div className="flex flex-col items-center justify-center gap-3" style={{ height: h }}>
          <div style={{ width: 170, height: 170 }} className="relative flex-shrink-0"><ResponsiveContainer><PieChart><Pie data={term.map(x => ({ name: titleCase(x.type), value: x.total, type: x.type }))} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2} stroke="white">{term.map(x => <Cell key={x.type} fill={TYPE_COLORS[x.type]} />)}</Pie><Tooltip contentStyle={tip} /></PieChart></ResponsiveContainer><div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><div className="text-[22px] font-bold leading-none">{total}</div><div className="text-[10px] text-txt-tertiary">assessments</div></div></div>
          <ul className="text-[12px] space-y-1.5 w-full max-w-[320px]">{term.map(x => <li key={x.type} className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: TYPE_COLORS[x.type] }} /><span className="flex-1 text-txt-secondary">{x.type === 'viva' ? 'Vivas' : x.type === 'theory' ? 'Theory exams' : 'Practicals'}</span><b className="w-8 text-right">{x.total}</b><span className="text-[10px] text-txt-tertiary w-40 text-right whitespace-nowrap">{x.conducted} conducted · {x.planned} planned</span></li>)}</ul>
        </div>
      </Card></div>
      <div className="lg:col-span-3"><Card title="Status by trade" sub={`scheduled · conducted · marks uploaded on ${fmtDate(d.date)}`}>
        <div style={{ height: h }}><ResponsiveContainer><BarChart data={d.byTrade} layout="vertical" margin={{ top: 4, right: 24, left: 4, bottom: 0 }} barGap={2} barCategoryGap={8}><XAxis type="number" fontSize={10} stroke="#7383A5" allowDecimals={false} /><YAxis type="category" dataKey="name" width={150} fontSize={10} stroke="#7383A5" interval={0} /><Tooltip contentStyle={tip} /><Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} /><RBar dataKey="scheduled" name="Scheduled" fill={C.primary} radius={[0, 3, 3, 0]} /><RBar dataKey="conducted" name="Conducted" fill={C.emerald} radius={[0, 3, 3, 0]} /><RBar dataKey="marksUploaded" name="Marks uploaded" fill={C.violet} radius={[0, 3, 3, 0]} /></BarChart></ResponsiveContainer></div>
      </Card></div>
    </div>
  )
}

// One institute: a check matrix per workshop (what passes and what fails
// today) beside a fix-first list ranked by what blocks the most sessions.
const CHECKS = [['space', 'Space'], ['electricity', 'Electricity'], ['safety', 'Safety'], ['equipment', 'Equipment'], ['consumables', 'Consumables']]
function ReadinessForPrincipal({ rows, openCanvas }) {
  const order = { unavailable: 0, restricted: 1, ready: 2 }
  const sorted = [...rows].sort((p, q) => order[p.status] - order[q.status] || p.name.localeCompare(q.name))
  const failing = CHECKS.map(([k, label]) => ({ key: k, label, facilities: rows.filter(r => !r.checks[k]) })).filter(x => x.facilities.length).sort((p, q) => q.facilities.length - p.facilities.length)
  const withSession = rows.filter(r => r.status !== 'ready' && r.scheduledUse && r.scheduledUse !== 'No session scheduled')
  const h = Math.max(220, sorted.length * 36 + 48)
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
      <div className="lg:col-span-3"><Card title="Readiness checks by workshop" sub="the five checks for today's scheduled use · green met, red not met">
        <div style={{ minHeight: h }} className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead><tr className="text-[10px] uppercase tracking-wider text-txt-tertiary"><th className="text-left font-bold pb-2 pr-2">Workshop</th>{CHECKS.map(([k, l]) => <th key={k} className="font-bold pb-2 px-1 text-center">{l}</th>)}<th className="text-right font-bold pb-2 pl-2">Status</th></tr></thead>
            <tbody>{sorted.map(r => <tr key={r.id} className="border-t border-bdr-light/60"><td className="py-2 pr-2"><div className="font-semibold text-txt-primary whitespace-nowrap">{r.name}</div><div className="text-[10px] text-txt-tertiary whitespace-nowrap">{r.tradeName} · {r.scheduledUse || 'no session today'}</div></td>{CHECKS.map(([k]) => <td key={k} className="px-1 text-center"><span title={r.checks[k] ? 'Met' : 'Not met'} className={`inline-block w-7 h-5 rounded-md ${r.checks[k] ? 'bg-emerald-400' : 'bg-rose-400'}`} /></td>)}<td className="pl-2 text-right"><Pill kind={r.status === 'ready' ? 'ok' : r.status === 'restricted' ? 'warn' : 'bad'}>{titleCase(r.status)}</Pill></td></tr>)}</tbody>
          </table>
        </div>
      </Card></div>
      <div className="lg:col-span-2"><Card title="Fix first" sub="failing checks ranked by how many workshops they hold back">
        <div style={{ minHeight: h }} className="flex flex-col gap-3">
          {failing.length === 0 ? <div className="text-[12px] text-emerald-700 rounded-xl bg-emerald-50 px-3 py-2">Every workshop passes all five checks today.</div> : failing.map(f => (
            <div key={f.key} className="rounded-xl bg-surface-page px-3 py-2.5">
              <div className="flex items-center gap-2"><span className="text-[12px] font-bold text-txt-primary">{f.label}</span><span className="text-[10px] text-txt-tertiary">not met in {f.facilities.length} workshop{f.facilities.length > 1 ? 's' : ''}</span></div>
              <ul className="mt-1.5 space-y-1 text-[11px]">{f.facilities.map(r => <li key={r.id} className="flex items-start gap-2"><span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.status === 'unavailable' ? 'bg-rose-500' : 'bg-amber-500'}`} /><span className="flex-1 text-txt-secondary"><b className="text-txt-primary">{r.name}</b>{(() => { const m = r.reasons.filter(x => x.toLowerCase().includes(f.key === 'equipment' ? 'machine' : f.key === 'electricity' ? 'electric' : f.key)); const txt = m.length ? m : f.key === 'equipment' ? [`${r.machines?.functional ?? 0} of ${r.machines?.total ?? 0} machines functional`] : r.reasons.slice(0, 1); return txt.map(x => ` · ${x}`).join('') })()}</span></li>)}</ul>
            </div>
          ))}
          {withSession.length > 0 && <div className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-900"><b>{withSession.length}</b> workshop{withSession.length > 1 ? 's' : ''} with a session scheduled today {withSession.length > 1 ? 'are' : 'is'} not ready: {withSession.map(r => `${r.name} (${r.scheduledUse})`).join(', ')}.</div>}
          <div className="mt-auto flex gap-2 flex-wrap pt-1"><button onClick={() => openCanvas({ type: 'daily_ops' })} className="px-3 py-1.5 rounded-pill bg-primary text-white text-[11px] font-bold">Raise an issue</button><button onClick={() => openCanvas({ type: 'my_institute', tab: 'facilities' })} className="px-3 py-1.5 rounded-pill bg-white border border-bdr text-[11px] font-bold">Open campus facilities</button></div>
        </div>
      </Card></div>
    </div>
  )
}
