// ITI dashboard — one institute: intake plan vs registry, attendance
// coverage, trainers, machines, civil works, placements, grievances.
// Principal sees their own ITI; CEO / IMA can switch between the five.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Bar, Pill, Section, Table, Loading, useLoad, fmtDate, fmtCr, fmtPct, nil, stateKind, titleCase, NoFeed } from './_ui.jsx'
import LineChartCard from '../../components/cards/LineChartCard.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

export default function ItiDashboardCanvas({ context }) {
  const { role, openCanvas } = useApp()
  const { data: itis } = useLoad(() => api.itis())
  const [itiId, setItiId] = useState(context?.itiId || 'mine')
  const [showBatches, setShowBatches] = useState(false)
  const { data } = useLoad(() => api.itiDashboard(itiId), [itiId])
  useSaathiContext(data ? brief(data) : '', ['What are the three biggest gaps at this ITI?', 'Explain coverage vs attendance here.'])
  if (!data) return <Loading />
  const { iti, trades, batches, trainers, kpis, attendanceTrend, machines, machineStats, civil, grievances, registryConnected } = data
  const canSwitch = role !== 'iti_principal' && role !== 'trainer'
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="fuchsia" eyebrow={`${iti.kind === 'hub' ? 'Hub ITI' : 'Spoke ITI'} · ${iti.district} · ${registryConnected ? 'registry connected' : 'no registry feed'}`} title={iti.name}
        subtitle={`${iti.sectorFocus} · ${iti.baselineSeats} baseline → ${iti.seatCapacity} Y1 places · ${trades.length} SIP offerings · ${batches.filter(b => b.state === 'running').length} running batches`}
        right={canSwitch && itis ? <select value={itiId} onChange={e => setItiId(e.target.value)} className="text-[12px] rounded-lg border border-bdr px-2 py-1.5 bg-white">{itis.itis.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select> : null} />
      <div className="p-4 space-y-4">
        {!registryConnected && <NoFeed>Students, attendance and marks are not available for {iti.name}: the registry is not connected yet (connection due 31 Dec). Plan, budget and tasks are in the <button className="text-primary font-bold" onClick={() => openCanvas({ type: 'institute_profile', itiCode: iti.code })}>institute profile</button>.</NoFeed>}
        <StatGrid>
          <Stat label="Seat utilisation" value={fmtPct(kpis.seatUtilPct)} sub={registryConnected ? `${kpis.active} active of ${iti.seatCapacity} · ${fmtPct(kpis.womenPct)} women` : 'no feed'} tone={kpis.seatUtilPct == null ? 'slate' : kpis.seatUtilPct >= 70 ? 'emerald' : 'amber'} />
          <Stat label="Attendance (14d)" value={fmtPct(kpis.attendancePct)} sub={registryConnected ? `coverage ${fmtPct(kpis.coveragePct)} · ${kpis.needsReview} to review` : 'no feed'} tone={kpis.attendancePct == null ? 'slate' : kpis.attendancePct >= 85 ? 'emerald' : 'rose'} onClick={() => openCanvas({ type: 'institute_today', itiId: iti.id })} />
          <Stat label="Trainer vacancy" value={fmtPct(kpis.trainerVacancyPct)} sub={`${trainers.length} of ${kpis.sanctioned} planned · target <10%`} tone={kpis.trainerVacancyPct == null ? 'slate' : kpis.trainerVacancyPct <= 10 ? 'emerald' : 'amber'} />
          <Stat label="Machines functional" value={`${machineStats.functional}/${machineStats.total}`} sub={`${machineStats.awaiting} awaiting commissioning · ${machineStats.ordered} ordered`} tone={machineStats.nonFunctional ? 'rose' : 'emerald'} onClick={() => openCanvas({ type: 'machines_infra', itiId: iti.id })} />
          <Stat label="Employer-confirmed joins" value={kpis.placedVerified} sub="pre-scheme cohorts + OJT" tone="violet" onClick={() => openCanvas({ type: 'placement_pipeline', itiId: iti.id })} />
          <Stat label="Year-1 tasks" value={`${kpis.tasksTotal - kpis.tasksOverdue}/${kpis.tasksTotal}`} sub={`${kpis.tasksOverdue} overdue`} tone={kpis.tasksOverdue ? 'rose' : 'sky'} onClick={() => openCanvas({ type: 'annual_plan', itiId: iti.id })} />
          <Stat label="Civil works" value={civil.length} sub={civil.length ? `${Math.round(civil.reduce((s, w) => s + w.pctComplete, 0) / civil.length)}% avg · open` : 'none planned'} tone="amber" onClick={() => openCanvas({ type: 'civil_works', itiId: iti.id })} />
          <Stat label="Open issues / grievances" value={`${kpis.openIssues} / ${grievances.filter(g => g.status !== 'resolved').length}`} tone="rose" onClick={() => openCanvas({ type: 'daily_ops' })} />
        </StatGrid>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {registryConnected ? <LineChartCard card={{ title: 'Daily attendance · last 14 days (reported sessions)', xAxis: '', yAxis: '% present', series: [{ name: 'Present %', color: 'primary', data: attendanceTrend }] }} /> : <NoFeed>Attendance trend needs a registry feed.</NoFeed>}
          <Section tone="indigo" title="SIP offerings" hint="Places and planned enrolments for Year 1; launch period for new programmes.">
            <Table tone="indigo" columns={[
              { key: 'name', label: 'Course', render: r => <div><div className="font-semibold">{r.trade.name}</div><div className="text-[10px] text-txt-tertiary">{r.trade.code} · NSQF {r.trade.nsqfLevel}</div></div> },
              { key: 'kind', label: 'Kind', render: r => <Pill kind={r.trade.kind === 'new_specialist' ? 'info' : r.trade.kind === 'short_term' ? 'violet' : r.trade.kind === 'aggregate' ? 'neutral' : 'ok'}>{titleCase(r.trade.kind)}</Pill> },
              { key: 'y1', label: 'Y1 enrol / places', align: 'right', render: r => r.y1 ? `${r.y1.enrolments} / ${r.y1.places}` : '—' },
              { key: 'launch', label: 'Launch', render: r => <span className="text-[11px]">{r.launch}</span> },
              { key: 'batches', label: 'Batches', align: 'right', render: r => nil(r.batches || null) },
            ]} rows={trades} />
          </Section>
        </div>
        <Section tone="emerald" title={`Batches · ${batches.length}`} hint={showBatches ? undefined : `${batches.filter(b => b.state === 'running').length} running · ${batches.reduce((s, b) => s + b._count.trainees, 0).toLocaleString('en-IN')} students`} right={<div className="flex items-center gap-3"><button className="text-[11px] text-primary font-bold" onClick={() => setShowBatches(v => !v)}>{showBatches ? 'Collapse' : 'Show batches'} {showBatches ? '↑' : '↓'}</button><button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'batches', itiId: iti.id })}>Open rosters →</button></div>}>
          {showBatches && <Table tone="emerald" columns={[
            { key: 'name', label: 'Batch', render: r => <div><div className="font-semibold">{r.name}</div><div className="text-[10px] text-txt-tertiary">{r.trade.name} · lead {r.lead?.name || 'none assigned'}</div></div> },
            { key: 'trainees', label: 'Students', align: 'right', render: r => `${r._count.trainees}/${r.capacity}` },
            { key: 'tenure', label: 'Tenure', render: r => `${r.tenureMonths} months · year ${r.studyYear}` },
            { key: 'state', label: 'State', render: r => <Pill kind={stateKind(r.state)}>{r.state}</Pill> },
            { key: 'dates', label: 'Dates', render: r => `${fmtDate(r.startDate)} → ${fmtDate(r.endDate)}` },
          ]} rows={batches.slice(0, 40)} empty={registryConnected ? 'No batches.' : 'No registry feed.'} />}
          {showBatches && batches.length > 40 && <div className="text-[11px] text-txt-tertiary px-2 pt-2">Showing 40 of {batches.length}.</div>}
        </Section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section tone="amber" title="Machines & labs" right={<button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'machines_infra', itiId: iti.id })}>Full register →</button>}>
            <ul className="space-y-1.5 text-[12px]">{machines.slice(0, 8).map(m => <li key={m.id} className="flex items-center gap-2"><Pill kind={stateKind(m.status)}>{titleCase(m.status)}</Pill><span className="truncate">{m.name}</span><span className="text-[10px] text-txt-tertiary ml-auto">{m.trade?.code || m.category}</span></li>)}</ul>
          </Section>
          <Section tone="violet" title="Civil works at this ITI" right={<button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'civil_works', itiId: iti.id })}>Civil works →</button>}>
            {civil.length === 0 ? <div className="text-[12px] text-txt-tertiary">No civil works planned here.</div> : civil.map(w => <div key={w.id} className="mb-2"><div className="flex justify-between text-[12px]"><span className="font-semibold truncate">{w.title}</span><Pill kind={stateKind(w.state)}>{w.state.replace(/_/g, ' ')}</Pill></div><Bar pct={w.pctComplete} tone={w.state === 'delayed' ? 'rose' : 'auto'} /><div className="text-[10px] text-txt-tertiary">{w.packageId} · {fmtCr(w.budgetCr)} · {w.unitsAccepted}/{w.workUnits} units · due {fmtDate(w.scheduledCompletion)}</div></div>)}
          </Section>
        </div>
      </div>
    </div>
  )
}
