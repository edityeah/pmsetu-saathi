// Cluster Home (Module A) — the CEO's first screen: five ITIs, Year-1
// envelope vs planned vs spent, task states, launch gates, triggered risks,
// pending change requests, headline KPIs with their coverage.
import KpiGridCard from '../../components/cards/KpiGridCard.jsx'
import BarChartCard from '../../components/cards/BarChartCard.jsx'
import DataTableCard from '../../components/cards/DataTableCard.jsx'
import AnalystCanvasShell from './_AnalystCanvasShell.jsx'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading, Pill, Section, fmtCr, nil, stateKind } from './_ui.jsx'

export default function ClusterHomeCanvas({ context }) {
  const { openCanvas } = useApp()
  const { data, err } = useLoad(() => api.planHome())
  if (err) return <div className="p-6 text-sm text-danger">Could not load: {err.message}</div>
  if (!data) return <Loading />
  const { cluster, itis, byCategory, y1, tasksSummary, gates, risks, kpis, changes, milestones, coverage } = data
  const pendingChanges = changes.filter(c => c.state === 'proposed')
  const k = code => kpis.find(x => x.code === code)
  const kpiItem = (code, label, tone) => { const x = k(code); return { label, value: x?.current == null ? '—' : `${x.current}${x.unit === 'percent' ? '%' : ''}`, hint: x?.current == null ? (x?.valueStatus || 'no source yet') : `Y1 target ${x.targets?.Y1}${x.unit === 'percent' ? '%' : ''} · ${x.coverage || 'cluster'}`, tone } }

  const grid = { title: `${cluster.planYearLabel} · month ${y1.monthOfYear} of 12`, items: [
    { label: 'Year-1 envelope', value: fmtCr(y1.envelopeCr), hint: '10% advance scenario', tone: 'indigo', onClick: () => openCanvas({ type: 'sip_budget' }) },
    { label: 'Planned Y1 spend', value: fmtCr(y1.plannedCr), hint: `headroom ${fmtCr(y1.headroomCr)}`, tone: y1.headroomCr >= 0 ? 'emerald' : 'rose', onClick: () => openCanvas({ type: 'annual_plan' }) },
    { label: 'Spent so far', value: fmtCr(y1.spentCr), hint: `${Math.round(100 * y1.spentCr / y1.plannedCr)}% of plan`, tone: 'sky', onClick: () => openCanvas({ type: 'finance_escrow' }) },
    { label: 'Tasks overdue', value: tasksSummary.overdue, delta: tasksSummary.byState.blocked ? `${tasksSummary.byState.blocked} blocked` : undefined, hint: `${tasksSummary.byState.returned} returned · ${tasksSummary.byState.reported_complete} awaiting review`, tone: tasksSummary.overdue ? 'rose' : 'emerald', onClick: () => openCanvas({ type: 'milestone_board' }) },
    { label: 'Tasks done', value: `${tasksSummary.byState.completed + tasksSummary.byState.reviewed}/${tasksSummary.total}`, hint: `${tasksSummary.byState.in_progress} in progress`, tone: 'violet', onClick: () => openCanvas({ type: 'annual_plan' }) },
    { label: 'Launch gates', value: `${gates.passed}/${gates.total}`, hint: `${gates.ready} ready · ${gates.pending} pending`, tone: 'amber', onClick: () => openCanvas({ type: 'five_year_targets' }) },
    { label: 'ITIs reporting', value: `${coverage.connected} of ${coverage.total}`, hint: 'registry-connected', tone: coverage.connected < coverage.total ? 'amber' : 'emerald', onClick: () => openCanvas({ type: 'cluster_operations' }) },
    { label: 'IMA milestones', value: `${milestones.verified}/${milestones.total}`, hint: `${milestones.submitted} submitted · ${milestones.rejected} returned`, tone: 'teal', onClick: () => openCanvas({ type: 'milestones' }) },
  ] }
  const kpiGrid = { title: 'Headline KPIs · value where a source exists, otherwise "—"', items: [kpiItem('K01', 'Annual enrolment', 'indigo'), kpiItem('K02', 'Seat utilisation', 'sky'), kpiItem('K11', 'Female enrolment', 'fuchsia'), kpiItem('K04', 'Placement rate', 'violet'), kpiItem('K08', 'Civil completion', 'amber'), kpiItem('K09', 'Equipment installed', 'teal'), kpiItem('K06', 'Employer MoUs', 'emerald'), kpiItem('K07', 'Apprenticeships', 'rose')] }
  const catBars = { title: 'Year-1 by category · planned vs spent (₹ Cr)', unit: '₹ Cr', orient: 'horizontal', annotation: 'Civil carries the largest Year-1 line (enabling works). Equipment is phased mostly to Year 2–3.', data: byCategory.sort((a, b) => b.y1Cr - a.y1Cr).map(c => ({ label: c.category, value: +c.y1Cr.toFixed(2), color: c.spentCr / c.y1Cr > 0.3 ? 'emerald' : 'primary' })) }
  const itiTable = { title: 'Five ITIs · plan and status', columns: [
    { key: 'name', label: 'ITI', type: 'text' }, { key: 'kind', label: 'Role', type: 'text' }, { key: 'fiveYearCr', label: '5-yr ₹ Cr', type: 'number' }, { key: 'y1Cr', label: 'Y1 ₹ Cr', type: 'number' }, { key: 'spentY1Cr', label: 'Spent', type: 'number' },
    { key: 'tasksText', label: 'Tasks done / overdue', type: 'text' }, { key: 'gatesPending', label: 'Gates pending', type: 'number' }, { key: 'students', label: 'Students', type: 'text' }, { key: 'registry', label: 'Registry', type: 'text' } ],
    rows: itis.map(i => ({ ...i, tasksText: `${i.tasks.done}/${i.tasks.total} · ${i.tasks.overdue} overdue${i.tasks.blocked ? ` · ${i.tasks.blocked} blocked` : ''}`, students: i.registryConnected ? String(i._count.trainees) : '— (no feed)', registry: i.registryConnected ? 'connected' : 'pending' })),
    highlight: itis.some(i => !i.registryConnected) ? `${itis.filter(i => !i.registryConnected).map(i => i.name.replace('Government ITI ', '')).join(', ')}: no registry feed yet, so operations figures are not available.` : null }
  const risksBox = (
    <Section title="Risks · triggered first" hint="From the SIP risk register; decision rules apply before any target is revised." right={<button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'milestone_board' })}>Board →</button>}>
      <ul className="space-y-1.5 text-[12px]">{[...risks].sort((a, b) => (b.state === 'triggered') - (a.state === 'triggered')).slice(0, 5).map(r => <li key={r.id} className="flex items-start gap-2"><Pill kind={r.state === 'triggered' ? 'bad' : r.state === 'closed' ? 'ok' : 'info'}>{r.state}</Pill><div><b>{r.id} · {r.risk}</b> <span className="text-txt-secondary">— {r.response}</span><div className="text-[10px] text-txt-tertiary">owner {r.ownerRole} · {r.cadence} · rule: {r.decisionRule}</div></div></li>)}</ul>
    </Section>
  )
  const changesBox = (
    <Section title={`Change requests · ${pendingChanges.length} awaiting decision`} hint="Logged before any target or date is revised; formal approvals are routed, never implied.">
      {changes.length === 0 ? <div className="text-[12px] text-txt-tertiary">None.</div> : <ul className="space-y-1.5 text-[12px]">{changes.slice(0, 5).map(c => <li key={c.id} className="flex items-start gap-2"><Pill kind={stateKind(c.state)}>{c.state.replace(/_/g, ' ')}</Pill><div><b>{c.title}</b> <span className="text-txt-tertiary">({c.itiCode || 'cluster'} · {c.proposer.name})</span><div className="text-[10px] text-txt-secondary">{c.currentValue} → {c.proposedValue} · {c.reason}</div></div></li>)}</ul>}
      <div className="mt-2"><button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'milestone_board' })}>Decide on the milestone board →</button></div>
    </Section>
  )
  const saathiContext = `Cluster home numbers: envelope ₹${y1.envelopeCr} Cr, planned ₹${y1.plannedCr} Cr, spent ₹${y1.spentCr} Cr (month ${y1.monthOfYear}); tasks ${JSON.stringify(tasksSummary.byState)} overdue ${tasksSummary.overdue}; gates ${gates.passed}/${gates.total} passed, ${gates.ready} ready; registry-connected ${coverage.connected} of ${coverage.total}; per ITI: ${itis.map(i => `${i.code} 5yr ₹${i.fiveYearCr} Cr, Y1 ₹${i.y1Cr} Cr spent ₹${i.spentY1Cr} Cr, tasks ${i.tasks.done}/${i.tasks.total} overdue ${i.tasks.overdue} blocked ${i.tasks.blocked}, registry ${i.registryConnected}`).join('; ')}; triggered risks ${risks.filter(r => r.state === 'triggered').map(r => r.id + ' ' + r.risk).join(', ')}; pending changes ${pendingChanges.map(c => c.title).join('; ') || 'none'}.`
  return (
    <AnalystCanvasShell eyebrow={`${cluster.code} · ${cluster.name}`} title="Where the five-year plan stands this month." subtitle={`SIP ₹${cluster.sipAmountCr} Cr · ${cluster.aipName} · ${cluster.planYearLabel}`} toneClass="from-violet-50/70 via-white to-white"
      refreshedOn={new Date().toLocaleDateString('en-IN')} saathiTitle="Saathi · Cluster" saathiContext={saathiContext} threadId={context?.threadId}
      cells={[
        { node: <KpiGridCard card={grid} />, prompt: 'Summarise the Year-1 position in five lines for the board.' },
        { node: <DataTableCard card={itiTable} />, prompt: 'Which ITI is slipping on its Year-1 tasks and what is blocking it?' },
        { node: <BarChartCard card={catBars} />, prompt: 'Is the Year-1 spend profile consistent with the phasing in the SIP?', span: 'half' },
        { node: <KpiGridCard card={kpiGrid} />, prompt: 'Which KPIs have a real source today and which are still plan-only?', span: 'half' },
        { node: risksBox, prompt: 'What should we do about the triggered risks this month?', span: 'half' },
        { node: changesBox, prompt: 'Should I approve the pending change requests? What do they affect?', span: 'half' },
      ]}
      quickAsks={['What is overdue and who owns it?', 'Which launch gates must pass before Year-2 intakes?', 'Draft the Year-1 status note for the SSC.', 'Where will the Year-2 first tranche fail if nothing changes?']} />
  )
}
