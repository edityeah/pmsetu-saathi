// State scorecard — the State PMU's portfolio view: every cluster in the
// state at its stage, with utilisation, KPI score and milestone progress for
// the operational ones. MSDE publishes a similar scorecard nationally.
import KpiGridCard from '../../components/cards/KpiGridCard.jsx'
import DataTableCard from '../../components/cards/DataTableCard.jsx'
import BarChartCard from '../../components/cards/BarChartCard.jsx'
import AnalystCanvasShell from './_AnalystCanvasShell.jsx'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading } from './_ui.jsx'

export default function StateScorecardCanvas({ context }) {
  const { openCanvas } = useApp()
  const { data } = useLoad(() => api.scorecard())
  if (!data) return <Loading />
  const live = data.clusters.filter(c => c.live)
  const delhi = live[0]
  const kpiGrid = { title: `${data.state} · PM-SETU portfolio`, items: [
    { label: 'Clusters in state', value: data.clusters.length, hint: `${live.length} operational`, tone: 'indigo' },
    { label: 'SIP approved', value: `₹${live.reduce((s, c) => s + c.sipCr, 0).toFixed(0)} Cr`, hint: `${data.clusters.filter(c => c.status === 'sip_review').length} in SSC review`, tone: 'emerald' },
    { label: 'Active trainees', value: live.reduce((s, c) => s + (c.active || 0), 0).toLocaleString('en-IN'), tone: 'sky' },
    { label: 'Verified placements', value: live.reduce((s, c) => s + c.placementsVerified, 0), tone: 'violet' },
    { label: 'National: approved', value: data.national.approvedClusters, hint: `₹${data.national.approvedCr.toLocaleString('en-IN')} Cr · 9 states`, tone: 'amber' },
    { label: 'National: ITIs identified', value: data.national.identifiedItis, hint: `${data.national.hubs} hubs · ${data.national.spokes} spokes`, tone: 'teal' },
  ] }
  const table = { title: 'Clusters', columns: [{ key: 'name', label: 'Cluster', type: 'text' }, { key: 'aipName', label: 'AIP', type: 'text' }, { key: 'stage', label: 'Stage', type: 'text' }, { key: 'sipCr', label: 'SIP ₹ Cr', type: 'number' }, { key: 'utilisedPct', label: 'Utilised', type: 'percent' }, { key: 'score', label: 'KPI score', type: 'percent' }, { key: 'milestonesPct', label: 'Milestones', type: 'percent' }], rows: data.clusters, highlight: delhi && delhi.score < 80 ? `${delhi.name}: KPI score ${delhi.score}% is below the 80% tranche gate (${delhi.coverage}; ${delhi.tasksOverdue} Year-1 tasks overdue). Year-2 first tranche at risk unless civil, equipment and registry connection accelerate.` : null }
  const bars = { title: 'Delhi cluster · KPIs with a source vs Year-1 target', unit: '%', orient: 'horizontal', color: 'primary', annotation: 'Only KPIs with an actual value are shown; the rest are plan-only this early in Year 1.', data: (delhi?.kpis || []).filter(k => k.current != null).map(k => ({ label: `${k.code} ${k.name.slice(0, 26)}`, value: k.achievementPct, color: k.achievementPct >= 80 ? 'emerald' : k.achievementPct >= 50 ? 'amber' : 'rose' })) }
  const readiness = delhi?.readiness
  const conditions = readiness ? (
    <div className="rounded-2xl border border-bdr-light bg-white shadow-card p-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-primary mb-2">{delhi.name} · Year-{readiness.nextYear} first tranche</div>
      <ul className="space-y-1.5 text-[12px]">{readiness.firstTranche.conditions.map(c => <li key={c.id} className="flex items-start gap-2"><span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${c.ok ? 'bg-emerald-500' : 'bg-rose-500'}`} /><div><div className="font-semibold">{c.label}</div><div className="text-[11px] text-txt-secondary">{c.detail}</div></div></li>)}</ul>
      <div className="mt-2 text-[11px]"><button onClick={() => openCanvas({ type: 'tranche_readiness' })} className="text-primary font-bold">State share for Year 2 due Jul 2027 · open tranche view →</button></div>
    </div>
  ) : null
  return (
    <AnalystCanvasShell eyebrow={`State PMU · ${data.state} Training & Technical Education`} title="Where every cluster in the state stands." subtitle="One operational cluster (CL-DL-01), two illustrative pipeline clusters. The SSC meets quarterly; this is its scorecard." toneClass="from-fuchsia-50/60 via-white to-white"
      refreshedOn={new Date().toLocaleDateString('en-IN')} saathiTitle="Saathi · State" saathiContext={`State portfolio: ${data.clusters.map(c => `${c.name} (${c.aipName}, ${c.stage}, SIP ₹${c.sipCr} Cr, utilised ${c.utilisedPct}%, KPI ${c.score}%)`).join('; ')}. National: ${data.national.approvedClusters} clusters approved worth ₹${data.national.approvedCr} Cr.`} threadId={context?.threadId}
      cells={[
        { node: <KpiGridCard card={kpiGrid} />, prompt: 'Summarise the state portfolio for the Chief Secretary in five lines.' },
        { node: <DataTableCard card={table} />, prompt: 'Which cluster needs SSC attention this quarter and why?' },
        { node: conditions, prompt: 'What must the state do before July 2027 for the Delhi tranche?', span: 'half' },
        { node: <BarChartCard card={bars} />, prompt: 'Which Delhi KPIs would fail an MSDE scorecard today?', span: 'half' },
      ]}
      quickAsks={['Draft the SSC agenda for the next quarterly review', 'Compare Delhi with other approved clusters nationally', 'What is the state share due and when?', 'Which EOIs should we push to RFP next?']} />
  )
}
