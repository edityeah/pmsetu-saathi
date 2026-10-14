// SPV CEO home screen: "track the transformation". Live data from
// /api/cluster/overview, rendered through the analyst shell so Saathi sits
// underneath and can talk to every card.

import KpiGridCard from '../../components/cards/KpiGridCard.jsx'
import BarChartCard from '../../components/cards/BarChartCard.jsx'
import DonutChartCard from '../../components/cards/DonutChartCard.jsx'
import DataTableCard from '../../components/cards/DataTableCard.jsx'
import AnalystCanvasShell from './_AnalystCanvasShell.jsx'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading, Bar, Pill, fmtDate } from './_ui.jsx'

export default function TransformationDashboardCanvas({ context }) {
  const { openCanvas } = useApp()
  const { data, err } = useLoad(() => api.overview())
  if (err) return <div className="p-6 text-sm text-danger">Could not load: {err.message}</div>
  if (!data) return <Loading />
  const { cluster, headline, kpis, utilisation, score, readiness, itis, milestonesDue } = data

  const kpiGrid = {
    title: `${cluster.name} · scheme year ${cluster.currentYear} · what the IMA sees`,
    items: [
      { label: 'Cost-weighted KPI score', value: `${score.score}%`, delta: score.score >= 80 ? '+ above 80% gate' : `- ${80 - score.score} pts to 80% gate`, tone: score.score >= 80 ? 'emerald' : 'rose', onClick: () => openCanvas({ type: 'tranche_readiness' }) },
      { label: 'Utilised of advance', value: `${utilisation.utilisedPct}%`, delta: utilisation.utilisedPct >= 75 ? '+ above 75%' : `- needs 75% (₹${utilisation.budgetCr} Cr)`, tone: utilisation.utilisedPct >= 75 ? 'emerald' : 'amber', onClick: () => openCanvas({ type: 'finance_escrow' }) },
      { label: 'Milestones verified', value: `${headline.milestonesVerified}/${headline.milestonesTotal}`, hint: `${readiness.milestoneProgressPct}% of weighted milestones`, tone: 'indigo', onClick: () => openCanvas({ type: 'milestones' }) },
      { label: 'Active students', value: headline.traineesActive.toLocaleString('en-IN'), hint: `${headline.womenPct}% women · ${headline.coverage}`, tone: 'sky', onClick: () => openCanvas({ type: 'iti_dashboard' }) },
      { label: 'Employer-confirmed joins', value: headline.placementsVerified, hint: `${headline.placementsAll} joined records · ${headline.employersActive} active MoUs`, tone: 'violet', onClick: () => openCanvas({ type: 'placement_pipeline' }) },
      { label: 'Machines functional', value: `${headline.machinesFunctionalPct}%`, hint: 'of cluster assets', tone: headline.machinesFunctionalPct >= 70 ? 'emerald' : 'amber', onClick: () => openCanvas({ type: 'machines_infra' }) },
      { label: 'Year-1 tasks', value: `${headline.tasksDone}/${headline.tasksTotal}`, hint: `${headline.tasksOverdue} overdue`, tone: headline.tasksOverdue ? 'rose' : 'teal', onClick: () => openCanvas({ type: 'milestone_board' }) },
      { label: 'Open grievances', value: headline.grievOpen, tone: headline.grievOpen > 3 ? 'rose' : 'amber', onClick: () => openCanvas({ type: 'grievances_admin' }) },
    ],
  }
  const withValue = kpis.filter(k => k.current != null)
  const kpiBars = { title: `KPIs with a source · % of the way from baseline to Year-1 target (${withValue.length} of ${kpis.length} have a value)`, unit: '% achieved', orient: 'horizontal', color: 'primary',
    annotation: `${kpis.length - withValue.length} KPIs are plan-only until their source exists (completion, placement rate, satisfaction…). The IMA only counts the ✓ verified ones.`,
    data: withValue.map(k => ({ label: `${k.verified ? '✓ ' : ''}${k.code} ${k.name.slice(0, 28)}`, value: k.achievementPct, color: k.achievementPct >= 80 ? 'emerald' : k.achievementPct >= 50 ? 'amber' : 'rose' })) }
  const spend = { title: 'Year-1 AOP spend by component', unit: '₹ Cr', annotation: `Utilised ₹${utilisation.utilisedCr} Cr of ₹${utilisation.budgetCr} Cr. Equipment carries the biggest KPI weight.`,
    data: score.byComponent.map(c => ({ label: c.label.split(' (')[0].slice(0, 22), value: c.utilisedCr })) }
  const itiTable = { title: 'Per-ITI transformation', columns: [
      { key: 'name', label: 'ITI', type: 'text' }, { key: 'kind', label: 'Role', type: 'text' }, { key: 'activeText', label: 'Students', type: 'text' }, { key: 'seatText', label: 'Seat util', type: 'text' },
      { key: 'civilPct', label: 'Civil', type: 'percent' }, { key: 'machines', label: 'Machines OK', type: 'text' }, { key: 'tasks', label: 'Tasks overdue', type: 'text' }, { key: 'placedVerified', label: 'Employer-confirmed', type: 'number' } ],
    rows: itis.map(i => ({ ...i, activeText: i.registryConnected ? String(i.active) : '— no feed', seatText: i.seatUtilPct == null ? '—' : `${i.seatUtilPct}%`, machines: `${i.machinesOk}/${i.machinesTotal}`, tasks: `${i.tasksOverdue}/${i.tasksTotal}` })), highlight: itis.some(i => !i.registryConnected) ? `${itis.filter(i => !i.registryConnected).map(i => i.name.replace('Government ITI ', '')).join(', ')}: no registry feed yet — student figures are unavailable, not zero.` : null }

  const dueList = (
    <div className="rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden">
      <div className="px-4 py-2.5 bg-gradient-to-r from-surface-page/50 to-white border-b border-bdr-light"><div className="text-[11px] font-bold uppercase tracking-wider text-primary">Next milestones for the IMA</div></div>
      <ul className="divide-y divide-bdr-light/60">
        {milestonesDue.map(m => (
          <li key={m.id} className="px-4 py-2.5 flex items-center gap-3">
            <div className="flex-1 min-w-0"><div className="text-[12px] font-bold text-txt-primary truncate">{m.title}</div><div className="text-[10px] text-txt-secondary">{m.itiCode || 'Cluster'} · due {fmtDate(m.dueAt)} · {m.weightPct}% of milestone weight</div></div>
            <Pill kind={m.state === 'submitted' ? 'warn' : m.state === 'rejected' ? 'bad' : 'info'}>{m.state}</Pill>
          </li>
        ))}
      </ul>
      <div className="px-4 py-2 text-[11px]"><button onClick={() => openCanvas({ type: 'milestones' })} className="text-primary font-bold">Open milestones →</button></div>
    </div>
  )
  const trancheBox = (
    <div className="rounded-2xl border border-bdr-light bg-white shadow-card p-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-primary mb-2">Year-{readiness.nextYear} first tranche · {readiness.firstTranche.met}/3 conditions</div>
      <div className="space-y-2.5">
        {readiness.firstTranche.conditions.map(c => <Bar key={c.id} pct={Math.min(100, 100 * c.value / c.threshold)} tone={c.ok ? 'emerald' : 'auto'} label={c.label} />)}
      </div>
      <button onClick={() => openCanvas({ type: 'tranche_readiness' })} className="mt-3 text-[11px] text-primary font-bold">Simulate what closes the gap →</button>
    </div>
  )

  const saathiContext = `Live numbers: KPI score ${score.score}% (components ${score.componentScore}/${score.componentWeight}, outcomes ${score.outcomeScore}/${score.outcomeWeight}); utilisation ${utilisation.utilisedPct}% (₹${utilisation.utilisedCr} Cr of ₹${utilisation.budgetCr} Cr); milestones verified ${headline.milestonesVerified}/${headline.milestonesTotal}; verified placements ${headline.placementsVerified}/${headline.placementsAll}; coverage ${headline.coverage}; tasks ${headline.tasksDone}/${headline.tasksTotal} done, ${headline.tasksOverdue} overdue; per-ITI: ${itis.map(i => `${i.name} ${i.registryConnected ? `seat ${i.seatUtilPct}%` : 'no registry feed'} civil ${i.civilPct}% machines ${i.machinesOk}/${i.machinesTotal} tasks overdue ${i.tasksOverdue}`).join('; ')}.`

  return (
    <AnalystCanvasShell
      eyebrow={`${cluster.name} · ${cluster.aipName}`}
      title="Here is where the transformation stands."
      subtitle={`SIP ₹${cluster.sipAmountCr} Cr approved ${fmtDate(cluster.sipApprovedAt)} · ${cluster.planYearLabel} · Pusa hub + 4 spokes · ${headline.coverage}`}
      toneClass="from-indigo-50/70 via-white to-white"
      refreshedOn={new Date().toLocaleDateString('en-IN')}
      saathiTitle="Saathi · Cluster"
      saathiContext={saathiContext}
      threadId={context?.threadId}
      cells={[
        { node: <KpiGridCard card={kpiGrid} />, prompt: 'Walk me through these headline numbers and tell me which one the IMA will challenge first.' },
        { node: trancheBox, prompt: 'What exactly do we need to do by July 2027 to release the Year-2 first tranche?', span: 'half' },
        { node: dueList, prompt: 'Which pending milestones carry the most weight and what evidence do they need?', span: 'half' },
        { node: <BarChartCard card={kpiBars} />, prompt: 'Which KPIs are furthest from target and what actions move them this quarter?' },
        { node: <BarChartCard card={spend} />, prompt: 'Is the spend mix consistent with the SIP and the 20% civil cap?', span: 'half' },
        { node: <DonutChartCard card={{ title: 'Milestone states', unit: 'milestones', data: [{ label: 'Verified', value: headline.milestonesVerified, color: 'emerald' }, { label: 'Submitted', value: milestonesDue.filter(m => m.state === 'submitted').length, color: 'amber' }, { label: 'Pending', value: headline.milestonesTotal - headline.milestonesVerified - milestonesDue.filter(m => m.state === 'submitted').length, color: 'sky' }] }} />, prompt: 'What is blocking the submitted milestones from being verified?', span: 'half' },
      ]}
      quickAsks={[
        'Are we on track for the Year-2 first tranche?',
        'Draft a one-paragraph status for the SPV board.',
        'Which civil works are behind and what should I tell the contractor?',
        'What does "verified placement" require under the License Agreement?',
        'What would the MSDE scorecard show for us today?',
      ]}
    />
  )
}
