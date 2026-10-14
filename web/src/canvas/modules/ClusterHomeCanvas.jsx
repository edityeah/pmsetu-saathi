// Cluster Home (Module A) — the CEO's first screen, in reading order:
//   1. the money: funding split, Year-1 by category and by ITI, five-year
//      packages by category (the SIP budget, folded in here)
//   2. where Year 1 stands this month (every tile opens its module)
//   3. headline KPIs as a table: baseline · target · current · source
//   4. risks (triggered first) and change requests awaiting a decision
import KpiGridCard from '../../components/cards/KpiGridCard.jsx'
import DonutChartCard from '../../components/cards/DonutChartCard.jsx'
import AnalystCanvasShell from './_AnalystCanvasShell.jsx'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading, Pill, Section, Table, Bar, Stat, StatGrid, fmtCr, stateKind } from './_ui.jsx'

const HEADLINE = ['K01', 'K02', 'K11', 'K04', 'K03', 'K08', 'K09', 'K06', 'K07', 'K05']

export default function ClusterHomeCanvas({ context }) {
  const { openCanvas } = useApp()
  const { data, err } = useLoad(() => api.planHome())
  const { data: budget } = useLoad(() => api.budget())
  if (err) return <div className="p-6 text-sm text-danger">Could not load: {err.message}</div>
  if (!data || !budget) return <Loading />
  const { cluster, itis, byCategory, y1, tasksSummary, gates, risks, kpis, changes, milestones, coverage } = data
  const { sip, lines, packages, totals } = budget
  const pendingChanges = changes.filter(c => c.state === 'proposed')
  const civilLine = lines.find(l => l.component === 'civil')
  const byCat = {}
  for (const p of packages) { const c = byCat[p.category] ||= { category: p.category, totalCr: 0, n: 0, y1: 0 }; c.totalCr += p.totalCr; c.n++; c.y1 += p.yearly[1] || 0 }

  // 1. The money
  const funding = (
    <StatGrid>
      <Stat label="Centre (50% scenario)" value={fmtCr(sip.centreCr)} sub="capital-funded within total" tone="indigo" />
      <Stat label="State (33% scenario)" value={fmtCr(sip.stateCr)} sub="no entitlement asserted" tone="sky" />
      <Stat label="Industry (17% scenario)" value={fmtCr(sip.industryCr)} sub="actual contribution not yet recorded" tone="emerald" />
      <Stat label="Civil cap (20%)" value={fmtCr(sip.civilCapCr)} sub={`5-yr civil ${fmtCr(sip.civilPlannedCr)} · Y1 ${fmtCr(civilLine?.budgetCr)}`} tone={sip.civilPlannedCr > sip.civilCapCr ? 'rose' : 'amber'} />
    </StatGrid>
  )
  const catDonut = { title: 'Year-1 by category (₹ Cr)', unit: '₹ Cr', annotation: `Planned ₹${totals.budgetCr} Cr against the envelope of ₹${sip.envelopeY1Cr} Cr. Civil is the largest Year-1 line; equipment peaks in Years 2–3.`, data: lines.map(l => ({ label: l.label.split(' (')[0], value: l.budgetCr })) }
  const byIti = (
    <Section title="Year-1 by ITI (₹ Cr)" hint="Planned Year-1 allocation per institute and what has been spent so far. Tap an ITI to open its profile." right={<span className="text-[10px] text-txt-tertiary">planned · spent</span>}>
      <div className="space-y-2.5">
        {[...itis].sort((a, b) => b.y1Cr - a.y1Cr).map(i => (
          <button key={i.id} onClick={() => openCanvas({ type: 'institute_profile', itiCode: i.code })} className="w-full text-left">
            <div className="flex justify-between text-[11px]"><span className="font-semibold truncate pr-2">{i.name.replace('Government ITI ', '')} <span className="text-txt-tertiary font-normal">· {i.kind}</span></span><span className="text-txt-secondary whitespace-nowrap">{fmtCr(i.spentY1Cr)} / {fmtCr(i.y1Cr)}</span></div>
            <Bar pct={i.y1Cr ? 100 * i.spentY1Cr / i.y1Cr : 0} tone="auto" />
          </button>
        ))}
        <div className="pt-2 border-t border-bdr-light text-[12px] flex justify-between"><span>Cluster Year 1</span><b>{fmtCr(y1.spentCr)} spent of {fmtCr(y1.plannedCr)} · headroom {fmtCr(y1.headroomCr)}</b></div>
      </div>
    </Section>
  )
  const pkgTable = (
    <Section title="Five-year packages by category" hint={`${packages.length} packages; each has a yearly AOP record. Task budgets are never added on top.`}>
      <Table columns={[{ key: 'category', label: 'Category' }, { key: 'n', label: 'Packages', align: 'right' }, { key: 'totalCr', label: '5-year', align: 'right', render: r => fmtCr(r.totalCr) }, { key: 'y1', label: 'Year 1', align: 'right', render: r => fmtCr(r.y1) }, { key: 'share', label: 'Share', align: 'right', render: r => `${Math.round(100 * r.totalCr / cluster.sipAmountCr)}%` }]} rows={Object.values(byCat).sort((a, b) => b.totalCr - a.totalCr)} />
    </Section>
  )

  // 2. Year 1 this month
  const grid = { title: `${cluster.planYearLabel} · month ${y1.monthOfYear} of 12`, items: [
    { label: 'Year-1 envelope', value: fmtCr(y1.envelopeCr), hint: '10% advance scenario', tone: 'indigo', onClick: () => openCanvas({ type: 'annual_plan' }) },
    { label: 'Planned Y1 spend', value: fmtCr(y1.plannedCr), hint: `headroom ${fmtCr(y1.headroomCr)}`, tone: y1.headroomCr >= 0 ? 'emerald' : 'rose', onClick: () => openCanvas({ type: 'annual_plan' }) },
    { label: 'Spent so far', value: fmtCr(y1.spentCr), hint: `${Math.round(100 * y1.spentCr / y1.plannedCr)}% of plan`, tone: 'sky', onClick: () => openCanvas({ type: 'finance_escrow' }) },
    { label: 'Tasks overdue', value: tasksSummary.overdue, delta: tasksSummary.byState.blocked ? `${tasksSummary.byState.blocked} blocked` : undefined, hint: `${tasksSummary.byState.returned} returned · ${tasksSummary.byState.reported_complete} awaiting review`, tone: tasksSummary.overdue ? 'rose' : 'emerald', onClick: () => openCanvas({ type: 'milestone_board' }) },
    { label: 'Tasks done', value: `${tasksSummary.byState.completed + tasksSummary.byState.reviewed}/${tasksSummary.total}`, hint: `${tasksSummary.byState.in_progress} in progress`, tone: 'violet', onClick: () => openCanvas({ type: 'annual_plan' }) },
    { label: 'Launch gates', value: `${gates.passed}/${gates.total}`, hint: `${gates.ready} ready · ${gates.pending} pending`, tone: 'amber', onClick: () => openCanvas({ type: 'five_year_targets' }) },
    { label: 'ITIs reporting', value: `${coverage.connected} of ${coverage.total}`, hint: 'registry-connected', tone: coverage.connected < coverage.total ? 'amber' : 'emerald', onClick: () => openCanvas({ type: 'iti_dashboard' }) },
    { label: 'IMA milestones', value: `${milestones.verified}/${milestones.total}`, hint: `${milestones.submitted} submitted · ${milestones.rejected} returned`, tone: 'teal', onClick: () => openCanvas({ type: 'milestones' }) },
  ] }

  // 3. Headline KPIs as a table
  const headlineRows = HEADLINE.map(code => kpis.find(k => k.code === code)).filter(Boolean)
  const unit = k => k.unit === 'percent' ? '%' : ''
  const r1 = v => v == null ? null : Math.round(v * 10) / 10
  const kpiTable = (
    <Section title="Headline KPIs · baseline, target, current position" hint="A current value appears only where a source exists; otherwise the owner who will produce it is named." right={<button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'five_year_targets' })}>All 27 KPIs →</button>}>
      <Table columns={[
        { key: 'code', label: 'KPI', render: r => <div><div className="font-semibold">{r.code} · {r.name}</div><div className="text-[10px] text-txt-tertiary">{r.unit}{r.ownerRole ? ` · owner ${r.ownerRole}` : ''}</div></div> },
        { key: 'baseline', label: 'Baseline', align: 'right', render: r => r.baseline == null ? <span className="text-txt-tertiary">{r.baselineText || '—'}</span> : `${r1(r.baseline)}${unit(r)}` },
        { key: 'target', label: 'Y1 target', align: 'right', render: r => <b>{r1(r.targets?.Y1 ?? r.target) ?? '—'}{(r.targets?.Y1 ?? r.target) != null ? unit(r) : ''}</b> },
        { key: 'y5', label: 'Y5 target', align: 'right', render: r => <span className="text-txt-secondary">{r1(r.targets?.Y5) ?? '—'}{r.targets?.Y5 != null ? unit(r) : ''}</span> },
        { key: 'current', label: 'Current', align: 'right', render: r => r.current == null ? <span className="text-txt-tertiary">—</span> : <b className={r.target && r.current >= r.target ? 'text-emerald-700' : 'text-amber-700'}>{r.current}{unit(r)}</b> },
        { key: 'progress', label: 'To Y1 target', render: r => { const t = r.targets?.Y1 ?? r.target; return r.current == null || !t ? <span className="text-[10px] text-txt-tertiary">no source yet</span> : <div className="min-w-[110px]"><Bar pct={Math.min(100, 100 * r.current / t)} tone="auto" /></div> } },
        { key: 'coverage', label: 'Source / coverage', render: r => <span className="text-[10px] text-txt-secondary">{r.current == null ? (r.valueStatus || 'pending') : (r.coverage || r.actualSource || 'cluster')}</span> },
      ]} rows={headlineRows} />
    </Section>
  )

  // 4. Risks and changes
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

  const saathiContext = `Cluster home: SIP ₹${cluster.sipAmountCr} Cr (Centre ₹${sip.centreCr} Cr, State ₹${sip.stateCr} Cr, Industry ₹${sip.industryCr} Cr; civil cap ₹${sip.civilCapCr} Cr vs planned ₹${sip.civilPlannedCr} Cr). Year 1: envelope ₹${y1.envelopeCr} Cr, planned ₹${y1.plannedCr} Cr, spent ₹${y1.spentCr} Cr (month ${y1.monthOfYear}); by category ${lines.map(l => `${l.label.split(' (')[0]} ₹${l.budgetCr} Cr`).join(', ')}; per ITI: ${itis.map(i => `${i.code} Y1 ₹${i.y1Cr} Cr spent ₹${i.spentY1Cr} Cr, tasks ${i.tasks.done}/${i.tasks.total} overdue ${i.tasks.overdue} blocked ${i.tasks.blocked}, registry ${i.registryConnected}`).join('; ')}. Tasks ${JSON.stringify(tasksSummary.byState)} overdue ${tasksSummary.overdue}; gates ${gates.passed}/${gates.total}; ITIs reporting ${coverage.connected}/${coverage.total}. Headline KPIs: ${headlineRows.map(k => `${k.code} ${k.name}: baseline ${k.baseline ?? '—'}, Y1 target ${k.targets?.Y1 ?? '—'}, current ${k.current ?? 'no source'}`).join('; ')}. Triggered risks ${risks.filter(r => r.state === 'triggered').map(r => r.id + ' ' + r.risk).join(', ')}; pending changes ${pendingChanges.map(c => c.title).join('; ') || 'none'}.`
  return (
    <AnalystCanvasShell eyebrow={`${cluster.code} · ${cluster.name}`} title="Where the five-year plan stands this month." subtitle={`SIP ₹${cluster.sipAmountCr} Cr · ${cluster.aipName} · ${cluster.planYearLabel}`} toneClass="from-violet-50/70 via-white to-white"
      refreshedOn={new Date().toLocaleDateString('en-IN')} saathiContext={saathiContext}
      cells={[
        { node: funding, prompt: 'Explain the funding split and whether the civil cap is respected.' },
        { node: <DonutChartCard card={catDonut} />, prompt: 'Is the Year-1 spend profile consistent with the phasing in the SIP?', span: 'half' },
        { node: byIti, prompt: 'Which ITI is spending slowest against its Year-1 allocation and why?', span: 'half' },
        { node: pkgTable, prompt: 'Which category carries the most five-year money and when does it land?' },
        { node: <KpiGridCard card={grid} />, prompt: 'Summarise the Year-1 position in five lines for the board.' },
        { node: kpiTable, prompt: 'Which headline KPIs are behind their Year-1 target and which have no source yet?' },
        { node: risksBox, prompt: 'What should we do about the triggered risks this month?', span: 'half' },
        { node: changesBox, prompt: 'Should I approve the pending change requests? What do they affect?', span: 'half' },
      ]}
      quickAsks={['What is overdue and who owns it?', 'Are we within the 20% civil cap?', 'Which KPIs have a real source today and which are still plan-only?', 'Draft the Year-1 status note for the SSC.', 'Where will the Year-2 first tranche fail if nothing changes?']} />
  )
}
