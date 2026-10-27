// Five-year targets (Module A), in reading order: spend phasing (one stacked
// bar per year, split by category or by ITI), the enrolment ramp and site
// budgets, the 27 KPI trajectories, and the enrolment plan by offering
// (long, so it stays folded until asked for).
import { useState } from 'react'
import StackedBarCard from '../../components/cards/StackedBarCard.jsx'
import LineChartCard from '../../components/cards/LineChartCard.jsx'
import DataTableCard from '../../components/cards/DataTableCard.jsx'
import AnalystCanvasShell from './_AnalystCanvasShell.jsx'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading, Section, Table, Chips } from './_ui.jsx'

const r1 = v => (v == null || v === '' ? v : Math.round(Number(v) * 10) / 10)

export default function FiveYearTargetsCanvas({ context }) {
  const { role, meExtra } = useApp()
  const { data } = useLoad(() => api.planTargets())
  const [iti, setIti] = useState(role === 'iti_principal' ? (meExtra?.iti?.code || 'all') : 'all')
  const [split, setSplit] = useState('category')
  const [showPlan, setShowPlan] = useState(false)
  if (!data) return <Loading />
  const { cluster, periods, clusterPlan, offerings, kpis, siteBudgets, phasing, phasingByIti = [] } = data
  const list = offerings.filter(o => iti === 'all' || o.iti.code === iti)

  // Spend phasing: Y1…Y5 bars, stacked by category (cluster or one ITI) or by ITI.
  const years = ['Y1', 'Y2', 'Y3', 'Y4', 'Y5']
  let keys, rows
  if (split === 'iti') {
    keys = phasingByIti.map(r => r.code)
    rows = years.map((y, i) => ({ label: y, ...Object.fromEntries(phasingByIti.map(r => [r.code, +Object.values(r.byCategory).reduce((s, v) => s + (v[i] || 0), 0).toFixed(2)])) }))
  } else {
    const src = iti === 'all' ? Object.fromEntries(phasing.map(p => [p.category, p.yearly])) : (phasingByIti.find(r => r.code === iti)?.byCategory || {})
    keys = Object.keys(src).sort((a, b) => src[b].reduce((x, y) => x + y, 0) - src[a].reduce((x, y) => x + y, 0))
    rows = years.map((y, i) => ({ label: y, ...Object.fromEntries(keys.map(k => [k, +(src[k][i] || 0).toFixed(2)])) }))
  }
  const totalsByYear = rows.map(r => keys.reduce((s, k) => s + (r[k] || 0), 0))
  const peak = totalsByYear.indexOf(Math.max(...totalsByYear))
  const phasingCard = { title: `Spend phasing · ${iti === 'all' ? 'cluster' : iti} · by ${split === 'iti' ? 'ITI' : 'category'}`, unit: '₹ Cr', keys, data: rows,
    annotation: `Each bar is one year of the SIP; segments are the ${split === 'iti' ? 'institutes' : 'categories'} that make it up. Peak year Y${peak + 1} at ₹${totalsByYear[peak].toFixed(1)} Cr; equipment lands mostly in Y2–Y3, recurring lines rise as new programmes run.` }
  const phasingControls = (
    <div className="flex items-center gap-2 flex-wrap">
      <Chips options={[{ id: 'category', label: 'By category' }, { id: 'iti', label: 'By ITI' }]} value={split} onChange={setSplit} />
      {role !== 'iti_principal' && <Chips options={[{ id: 'all', label: 'All ITIs' }, ...siteBudgets.map(s => ({ id: s.code, label: s.code }))]} value={iti} onChange={setIti} />}
    </div>
  )

  const line = { title: 'Cluster annual places vs planned enrolments', yAxis: 'course enrolments', series: [{ name: 'Places', color: 'sky', data: clusterPlan.map(p => ({ x: p.period, y: p.places })) }, { name: 'Enrolments', color: 'primary', data: clusterPlan.map(p => ({ x: p.period, y: p.enrolments })) }], annotation: 'Enrolments are course episodes, not unique people (K01 definition). Utilisation = enrolments / places.' }
  const siteTable = { title: 'Site budgets by year (₹ Cr)', columns: [{ key: 'name', label: 'ITI', type: 'text' }, { key: 'anchorCr', label: 'Anchor', type: 'number' }, ...[1, 2, 3, 4, 5].map(y => ({ key: `y${y}`, label: `Y${y}`, type: 'number' })), { key: 'totalCr', label: 'Total', type: 'number' }], rows: siteBudgets.map(s => ({ ...s, y1: s.yearly[0], y2: s.yearly[1], y3: s.yearly[2], y4: s.yearly[3], y5: s.yearly[4] })) }
  const kpiTable = (
    <Section tone="indigo" title="KPI trajectories K01–K27" hint="Baseline and yearly targets from the plan; 'current' only where a source exists.">
      <Table tone="indigo" columns={[
        { key: 'code', label: 'KPI', render: r => <div><div className="font-semibold">{r.code} · {r.name}</div><div className="text-[10px] text-txt-tertiary">{r.unit} · owner {r.ownerRole || '—'}</div></div> },
        { key: 'baseline', label: 'Base', align: 'right', render: r => r1(r.baseline) ?? '—' },
        ...years.map(y => ({ key: y, label: y, align: 'right', render: r => r1(r.targets[y]) ?? '—' })),
        { key: 'current', label: 'Now', align: 'right', render: r => r.current == null ? <span className="text-txt-tertiary">—</span> : <b>{r1(r.current)}</b> },
        { key: 'status', label: 'Status', render: r => <span className="text-[10px] text-txt-secondary">{r.coverage || r.valueStatus}</span> },
      ]} rows={kpis} />
    </Section>
  )
  const offTable = (
    <Section tone="emerald" title={`Enrolment plan by offering · ${list.length} offerings`} hint="Planned enrolments per period · places in grey · Y1 actual from registry where connected." right={<button className="text-[11px] text-primary font-bold" onClick={() => setShowPlan(s => !s)}>{showPlan ? 'Hide' : 'Show plan'} →</button>}>
      {showPlan ? <Table tone="emerald" columns={[
        { key: 'id', label: 'Offering', render: r => <div><div className="font-semibold">{r.iti.code} · {r.trade.name}</div><div className="text-[10px] text-txt-tertiary">{r.id} · launch {r.launch}</div></div> },
        ...periods.map((p, i) => ({ key: p, label: p, align: 'right', render: r => r.plans[i] ? <span>{r.plans[i].enrolments}<span className="text-txt-tertiary text-[10px]">/{r.plans[i].places}</span>{p === 'Y1' && r.plans[i].actualEnrolments != null && <span className="block text-[10px] text-emerald-700 font-bold">actual {r.plans[i].actualEnrolments}</span>}</span> : '·' })),
      ]} rows={list} /> : <div className="text-[12px] text-txt-secondary">Cluster plan: {clusterPlan.filter(p => p.period !== 'Baseline').map(p => `${p.period} ${p.enrolments.toLocaleString('en-IN')}/${p.places.toLocaleString('en-IN')}`).join(' · ')}. Open the plan to see every offering by period.</div>}
    </Section>
  )
  const saathiContext = `Five-year plan: spend phasing by year ${years.map((y, i) => `${y} ₹${totalsByYear[i].toFixed(1)} Cr`).join(', ')} (by category: ${phasing.map(p => `${p.category} ₹${p.totalCr} Cr`).join(', ')}); cluster enrolments ${clusterPlan.map(p => `${p.period} ${p.enrolments}/${p.places}`).join(', ')}; site budgets ${siteBudgets.map(s => `${s.code} ₹${s.totalCr} Cr`).join(', ')}; KPIs with current values: ${kpis.filter(k => k.current != null).map(k => `${k.code} ${k.current} vs Y1 ${k.targets.Y1}`).join('; ')}.`
  return (
    <AnalystCanvasShell eyebrow={`${cluster.name} · five-year targets`} title="What the cluster has committed to, year by year." subtitle="Spend phasing, enrolment ramp, KPI trajectories and the enrolment plan from the SIP. Source values are kept verbatim; derived ones are labelled." toneClass="from-sky-50/70 via-white to-white"
      saathiContext={saathiContext}
      cells={[
        { node: <StackedBarCard card={phasingCard} right={phasingControls} />, prompt: 'Is the phasing realistic given current civil progress? Which year is the crunch?' },
        { node: <LineChartCard card={line} />, prompt: 'Explain the enrolment ramp and what utilisation it implies each year.', span: 'half' },
        { node: <DataTableCard card={siteTable} />, prompt: 'Which ITI has the steepest Year-2 jump and what drives it?', span: 'half' },
        { node: kpiTable, prompt: 'Which KPIs will the IMA ask about first in Year 1 and do we have a source for them?' },
        { node: offTable, prompt: 'Which new offerings carry the most Year-3 enrolment and are their gates on track?' },
      ]}
      quickAsks={['Which KPIs have no actual source yet?', 'Compare Y1 planned vs actual enrolment at Pusa and Shahdara.', 'What does the 95% seat utilisation target require by Year 5?']} />
  )
}
