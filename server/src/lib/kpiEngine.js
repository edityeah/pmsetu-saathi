// kpiEngine — the PM-SETU fund-release arithmetic in one place.
//
// Guidelines §4.2: from Year 2, each annual allocation is released in two
// 50% tranches. The FIRST tranche needs (a) ≥75% of the previous release
// utilised (UCs accepted), (b) the current-year AOP approved by the SSC,
// (c) ≥80% of previous-year KPI targets achieved, scored COST-WEIGHTED:
// each budget component contributes in proportion to its share of cost
// (component progress × component weight), with ~10% reserved for outcome
// KPIs (placement, salary, trainee performance, industry satisfaction).
// The SECOND tranche needs ≥50% of current-year KPIs by mid-year, industry
// and state deposits in escrow, and reporting compliance.
//
// Everything below is pure functions over rows fetched by the route, so the
// same maths drives the CEO dashboard, the IMA audit view and the state PMU.

export function costWeightedScore(budgetLines, kpis) {
  // Component block (≈90%): Σ weight_i × progress_i
  const component = budgetLines.reduce((s, l) => s + (l.kpiWeight || 0) * ((l.progressPct || 0) / 100), 0)
  const componentWeight = budgetLines.reduce((s, l) => s + (l.kpiWeight || 0), 0) // ≈ 0.9
  // Outcome block (≈10%): Σ weight_k × achievement_k, achievement clipped to [0,1]
  const outcomeWeight = 1 - componentWeight
  const kpiW = kpis.reduce((s, k) => s + (k.weight || 0), 0) || 1
  const outcome = kpis.reduce((s, k) => s + (k.weight || 0) / kpiW * kpiAchievement(k), 0) * outcomeWeight
  const total = component + outcome
  return {
    score: round(total * 100),
    componentScore: round(component * 100),
    componentWeight: round(componentWeight * 100),
    outcomeScore: round(outcome * 100),
    outcomeWeight: round(outcomeWeight * 100),
    byComponent: budgetLines.map(l => ({
      component: l.component, label: l.label, weightPct: round((l.kpiWeight || 0) * 100), progressPct: l.progressPct || 0,
      contributionPct: round((l.kpiWeight || 0) * (l.progressPct || 0)),
      budgetCr: l.budgetCr, utilisedCr: l.utilisedCr, committedCr: l.committedCr,
    })),
  }
}

// Fraction of the way from baseline to target (0..1), honouring direction.
export function kpiAchievement(k) {
  const { baseline, target, current, direction } = k
  if (target === baseline) return current >= target ? 1 : 0
  let f = direction === 'down' ? (baseline - current) / (baseline - target) : (current - baseline) / (target - baseline)
  if (!isFinite(f)) f = 0
  return Math.max(0, Math.min(1, f))
}

export function utilisation(budgetLines) {
  const budget = sum(budgetLines, 'budgetCr'), utilised = sum(budgetLines, 'utilisedCr'), committed = sum(budgetLines, 'committedCr')
  return { budgetCr: round(budget, 2), utilisedCr: round(utilised, 2), committedCr: round(committed, 2), utilisedPct: budget ? round(100 * utilised / budget) : 0, committedPct: budget ? round(100 * committed / budget) : 0 }
}

export function trancheReadiness({ budgetLines, kpis, reports, deposits, ucs, milestones, year }) {
  const util = utilisation(budgetLines)
  const score = costWeightedScore(budgetLines, kpis)
  const nextYear = (year || 1) + 1
  const aop = reports.find(r => r.kind === 'aop' && /FY2?7/.test(r.period) && r.period.includes('27-28')) || reports.find(r => r.kind === 'aop' && r.state !== 'approved')
  const aopOk = !!aop && aop.state === 'approved'
  const ucAccepted = ucs.filter(u => u.state === 'accepted').reduce((s, u) => s + u.amountCr, 0)
  const ucPct = util.budgetCr ? round(100 * ucAccepted / util.budgetCr) : 0
  const nextDeposits = deposits.filter(d => d.year === nextYear)
  const reportsOk = reports.filter(r => r.kind === 'quarterly').every(r => r.state !== 'draft' || r.dueAt > new Date())
  const verifiedWeight = milestones.filter(m => m.state === 'verified').reduce((s, m) => s + m.weightPct, 0)
  const totalWeight = milestones.reduce((s, m) => s + m.weightPct, 0) || 1

  const first = [
    { id: 'util', label: `≥75% of previous release utilised`, detail: `${util.utilisedPct}% spent (₹${util.utilisedCr} Cr of ₹${util.budgetCr} Cr); UCs accepted for ${ucPct}%`, value: util.utilisedPct, threshold: 75, ok: util.utilisedPct >= 75 },
    { id: 'aop', label: `Year-${nextYear} AOP approved by SSC`, detail: aop ? `${aop.period}: ${aop.state.replace(/_/g, ' ')}${aop.dueAt ? ' · due ' + fmtDate(aop.dueAt) : ''}` : 'Not drafted', value: aopOk ? 100 : aop?.state === 'submitted' ? 60 : aop ? 20 : 0, threshold: 100, ok: aopOk },
    { id: 'kpi', label: `≥80% of Year-${year} KPI targets (cost-weighted)`, detail: `Score ${score.score}% = components ${score.componentScore}/${score.componentWeight} + outcomes ${score.outcomeScore}/${score.outcomeWeight}`, value: score.score, threshold: 80, ok: score.score >= 80 },
  ]
  const second = [
    { id: 'mid', label: '≥50% of current-year KPI targets by mid-year', detail: `Current cost-weighted score ${score.score}%`, value: score.score, threshold: 50, ok: score.score >= 50 },
    { id: 'industry', label: 'Industry share for the year deposited in escrow', detail: depositLine(nextDeposits, 'industry'), value: depositPct(nextDeposits, 'industry'), threshold: 100, ok: depositPct(nextDeposits, 'industry') >= 100 },
    { id: 'state', label: 'State share for the year deposited in escrow', detail: depositLine(nextDeposits, 'state'), value: depositPct(nextDeposits, 'state'), threshold: 100, ok: depositPct(nextDeposits, 'state') >= 100 },
    { id: 'reports', label: 'Interim progress reports + financials submitted; IMA observations closed', detail: reportsOk ? 'All due quarterly reports submitted' : 'A due quarterly report is still in draft', value: reportsOk ? 100 : 40, threshold: 100, ok: reportsOk },
  ]
  return {
    year, nextYear, utilisation: util, score, aop,
    milestoneProgressPct: round(100 * verifiedWeight / totalWeight),
    firstTranche: { conditions: first, ready: first.every(c => c.ok), met: first.filter(c => c.ok).length },
    secondTranche: { conditions: second, ready: second.every(c => c.ok), met: second.filter(c => c.ok).length },
  }
}

function depositPct(deps, source) {
  const rows = deps.filter(d => d.source === source)
  if (!rows.length) return 0
  const due = sum(rows, 'amountCr'), done = sum(rows.filter(r => r.state === 'deposited'), 'amountCr')
  return due ? round(100 * done / due) : 0
}
function depositLine(deps, source) {
  const rows = deps.filter(d => d.source === source)
  if (!rows.length) return 'No schedule yet'
  const r = rows[0]
  return `₹${sum(rows, 'amountCr').toFixed(2)} Cr due ${fmtDate(r.dueAt)} · ${r.state}`
}
function sum(rows, k) { return rows.reduce((s, r) => s + (Number(r[k]) || 0), 0) }
function round(n, d = 0) { const f = 10 ** d; return Math.round(n * f) / f }
function fmtDate(x) { try { return new Date(x).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return '' } }
