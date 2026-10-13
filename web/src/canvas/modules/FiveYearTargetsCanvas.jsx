// Five-year targets (Module A) — places and enrolments by course and period,
// the 27 KPI trajectories, site budgets by year, and category phasing.
import { useState } from 'react'
import BarChartCard from '../../components/cards/BarChartCard.jsx'
import LineChartCard from '../../components/cards/LineChartCard.jsx'
import DataTableCard from '../../components/cards/DataTableCard.jsx'
import AnalystCanvasShell from './_AnalystCanvasShell.jsx'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading, Section, Table, Pill, Chips } from './_ui.jsx'

export default function FiveYearTargetsCanvas({ context }) {
  const { role, meExtra } = useApp()
  const { data } = useLoad(() => api.planTargets())
  const [iti, setIti] = useState(role === 'iti_principal' ? (meExtra?.iti?.code || 'all') : 'all')
  if (!data) return <Loading />
  const { cluster, periods, clusterPlan, offerings, kpis, siteBudgets, phasing } = data
  const list = offerings.filter(o => iti === 'all' || o.iti.code === iti)
  const line = { title: 'Cluster annual places vs planned enrolments', yAxis: 'course enrolments', series: [{ name: 'Places', color: 'sky', data: clusterPlan.map(p => ({ x: p.period, y: p.places })) }, { name: 'Enrolments', color: 'primary', data: clusterPlan.map(p => ({ x: p.period, y: p.enrolments })) }], annotation: 'Enrolments are course episodes, not unique people (K01 definition). Utilisation = enrolments / places.' }
  const phasingBars = { title: 'Spend phasing by category (₹ Cr, Y1 → Y5)', unit: '₹ Cr', data: phasing.flatMap(p => p.yearly.map((v, i) => ({ label: `${p.category.slice(0, 9)} Y${i + 1}`, value: v, color: ['primary', 'sky', 'emerald', 'amber', 'violet'][i] }))).filter(d => d.value > 0.05), annotation: 'Equipment peaks in Y2–Y3; recurring categories rise each year as new programmes run.' }
  const siteTable = { title: 'Site budgets by year (₹ Cr)', columns: [{ key: 'name', label: 'ITI', type: 'text' }, { key: 'anchorCr', label: 'Anchor', type: 'number' }, ...[1, 2, 3, 4, 5].map(y => ({ key: `y${y}`, label: `Y${y}`, type: 'number' })), { key: 'totalCr', label: 'Total', type: 'number' }], rows: siteBudgets.map(s => ({ ...s, y1: s.yearly[0], y2: s.yearly[1], y3: s.yearly[2], y4: s.yearly[3], y5: s.yearly[4] })) }
  const offTable = (
    <Section title="Enrolment plan by offering" hint="Planned enrolments per period · places in grey · Y1 actual from registry where connected." right={<Chips options={[{ id: 'all', label: 'All ITIs' }, ...[...new Set(offerings.map(o => o.iti.code))].map(c => ({ id: c, label: c }))]} value={iti} onChange={setIti} />}>
      <Table columns={[
        { key: 'id', label: 'Offering', render: r => <div><div className="font-semibold">{r.iti.code} · {r.trade.name}</div><div className="text-[10px] text-txt-tertiary">{r.id} · launch {r.launch}</div></div> },
        ...periods.map((p, i) => ({ key: p, label: p, align: 'right', render: r => r.plans[i] ? <span>{r.plans[i].enrolments}<span className="text-txt-tertiary text-[10px]">/{r.plans[i].places}</span>{p === 'Y1' && r.plans[i].actualEnrolments != null && <span className="block text-[10px] text-emerald-700 font-bold">actual {r.plans[i].actualEnrolments}</span>}</span> : '·' })),
      ]} rows={list} />
    </Section>
  )
  const kpiTable = (
    <Section title="KPI trajectories K01–K27" hint="Baseline and yearly targets from the plan; 'current' only where a source exists.">
      <Table columns={[
        { key: 'code', label: 'KPI', render: r => <div><div className="font-semibold">{r.code} · {r.name}</div><div className="text-[10px] text-txt-tertiary">{r.unit} · owner {r.ownerRole || '—'}</div></div> },
        { key: 'baseline', label: 'Base', align: 'right', render: r => r.baseline ?? '—' },
        ...['Y1', 'Y2', 'Y3', 'Y4', 'Y5'].map(y => ({ key: y, label: y, align: 'right', render: r => r.targets[y] ?? '—' })),
        { key: 'current', label: 'Now', align: 'right', render: r => r.current == null ? <span className="text-txt-tertiary">—</span> : <b>{r.current}</b> },
        { key: 'status', label: 'Status', render: r => <span className="text-[10px] text-txt-secondary">{r.coverage || r.valueStatus}</span> },
      ]} rows={kpis} />
    </Section>
  )
  const saathiContext = `Five-year plan: cluster enrolments ${clusterPlan.map(p => `${p.period} ${p.enrolments}/${p.places}`).join(', ')}; site budgets ${siteBudgets.map(s => `${s.code} ₹${s.totalCr} Cr`).join(', ')}; KPIs with current values: ${kpis.filter(k => k.current != null).map(k => `${k.code} ${k.current} vs Y1 ${k.targets.Y1}`).join('; ')}.`
  return (
    <AnalystCanvasShell eyebrow={`${cluster.name} · five-year targets`} title="What the cluster has committed to, year by year." subtitle="Places, enrolments, KPIs, budgets and phasing from the SIP. Source values are kept verbatim; derived ones are labelled." toneClass="from-sky-50/70 via-white to-white"
      saathiTitle="Saathi · Targets" saathiContext={saathiContext} threadId={context?.threadId}
      cells={[
        { node: <LineChartCard card={line} />, prompt: 'Explain the enrolment ramp and what utilisation it implies each year.', span: 'half' },
        { node: <DataTableCard card={siteTable} />, prompt: 'Which ITI has the steepest Year-2 jump and what drives it?', span: 'half' },
        { node: offTable, prompt: 'Which new offerings carry the most Year-3 enrolment and are their gates on track?' },
        { node: kpiTable, prompt: 'Which KPIs will the IMA ask about first in Year 1 and do we have a source for them?' },
        { node: <BarChartCard card={phasingBars} />, prompt: 'Is the phasing realistic given current civil progress?' },
      ]}
      quickAsks={['Which KPIs have no actual source yet?', 'Compare Y1 planned vs actual enrolment at Pusa and Shahdara.', 'What does the 95% seat utilisation target require by Year 5?']} />
  )
}
