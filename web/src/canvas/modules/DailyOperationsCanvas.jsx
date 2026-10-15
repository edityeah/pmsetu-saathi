// Daily Operations — section 4: Attendance · Assessment · Infrastructure
// readiness · Upcoming events. The headline cards open Attendance (for a
// day, all ITIs) and Upcoming events (from today, scheduled). Coverage is
// always shown before the average; an ITI without a feed is "not reporting".
import { useState } from 'react'
import BarChartCard from '../../components/cards/BarChartCard.jsx'
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
  const a = att.data, e = ev.data
  useSaathiContext(tab === 'attendance' && a ? `Attendance on ${fmtDate(a.date)} (${a.scope}; ${a.coverage}): ${a.totals.attendancePct}% present on ${a.totals.reported} of ${a.totals.scheduled} reported sessions; by ITI ${a.byIti.map(i => `${i.code} ${i.attendancePct ?? 'no feed'}% (${i.reported}/${i.scheduled})`).join(', ')}; silent batches ${a.silent.map(b => b.name).join(', ') || 'none'}.` : tab === 'events' && e ? `Upcoming events (${e.days} days from ${fmtDate(e.from)}, ${e.status}): ${e.total}; by kind ${JSON.stringify(e.byKind)}; next: ${e.events.slice(0, 12).map(x => `${fmtDate(x.date)} ${x.title}`).join('; ')}.` : '', tab === 'attendance' ? ['Which ITI has the lowest attendance today and why?', 'Which batches have not reported?'] : ['What is due this week?', 'Which IMA milestones fall in the next 30 days?'])
  const scopeOpts = [{ id: 'all', label: 'All ITIs' }, ...((itis?.itis || []).map(i => ({ id: i.id, label: i.name })))]
  const canSwitch = role !== 'iti_principal' && role !== 'trainer'

  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="indigo" eyebrow="Daily operations" title={tab === 'attendance' ? 'Attendance' : tab === 'events' ? 'Upcoming events' : titleCase(tab)} subtitle={tab === 'attendance' ? 'Who was in class, where it was reported, and which batches stayed silent.' : tab === 'events' ? 'Everything with a date: assessments, IMA milestones, reports, employer engagements.' : 'Being set up for this cluster.'} />
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

      {(tab === 'assessment' || tab === 'infrastructure') && (
        <div className="p-4"><Empty>{tab === 'assessment' ? 'Assessment analytics for the cluster are being set up. ' : 'Infrastructure readiness is being set up. '}Until then use <button className="text-primary font-bold" onClick={() => openCanvas({ type: tab === 'assessment' ? 'assessments' : 'machines_infra' })}>{tab === 'assessment' ? 'Assessments' : 'Machines & labs'}</button>.</Empty></div>
      )}
    </div>
  )
}
