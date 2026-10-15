// Budget Analytics — section 1. Opens on Utilisation: the Year-1 AOP
// allocation by line, what is committed and utilised, and the certified
// utilisation certificates behind the figure. Export gives the same table
// as a CSV the CEO can send on.
import { useState } from 'react'
import { Download } from 'lucide-react'
import BarChartCard from '../../components/cards/BarChartCard.jsx'
import FilterBar from './_FilterBar.jsx'
import { api } from '../../api/client.js'
import { useLoad, Loading, Hero, Stat, StatGrid, Bar, Section, Table, Tabs, Pill, fmtCr, fmtDate } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

const TABS = [{ id: 'utilisation', label: 'Utilisation' }]

export default function BudgetAnalyticsCanvas({ context }) {
  const f0 = context?.filters || {}
  const [tab, setTab] = useState(context?.tab || 'utilisation')
  const [year, setYear] = useState(String(f0.year || 1))
  const { data } = useLoad(() => api.aopUtilisation({ year }), [year])
  useSaathiContext(data ? `Budget analytics · utilisation: ${brief(data.totals)}; lines ${data.lines.map(l => `${l.label} ₹${l.utilisedCr}/${l.budgetCr} Cr (${l.utilisedPct}%)`).join('; ')}` : '', ['Which line is furthest behind on utilisation?', 'How much more must be certified to reach the 75% gate?'])
  if (!data) return <Loading />
  const { totals, lines, ucs, cluster } = data
  const bars = { title: 'Utilised against allocation by line (₹ Cr)', unit: '₹ Cr', orient: 'horizontal', annotation: `Utilised ₹${totals.utilisedCr} Cr of ₹${totals.budgetCr} Cr (${totals.utilisedPct}%); committed ${totals.committedPct}%. The Year-2 first tranche needs 75% utilised and certified.`, data: lines.map(l => ({ label: l.label.split(' (')[0], value: l.utilisedCr, color: l.utilisedPct >= 50 ? 'emerald' : l.utilisedPct >= 25 ? 'amber' : 'rose' })) }
  function exportCsv() {
    const rows = [['Line', 'Type', 'Allocation (Cr)', 'Committed (Cr)', 'Utilised (Cr)', 'Utilised %', 'Physical %'], ...lines.map(l => [l.label, l.capex ? 'capex' : 'opex', l.budgetCr, l.committedCr, l.utilisedCr, l.utilisedPct, l.progressPct]), ['Total', '', totals.budgetCr, totals.committedCr, totals.utilisedCr, totals.utilisedPct, '']]
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `AOP-year-${year}-utilisation-${cluster.code}.csv`; a.click()
  }
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="amber" eyebrow="Budget analytics" title={`Year-${year} AOP: ${fmtCr(totals.utilisedCr)} utilised of ${fmtCr(totals.budgetCr)} approved`} subtitle="Utilisation is what the Chartered Accountant has certified against each line; committed is contracted but not yet paid." right={<button onClick={exportCsv} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white border border-bdr text-[11px] font-bold text-txt-primary hover:bg-surface-page"><Download className="w-3.5 h-3.5" /> Export report</button>} />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      <FilterBar items={[{ label: 'AOP year', value: year, options: [{ id: '1', label: 'Year 1' }], onChange: setYear }, { label: 'Scope', value: 'Cluster' }]} note={`${cluster.name}`} />
      <div className="p-4 space-y-4">
        <StatGrid>
          <Stat label="Approved allocation" value={fmtCr(totals.budgetCr)} sub={`envelope ${fmtCr(cluster.envelopeY1Cr)}`} tone="indigo" />
          <Stat label="Utilised" value={`${totals.utilisedPct}%`} sub={fmtCr(totals.utilisedCr)} tone={totals.utilisedPct >= 75 ? 'emerald' : 'amber'} />
          <Stat label="Committed" value={`${totals.committedPct}%`} sub={fmtCr(totals.committedCr)} tone="sky" />
          <Stat label="Headroom to 75% gate" value={`${Math.max(0, 75 - totals.utilisedPct)} pts`} sub={`₹${Math.max(0, +(0.75 * totals.budgetCr - totals.utilisedCr).toFixed(2))} Cr more to certify`} tone="rose" />
        </StatGrid>
        <BarChartCard card={bars} />
        <Section title="Allocation, committed and utilised by line" hint="Physical progress is the component's own measure (works complete, units installed, hires made).">
          <Table columns={[
            { key: 'label', label: 'Line', render: r => <div><div className="font-semibold">{r.label}</div><Pill kind={r.capex ? 'info' : 'neutral'}>{r.capex ? 'capex' : 'opex'}</Pill></div> },
            { key: 'budgetCr', label: 'Allocation', align: 'right', render: r => fmtCr(r.budgetCr) },
            { key: 'committedCr', label: 'Committed', align: 'right', render: r => fmtCr(r.committedCr) },
            { key: 'utilisedCr', label: 'Utilised', align: 'right', render: r => fmtCr(r.utilisedCr) },
            { key: 'utilisedPct', label: 'Utilised %', render: r => <div className="min-w-[120px]"><Bar pct={r.utilisedPct} label={`${r.utilisedPct}%`} tone="auto" /></div> },
            { key: 'progressPct', label: 'Physical', align: 'right', render: r => `${r.progressPct}%` },
          ]} rows={lines} />
        </Section>
        <Section title="Utilisation certificates" hint="Certified by the SPV head of finance and a CA; accepted by the SPMU.">
          <Table columns={[{ key: 'period', label: 'Period' }, { key: 'amountCr', label: 'Amount', align: 'right', render: r => fmtCr(r.amountCr) }, { key: 'submittedAt', label: 'Submitted', render: r => fmtDate(r.submittedAt) }, { key: 'state', label: 'State', render: r => <Pill kind={r.state === 'accepted' ? 'ok' : 'warn'}>{r.state}</Pill> }, { key: 'pfms', label: 'PFMS', render: r => r.pfmsMatched ? 'matched' : 'pending' }]} rows={ucs} empty="No certificates yet." />
        </Section>
      </div>
    </div>
  )
}
