// SIP budget — the five-year envelope and the Year-1 AOP lines.
import { api } from '../../api/client.js'
import { Hero, Stat, StatGrid, Bar, Section, Table, Loading, useLoad, fmtCr, Pill } from './_ui.jsx'
import DonutChartCard from '../../components/cards/DonutChartCard.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

export default function SipBudgetCanvas() {
  const { data } = useLoad(() => api.budget())
  useSaathiContext(data ? brief(data) : '', ['Are we within the 20% civil cap?', 'Which category is under-spent for month 3?'])
  if (!data) return <Loading />
  const { cluster, lines, totals, sip, packages } = data
  const byCat = {}
  for (const p of packages) { const c = byCat[p.category] ||= { category: p.category, totalCr: 0, n: 0, y1: 0 }; c.totalCr += p.totalCr; c.n++; c.y1 += p.yearly[1] || 0 }
  const civil = lines.find(l => l.component === 'civil')
  const capex = lines.filter(l => l.capex).reduce((s, l) => s + l.budgetCr, 0)
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="amber" eyebrow="Strategic Investment Plan" title={`SIP ₹${cluster.sipAmountCr} Cr · Year-${cluster.currentYear} envelope ₹${sip.envelopeY1Cr} Cr · planned ₹${totals.budgetCr} Cr`} subtitle={`${packages.length} work packages across five ITIs (civil 36, digital 18.3, equipment 67.7, recurring 91). Civil planned ₹${sip.civilPlannedCr} Cr against the 20% cap of ₹${sip.civilCapCr} Cr.`} />
      <div className="p-4 space-y-4">
        <StatGrid>
          <Stat label="Centre (50% scenario)" value={fmtCr(sip.centreCr)} sub="capital-funded within total" tone="indigo" />
          <Stat label="State (33% scenario)" value={fmtCr(sip.stateCr)} sub="no entitlement asserted" tone="sky" />
          <Stat label="Industry (17% scenario)" value={fmtCr(sip.industryCr)} sub="actual contribution not yet recorded" tone="emerald" />
          <Stat label="Civil cap (20%)" value={fmtCr(sip.civilCapCr)} sub={`5-yr civil ${fmtCr(sip.civilPlannedCr)} · Y1 ${fmtCr(civil?.budgetCr)}`} tone={sip.civilPlannedCr > sip.civilCapCr ? 'rose' : 'amber'} />
        </StatGrid>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DonutChartCard card={{ title: 'Year-1 by category (₹ Cr)', unit: '₹ Cr', annotation: `Capex ${Math.round(100 * capex / totals.budgetCr)}% of Year 1; equipment peaks in Years 2–3.`, data: lines.map(l => ({ label: l.label.split(' (')[0], value: l.budgetCr })) }} />
          <Section tone="indigo" title="Utilisation" hint="UCs certified by the CA against each line; PFMS-matched.">
            <div className="space-y-3">
              {lines.map(l => (
                <div key={l.id}>
                  <div className="flex justify-between text-[11px]"><span className="font-semibold truncate pr-2">{l.label}</span><span className="text-txt-secondary whitespace-nowrap">{fmtCr(l.utilisedCr)} / {fmtCr(l.budgetCr)}</span></div>
                  <Bar pct={100 * l.utilisedCr / l.budgetCr} tone="auto" />
                </div>
              ))}
              <div className="pt-2 border-t border-bdr-light text-[12px] flex justify-between"><span>Total utilised</span><b>{totals.utilisedPct}% · {fmtCr(totals.utilisedCr)}</b></div>
            </div>
          </Section>
        </div>
        <Section tone="emerald" title="Five-year packages by category" hint="66 packages; each has a yearly AOP record. Task budgets are never added on top.">
          <Table tone="emerald" columns={[{ key: 'category', label: 'Category' }, { key: 'n', label: 'Packages', align: 'right' }, { key: 'totalCr', label: '5-year', align: 'right', render: r => fmtCr(r.totalCr) }, { key: 'y1', label: 'Year 1', align: 'right', render: r => fmtCr(r.y1) }]} rows={Object.values(byCat).sort((a, b) => b.totalCr - a.totalCr)} />
        </Section>
        <Section tone="amber" title="Year-1 budget lines" hint="Weights feed the cost-weighted KPI score used for tranche release.">
          <Table tone="amber" columns={[
            { key: 'label', label: 'Line', render: r => <div><div className="font-semibold">{r.label}</div><Pill kind={r.capex ? 'info' : 'neutral'}>{r.capex ? 'capex' : 'opex'}</Pill></div> },
            { key: 'budgetCr', label: 'Budget', align: 'right', render: r => fmtCr(r.budgetCr) },
            { key: 'committedCr', label: 'Committed', align: 'right', render: r => fmtCr(r.committedCr) },
            { key: 'utilisedCr', label: 'Utilised', align: 'right', render: r => fmtCr(r.utilisedCr) },
            { key: 'progressPct', label: 'Physical', align: 'right', render: r => `${r.progressPct}%` },
            { key: 'kpiWeight', label: 'KPI weight', align: 'right', render: r => `${Math.round(r.kpiWeight * 100)}%` },
          ]} rows={lines} />
        </Section>
      </div>
    </div>
  )
}
