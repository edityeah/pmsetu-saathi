// Daily Operations — section 4: Attendance · Assessment · Infrastructure
// readiness · Upcoming events. The headline cards open Attendance (for a
// day, all ITIs) and Upcoming events (from today, scheduled). Coverage is
// always shown before the average; an ITI without a feed is "not reporting".
import { useState } from 'react'
import BarChartCard from '../../components/cards/BarChartCard.jsx'
import DonutChartCard from '../../components/cards/DonutChartCard.jsx'
import FilterBar from './_FilterBar.jsx'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading, Hero, Stat, StatGrid, Bar, Section, Table, Tabs, Pill, Chips, fmtDate, fmtPct, stateKind, titleCase, NoFeed, Empty } from './_ui.jsx'
import { useSaathiContext } from '../CanvasSaathi.jsx'

const TABS = [{ id: 'attendance', label: 'Attendance' }, { id: 'assessment', label: 'Assessment' }, { id: 'infrastructure', label: 'Infrastructure readiness' }, { id: 'events', label: 'Upcoming events' }]
const todayIso = () => new Date().toISOString().slice(0, 10)
const KIND = { assessment: 'violet', milestone: 'ok', report: 'info', opportunity: 'warn', employer: 'neutral', visit: 'info' }

export default function DailyOperationsCanvas({ context }) {
  const { role, openCanvas } = useApp()
  const f0 = context?.filters || {}
  const [tab, setTab] = useState(context?.tab || 'attendance')
  const { data: itis } = useLoad(() => api.itis())
  // Attendance filters
  const [date, setDate] = useState(f0.date || todayIso())
  const [scope, setScope] = useState(f0.scope || 'all')
  // Events filters
  const [from, setFrom] = useState(f0.from || todayIso())
  const [days, setDays] = useState(Number(f0.days || 30))
  const [status, setStatus] = useState(f0.status || 'scheduled')
  const att = useLoad(() => tab === 'attendance' ? api.attendanceDay({ date, itiId: scope === 'all' ? undefined : scope }) : Promise.resolve(null), [tab, date, scope])
  const ev = useLoad(() => tab === 'events' ? api.upcomingEvents({ from, days, status, itiId: scope === 'all' ? undefined : scope }) : Promise.resolve(null), [tab, from, days, status, scope])
  const asm = useLoad(() => tab === 'assessment' ? api.assessmentAnalytics({ itiId: scope === 'all' ? undefined : scope }) : Promise.resolve(null), [tab, scope])
  const inf = useLoad(() => tab === 'infrastructure' ? api.infrastructureReadiness({ itiId: scope === 'all' ? undefined : scope }) : Promise.resolve(null), [tab, scope])
  const a = att.data, e = ev.data, m = asm.data, f = inf.data
  useSaathiContext(tab === 'assessment' && m ? `Assessments (${m.coverage}): ${JSON.stringify(m.totals)}; by ITI ${m.byIti.map(i => `${i.code} planned ${i.planned}, to review ${i.toReview}, avg ${i.avgPct ?? 'no feed'}%`).join('; ')}; by trade ${m.byTrade.map(t => `${t.trade} ${t.avgPct}% (${t.n})`).join(', ')}.` : tab === 'infrastructure' && f ? `Infrastructure readiness: ${JSON.stringify(f.totals)}; by ITI ${f.byIti.map(i => `${i.code} rooms ${i.roomsWorking}/${i.roomsBaseline}, machines ${i.machines.functional}/${i.machines.total} (${i.machines.nonFunctional} down), civil ${i.civil.pct ?? '—'}% (${i.civil.delayed} delayed), gates ${i.gates.passed}/${i.gates.total}`).join('; ')}; non-functional ${f.nonFunctional.map(x => `${x.name} (${x.itiCode})`).join(', ') || 'none'}.` : tab === 'attendance' && a ? `Attendance on ${fmtDate(a.date)} (${a.scope}; ${a.coverage}): ${a.totals.attendancePct}% present on ${a.totals.reported} of ${a.totals.scheduled} reported sessions; by ITI ${a.byIti.map(i => `${i.code} ${i.attendancePct ?? 'no feed'}% (${i.reported}/${i.scheduled})`).join(', ')}; silent batches ${a.silent.map(b => b.name).join(', ') || 'none'}.` : tab === 'events' && e ? `Upcoming events (${e.days} days from ${fmtDate(e.from)}, ${e.status}): ${e.total}; by kind ${JSON.stringify(e.byKind)}; next: ${e.events.slice(0, 12).map(x => `${fmtDate(x.date)} ${x.title}`).join('; ')}.` : '', tab === 'attendance' ? ['Which ITI has the lowest attendance today and why?', 'Which batches have not reported?'] : ['What is due this week?', 'Which IMA milestones fall in the next 30 days?'])
  const scopeOpts = [{ id: 'all', label: 'All ITIs' }, ...((itis?.itis || []).map(i => ({ id: i.id, label: i.name })))]
  const canSwitch = role !== 'iti_principal' && role !== 'trainer'

  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="indigo" eyebrow="Daily operations" title={tab === 'attendance' ? 'Attendance' : tab === 'events' ? 'Upcoming events' : tab === 'assessment' ? 'Assessment' : 'Infrastructure readiness'} subtitle={tab === 'attendance' ? 'Who was in class, where it was reported, and which batches stayed silent.' : tab === 'events' ? 'Everything with a date: assessments, IMA milestones, reports, employer engagements.' : tab === 'assessment' ? 'What is planned, what is awaiting review, and how students are scoring.' : 'What is usable today: rooms, machines, civil works and the gates before a new course can take intake.'} />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'attendance' && (<>
        <FilterBar items={[{ label: 'Date', type: 'date', value: date, onChange: setDate }, ...(canSwitch ? [{ label: 'Scope', value: scope, options: scopeOpts, onChange: setScope }] : [])]} note={a ? a.coverage : ''} />
        {!a ? <Loading /> : (
          <div className="p-4 space-y-4">
            {a.fallback && <NoFeed>No sessions were scheduled on {fmtDate(a.requestedDate)}. Showing the latest day with sessions: <b>{fmtDate(a.date)}</b>.</NoFeed>}
            <StatGrid>
              <Stat label="Attendance" value={fmtPct(a.totals.attendancePct)} sub={`${a.totals.present.toLocaleString('en-IN')} present · ${a.totals.absent.toLocaleString('en-IN')} absent`} tone={a.totals.attendancePct == null ? 'slate' : a.totals.attendancePct >= 85 ? 'emerald' : 'amber'} />
              <Stat label="Reporting coverage" value={fmtPct(a.totals.coveragePct)} sub={`${a.totals.reported} of ${a.totals.scheduled} sessions reported`} tone={a.totals.coveragePct >= 90 ? 'emerald' : 'amber'} />
              <Stat label="Silent batches" value={a.silent.length} sub="sessions without a register" tone={a.silent.length ? 'rose' : 'emerald'} />
              <Stat label="ITIs reporting" value={a.coverage.split(' ITIs')[0]} sub="registry-connected" tone="sky" />
            </StatGrid>
            <BarChartCard card={{ title: `Attendance by ITI · ${fmtDate(a.date)}`, unit: '% present', data: a.byIti.filter(i => i.registryConnected).map(i => ({ label: i.code, value: i.attendancePct || 0, color: (i.attendancePct || 0) >= 85 ? 'emerald' : 'amber' })), annotation: a.byIti.some(i => !i.registryConnected) ? `${a.byIti.filter(i => !i.registryConnected).map(i => i.code).join(', ')} not shown: no registry feed.` : undefined }} />
            <Section title="By ITI" hint="Reported sessions only; an ITI without a feed shows as not reporting.">
              <Table columns={[
                { key: 'name', label: 'ITI', render: r => <div><div className="font-semibold">{r.name}</div><div className="text-[10px] text-txt-tertiary">{r.registryConnected ? 'registry connected' : 'no feed'}</div></div> },
                { key: 'sessions', label: 'Reported / scheduled', align: 'right', render: r => r.registryConnected ? `${r.reported} / ${r.scheduled}` : '—' },
                { key: 'coveragePct', label: 'Coverage', align: 'right', render: r => r.registryConnected ? fmtPct(r.coveragePct) : <Pill kind="warn">no feed</Pill> },
                { key: 'attendancePct', label: 'Attendance', render: r => r.registryConnected ? <div className="min-w-[120px]"><Bar pct={r.attendancePct || 0} label={fmtPct(r.attendancePct)} tone="auto" /></div> : '—' },
                { key: 'open', label: '', align: 'right', render: r => r.registryConnected ? <button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'institute_today', itiId: r.id })}>Open ITI →</button> : null },
              ]} rows={a.byIti} />
            </Section>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Section title="Lowest attendance by batch" hint="Reported sessions on this day.">
                <Table columns={[{ key: 'name', label: 'Batch', render: r => <div><div className="font-semibold">{r.name}</div><div className="text-[10px] text-txt-tertiary">{r.students} students · {r.reported}/{r.scheduled} reported</div></div> }, { key: 'attendancePct', label: 'Attendance', render: r => <div className="min-w-[110px]"><Bar pct={r.attendancePct || 0} label={fmtPct(r.attendancePct)} tone="auto" /></div> }]} rows={a.byBatch.filter(b => b.attendancePct != null).slice(0, 8)} empty="No reported sessions." />
              </Section>
              <Section title="Batches without a register" hint="Scheduled on this day, not yet reported.">
                <Table columns={[{ key: 'name', label: 'Batch' }, { key: 'missing', label: 'Unreported', align: 'right', render: r => r.scheduled - r.reported }]} rows={a.silent.slice(0, 12)} empty="Every batch reported." />
              </Section>
            </div>
          </div>
        )}
      </>)}

      {tab === 'events' && (<>
        <FilterBar items={[{ label: 'From', type: 'date', value: from, onChange: setFrom }, { label: 'Period', value: String(days), options: [{ id: '7', label: 'Next 7 days' }, { id: '14', label: 'Next 14 days' }, { id: '30', label: 'Next 30 days' }, { id: '60', label: 'Next 60 days' }], onChange: v => setDays(Number(v)) }, { label: 'Status', value: status, options: [{ id: 'scheduled', label: 'Scheduled' }, { id: 'all', label: 'All' }], onChange: setStatus }, ...(canSwitch ? [{ label: 'Scope', value: scope, options: scopeOpts, onChange: setScope }] : [])]} note={e ? `${e.total} events` : ''} />
        {!e ? <Loading /> : (
          <div className="p-4 space-y-4">
            <StatGrid>
              <Stat label="Events" value={e.total} sub={`${fmtDate(e.from)} → ${fmtDate(e.to)}`} tone="sky" />
              <Stat label="Assessments" value={e.byKind.assessment || 0} tone="violet" onClick={() => openCanvas({ type: 'assessments' })} />
              <Stat label="IMA milestones due" value={e.byKind.milestone || 0} tone="emerald" onClick={() => openCanvas({ type: 'milestones' })} />
              <Stat label="Reports · employer" value={`${e.byKind.report || 0} · ${(e.byKind.opportunity || 0) + (e.byKind.employer || 0)}`} tone="amber" />
            </StatGrid>
            <BarChartCard card={{ title: 'Events by week', unit: 'events', data: e.byWeek.map(w => ({ label: `${w.label} · ${fmtDate(w.from)}`, value: w.count })) }} />
            <Section title="Schedule" hint="Tap an event to open where it is managed.">
              {e.events.length === 0 ? <Empty>Nothing scheduled in this period.</Empty> : <Table columns={[
                { key: 'date', label: 'Date', render: r => <b>{fmtDate(r.date)}</b> },
                { key: 'kind', label: 'Kind', render: r => <Pill kind={KIND[r.kind] || 'neutral'}>{r.kind}</Pill> },
                { key: 'title', label: 'Event', render: r => <button className="text-left hover:text-primary" onClick={() => openCanvas({ type: r.canvas })}>{r.title}</button> },
                { key: 'itiCode', label: 'ITI', render: r => r.itiCode || 'Cluster' },
                { key: 'status', label: 'Status', render: r => <Pill kind={stateKind(r.status)}>{r.status}</Pill> },
              ]} rows={e.events.slice(0, 80)} />}
              {e.events.length > 80 && <div className="text-[11px] text-txt-tertiary px-2 pt-2">Showing 80 of {e.events.length}.</div>}
            </Section>
          </div>
        )}
      </>)}

      {tab === 'assessment' && (<>
        <FilterBar items={[{ label: 'Period', value: 'Last 60 days · next 14' }, ...(canSwitch ? [{ label: 'Scope', value: scope, options: scopeOpts, onChange: setScope }] : [])]} note={m ? m.coverage : ''} />
        {!m ? <Loading /> : (
          <div className="p-4 space-y-4">
            <StatGrid>
              <Stat label="Planned" value={m.totals.byState.planned || 0} sub="assessments scheduled" tone="sky" />
              <Stat label="Awaiting review" value={(m.totals.byState.needs_review || 0) + (m.totals.byState.submitted || 0)} sub={`${(m.totals.byState.marks_pending || 0) + (m.totals.byState.conducted || 0)} without marks yet`} tone="amber" onClick={() => openCanvas({ type: 'assessments', tab: 'review' })} />
              <Stat label="Average score" value={fmtPct(m.totals.avgPct)} sub={`${m.totals.entries.toLocaleString('en-IN')} marks in 60 days`} tone={m.totals.avgPct >= 60 ? 'emerald' : 'amber'} />
              <Stat label="Scoring 40% or more" value={fmtPct(m.totals.passPct)} sub="of marks entered" tone={m.totals.passPct >= 80 ? 'emerald' : 'rose'} />
            </StatGrid>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <DonutChartCard card={{ title: 'Results distribution (60 days)', unit: 'marks', data: m.bands.map((b, i) => ({ label: b.label, value: b.n, color: ['rose', 'amber', 'sky', 'emerald'][i] })) }} />
              <BarChartCard card={{ title: 'Average score by trade', unit: '% of max marks', orient: 'horizontal', data: m.byTrade.map(t => ({ label: `${t.trade} (${t.n})`, value: t.avgPct, color: t.avgPct >= 60 ? 'emerald' : 'amber' })) }} />
            </div>
            <Section title="By ITI" hint="Only registry-connected ITIs have assessment data.">
              <Table columns={[
                { key: 'name', label: 'ITI', render: r => <div><div className="font-semibold">{r.name}</div><div className="text-[10px] text-txt-tertiary">{r.registryConnected ? 'registry connected' : 'no feed'}</div></div> },
                { key: 'planned', label: 'Planned', align: 'right', render: r => r.registryConnected ? r.planned : '—' },
                { key: 'conducted', label: 'Conducted', align: 'right', render: r => r.registryConnected ? r.conducted : '—' },
                { key: 'toReview', label: 'To review', align: 'right', render: r => r.registryConnected ? <b className={r.toReview ? 'text-amber-700' : ''}>{r.toReview}</b> : '—' },
                { key: 'avgPct', label: 'Average', render: r => r.registryConnected ? <div className="min-w-[110px]"><Bar pct={r.avgPct || 0} label={fmtPct(r.avgPct)} tone="auto" /></div> : <Pill kind="warn">no feed</Pill> },
              ]} rows={m.byIti} />
            </Section>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Section title="Awaiting marks or review" hint="Tap to open in Assessments.">
                <Table columns={[{ key: 'title', label: 'Assessment', render: r => <button className="text-left hover:text-primary" onClick={() => openCanvas({ type: 'assessments', tab: 'review', planId: r.id })}><div className="font-semibold">{r.title}</div><div className="text-[10px] text-txt-tertiary">{r.batch} · {r.itiCode} · {fmtDate(r.date)}</div></button> }, { key: 'state', label: 'State', render: r => <Pill kind={stateKind(r.state)}>{r.state.replace(/_/g, ' ')}</Pill> }, { key: 'entries', label: 'Marks', align: 'right' }]} rows={m.review.slice(0, 12)} empty="Nothing waiting." />
              </Section>
              <Section title="Next 14 days" hint="Planned assessments.">
                <Table columns={[{ key: 'date', label: 'Date', render: r => fmtDate(r.date) }, { key: 'title', label: 'Assessment', render: r => <div><div className="font-semibold">{r.title}</div><div className="text-[10px] text-txt-tertiary">{r.batch} · {r.itiCode} · {r.type} · {r.maxMarks} marks</div></div> }]} rows={m.upcoming.slice(0, 12)} empty="Nothing planned in the next two weeks." />
              </Section>
            </div>
          </div>
        )}
      </>)}

      {tab === 'infrastructure' && (<>
        <FilterBar items={canSwitch ? [{ label: 'Scope', value: scope, options: scopeOpts, onChange: setScope }] : []} note="Plan values for rooms; registry for machines" />
        {!f ? <Loading /> : (
          <div className="p-4 space-y-4">
            <StatGrid>
              <Stat label="Rooms working" value={`${f.totals.rooms.working}/${f.totals.rooms.baseline}`} sub={`Year-5 target ${f.totals.rooms.y5}`} tone={f.totals.rooms.working < f.totals.rooms.baseline ? 'amber' : 'emerald'} />
              <Stat label="Machines functional" value={`${f.totals.machines.functional}/${f.totals.machines.total}`} sub={`${f.totals.machines.awaiting} awaiting commissioning · ${f.totals.machines.ordered} ordered`} tone={f.totals.machines.nonFunctional ? 'rose' : 'emerald'} onClick={() => openCanvas({ type: 'machines_infra' })} />
              <Stat label="Civil works" value={fmtPct(f.totals.civil.pct)} sub={`${f.totals.civil.works} works · ${f.totals.civil.delayed} delayed`} tone={f.totals.civil.delayed ? 'rose' : 'amber'} onClick={() => openCanvas({ type: 'civil_works' })} />
              <Stat label="Launch gates passed" value={`${f.totals.gates.passed}/${f.totals.gates.total}`} sub={`${f.totals.gates.ready} ready to pass`} tone="teal" />
            </StatGrid>
            <Section title="Readiness by ITI" hint="Rooms from the plan; machines, civil works and gates from the registers.">
              <Table columns={[
                { key: 'name', label: 'ITI', render: r => <div><div className="font-semibold">{r.name}</div><div className="text-[10px] text-txt-tertiary">{r.kind}</div></div> },
                { key: 'rooms', label: 'Rooms working', align: 'right', render: r => `${r.roomsWorking}/${r.roomsBaseline}` },
                { key: 'machines', label: 'Machines', render: r => <span className="text-[11px]">{r.machines.functional}/{r.machines.total} functional{r.machines.nonFunctional ? <b className="text-rose-700"> · {r.machines.nonFunctional} down</b> : ''}{r.machines.awaiting ? ` · ${r.machines.awaiting} awaiting` : ''}{r.machines.ordered ? ` · ${r.machines.ordered} ordered` : ''}</span> },
                { key: 'civil', label: 'Civil works', render: r => r.civil.works ? <div className="min-w-[120px]"><Bar pct={r.civil.pct || 0} label={`${fmtPct(r.civil.pct)} · ${r.civil.works} works${r.civil.delayed ? ` · ${r.civil.delayed} delayed` : ''}`} tone={r.civil.delayed ? 'rose' : 'auto'} /></div> : <span className="text-txt-tertiary">none</span> },
                { key: 'gates', label: 'Gates', align: 'right', render: r => r.gates.total ? `${r.gates.passed}/${r.gates.total}${r.gates.ready ? ` (${r.gates.ready} ready)` : ''}` : '—' },
                { key: 'open', label: '', align: 'right', render: r => <button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'institute_profile', itiCode: r.code, tab: 'infrastructure' })}>Open ITI →</button> },
              ]} rows={f.byIti} />
            </Section>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Section title="Machines not functional" hint="Shown in red on the institute register.">
                <Table columns={[{ key: 'name', label: 'Machine', render: r => <div><div className="font-semibold text-rose-700">{r.name}</div><div className="text-[10px] text-txt-tertiary">{r.itiCode} · {r.trade || r.category}</div></div> }, { key: 'lastServiceAt', label: 'Last service', render: r => fmtDate(r.lastServiceAt) }]} rows={f.nonFunctional} empty="Every machine on the register is working." />
              </Section>
              <Section title="Civil works" hint="Weighted by budget; delayed past scheduled completion in red.">
                <Table columns={[{ key: 'title', label: 'Work', render: r => <div><div className="font-semibold">{r.title}</div><div className="text-[10px] text-txt-tertiary">{r.itiCode} · due {fmtDate(r.scheduledCompletion)}</div></div> }, { key: 'pctComplete', label: 'Progress', render: r => <div className="min-w-[100px]"><Bar pct={r.pctComplete} label={`${r.pctComplete}%`} tone={r.state === 'delayed' ? 'rose' : 'auto'} /></div> }]} rows={f.works.slice(0, 10)} empty="No civil works in scope." />
              </Section>
            </div>
          </div>
        )}
      </>)}
    </div>
  )
}
