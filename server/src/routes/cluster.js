// /api/cluster — the SPV compliance layer: SIP, budget, tranche readiness,
// civil works, procurement, escrow, UCs, milestones, reports, board items.
// Read by spv_ceo, ima_officer, state_pmu, iti_principal (scoped views).

import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../auth/middleware.js'
import { clusterFor } from '../lib/scope.js'
import { trancheReadiness, costWeightedScore, utilisation, kpiAchievement } from '../lib/kpiEngine.js'
import { notifyPrincipal } from '../lib/notify.js'

const r = Router()
r.use(requireAuth)
const J = (s, d = null) => { try { return JSON.parse(s ?? 'null') ?? d } catch { return d } }

async function bundle(clusterId) {
  const [budgetLines, kpis, reports, deposits, ucs, milestones] = await Promise.all([
    prisma.budgetLine.findMany({ where: { clusterId }, orderBy: { budgetCr: 'desc' } }),
    prisma.kpi.findMany({ where: { clusterId }, orderBy: { code: 'asc' } }),
    prisma.report.findMany({ where: { clusterId }, orderBy: { dueAt: 'asc' } }),
    prisma.escrowDeposit.findMany({ where: { clusterId }, orderBy: [{ year: 'asc' }, { source: 'asc' }] }),
    prisma.utilisationCertificate.findMany({ where: { clusterId }, orderBy: { period: 'asc' } }),
    prisma.milestone.findMany({ where: { clusterId }, orderBy: { dueAt: 'asc' }, include: { verifiedBy: { select: { name: true } } } }),
  ])
  return { budgetLines, kpis, reports, deposits, ucs, milestones }
}
const kpiView = k => ({ ...k, targets: J(k.targets, {}), achievementPct: k.current == null ? null : Math.round(100 * kpiAchievement(k)) })

// Headline overview: the "track the transformation" screen.
r.get('/overview', async (req, res, next) => {
  try {
    const c = await clusterFor(req.user)
    const b = await bundle(c.id)
    const itis = await prisma.iti.findMany({ where: { clusterId: c.id }, orderBy: [{ kind: 'asc' }, { name: 'asc' }], include: { _count: { select: { trainees: { where: { status: 'active' } }, batches: { where: { state: 'running' } }, machines: true } } } })
    const [traineesActive, traineesWomen, trainersCount, joinedAll, joinedConfirmed, grievOpen, machinesAll, machinesFunctional, newSpecialist, shortTerm, tasksOverdue, tasksTotal, tasksDone, employersActive] = await Promise.all([
      prisma.trainee.count({ where: { iti: { clusterId: c.id }, status: 'active' } }),
      prisma.trainee.count({ where: { iti: { clusterId: c.id }, status: 'active', gender: 'F' } }),
      prisma.user.count({ where: { role: 'trainer' } }),
      prisma.application.count({ where: { stage: { in: ['joined', 'follow_up'] }, trainee: { iti: { clusterId: c.id } } } }),
      prisma.application.count({ where: { stage: { in: ['joined', 'follow_up'] }, evidenceLevel: { in: ['employer_confirmed', 'independently_verified'] }, trainee: { iti: { clusterId: c.id } } } }),
      prisma.grievance.count({ where: { status: { not: 'resolved' } } }),
      prisma.machine.count({ where: { iti: { clusterId: c.id } } }),
      prisma.machine.count({ where: { iti: { clusterId: c.id }, status: { in: ['functional', 'installed'] } } }),
      prisma.trade.count({ where: { kind: 'new_specialist', status: 'approved' } }),
      prisma.trade.count({ where: { kind: 'short_term' } }),
      prisma.planTask.count({ where: { clusterId: c.id, dueAt: { lt: new Date() }, state: { notIn: ['completed', 'reviewed'] } } }),
      prisma.planTask.count({ where: { clusterId: c.id } }),
      prisma.planTask.count({ where: { clusterId: c.id, state: { in: ['completed', 'reviewed'] } } }),
      prisma.employer.count({ where: { clusterId: c.id, relationshipStatus: 'active' } }),
    ])
    const perIti = []
    for (const i of itis) {
      const [places, civil, machinesOk, machinesTotal, joined, tOverdue, tTotal] = await Promise.all([
        prisma.offeringPlan.aggregate({ where: { offering: { itiId: i.id }, period: 'Y1' }, _sum: { places: true, enrolments: true } }),
        prisma.civilWork.findMany({ where: { itiId: i.id } }),
        prisma.machine.count({ where: { itiId: i.id, status: { in: ['functional', 'installed'] } } }),
        prisma.machine.count({ where: { itiId: i.id } }),
        prisma.application.count({ where: { stage: { in: ['joined', 'follow_up'] }, evidenceLevel: { in: ['employer_confirmed', 'independently_verified'] }, trainee: { itiId: i.id } } }),
        prisma.planTask.count({ where: { itiId: i.id, dueAt: { lt: new Date() }, state: { notIn: ['completed', 'reviewed'] } } }),
        prisma.planTask.count({ where: { itiId: i.id } }),
      ])
      const civilPct = civil.length ? Math.round(civil.reduce((s, w) => s + w.pctComplete * w.budgetCr, 0) / Math.max(0.001, civil.reduce((s, w) => s + w.budgetCr, 0))) : 0
      const active = i._count.trainees
      perIti.push({ id: i.id, code: i.code, name: i.name, kind: i.kind, district: i.district, registryConnected: i.registryConnected, seatCapacity: i.seatCapacity, baselineSeats: i.baselineSeats, seatsPlanned: places._sum.places || 0, enrolmentTargetY1: places._sum.enrolments || 0, active: i.registryConnected ? active : null, seatUtilPct: i.registryConnected && i.seatCapacity ? Math.round(100 * active / i.seatCapacity) : null, civilPct, machinesOk, machinesTotal, placedVerified: joined, tasksOverdue: tOverdue, tasksTotal: tTotal, fiveYearCr: i.fiveYearCr })
    }
    const readiness = trancheReadiness({ ...b, year: c.currentYear })
    res.json({
      cluster: c,
      kpis: b.kpis.map(kpiView),
      headline: {
        traineesActive, womenPct: traineesActive ? Math.round(100 * traineesWomen / traineesActive) : 0, trainersCount, coverage: `${itis.filter(i => i.registryConnected).length} of ${itis.length} ITIs reporting`,
        placementsVerified: joinedConfirmed, placementsAll: joinedAll, grievOpen, machinesFunctionalPct: machinesAll ? Math.round(100 * machinesFunctional / machinesAll) : 0,
        newCts: newSpecialist, shortTerm, milestonesVerified: b.milestones.filter(m => m.state === 'verified').length, milestonesTotal: b.milestones.length,
        tasksOverdue, tasksTotal, tasksDone, employersActive,
      },
      utilisation: readiness.utilisation, score: readiness.score, readiness, itis: perIti,
      milestonesDue: b.milestones.filter(m => m.state !== 'verified').slice(0, 6),
    })
  } catch (e) { next(e) }
})

r.get('/tranche-readiness', async (req, res, next) => {
  try {
    const c = await clusterFor(req.user)
    const b = await bundle(c.id)
    res.json({ cluster: c, ...trancheReadiness({ ...b, year: c.currentYear }), budgetLines: b.budgetLines, kpis: b.kpis.map(kpiView) })
  } catch (e) { next(e) }
})

// "What if" — simulate component progress / KPI changes without saving.
r.post('/tranche-readiness/simulate', async (req, res, next) => {
  try {
    const body = z.object({ progress: z.record(z.number()).optional(), kpis: z.record(z.number()).optional() }).parse(req.body || {})
    const c = await clusterFor(req.user)
    const b = await bundle(c.id)
    const lines = b.budgetLines.map(l => ({ ...l, progressPct: body.progress?.[l.component] ?? l.progressPct }))
    const kpis = b.kpis.map(k => ({ ...k, current: body.kpis?.[k.code] ?? k.current }))
    res.json({ score: costWeightedScore(lines, kpis), utilisation: utilisation(lines) })
  } catch (e) { next(e) }
})

r.get('/budget', async (req, res, next) => {
  try {
    const c = await clusterFor(req.user)
    const [lines, packages] = await Promise.all([
      prisma.budgetLine.findMany({ where: { clusterId: c.id }, orderBy: { budgetCr: 'desc' } }),
      prisma.package.findMany({ where: { clusterId: c.id }, include: { iti: { select: { code: true } } }, orderBy: { id: 'asc' } }),
    ])
    const civilCr = packages.filter(p => p.category === 'Civil').reduce((s, p) => s + p.totalCr, 0)
    res.json({ cluster: c, lines, totals: utilisation(lines), packages: packages.map(p => ({ ...p, yearly: J(p.yearly, {}) })),
      sip: { totalCr: c.sipAmountCr, centreCr: +(c.sipAmountCr * 0.5).toFixed(2), stateCr: +(c.sipAmountCr * 0.33).toFixed(2), industryCr: +(c.sipAmountCr * 0.17).toFixed(2), civilCapCr: +(c.sipAmountCr * 0.2).toFixed(2), civilPlannedCr: +civilCr.toFixed(2), envelopeY1Cr: c.envelopeY1Cr } })
  } catch (e) { next(e) }
})

r.get('/civil', async (req, res, next) => {
  try {
    const c = await clusterFor(req.user)
    const works = await prisma.civilWork.findMany({ where: { iti: { clusterId: c.id } }, include: { iti: { select: { code: true, name: true, kind: true } } }, orderBy: { scheduledCompletion: 'asc' } })
    res.json({ works })
  } catch (e) { next(e) }
})

r.post('/civil/:id/progress', requireRole('spv_ceo', 'iti_principal'), async (req, res, next) => {
  try {
    const body = z.object({ pctComplete: z.number().min(0).max(100), state: z.string().optional() }).parse(req.body)
    const w = await prisma.civilWork.update({ where: { id: req.params.id }, data: { pctComplete: body.pctComplete, unitsAccepted: Math.round(body.pctComplete * 0.8), state: body.state || (body.pctComplete >= 100 ? 'complete' : 'in_progress') } })
    res.json({ work: w })
  } catch (e) { next(e) }
})

// CEO asks the ITI principal for the current situation on a civil work.
r.post('/civil/:id/ask', requireRole('spv_ceo', 'ima_officer'), async (req, res, next) => {
  try {
    const body = z.object({ question: z.string().min(2) }).parse(req.body)
    const w = await prisma.civilWork.findUnique({ where: { id: req.params.id } })
    if (!w) return res.status(404).json({ error: 'not_found' })
    await notifyPrincipal(w.itiId, { title: `Status requested: ${w.title}`, message: `${req.user.name} asks: ${body.question}`, category: 'civil', priority: 'high', action: { label: 'Open civil works', type: 'OPEN_CIVIL_WORKS' } })
    res.json({ ok: true })
  } catch (e) { next(e) }
})

r.get('/procurement', async (req, res, next) => {
  try {
    const c = await clusterFor(req.user)
    const packages = await prisma.procurementPackage.findMany({ where: { clusterId: c.id }, orderBy: { code: 'asc' } })
    res.json({ packages: packages.map(p => ({ ...p, forItiCodes: J(p.forItiCodes, []) })) })
  } catch (e) { next(e) }
})

// CEO asks the receiving ITI(s) how a procurement package is progressing.
r.post('/procurement/:id/ask', requireRole('spv_ceo', 'ima_officer'), async (req, res, next) => {
  try {
    const body = z.object({ question: z.string().min(2), itiCode: z.string().optional() }).parse(req.body)
    const p = await prisma.procurementPackage.findUnique({ where: { id: req.params.id } })
    if (!p) return res.status(404).json({ error: 'not_found' })
    const codes = body.itiCode ? [body.itiCode] : J(p.forItiCodes, [])
    const itis = await prisma.iti.findMany({ where: { code: { in: codes } } })
    for (const i of itis) await notifyPrincipal(i.id, { title: `Progress check: ${p.title}`, message: `${req.user.name} asks: ${body.question}`, category: 'procurement', priority: 'high', action: { label: 'Open procurement', type: 'OPEN_PROCUREMENT' } })
    res.json({ ok: true, notified: itis.map(i => i.code) })
  } catch (e) { next(e) }
})

r.post('/procurement/:id/advance', requireRole('spv_ceo'), async (req, res, next) => {
  try {
    const order = ['planned', 'tendered', 'awarded', 'delivered', 'installed', 'closed']
    const p = await prisma.procurementPackage.findUnique({ where: { id: req.params.id } })
    if (!p) return res.status(404).json({ error: 'not_found' })
    const next_ = order[Math.min(order.indexOf(p.state) + 1, order.length - 1)]
    const stamp = next_ === 'tendered' ? { tenderedAt: new Date() } : next_ === 'awarded' ? { awardedAt: new Date(), awardedTo: p.awardedTo || req.body?.awardedTo || 'L1 bidder (GeM)' } : next_ === 'delivered' ? { deliveredAt: new Date() } : next_ === 'installed' ? { unitsInstalled: p.inventoryUnits } : {}
    const up = await prisma.procurementPackage.update({ where: { id: p.id }, data: { state: next_, ...stamp } })
    res.json({ package: up })
  } catch (e) { next(e) }
})

r.get('/finance', async (req, res, next) => {
  try {
    const c = await clusterFor(req.user)
    const [deposits, ucs, lines] = await Promise.all([
      prisma.escrowDeposit.findMany({ where: { clusterId: c.id }, orderBy: [{ year: 'asc' }, { tranche: 'asc' }, { source: 'asc' }] }),
      prisma.utilisationCertificate.findMany({ where: { clusterId: c.id }, orderBy: { period: 'asc' } }),
      prisma.budgetLine.findMany({ where: { clusterId: c.id } }),
    ])
    const inEscrow = deposits.filter(d => d.state === 'deposited').reduce((s, d) => s + d.amountCr, 0)
    const util = utilisation(lines)
    res.json({ cluster: c, deposits, ucs, utilisation: util, escrow: { depositedCr: +inEscrow.toFixed(2), balanceCr: +(inEscrow - util.utilisedCr).toFixed(2), pendingCr: +deposits.filter(d => d.state !== 'deposited').reduce((s, d) => s + d.amountCr, 0).toFixed(2) } })
  } catch (e) { next(e) }
})

r.post('/finance/uc/:id/submit', requireRole('spv_ceo'), async (req, res, next) => {
  try {
    const uc = await prisma.utilisationCertificate.update({ where: { id: req.params.id }, data: { caCertified: true, submittedAt: new Date(), state: 'submitted' } })
    res.json({ uc })
  } catch (e) { next(e) }
})

r.get('/milestones', async (req, res, next) => {
  try {
    const c = await clusterFor(req.user)
    const milestones = await prisma.milestone.findMany({ where: { clusterId: c.id }, orderBy: [{ dueAt: 'asc' }], include: { verifiedBy: { select: { name: true } } } })
    res.json({ milestones })
  } catch (e) { next(e) }
})

r.post('/milestones/:id/submit', requireRole('spv_ceo', 'iti_principal'), async (req, res, next) => {
  try {
    const body = z.object({ evidenceNote: z.string().optional(), evidenceUrl: z.string().optional() }).parse(req.body || {})
    const m = await prisma.milestone.update({ where: { id: req.params.id }, data: { state: 'submitted', submittedAt: new Date(), evidenceNote: body.evidenceNote || 'Evidence pack uploaded by SPV.', evidenceUrl: body.evidenceUrl || '/demo/evidence.pdf', rejectNote: null } })
    await prisma.notification.create({ data: { type: 'system', title: 'Milestone submitted for verification', category: 'milestone', priority: 'high', targetRoles: JSON.stringify(['ima_officer']), message: `${m.title} — evidence submitted by the SPV.`, action: JSON.stringify({ label: 'Verify', type: 'OPEN_VERIFICATION_QUEUE' }) } })
    res.json({ milestone: m })
  } catch (e) { next(e) }
})

r.post('/milestones/:id/verify', requireRole('ima_officer'), async (req, res, next) => {
  try {
    const body = z.object({ decision: z.enum(['verified', 'rejected']), note: z.string().optional() }).parse(req.body)
    const m = await prisma.milestone.update({ where: { id: req.params.id }, data: body.decision === 'verified'
      ? { state: 'verified', verifiedAt: new Date(), verifiedByUserId: req.user.id, rejectNote: null }
      : { state: 'rejected', rejectNote: body.note || 'Evidence insufficient — resubmit.', verifiedAt: null } })
    if (m.taskId) await prisma.planTask.update({ where: { id: m.taskId }, data: body.decision === 'verified' ? { state: 'reviewed', reviewNote: 'Verified by IMA' } : { state: 'returned', reviewNote: body.note || 'Returned by IMA' } }).catch(() => null)
    await prisma.notification.create({ data: { type: 'system', title: body.decision === 'verified' ? 'Milestone verified by IMA' : 'Milestone returned by IMA', category: 'milestone', priority: 'high', targetRoles: JSON.stringify(['spv_ceo']), message: `${m.title}${body.note ? ' — ' + body.note : ''}`, action: JSON.stringify({ label: 'Open milestones', type: 'OPEN_MILESTONES' }) } })
    res.json({ milestone: m })
  } catch (e) { next(e) }
})

r.get('/reports', async (req, res, next) => {
  try {
    const c = await clusterFor(req.user)
    res.json({ reports: await prisma.report.findMany({ where: { clusterId: c.id }, orderBy: { dueAt: 'asc' } }) })
  } catch (e) { next(e) }
})

// Build a quarterly "report pack" from live data — the thing the IMA wants.
r.get('/reports/pack', async (req, res, next) => {
  try {
    const c = await clusterFor(req.user)
    const b = await bundle(c.id)
    const [enrol, dropouts, apps, spells, grievances, civil, procurement, tasks, coverage] = await Promise.all([
      prisma.trainee.count({ where: { iti: { clusterId: c.id }, status: 'active' } }),
      prisma.trainee.count({ where: { iti: { clusterId: c.id }, status: 'dropped' } }),
      prisma.application.groupBy({ by: ['stage'], _count: { _all: true }, where: { trainee: { iti: { clusterId: c.id } } } }),
      prisma.employmentSpell.groupBy({ by: ['type'], _count: { _all: true }, _sum: { hoursLogged: true }, where: { trainee: { iti: { clusterId: c.id } } } }),
      prisma.grievance.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.civilWork.findMany({ where: { iti: { clusterId: c.id } }, include: { iti: { select: { name: true } } } }),
      prisma.procurementPackage.findMany({ where: { clusterId: c.id } }),
      prisma.planTask.groupBy({ by: ['state'], _count: { _all: true }, where: { clusterId: c.id } }),
      prisma.iti.findMany({ where: { clusterId: c.id }, select: { code: true, registryConnected: true } }),
    ])
    res.json({
      cluster: c, period: 'FY26-27 Q2 (Aug–Sep)', generatedAt: new Date(), coverage: `${coverage.filter(i => i.registryConnected).length} of ${coverage.length} ITIs registry-connected`,
      sections: {
        operations: { enrolmentActive: enrol, dropouts, placementsByState: apps.map(p => ({ state: p.stage, count: p._count._all })), spells: spells.map(s => ({ type: s.type, count: s._count._all, hours: s._sum.hoursLogged || 0 })), grievances: grievances.map(g => ({ status: g.status, count: g._count._all })) },
        plan: { tasksByState: tasks.map(t => ({ state: t.state, count: t._count._all })) },
        upgradation: { civil: civil.map(w => ({ iti: w.iti.name, title: w.title, pct: w.pctComplete, state: w.state, budgetCr: w.budgetCr })), procurement: procurement.map(p => ({ code: p.code, title: p.title, state: p.state, budgetCr: p.budgetCr })) },
        kpis: b.kpis.map(k => ({ code: k.code, name: k.name, baseline: k.baseline, target: k.target, current: k.current, coverage: k.coverage, valueStatus: k.valueStatus, unit: k.unit, verified: k.verified, achievementPct: k.current == null ? null : Math.round(100 * kpiAchievement(k)) })),
        finance: { utilisation: utilisation(b.budgetLines), deposits: b.deposits, ucs: b.ucs },
        score: costWeightedScore(b.budgetLines, b.kpis),
      },
    })
  } catch (e) { next(e) }
})

r.post('/reports/:id/submit', requireRole('spv_ceo'), async (req, res, next) => {
  try {
    const rep = await prisma.report.update({ where: { id: req.params.id }, data: { state: 'submitted', submittedAt: new Date() } })
    await prisma.notification.create({ data: { type: 'system', title: `${rep.kind === 'aop' ? 'AOP' : 'Report'} submitted: ${rep.period}`, category: 'report', priority: 'high', targetRoles: JSON.stringify(['ima_officer', 'state_pmu']), message: 'Submitted by the SPV CEO for IMA review and SSC approval.', action: JSON.stringify({ label: 'Review', type: 'OPEN_REPORT_REVIEW' }) } })
    res.json({ report: rep })
  } catch (e) { next(e) }
})

r.post('/reports/:id/review', requireRole('ima_officer', 'state_pmu'), async (req, res, next) => {
  try {
    const body = z.object({ decision: z.enum(['reviewed', 'approved', 'returned']), note: z.string().optional() }).parse(req.body)
    const data = body.decision === 'reviewed' ? { state: 'ima_reviewed', imaReviewedAt: new Date() }
      : body.decision === 'approved' ? { state: 'approved', sscApprovedAt: new Date(), imaReviewedAt: new Date() }
      : { state: 'returned', summary: body.note || 'Returned with observations.' }
    const rep = await prisma.report.update({ where: { id: req.params.id }, data })
    await prisma.notification.create({ data: { type: 'system', title: `${rep.period}: ${rep.state.replace(/_/g, ' ')}`, category: 'report', priority: 'normal', targetRoles: JSON.stringify(['spv_ceo']), message: body.note || 'Status updated by the reviewer.' } })
    res.json({ report: rep })
  } catch (e) { next(e) }
})

r.get('/board', async (req, res, next) => {
  try {
    const c = await clusterFor(req.user)
    res.json({ items: await prisma.boardItem.findMany({ where: { clusterId: c.id }, orderBy: [{ state: 'desc' }, { meetingDate: 'asc' }] }) })
  } catch (e) { next(e) }
})

r.post('/board/:id/decide', requireRole('spv_ceo'), async (req, res, next) => {
  try {
    const body = z.object({ decision: z.enum(['approved', 'rejected']) }).parse(req.body)
    res.json({ item: await prisma.boardItem.update({ where: { id: req.params.id }, data: { state: body.decision } }) })
  } catch (e) { next(e) }
})

r.get('/kpis', async (req, res, next) => {
  try {
    const c = await clusterFor(req.user)
    const kpis = await prisma.kpi.findMany({ where: { clusterId: c.id }, orderBy: { code: 'asc' } })
    res.json({ kpis: kpis.map(kpiView) })
  } catch (e) { next(e) }
})

r.post('/kpis/:id/verify', requireRole('ima_officer'), async (req, res, next) => {
  try {
    const body = z.object({ verified: z.boolean(), current: z.number().optional() }).parse(req.body)
    res.json({ kpi: kpiView(await prisma.kpi.update({ where: { id: req.params.id }, data: { verified: body.verified, ...(body.current != null ? { current: body.current, currentAsOf: new Date() } : {}) } })) })
  } catch (e) { next(e) }
})

export default r
