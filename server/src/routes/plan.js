// /api/plan — PRD Module A: SIP & Annual Plan Tracker.
//   cluster home · institute profiles (7 tabs) · 5-year targets · annual
//   plan (outcomes / workplan / calendar) · milestone board with dependency
//   chain · change requests · launch gates · risks · evidence rules ·
//   trainer commitments.
// Rule from the PRD: a task carries no budget of its own; money sits on the
// AOP record / package it belongs to. Missing data is shown as missing.

import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../auth/middleware.js'
import { clusterFor, itiFor, profileOf, trainerBatchIds } from '../lib/scope.js'
import { notifyPrincipal } from '../lib/notify.js'

const r = Router()
r.use(requireAuth)
const J = (s, d = null) => { try { return JSON.parse(s ?? 'null') ?? d } catch { return d } }
const now = () => new Date()

const TASK_STATES = ['planned', 'in_progress', 'blocked', 'reported_complete', 'completed', 'reviewed', 'returned']

function taskView(t) {
  const overdue = !['completed', 'reviewed'].includes(t.state) && t.dueAt < now()
  return { ...t, overdue, slipDays: overdue ? Math.round((now() - t.dueAt) / 86400000) : 0 }
}

async function clusterSummary(clusterId) {
  const [cluster, itis, packages, aops, tasks, gates, risks, kpis, changes, milestones] = await Promise.all([
    prisma.cluster.findUnique({ where: { id: clusterId } }),
    prisma.iti.findMany({ where: { clusterId }, orderBy: [{ kind: 'asc' }, { code: 'asc' }], include: { _count: { select: { trainees: { where: { status: 'active' } }, batches: { where: { state: 'running' } } } } } }),
    prisma.package.findMany({ where: { clusterId } }),
    prisma.aopRecord.findMany({ where: { year: 1 }, include: { package: { select: { itiId: true, category: true } } } }),
    prisma.planTask.findMany({ where: { clusterId }, orderBy: { dueAt: 'asc' } }),
    prisma.launchGate.findMany({ include: { offering: { select: { itiId: true, tradeId: true, launch: true } } } }),
    prisma.risk.findMany({ where: { clusterId } }),
    prisma.kpi.findMany({ where: { clusterId }, orderBy: { code: 'asc' } }),
    prisma.changeRequest.findMany({ where: { clusterId }, orderBy: { createdAt: 'desc' }, include: { proposer: { select: { name: true, role: true } } } }),
    prisma.milestone.findMany({ where: { clusterId } }),
  ])
  const byCategory = {}
  for (const p of packages) { const y = J(p.yearly, {}); const c = byCategory[p.category] ||= { category: p.category, totalCr: 0, y1Cr: 0, spentCr: 0, packages: 0 }; c.totalCr += p.totalCr; c.y1Cr += y[1] || 0; c.packages++ }
  for (const a of aops) { const c = byCategory[a.package.category]; if (c) c.spentCr += a.spentCr }
  const perIti = itis.map(i => {
    const pk = packages.filter(p => p.itiId === i.id)
    const y1 = pk.reduce((s, p) => s + (J(p.yearly, {})[1] || 0), 0)
    const spent = aops.filter(a => a.package.itiId === i.id).reduce((s, a) => s + a.spentCr, 0)
    const ts = tasks.filter(t => t.itiId === i.id).map(taskView)
    return { ...i, y1Cr: +y1.toFixed(3), spentY1Cr: +spent.toFixed(3), fiveYearPlannedCr: +pk.reduce((s, p) => s + p.totalCr, 0).toFixed(2),
      tasks: { total: ts.length, done: ts.filter(t => ['completed', 'reviewed'].includes(t.state)).length, overdue: ts.filter(t => t.overdue).length, blocked: ts.filter(t => t.state === 'blocked').length },
      gatesPending: gates.filter(g => g.offering.itiId === i.id && g.state !== 'passed').length, profile: J(i.profileSections, {}) }
  })
  const tv = tasks.map(taskView)
  const tasksSummary = { total: tv.length, byState: Object.fromEntries(TASK_STATES.map(s => [s, tv.filter(t => t.state === s).length])), overdue: tv.filter(t => t.overdue).length, dueIn30: tv.filter(t => !t.overdue && !['completed', 'reviewed'].includes(t.state) && t.dueAt < new Date(Date.now() + 30 * 86400000)).length }
  const y1Planned = Object.values(byCategory).reduce((s, c) => s + c.y1Cr, 0), y1Spent = Object.values(byCategory).reduce((s, c) => s + c.spentCr, 0)
  return { cluster, itis: perIti, byCategory: Object.values(byCategory).map(c => ({ ...c, totalCr: +c.totalCr.toFixed(3), y1Cr: +c.y1Cr.toFixed(3), spentCr: +c.spentCr.toFixed(3) })),
    y1: { envelopeCr: cluster.envelopeY1Cr, plannedCr: +y1Planned.toFixed(3), spentCr: +y1Spent.toFixed(3), headroomCr: +(cluster.envelopeY1Cr - y1Planned).toFixed(3), monthOfYear: Math.max(1, Math.min(12, Math.round((now() - cluster.scenarioStart) / (30.44 * 86400000)) + 1)) },
    tasksSummary, gates: { total: gates.length, pending: gates.filter(g => g.state === 'pending').length, ready: gates.filter(g => g.state === 'ready').length, passed: gates.filter(g => g.state === 'passed').length },
    risks, kpis: kpis.map(k => ({ ...k, targets: J(k.targets, {}) })), changes, milestones: { total: milestones.length, verified: milestones.filter(m => m.state === 'verified').length, submitted: milestones.filter(m => m.state === 'submitted').length, rejected: milestones.filter(m => m.state === 'rejected').length },
    coverage: { connected: itis.filter(i => i.registryConnected).length, total: itis.length } }
}

r.get('/home', async (req, res, next) => {
  try { const c = await clusterFor(req.user); res.json(await clusterSummary(c.id)) } catch (e) { next(e) }
})

// Institute profile — the seven tabs. Each tab says where its values come from.
r.get('/itis/:code/profile', async (req, res, next) => {
  try {
    let iti = req.params.code === 'mine' ? await itiFor(req.user) : await prisma.iti.findFirst({ where: { OR: [{ code: req.params.code }, { id: req.params.code }] } })
    if (!iti) { const c = await clusterFor(req.user); iti = await prisma.iti.findFirst({ where: { clusterId: c.id, kind: 'hub' } }) }
    const [principal, kpis] = await Promise.all([iti.principalUserId ? prisma.user.findUnique({ where: { id: iti.principalUserId }, select: { name: true, loginId: true } }) : null, prisma.kpi.findMany({ where: { clusterId: iti.clusterId }, orderBy: { code: 'asc' } })])
    const [offerings, packages, aops, tasks, gates, machines, civil, trainers, assignments, batches, activeStudents, women, pwd] = await Promise.all([
      prisma.offering.findMany({ where: { itiId: iti.id }, include: { trade: true, plans: { orderBy: { period: 'asc' } } } }),
      prisma.package.findMany({ where: { itiId: iti.id }, orderBy: { id: 'asc' } }),
      prisma.aopRecord.findMany({ where: { package: { itiId: iti.id } }, orderBy: [{ year: 'asc' }, { id: 'asc' }] }),
      prisma.planTask.findMany({ where: { itiId: iti.id }, orderBy: { dueAt: 'asc' } }),
      prisma.launchGate.findMany({ where: { offering: { itiId: iti.id } }, include: { offering: { select: { tradeId: true, launch: true } } } }),
      prisma.machine.findMany({ where: { itiId: iti.id }, include: { trade: { select: { code: true } } } }),
      prisma.civilWork.findMany({ where: { itiId: iti.id } }),
      prisma.user.findMany({ where: { role: 'trainer', profile: { contains: `"itiCode":"${iti.code}"` } }, select: { id: true, name: true, profile: true } }),
      prisma.trainerAssignment.findMany({ where: { batch: { itiId: iti.id } }, select: { trainerUserId: true, subjectId: true, batchId: true, responsibility: true } }),
      prisma.batch.findMany({ where: { itiId: iti.id, state: 'running' }, select: { id: true, tradeId: true, capacity: true, _count: { select: { trainees: true } } } }),
      prisma.trainee.count({ where: { itiId: iti.id, status: 'active' } }),
      prisma.trainee.count({ where: { itiId: iti.id, status: 'active', gender: 'F' } }),
      prisma.trainee.count({ where: { itiId: iti.id, status: 'active', pwd: true } }),
    ])
    const periods = ['Baseline', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5']
    const trades = offerings.map(o => ({ id: o.id, trade: o.trade, launch: o.launch, note: o.note, scope: o.scope,
      plans: periods.map(p => o.plans.find(x => x.period === p) || null),
      actualY1: o.plans.find(x => x.period === 'Y1')?.actualEnrolments ?? null,
      runningBatches: batches.filter(b => b.tradeId === o.tradeId).length, enrolledNow: batches.filter(b => b.tradeId === o.tradeId).reduce((s, b) => s + b._count.trainees, 0),
      gates: gates.filter(g => g.offeringId === o.id) }))
    // registry programmes not in the SIP offerings (counted under OTH)
    const otherBatches = batches.filter(b => !offerings.some(o => o.tradeId === b.tradeId))
    const otherTrades = {}
    for (const b of otherBatches) { const t = otherTrades[b.tradeId] ||= { tradeId: b.tradeId, batches: 0, enrolled: 0 }; t.batches++; t.enrolled += b._count.trainees }
    const trainerIds = new Set(assignments.map(a => a.trainerUserId))
    const staffing = { registryTrainers: trainers.length, assignedTrainers: trainerIds.size, baseline: iti.trainersBaseline, plan: J(iti.trainerPlan, {}), byProgramme: {}, leads: assignments.filter(a => a.responsibility.startsWith('Batch lead')).length }
    for (const t of trainers) { const p = J(t.profile, {}); staffing.byProgramme[p.programme] = (staffing.byProgramme[p.programme] || 0) + 1 }
    const budget = packages.map(p => ({ ...p, yearly: J(p.yearly, {}), aops: aops.filter(a => a.packageId === p.id) }))
    res.json({ iti: { ...iti, principal, profileSections: J(iti.profileSections, {}), trainerPlan: J(iti.trainerPlan, {}) }, kpis: kpis.map(k => ({ ...k, targets: J(k.targets, {}) })), students: { active: activeStudents, women, pwd, registryConnected: iti.registryConnected },
      trades, otherTrades: Object.values(otherTrades), staffing, infrastructure: { rooms: { baseline: iti.roomsBaseline, working: iti.roomsWorking, y5: iti.roomsY5 }, machines, civil },
      budget, targets: { fiveYearCr: iti.fiveYearCr, civilCr: iti.civilCr, digitalCr: iti.digitalCr, plannedCr: +packages.reduce((s, p) => s + p.totalCr, 0).toFixed(2) }, gates, tasks: tasks.map(taskView) })
  } catch (e) { next(e) }
})

r.post('/itis/:code/profile/confirm', requireRole('iti_principal', 'spv_ceo'), async (req, res, next) => {
  try {
    const body = z.object({ tab: z.string(), state: z.enum(['confirmed', 'draft', 'pending']).default('confirmed') }).parse(req.body)
    const iti = await prisma.iti.findFirst({ where: { OR: [{ code: req.params.code }, { id: req.params.code }] } })
    const sections = J(iti.profileSections, {})
    sections[body.tab] = { state: body.state, confirmedAt: body.state === 'confirmed' ? new Date().toISOString().slice(0, 10) : null, by: profileOf(req.user).roleCode || req.user.role }
    const up = await prisma.iti.update({ where: { id: iti.id }, data: { profileSections: JSON.stringify(sections) } })
    res.json({ sections: J(up.profileSections, {}) })
  } catch (e) { next(e) }
})

// Five-year targets: offering plans, KPI trajectories, site budgets, phasing.
r.get('/targets', async (req, res, next) => {
  try {
    const c = await clusterFor(req.user)
    const [offerings, kpis, packages, itis] = await Promise.all([
      prisma.offering.findMany({ where: { iti: { clusterId: c.id } }, include: { trade: { select: { code: true, name: true, kind: true } }, iti: { select: { code: true, name: true } }, plans: true }, orderBy: { id: 'asc' } }),
      prisma.kpi.findMany({ where: { clusterId: c.id }, orderBy: { code: 'asc' } }),
      prisma.package.findMany({ where: { clusterId: c.id } }),
      prisma.iti.findMany({ where: { clusterId: c.id }, orderBy: [{ kind: 'asc' }, { code: 'asc' }] }),
    ])
    const periods = ['Baseline', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5']
    const clusterPlan = periods.map(p => ({ period: p, places: offerings.reduce((s, o) => s + (o.plans.find(x => x.period === p)?.places || 0), 0), enrolments: offerings.reduce((s, o) => s + (o.plans.find(x => x.period === p)?.enrolments || 0), 0) }))
    const siteBudgets = itis.map(i => { const pk = packages.filter(p => p.itiId === i.id); const yearly = [1, 2, 3, 4, 5].map(y => +pk.reduce((s, p) => s + (J(p.yearly, {})[y] || 0), 0).toFixed(3)); return { code: i.code, name: i.name, anchorCr: i.fiveYearCr, yearly, totalCr: +yearly.reduce((a, b) => a + b, 0).toFixed(2) } })
    const phasingByIti = itis.map(i => ({ code: i.code, name: i.name, byCategory: {} }))
    for (const p of packages) { const row = phasingByIti.find(x => x.code === itis.find(i => i.id === p.itiId)?.code); if (!row) continue; const y = J(p.yearly, {}); const c = row.byCategory[p.category] ||= [0, 0, 0, 0, 0]; for (let i = 1; i <= 5; i++) c[i - 1] += y[i] || 0 }
    const phasing = {}
    for (const p of packages) { const y = J(p.yearly, {}); const row = phasing[p.category] ||= { category: p.category, yearly: [0, 0, 0, 0, 0], totalCr: 0 }; for (let i = 1; i <= 5; i++) row.yearly[i - 1] += y[i] || 0; row.totalCr += p.totalCr }
    res.json({ cluster: c, periods, clusterPlan, offerings: offerings.map(o => ({ ...o, plans: periods.map(p => o.plans.find(x => x.period === p) || null) })),
      kpis: kpis.map(k => ({ ...k, targets: J(k.targets, {}) })), siteBudgets, phasingByIti: phasingByIti.map(r => ({ ...r, byCategory: Object.fromEntries(Object.entries(r.byCategory).map(([k, v]) => [k, v.map(x => +x.toFixed(3))])) })), phasing: Object.values(phasing).map(p => ({ ...p, yearly: p.yearly.map(v => +v.toFixed(3)), totalCr: +p.totalCr.toFixed(2) })) })
  } catch (e) { next(e) }
})

// Annual plan: outcomes (Y1 KPI targets) · workplan (AOP records + tasks) · calendar (tasks by quarter).
r.get('/annual', async (req, res, next) => {
  try {
    const c = await clusterFor(req.user)
    const year = Number(req.query.year || c.currentYear)
    const itiId = req.query.itiId || null
    const [aops, tasks, kpis] = await Promise.all([
      prisma.aopRecord.findMany({ where: { year, ...(itiId ? { package: { itiId } } : {}) }, include: { package: true }, orderBy: { id: 'asc' } }),
      prisma.planTask.findMany({ where: { clusterId: c.id, ...(itiId ? { itiId } : {}) }, orderBy: { dueAt: 'asc' }, include: { aop: { select: { package: { select: { category: true, title: true } } } }, iti: { select: { code: true, name: true } } } }),
      prisma.kpi.findMany({ where: { clusterId: c.id }, orderBy: { code: 'asc' } }),
    ])
    const tv = tasks.map(t => ({ ...taskView(t), category: t.aop?.package?.category || null, packageTitle: t.aop?.package?.title || null, itiCode: t.iti?.code || null }))
    const workplan = aops.map(a => ({ ...a, package: { ...a.package, yearly: J(a.package.yearly, {}) }, tasks: tv.filter(t => t.aopId === a.id) }))
    const calendar = ['Q1', 'Q2', 'Q3', 'Q4'].map(q => ({ quarter: q, tasks: tv.filter(t => t.quarter === q) }))
    const totals = { budgetCr: +aops.reduce((s, a) => s + a.budgetCr, 0).toFixed(3), spentCr: +aops.reduce((s, a) => s + a.spentCr, 0).toFixed(3) }
    res.json({ cluster: c, year, outcomes: kpis.map(k => ({ code: k.code, name: k.name, unit: k.unit, baseline: k.baseline, target: J(k.targets, {})[`Y${year}`] ?? null, current: k.current, coverage: k.coverage, valueStatus: k.valueStatus, ownerRole: k.ownerRole })), workplan, calendar, totals })
  } catch (e) { next(e) }
})

r.get('/tasks', async (req, res, next) => {
  try {
    const c = await clusterFor(req.user)
    const where = { clusterId: c.id }
    if (req.user.role === 'iti_principal') { const iti = await itiFor(req.user); where.itiId = iti?.id }
    else if (req.query.itiId) where.itiId = String(req.query.itiId)
    if (req.query.state) where.state = String(req.query.state)
    const tasks = await prisma.planTask.findMany({ where, orderBy: { dueAt: 'asc' }, include: { aop: { select: { id: true, budgetCr: true, spentCr: true, deliverable: true, evidenceRule: true, package: { select: { title: true, category: true } } } }, iti: { select: { code: true, name: true } } } })
    res.json({ tasks: tasks.map(taskView) })
  } catch (e) { next(e) }
})

// Assign a task (CEO → principal, or principal → own ITI). The task hangs
// off an AOP record so it carries no budget of its own; the principal is
// notified in-app.
r.post('/tasks', requireRole('spv_ceo', 'iti_principal'), async (req, res, next) => {
  try {
    const body = z.object({ title: z.string().min(3), itiId: z.string(), aopId: z.string().optional(), category: z.string().optional(), dueAt: z.string(), evidence: z.string().optional(), acceptance: z.string().optional(), isMilestone: z.boolean().optional(), note: z.string().optional() }).parse(req.body)
    const c = await clusterFor(req.user)
    const iti = await prisma.iti.findUnique({ where: { id: body.itiId } })
    if (!iti) return res.status(404).json({ error: 'iti_not_found' })
    let aop = body.aopId ? await prisma.aopRecord.findUnique({ where: { id: body.aopId } }) : null
    if (!aop) aop = await prisma.aopRecord.findFirst({ where: { year: c.currentYear, package: { itiId: iti.id, ...(body.category ? { category: body.category } : {}) } }, orderBy: { id: 'asc' } })
    if (!aop) aop = await prisma.aopRecord.findFirst({ where: { year: c.currentYear, package: { itiId: iti.id } }, orderBy: { id: 'asc' } })
    if (!aop) return res.status(400).json({ error: 'no_aop_record', message: 'This ITI has no AOP record to hang the task on.' })
    const n = await prisma.planTask.count({ where: { itiId: iti.id } })
    const id = `TASK-${iti.code}-${String(n + 1).padStart(2, '0')}`
    const dueAt = new Date(body.dueAt)
    const months = Math.max(1, Math.min(12, Math.round((dueAt - new Date(c.scenarioStart || c.licenseStartAt)) / (30.4 * 86400000)) + 1))
    const quarter = `Q${Math.min(4, Math.ceil(months / 3))}`
    const t = await prisma.planTask.create({ data: { id, clusterId: c.id, itiId: iti.id, aopId: aop.id, title: body.title, quarter, dueMonth: months, dueAt, responsibleRole: `PR-${iti.code}`, reviewerRole: 'SPV-CEO', evidence: body.evidence || 'Progress note with photo or document', acceptance: body.acceptance || 'Reviewer accepts the evidence note', state: 'planned', isMilestone: !!body.isMilestone, lastUpdateAt: new Date(), updatedByRole: profileOf(req.user).roleCode || req.user.role, evidenceNote: null, reviewNote: body.note || null } })
    await notifyPrincipal(iti.id, { title: `New task from the SPV: ${body.title}`, message: `${id} · due ${dueAt.toLocaleDateString('en-IN')} · evidence: ${t.evidence}${body.note ? ' · ' + body.note : ''}`, priority: 'high', action: { label: 'Open annual plan', type: 'OPEN_ANNUAL_PLAN' } })
    res.json({ task: taskView(t) })
  } catch (e) { next(e) }
})

// CEO asks the principal for the current status of a task.
r.post('/tasks/:id/ask', requireRole('spv_ceo', 'ima_officer'), async (req, res, next) => {
  try {
    const body = z.object({ question: z.string().min(2) }).parse(req.body)
    const t = await prisma.planTask.findUnique({ where: { id: req.params.id } })
    if (!t) return res.status(404).json({ error: 'not_found' })
    await notifyPrincipal(t.itiId, { title: `Status requested: ${t.title}`, message: `${req.user.name} asks: ${body.question}`, priority: 'high', action: { label: 'Open annual plan', type: 'OPEN_ANNUAL_PLAN' } })
    res.json({ ok: true })
  } catch (e) { next(e) }
})

r.post('/tasks/:id/update', requireRole('iti_principal', 'spv_ceo', 'trainer'), async (req, res, next) => {
  try {
    const body = z.object({ state: z.enum(TASK_STATES).optional(), evidenceNote: z.string().optional(), evidenceUrl: z.string().optional(), forecastAt: z.string().optional(), blockedReason: z.string().optional(), note: z.string().optional() }).parse(req.body || {})
    const t = await prisma.planTask.findUnique({ where: { id: req.params.id } })
    if (!t) return res.status(404).json({ error: 'not_found' })
    const data = { lastUpdateAt: new Date(), updatedByRole: profileOf(req.user).roleCode || req.user.role }
    if (body.state) data.state = body.state
    if (body.evidenceNote != null) { data.evidenceNote = body.evidenceNote; data.evidenceUrl = body.evidenceUrl || `/demo/evidence/${t.id}.pdf` }
    if (body.forecastAt) data.forecastAt = new Date(body.forecastAt)
    if (body.blockedReason != null) data.blockedReason = body.blockedReason
    if (body.state === 'reported_complete' && !data.evidenceNote && !t.evidenceNote) return res.status(400).json({ error: 'evidence_required', message: 'Reporting complete needs an evidence note per the workstream rule.' })
    if (body.state && body.state !== 'blocked') data.blockedReason = null
    const up = await prisma.planTask.update({ where: { id: t.id }, data })
    if (body.state === 'reported_complete') await prisma.notification.create({ data: { type: 'system', title: `Task reported complete: ${t.title}`, category: 'plan', priority: 'normal', targetRoles: JSON.stringify(['spv_ceo']), message: `${t.id} · ${t.responsibleRole} → reviewer ${t.reviewerRole}. Evidence attached.`, action: JSON.stringify({ label: 'Review', type: 'OPEN_MILESTONE_BOARD' }) } })
    res.json({ task: taskView(up) })
  } catch (e) { next(e) }
})

r.post('/tasks/:id/review', requireRole('spv_ceo', 'iti_principal', 'ima_officer'), async (req, res, next) => {
  try {
    const body = z.object({ decision: z.enum(['accept', 'return']), note: z.string().optional() }).parse(req.body)
    const t = await prisma.planTask.findUnique({ where: { id: req.params.id } })
    if (!t) return res.status(404).json({ error: 'not_found' })
    const up = await prisma.planTask.update({ where: { id: t.id }, data: body.decision === 'accept' ? { state: 'reviewed', reviewNote: body.note || 'Accepted.', lastUpdateAt: new Date(), updatedByRole: t.reviewerRole } : { state: 'returned', reviewNote: body.note || 'Returned: evidence does not meet the acceptance items.', lastUpdateAt: new Date(), updatedByRole: t.reviewerRole } })
    await prisma.notification.create({ data: { type: 'system', title: body.decision === 'accept' ? `Accepted: ${t.title}` : `Returned: ${t.title}`, category: 'plan', priority: 'normal', targetRoles: JSON.stringify(['iti_principal']), message: body.note || '', action: JSON.stringify({ label: 'Open plan', type: 'OPEN_ANNUAL_PLAN' }) } })
    res.json({ task: taskView(up) })
  } catch (e) { next(e) }
})

// Milestone board: flagged tasks + IMA milestones, with predecessor chain and slip.
r.get('/milestone-board', async (req, res, next) => {
  try {
    const c = await clusterFor(req.user)
    const where = { clusterId: c.id }
    if (req.user.role === 'iti_principal') { const iti = await itiFor(req.user); where.itiId = iti?.id }
    const [tasks, milestones, changes] = await Promise.all([
      prisma.planTask.findMany({ where, orderBy: { dueAt: 'asc' }, include: { iti: { select: { code: true } }, aop: { select: { package: { select: { category: true, title: true } } } } } }),
      prisma.milestone.findMany({ where: { clusterId: c.id }, orderBy: { dueAt: 'asc' }, include: { verifiedBy: { select: { name: true } } } }),
      prisma.changeRequest.findMany({ where: { clusterId: c.id }, orderBy: { createdAt: 'desc' }, include: { proposer: { select: { name: true, role: true } } } }),
    ])
    const byId = Object.fromEntries(tasks.map(t => [t.id, t]))
    const board = tasks.filter(t => t.isMilestone || t.state === 'blocked' || (t.dueAt < now() && !['completed', 'reviewed'].includes(t.state))).map(t => {
      const chain = []; let p = t.predecessorId
      while (p && byId[p] && chain.length < 6) { chain.push({ id: byId[p].id, title: byId[p].title, state: byId[p].state, dueAt: byId[p].dueAt }); p = byId[p].predecessorId }
      const dependents = tasks.filter(x => x.predecessorId === t.id).map(x => ({ id: x.id, title: x.title, state: x.state, dueAt: x.dueAt }))
      const blockedByPredecessor = chain.some(x => !['completed', 'reviewed'].includes(x.state))
      return { ...taskView(t), chain, dependents, blockedByPredecessor }
    })
    res.json({ board, milestones, changes: changes.map(x => ({ ...x, affected: J(x.affected, []) })) })
  } catch (e) { next(e) }
})

r.get('/changes', async (req, res, next) => {
  try { const c = await clusterFor(req.user); res.json({ changes: (await prisma.changeRequest.findMany({ where: { clusterId: c.id }, orderBy: { createdAt: 'desc' }, include: { proposer: { select: { name: true, role: true } } } })).map(x => ({ ...x, affected: J(x.affected, []) })) }) } catch (e) { next(e) }
})

r.post('/changes', requireRole('iti_principal', 'spv_ceo', 'trainer'), async (req, res, next) => {
  try {
    const body = z.object({ targetType: z.string(), targetId: z.string(), title: z.string(), currentValue: z.string(), proposedValue: z.string(), reason: z.string(), resourceImpact: z.string().optional(), affected: z.array(z.string()).optional(), formalApprovalNeeded: z.boolean().optional() }).parse(req.body)
    const c = await clusterFor(req.user); const iti = await itiFor(req.user)
    const cr = await prisma.changeRequest.create({ data: { clusterId: c.id, itiCode: iti?.code || null, ...body, affected: JSON.stringify(body.affected || []), formalApprovalNeeded: !!body.formalApprovalNeeded, proposerUserId: req.user.id } })
    await prisma.notification.create({ data: { type: 'system', title: `Change request: ${body.title}`, category: 'plan', priority: 'normal', targetRoles: JSON.stringify(['spv_ceo']), message: `${req.user.name}: ${body.reason.slice(0, 140)}`, action: JSON.stringify({ label: 'Review', type: 'OPEN_MILESTONE_BOARD' }) } })
    res.json({ change: cr })
  } catch (e) { next(e) }
})

r.post('/changes/:id/decide', requireRole('spv_ceo'), async (req, res, next) => {
  try {
    const body = z.object({ decision: z.enum(['approved_internal', 'returned', 'routed_formal']), note: z.string().optional() }).parse(req.body)
    const cr = await prisma.changeRequest.update({ where: { id: req.params.id }, data: { state: body.decision, decisionNote: body.note || null, decidedAt: new Date() } })
    if (body.decision === 'approved_internal' && cr.targetType === 'task') {
      const m = cr.proposedValue.match(/(\d{4}-\d{2}-\d{2})/)
      if (m) await prisma.planTask.update({ where: { id: cr.targetId }, data: { forecastAt: new Date(m[1]) } }).catch(() => null)
    }
    res.json({ change: cr })
  } catch (e) { next(e) }
})

r.get('/gates', async (req, res, next) => {
  try {
    const where = {}
    if (req.user.role === 'iti_principal') { const iti = await itiFor(req.user); where.offering = { itiId: iti?.id } }
    res.json({ gates: await prisma.launchGate.findMany({ where, include: { offering: { include: { trade: { select: { code: true, name: true } }, iti: { select: { code: true, name: true } } } } }, orderBy: { id: 'asc' } }) })
  } catch (e) { next(e) }
})

r.post('/gates/:id/state', requireRole('iti_principal', 'spv_ceo', 'curriculum_dev'), async (req, res, next) => {
  try {
    const body = z.object({ state: z.enum(['pending', 'ready', 'passed', 'failed']) }).parse(req.body)
    res.json({ gate: await prisma.launchGate.update({ where: { id: req.params.id }, data: { state: body.state } }) })
  } catch (e) { next(e) }
})

r.get('/risks', async (req, res, next) => {
  try { const c = await clusterFor(req.user); res.json({ risks: await prisma.risk.findMany({ where: { clusterId: c.id }, orderBy: { id: 'asc' } }), rules: await prisma.evidenceRule.findMany({ where: { clusterId: c.id } }) }) } catch (e) { next(e) }
})

r.post('/risks/:id/state', requireRole('spv_ceo'), async (req, res, next) => {
  try { const body = z.object({ state: z.enum(['open', 'triggered', 'closed']) }).parse(req.body); res.json({ risk: await prisma.risk.update({ where: { id: req.params.id }, data: body }) }) } catch (e) { next(e) }
})

// Trainer: what I have committed to — assignments, upcoming assessments,
// rechecks due, support actions I own, referrals to me, issues I raised.
r.get('/my-commitments', requireRole('trainer'), async (req, res, next) => {
  try {
    const batchIds = await trainerBatchIds(req.user)
    const soon = new Date(Date.now() + 30 * 86400000)
    const [assignments, assessments, rechecks, support, referrals, issues, iti, tasks] = await Promise.all([
      prisma.trainerAssignment.findMany({ where: { trainerUserId: req.user.id }, include: { batch: { select: { id: true, name: true, tradeId: true, capacity: true, _count: { select: { trainees: true } } } }, subject: true } }),
      prisma.assessmentPlan.findMany({ where: { batchId: { in: batchIds }, date: { lte: soon }, state: { in: ['planned', 'conducted', 'marks_pending', 'needs_review', 'submitted'] } }, include: { batch: { select: { name: true } } }, orderBy: { date: 'asc' } }),
      prisma.practicalObservation.findMany({ where: { observerId: req.user.id, result: 'needs_re_practice', recheckAt: { not: null } }, include: { trainee: { select: { name: true, batchId: true } }, task: { select: { title: true } } }, orderBy: { recheckAt: 'asc' } }),
      prisma.supportAction.findMany({ where: { ownerUserId: req.user.id, state: { not: 'closed' } }, include: { trainee: { select: { name: true, batchId: true } } }, orderBy: { dueAt: 'asc' } }),
      prisma.referral.findMany({ where: { toUserId: req.user.id, state: { notIn: ['resolved'] } }, include: { trainee: { select: { name: true, batchId: true } } }, orderBy: { createdAt: 'desc' } }),
      prisma.opsIssue.findMany({ where: { raisedById: req.user.id, state: { not: 'resolved' } }, orderBy: { createdAt: 'desc' } }),
      itiFor(req.user),
      prisma.planTask.findMany({ where: { itiId: (await itiFor(req.user))?.id, responsibleRole: { startsWith: 'TECH' }, state: { notIn: ['completed', 'reviewed'] } }, orderBy: { dueAt: 'asc' }, take: 6 }),
    ])
    res.json({ iti, assignments, assessments, rechecks, support, referrals, issues, instituteTasks: tasks.map(taskView) })
  } catch (e) { next(e) }
})

export default r
