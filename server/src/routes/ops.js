// /api/ops — PRD Module B: Institute Operations.
//   trainer my-day · attendance bot (sessions + marks, offline-tolerant) ·
//   assessments (calendar, marks, simulated scan, principal review) ·
//   practical bot (rubric observations) · field visits + findings · daily
//   ops issues · trainer availability · institute today · cluster
//   operations · support queue · student 360 · grievances.
// Delivery status and attendance status are separate; nothing is counted
// until the trainer submits; the principal confirms; missing = missing.

import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../auth/middleware.js'
import { clusterFor, itiFor, traineeFor, trainerBatchIds, batchScope, resolveItiId, profileOf } from '../lib/scope.js'

const r = Router()
r.use(requireAuth)
const J = (s, d = null) => { try { return JSON.parse(s ?? 'null') ?? d } catch { return d } }
const dayStart = (x) => { const d = x ? new Date(x) : new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) }
const todayUTC = () => { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())) }
const daysAgo = n => new Date(todayUTC().getTime() - n * 86400000)
const MARK = ['present', 'absent', 'late', 'excused', 'roster_issue']

function attendanceStats(marks) {
  const total = marks.length, present = marks.filter(m => m.status === 'present' || m.status === 'late').length
  return { total, present, absent: marks.filter(m => m.status === 'absent').length, late: marks.filter(m => m.status === 'late').length, pct: total ? Math.round(100 * present / total) : null }
}

// ── Trainer: my day ───────────────────────────────────────────────────────
r.get('/my-day', requireRole('trainer'), async (req, res, next) => {
  try {
    const batchIds = await trainerBatchIds(req.user)
    const today = todayUTC(), in7 = new Date(today.getTime() + 7 * 86400000)
    const [sessions, pending, marksPending, upcoming, rechecks, referrals, support, availability, issues, iti] = await Promise.all([
      prisma.session.findMany({ where: { date: today, OR: [{ trainerUserId: req.user.id }, { batchId: { in: batchIds }, trainerUserId: null }] }, include: { batch: { select: { id: true, name: true, _count: { select: { trainees: true } } } }, subject: true }, orderBy: { startTime: 'asc' } }),
      prisma.session.findMany({ where: { trainerUserId: req.user.id, date: { lt: today, gte: daysAgo(10) }, attendanceState: 'not_reported', delivery: { in: ['scheduled', 'delivered', 'partial'] } }, include: { batch: { select: { name: true } }, subject: { select: { name: true } } }, orderBy: { date: 'desc' } }),
      prisma.assessmentPlan.findMany({ where: { batchId: { in: batchIds }, state: { in: ['marks_pending', 'conducted'] } }, include: { batch: { select: { name: true } } } }),
      prisma.assessmentPlan.findMany({ where: { batchId: { in: batchIds }, state: 'planned', date: { gte: today, lte: in7 } }, include: { batch: { select: { name: true } } }, orderBy: { date: 'asc' } }),
      prisma.practicalObservation.findMany({ where: { observerId: req.user.id, result: 'needs_re_practice', recheckAt: { lte: in7 } }, include: { trainee: { select: { name: true } }, task: { select: { title: true } } } }),
      prisma.referral.findMany({ where: { toUserId: req.user.id, state: { in: ['sent', 'accepted', 'contacted'] } }, include: { trainee: { select: { name: true, batchId: true } } } }),
      prisma.supportAction.findMany({ where: { ownerUserId: req.user.id, state: { not: 'closed' }, dueAt: { lte: in7 } }, include: { trainee: { select: { name: true } } }, orderBy: { dueAt: 'asc' } }),
      prisma.trainerAvailability.findUnique({ where: { trainerUserId_date: { trainerUserId: req.user.id, date: today } } }),
      prisma.opsIssue.findMany({ where: { raisedById: req.user.id, state: { not: 'resolved' } } }),
      itiFor(req.user),
    ])
    const unsynced = await prisma.session.count({ where: { trainerUserId: req.user.id, syncState: 'saved_on_device' } })
    res.json({ today, iti, sessions, pendingAttendance: pending, marksPending, upcomingAssessments: upcoming, rechecks, referrals, support, availability, issues, unsynced })
  } catch (e) { next(e) }
})

r.post('/availability', requireRole('trainer'), async (req, res, next) => {
  try {
    const body = z.object({ status: z.enum(['available', 'leave', 'late']), note: z.string().optional(), date: z.string().optional() }).parse(req.body)
    const date = dayStart(body.date)
    const row = await prisma.trainerAvailability.upsert({ where: { trainerUserId_date: { trainerUserId: req.user.id, date } }, update: { status: body.status, note: body.note }, create: { trainerUserId: req.user.id, date, status: body.status, note: body.note } })
    if (body.status !== 'available') {
      const affected = await prisma.session.findMany({ where: { trainerUserId: req.user.id, date }, include: { batch: { select: { name: true } } } })
      await prisma.notification.create({ data: { type: 'system', title: `${req.user.name}: ${body.status} today`, category: 'attendance', priority: 'normal', targetRoles: JSON.stringify(['iti_principal']), message: `${affected.length} session(s) affected: ${affected.map(s => s.batch.name).join('; ').slice(0, 160)}`, action: JSON.stringify({ label: 'Institute today', type: 'OPEN_INSTITUTE_TODAY' }) } })
    }
    res.json({ availability: row })
  } catch (e) { next(e) }
})

// ── Sessions + attendance ─────────────────────────────────────────────────
r.get('/sessions', async (req, res, next) => {
  try {
    const where = await batchScope(req.user)
    if (req.query.batchId) where.batchId = String(req.query.batchId)
    if (req.query.date) where.date = dayStart(String(req.query.date))
    else where.date = { gte: dayStart(String(req.query.from || daysAgo(14).toISOString())), lte: dayStart(String(req.query.to || todayUTC().toISOString())) }
    const sessions = await prisma.session.findMany({ where, include: { batch: { select: { id: true, name: true, itiId: true, _count: { select: { trainees: true } } } }, subject: { select: { name: true, type: true } }, trainer: { select: { name: true } } }, orderBy: [{ date: 'desc' }, { startTime: 'asc' }] })
    res.json({ sessions })
  } catch (e) { next(e) }
})

r.get('/sessions/:id', async (req, res, next) => {
  try {
    const s = await prisma.session.findUnique({ where: { id: req.params.id }, include: { batch: { include: { trainees: { where: { status: 'active' }, orderBy: { name: 'asc' } }, trade: { select: { name: true } } } }, subject: true, trainer: { select: { name: true } }, marks: true } })
    if (!s) return res.status(404).json({ error: 'not_found' })
    const since = daysAgo(15)
    const recent = await prisma.attendanceMark.findMany({ where: { traineeId: { in: s.batch.trainees.map(t => t.id) }, session: { date: { gte: since, lt: s.date } } }, select: { traineeId: true, status: true } })
    const roster = s.batch.trainees.map(t => ({ ...t, mark: s.marks.find(m => m.traineeId === t.id) || null, recent: attendanceStats(recent.filter(m => m.traineeId === t.id)) }))
    res.json({ session: s, roster })
  } catch (e) { next(e) }
})

r.post('/sessions/:id/attendance', requireRole('trainer', 'iti_principal'), async (req, res, next) => {
  try {
    const body = z.object({ marks: z.array(z.object({ traineeId: z.string(), status: z.enum(MARK), reason: z.string().optional() })), captureMethod: z.enum(['trainer_mobile', 'offline_sync', 'camera_assisted']).default('trainer_mobile'), offline: z.boolean().optional(), delivery: z.enum(['delivered', 'partial']).optional() }).parse(req.body)
    const s = await prisma.session.findUnique({ where: { id: req.params.id } })
    if (!s) return res.status(404).json({ error: 'not_found' })
    for (const m of body.marks) await prisma.attendanceMark.upsert({ where: { sessionId_traineeId: { sessionId: s.id, traineeId: m.traineeId } }, update: { status: m.status, reason: m.reason || null }, create: { sessionId: s.id, traineeId: m.traineeId, status: m.status, reason: m.reason || null } })
    const needsReview = body.marks.some(m => m.status === 'roster_issue')
    const present = body.marks.filter(m => m.status === 'present' || m.status === 'late').length
    const up = await prisma.session.update({ where: { id: s.id }, data: { delivery: body.delivery || (s.delivery === 'scheduled' ? 'delivered' : s.delivery), attendanceState: needsReview ? 'needs_review' : 'submitted', captureMethod: body.captureMethod, submittedAt: new Date(), syncState: body.offline ? 'saved_on_device' : 'synced', presentCount: present, absentCount: body.marks.filter(m => m.status === 'absent').length, lateCount: body.marks.filter(m => m.status === 'late').length } })
    if (needsReview) await prisma.notification.create({ data: { type: 'system', title: 'Attendance needs review (roster issue)', category: 'attendance', priority: 'normal', targetRoles: JSON.stringify(['iti_principal']), message: `${req.user.name} flagged a roster issue in session ${s.id}.`, action: JSON.stringify({ label: 'Review', type: 'OPEN_INSTITUTE_TODAY' }) } })
    res.json({ session: up })
  } catch (e) { next(e) }
})

r.post('/sessions/:id/delivery', requireRole('trainer', 'iti_principal'), async (req, res, next) => {
  try {
    const body = z.object({ delivery: z.enum(['scheduled', 'delivered', 'partial', 'rescheduled', 'cancelled']), reason: z.string().optional(), substituteName: z.string().optional() }).parse(req.body)
    res.json({ session: await prisma.session.update({ where: { id: req.params.id }, data: { delivery: body.delivery, deliveryReason: body.reason || null, substituteName: body.substituteName || null } }) })
  } catch (e) { next(e) }
})

r.post('/sessions/:id/sync', requireRole('trainer'), async (req, res, next) => {
  try { res.json({ session: await prisma.session.update({ where: { id: req.params.id }, data: { syncState: 'synced' } }) }) } catch (e) { next(e) }
})

r.post('/sessions/:id/confirm', requireRole('iti_principal', 'spv_ceo'), async (req, res, next) => {
  try {
    const body = z.object({ decision: z.enum(['confirm', 'return']), note: z.string().optional() }).parse(req.body || {})
    const up = await prisma.session.update({ where: { id: req.params.id }, data: body.decision === 'confirm' ? { attendanceState: 'confirmed', confirmedAt: new Date() } : { attendanceState: 'not_reported', deliveryReason: body.note || 'Returned by principal for correction' } })
    res.json({ session: up })
  } catch (e) { next(e) }
})

r.post('/marks/:id/correct', requireRole('trainer', 'iti_principal'), async (req, res, next) => {
  try {
    const body = z.object({ status: z.enum(MARK), reason: z.string().min(3) }).parse(req.body)
    res.json({ mark: await prisma.attendanceMark.update({ where: { id: req.params.id }, data: { status: body.status, correctedAt: new Date(), correctionReason: body.reason } }) })
  } catch (e) { next(e) }
})

// ── Assessments ───────────────────────────────────────────────────────────
r.get('/assessments', async (req, res, next) => {
  try {
    const where = await batchScope(req.user)
    if (req.query.batchId) where.batchId = String(req.query.batchId)
    const plans = await prisma.assessmentPlan.findMany({ where, include: { batch: { select: { id: true, name: true, itiId: true, _count: { select: { trainees: true } } } }, subject: { select: { name: true } }, entries: { select: { marks: true, status: true, reviewState: true, source: true, traineeId: true } } }, orderBy: { date: 'desc' } })
    const t = await traineeFor(req.user)
    res.json({ plans: plans.map(p => { const scored = p.entries.filter(e => e.marks != null); return { ...p, entries: undefined, summary: { entered: p.entries.length, scored: scored.length, absent: p.entries.filter(e => e.status === 'absent').length, avg: scored.length ? Math.round(scored.reduce((s, e) => s + e.marks, 0) / scored.length * 10) / 10 : null, needsReview: p.entries.filter(e => e.reviewState === 'needs_review').length, ocr: p.entries.filter(e => e.source === 'ocr').length, below40: scored.filter(e => e.marks / p.maxMarks < 0.4).length }, mine: t ? p.entries.find(e => e.traineeId === t.id) || null : undefined } }) })
  } catch (e) { next(e) }
})

r.get('/assessments/:id', async (req, res, next) => {
  try {
    const p = await prisma.assessmentPlan.findUnique({ where: { id: req.params.id }, include: { batch: { include: { trainees: { where: { status: 'active' }, orderBy: { name: 'asc' } } } }, subject: true, entries: true } })
    if (!p) return res.status(404).json({ error: 'not_found' })
    res.json({ plan: p, roster: p.batch.trainees.map(t => ({ id: t.id, name: t.name, gender: t.gender, entry: p.entries.find(e => e.traineeId === t.id) || null })) })
  } catch (e) { next(e) }
})

r.post('/assessments', requireRole('trainer', 'iti_principal'), async (req, res, next) => {
  try {
    const body = z.object({ batchId: z.string(), subjectId: z.string().optional(), title: z.string(), type: z.enum(['theory', 'practical']).default('theory'), topic: z.string().optional(), maxMarks: z.number().int().default(50), date: z.string() }).parse(req.body)
    res.json({ plan: await prisma.assessmentPlan.create({ data: { ...body, date: dayStart(body.date), evaluatorName: req.user.name, state: 'planned' } }) })
  } catch (e) { next(e) }
})

// Simulated scan: returns what an OCR pass would extract for the roster.
// Low-confidence rows come back flagged so the trainer corrects them before
// submitting. (A real build would call /api/ocr with the sheet photo.)
r.post('/assessments/:id/scan', requireRole('trainer', 'iti_principal'), async (req, res, next) => {
  try {
    const p = await prisma.assessmentPlan.findUnique({ where: { id: req.params.id }, include: { batch: { include: { trainees: { where: { status: 'active' }, orderBy: { name: 'asc' } } } } } })
    if (!p) return res.status(404).json({ error: 'not_found' })
    let seed = p.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 }
    const rows = p.batch.trainees.map(t => { const absent = rnd() < 0.05; const marks = absent ? null : Math.round(p.maxMarks * (0.35 + rnd() * 0.6)); const conf = +(0.6 + rnd() * 0.39).toFixed(2); return { traineeId: t.id, name: t.name, marks, status: absent ? 'absent' : 'scored', ocrConfidence: conf, ocrExtracted: marks, needsReview: conf < 0.75 } })
    res.json({ rows, note: 'Simulated OCR. Rows under 0.75 confidence need a manual check before submit.' })
  } catch (e) { next(e) }
})

r.post('/assessments/:id/marks', requireRole('trainer', 'iti_principal'), async (req, res, next) => {
  try {
    const body = z.object({ entries: z.array(z.object({ traineeId: z.string(), marks: z.number().nullable().optional(), status: z.enum(['scored', 'absent', 'not_assessed', 'withheld']).default('scored'), source: z.enum(['manual', 'ocr']).default('manual'), ocrConfidence: z.number().optional(), ocrExtracted: z.number().nullable().optional(), correctionReason: z.string().optional() })) }).parse(req.body)
    const p = await prisma.assessmentPlan.findUnique({ where: { id: req.params.id } })
    if (!p) return res.status(404).json({ error: 'not_found' })
    let needs = 0
    for (const e of body.entries) {
      const marks = e.status === 'scored' ? e.marks : null
      if (marks != null && (marks < 0 || marks > p.maxMarks)) return res.status(400).json({ error: 'marks_out_of_range', traineeId: e.traineeId })
      const existing = await prisma.markEntry.findUnique({ where: { assessmentId_traineeId: { assessmentId: p.id, traineeId: e.traineeId } } })
      const reviewState = e.source === 'ocr' && (e.ocrConfidence ?? 1) < 0.75 && e.ocrExtracted === marks ? 'needs_review' : 'submitted'
      if (reviewState === 'needs_review') needs++
      await prisma.markEntry.upsert({ where: { assessmentId_traineeId: { assessmentId: p.id, traineeId: e.traineeId } },
        update: { marks, status: e.status, source: e.source, ocrConfidence: e.ocrConfidence ?? null, ocrExtracted: e.ocrExtracted ?? null, reviewState, previousMarks: existing?.marks ?? null, correctionReason: e.correctionReason || null },
        create: { assessmentId: p.id, traineeId: e.traineeId, marks, status: e.status, source: e.source, ocrConfidence: e.ocrConfidence ?? null, ocrExtracted: e.ocrExtracted ?? null, reviewState } })
    }
    const up = await prisma.assessmentPlan.update({ where: { id: p.id }, data: { state: needs ? 'needs_review' : 'submitted', evaluatorName: req.user.name } })
    await prisma.notification.create({ data: { type: 'system', title: `Marks submitted: ${p.title}`, category: 'assessment', priority: 'normal', targetRoles: JSON.stringify(['iti_principal']), message: `${req.user.name} entered ${body.entries.length} marks${needs ? ` · ${needs} need review` : ''}.`, action: JSON.stringify({ label: 'Review', type: 'OPEN_ASSESSMENTS' }) } })
    res.json({ plan: up, needsReview: needs })
  } catch (e) { next(e) }
})

r.post('/assessments/:id/review', requireRole('iti_principal', 'spv_ceo'), async (req, res, next) => {
  try {
    const body = z.object({ decision: z.enum(['confirm', 'return']), note: z.string().optional(), entryIds: z.array(z.string()).optional() }).parse(req.body || {})
    if (body.decision === 'confirm') {
      await prisma.markEntry.updateMany({ where: { assessmentId: req.params.id, ...(body.entryIds ? { id: { in: body.entryIds } } : {}) }, data: { reviewState: 'confirmed' } })
      const remaining = await prisma.markEntry.count({ where: { assessmentId: req.params.id, reviewState: { in: ['needs_review', 'submitted'] } } })
      return res.json({ plan: await prisma.assessmentPlan.update({ where: { id: req.params.id }, data: { state: remaining ? 'needs_review' : 'confirmed' } }), remaining })
    }
    await prisma.markEntry.updateMany({ where: { assessmentId: req.params.id, ...(body.entryIds ? { id: { in: body.entryIds } } : {}) }, data: { reviewState: 'returned' } })
    res.json({ plan: await prisma.assessmentPlan.update({ where: { id: req.params.id }, data: { state: 'marks_pending' } }) })
  } catch (e) { next(e) }
})

// ── Practicals ────────────────────────────────────────────────────────────
r.get('/practicals', async (req, res, next) => {
  try {
    const batchId = String(req.query.batchId || '')
    const b = batchId ? await prisma.batch.findUnique({ where: { id: batchId }, include: { trainees: { where: { status: 'active' }, orderBy: { name: 'asc' } }, trade: true } }) : null
    if (!b) { const scope = await batchScope(req.user); const first = await prisma.batch.findFirst({ where: { state: 'running', ...(scope.batchId ? { id: scope.batchId } : scope.batch ? { itiId: scope.batch.itiId } : {}) } }); return res.json({ batch: null, suggested: first?.id || null }) }
    const [tasks, obs] = await Promise.all([
      prisma.practicalTask.findMany({ where: { tradeId: b.tradeId } }),
      prisma.practicalObservation.findMany({ where: { traineeId: { in: b.trainees.map(t => t.id) } }, include: { observer: { select: { name: true } } }, orderBy: { observedAt: 'desc' } }),
    ])
    const matrix = b.trainees.map(t => ({ id: t.id, name: t.name, byTask: Object.fromEntries(tasks.map(k => [k.id, obs.find(o => o.traineeId === t.id && o.taskId === k.id) || null])) }))
    const counts = { demonstrated: 0, developing: 0, needs_re_practice: 0, not_observed: 0 }
    for (const o of obs) counts[o.result] = (counts[o.result] || 0) + 1
    res.json({ batch: b, tasks: tasks.map(k => ({ ...k, rubric: J(k.rubric, []) })), matrix, counts, observations: obs.map(o => ({ ...o, scores: J(o.scores, {}) })) })
  } catch (e) { next(e) }
})

r.post('/practicals/observe', requireRole('trainer', 'iti_principal'), async (req, res, next) => {
  try {
    const body = z.object({ taskId: z.string(), traineeId: z.string(), scores: z.record(z.number().min(0).max(2)), result: z.enum(['demonstrated', 'developing', 'needs_re_practice', 'not_observed']), note: z.string().optional(), recheckDays: z.number().int().optional(), sessionId: z.string().optional() }).parse(req.body)
    const o = await prisma.practicalObservation.create({ data: { taskId: body.taskId, traineeId: body.traineeId, sessionId: body.sessionId || null, observerId: req.user.id, scores: JSON.stringify(body.scores), result: body.result, note: body.note || null, recheckAt: body.result === 'needs_re_practice' ? new Date(Date.now() + (body.recheckDays || 7) * 86400000) : null } })
    if (body.result === 'needs_re_practice') await prisma.supportAction.create({ data: { traineeId: body.traineeId, reason: 'recheck_due', detail: 'Practical needs re-practice', ownerUserId: req.user.id, nextAction: 'Supervised re-practice then recheck', dueAt: o.recheckAt } })
    res.json({ observation: { ...o, scores: body.scores } })
  } catch (e) { next(e) }
})

// ── Field visits + findings ───────────────────────────────────────────────
r.get('/visits', async (req, res, next) => {
  try {
    const where = {}
    if (req.user.role === 'iti_principal' || req.user.role === 'trainer') { const iti = await itiFor(req.user); where.itiId = iti?.id }
    else if (req.query.itiId) where.itiId = String(req.query.itiId)
    const visits = await prisma.visit.findMany({ where, include: { iti: { select: { code: true, name: true } }, visitor: { select: { name: true, role: true } }, findings: true }, orderBy: { date: 'desc' } })
    res.json({ visits: visits.map(v => ({ ...v, checklist: J(v.checklist, {}) })), openFindings: visits.flatMap(v => v.findings.filter(f => f.state !== 'closed').map(f => ({ ...f, workshop: v.workshop, iti: v.iti }))) })
  } catch (e) { next(e) }
})

r.post('/visits', requireRole('iti_principal', 'spv_ceo', 'ima_officer'), async (req, res, next) => {
  try {
    const body = z.object({ itiId: z.string().optional(), workshop: z.string(), visitType: z.enum(['routine', 'issue_follow_up', 'ceo_review']).default('routine'), checklist: z.record(z.enum(['satisfactory', 'action_needed', 'n_a'])), note: z.string().optional(), findings: z.array(z.object({ item: z.string(), severity: z.enum(['low', 'medium', 'high']).default('medium'), ownerRole: z.string(), dueDays: z.number().int().default(7), affectedClass: z.string().optional() })).default([]) }).parse(req.body)
    const itiId = body.itiId || (await itiFor(req.user))?.id
    const v = await prisma.visit.create({ data: { itiId, workshop: body.workshop, visitType: body.visitType, visitorId: req.user.id, date: new Date(), checklist: JSON.stringify(body.checklist), note: body.note || null } })
    for (const f of body.findings) await prisma.finding.create({ data: { visitId: v.id, item: f.item, severity: f.severity, ownerRole: f.ownerRole, dueAt: new Date(Date.now() + f.dueDays * 86400000), affectedClass: f.affectedClass || null, state: 'action_assigned' } })
    res.json({ visit: v })
  } catch (e) { next(e) }
})

r.post('/findings/:id/close', requireRole('iti_principal', 'spv_ceo', 'trainer'), async (req, res, next) => {
  try { const body = z.object({ note: z.string().min(3) }).parse(req.body); res.json({ finding: await prisma.finding.update({ where: { id: req.params.id }, data: { state: 'closed', closureNote: body.note } }) }) } catch (e) { next(e) }
})

// ── Daily ops issues ──────────────────────────────────────────────────────
r.get('/issues', async (req, res, next) => {
  try {
    const where = {}
    if (req.user.role === 'trainer') where.raisedById = req.user.id
    else if (req.user.role === 'iti_principal') { const iti = await itiFor(req.user); where.itiId = iti?.id }
    else if (req.query.itiId) where.itiId = String(req.query.itiId)
    res.json({ issues: await prisma.opsIssue.findMany({ where, include: { iti: { select: { code: true, name: true } }, raisedBy: { select: { name: true, role: true } }, batch: { select: { name: true } } }, orderBy: [{ state: 'asc' }, { createdAt: 'desc' }] }) })
  } catch (e) { next(e) }
})

r.post('/issues', async (req, res, next) => {
  try {
    const body = z.object({ title: z.string(), category: z.enum(['equipment', 'space', 'consumables', 'safety', 'timetable', 'trainer']), severity: z.enum(['low', 'medium', 'high']).default('medium'), effect: z.string().optional(), batchId: z.string().optional(), machineId: z.string().optional() }).parse(req.body)
    const iti = await itiFor(req.user)
    const i = await prisma.opsIssue.create({ data: { itiId: iti.id, title: body.title, category: body.category, severity: body.severity, effect: body.effect || null, batchId: body.batchId || null, machineId: body.machineId || null, raisedById: req.user.id, ownerRole: body.category === 'timetable' || body.category === 'trainer' ? `PR-${iti.code}` : `TECH-${iti.code}` } })
    if (body.machineId) await prisma.machine.update({ where: { id: body.machineId }, data: { status: 'non_functional' } }).catch(() => null)
    await prisma.notification.create({ data: { type: 'system', title: `${body.severity === 'high' ? '⚠ ' : ''}Issue: ${body.title}`, category: 'ops', priority: body.severity === 'high' ? 'high' : 'normal', targetRoles: JSON.stringify(['iti_principal']), message: `${req.user.name} · ${body.category}${body.effect ? ' · ' + body.effect : ''}`, action: JSON.stringify({ label: 'Daily ops', type: 'OPEN_DAILY_OPS' }) } })
    res.json({ issue: i })
  } catch (e) { next(e) }
})

r.post('/issues/:id/update', requireRole('iti_principal', 'spv_ceo', 'trainer'), async (req, res, next) => {
  try {
    const body = z.object({ state: z.enum(['open', 'assigned', 'resolved']).optional(), ownerRole: z.string().optional(), resolution: z.string().optional() }).parse(req.body)
    res.json({ issue: await prisma.opsIssue.update({ where: { id: req.params.id }, data: { ...body, resolvedAt: body.state === 'resolved' ? new Date() : undefined } }) })
  } catch (e) { next(e) }
})

// ── Institute today (principal) ───────────────────────────────────────────
async function instituteToday(itiId) {
  const iti = await prisma.iti.findUnique({ where: { id: itiId }, include: { principal: { select: { name: true } } } })
  const today = todayUTC(), since = daysAgo(15)
  const [sessionsToday, recent, batches, leave, needsReview, assessNeeds, marksPending, issues, findings, support, referrals, trainees, planned] = await Promise.all([
    prisma.session.findMany({ where: { batch: { itiId }, date: today }, include: { batch: { select: { id: true, name: true, tradeId: true } }, subject: { select: { name: true, type: true } }, trainer: { select: { id: true, name: true } } }, orderBy: { startTime: 'asc' } }),
    prisma.session.findMany({ where: { batch: { itiId }, date: { gte: since, lt: today } }, select: { id: true, batchId: true, date: true, delivery: true, attendanceState: true, presentCount: true, absentCount: true, lateCount: true, syncState: true, batch: { select: { name: true, tradeId: true, lead: { select: { name: true } } } } } }),
    prisma.batch.findMany({ where: { itiId, state: 'running' }, select: { id: true, name: true, tradeId: true, lead: { select: { name: true } }, _count: { select: { trainees: true } } } }),
    prisma.trainerAvailability.findMany({ where: { date: today, status: { not: 'available' }, trainer: { profile: { contains: `"itiCode":"${iti.code}"` } } }, include: { trainer: { select: { id: true, name: true } } } }),
    prisma.session.findMany({ where: { batch: { itiId }, attendanceState: 'needs_review' }, include: { batch: { select: { name: true } }, subject: { select: { name: true } } }, orderBy: { date: 'desc' }, take: 10 }),
    prisma.assessmentPlan.findMany({ where: { batch: { itiId }, state: { in: ['needs_review', 'submitted'] } }, include: { batch: { select: { name: true } }, _count: { select: { entries: true } } }, orderBy: { date: 'desc' } }),
    prisma.assessmentPlan.count({ where: { batch: { itiId }, state: 'marks_pending' } }),
    prisma.opsIssue.findMany({ where: { itiId, state: { not: 'resolved' } }, include: { raisedBy: { select: { name: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.finding.findMany({ where: { visit: { itiId }, state: { not: 'closed' } }, include: { visit: { select: { workshop: true } } } }),
    prisma.supportAction.findMany({ where: { trainee: { itiId }, state: { not: 'closed' } }, select: { reason: true, state: true, dueAt: true } }),
    prisma.referral.count({ where: { trainee: { itiId }, state: { in: ['sent', 'accepted'] } } }),
    prisma.trainee.count({ where: { itiId, status: 'active' } }),
    prisma.assessmentPlan.findMany({ where: { batch: { itiId }, state: 'planned', date: { gte: today } }, include: { batch: { select: { name: true } } }, orderBy: { date: 'asc' }, take: 8 }),
  ])
  if (!iti.registryConnected) return { iti, registryConnected: false, note: 'No registry feed yet — operations data not available for this ITI. Registry connection milestone due 31 Dec.', batches: [], sessionsToday: [], trend: [] }
  // coverage: last working days — per batch, days since last report
  const lastReport = {}
  for (const s of recent) if (['submitted', 'confirmed', 'needs_review'].includes(s.attendanceState)) { if (!lastReport[s.batchId] || s.date > lastReport[s.batchId]) lastReport[s.batchId] = s.date }
  const classesWithoutReport = batches.map(b => { const last = lastReport[b.id]; const days = last ? Math.round((today - last) / 86400000) : 99; const unreported = recent.filter(s => s.batchId === b.id && s.attendanceState === 'not_reported' && ['scheduled', 'delivered', 'partial'].includes(s.delivery)).length; return { ...b, lastReportAt: last || null, daysSince: days, unreported } }).filter(b => b.daysSince >= 3 || b.unreported >= 2).sort((a, b) => b.daysSince - a.daysSince)
  const reported = recent.filter(s => ['submitted', 'confirmed', 'needs_review'].includes(s.attendanceState))
  const scheduledPast = recent.filter(s => s.delivery !== 'cancelled' && s.delivery !== 'rescheduled')
  const byDay = {}
  for (const s of reported) { const k = s.date.toISOString().slice(0, 10); const d = byDay[k] ||= { present: 0, total: 0 }; d.present += s.presentCount || 0; d.total += (s.presentCount || 0) + (s.absentCount || 0) }
  const trend = Object.entries(byDay).sort().map(([x, v]) => ({ x: x.slice(5), y: v.total ? Math.round(100 * v.present / v.total) : null }))
  const byProg = {}
  for (const s of reported) { const d = byProg[s.batch.tradeId] ||= { trade: s.batch.tradeId, present: 0, total: 0, sessions: 0 }; d.present += s.presentCount || 0; d.total += (s.presentCount || 0) + (s.absentCount || 0); d.sessions++ }
  const attendancePct = reported.length ? Math.round(100 * reported.reduce((s, x) => s + (x.presentCount || 0), 0) / Math.max(1, reported.reduce((s, x) => s + (x.presentCount || 0) + (x.absentCount || 0), 0))) : null
  const todayStats = { scheduled: sessionsToday.length, reported: sessionsToday.filter(s => s.attendanceState !== 'not_reported').length, cancelled: sessionsToday.filter(s => ['cancelled', 'rescheduled'].includes(s.delivery)).length, trainerOnLeave: sessionsToday.filter(s => leave.some(l => l.trainer.id === s.trainer?.id)).length }
  const supportBy = {}
  for (const s of support) supportBy[s.reason] = (supportBy[s.reason] || 0) + 1
  return { iti, registryConnected: true, today, trainees, batches: batches.length, sessionsToday, todayStats, coverage: { scheduled: scheduledPast.length, reported: reported.length, pct: scheduledPast.length ? Math.round(100 * reported.length / scheduledPast.length) : null, confirmed: recent.filter(s => s.attendanceState === 'confirmed').length, unsynced: recent.filter(s => s.syncState === 'saved_on_device').length },
    attendancePct, trend, byProgramme: Object.values(byProg).map(p => ({ ...p, pct: p.total ? Math.round(100 * p.present / p.total) : null })), classesWithoutReport, leave, needsReview, assessments: { needsReview: assessNeeds, marksPending, planned }, issues, findings, support: { open: support.length, overdue: support.filter(s => s.dueAt && s.dueAt < today).length, byReason: supportBy, referralsOpen: referrals } }
}

r.get('/institute-today', async (req, res, next) => {
  try { const itiId = await resolveItiId(req.user, req.query.itiId); res.json(await instituteToday(itiId)) } catch (e) { next(e) }
})

// ── Cluster operations (CEO) ──────────────────────────────────────────────
r.get('/cluster-operations', async (req, res, next) => {
  try {
    const c = await clusterFor(req.user)
    const itis = await prisma.iti.findMany({ where: { clusterId: c.id }, orderBy: [{ kind: 'asc' }, { code: 'asc' }] })
    const today = todayUTC(), since = daysAgo(15)
    const rows = []
    for (const i of itis) {
      if (!i.registryConnected) { rows.push({ iti: i, registryConnected: false }); continue }
      const [students, batches, sessions, assessments, obs, issues, findings, support, leave, trainers] = await Promise.all([
        prisma.trainee.count({ where: { itiId: i.id, status: 'active' } }), prisma.batch.count({ where: { itiId: i.id, state: 'running' } }),
        prisma.session.findMany({ where: { batch: { itiId: i.id }, date: { gte: since, lt: today } }, select: { delivery: true, attendanceState: true, presentCount: true, absentCount: true, batchId: true } }),
        prisma.assessmentPlan.groupBy({ by: ['state'], _count: { _all: true }, where: { batch: { itiId: i.id } } }),
        prisma.practicalObservation.count({ where: { trainee: { itiId: i.id } } }),
        prisma.opsIssue.count({ where: { itiId: i.id, state: { not: 'resolved' } } }), prisma.finding.count({ where: { visit: { itiId: i.id }, state: { not: 'closed' } } }),
        prisma.supportAction.count({ where: { trainee: { itiId: i.id }, state: { not: 'closed' } } }),
        prisma.trainerAvailability.count({ where: { date: today, status: { not: 'available' }, trainer: { profile: { contains: `"itiCode":"${i.code}"` } } } }),
        prisma.user.count({ where: { role: 'trainer', profile: { contains: `"itiCode":"${i.code}"` } } }),
      ])
      const sched = sessions.filter(s => !['cancelled', 'rescheduled'].includes(s.delivery)), rep = sessions.filter(s => ['submitted', 'confirmed', 'needs_review'].includes(s.attendanceState))
      const present = rep.reduce((s, x) => s + (x.presentCount || 0), 0), total = rep.reduce((s, x) => s + (x.presentCount || 0) + (x.absentCount || 0), 0)
      const silentBatches = new Set(sessions.filter(s => s.attendanceState === 'not_reported' && !['cancelled', 'rescheduled'].includes(s.delivery)).map(s => s.batchId))
      rows.push({ iti: i, registryConnected: true, students, batches, trainers, coveragePct: sched.length ? Math.round(100 * rep.length / sched.length) : null, sessionsScheduled: sched.length, sessionsReported: rep.length, attendancePct: total ? Math.round(100 * present / total) : null, cancelledPct: sessions.length ? Math.round(100 * sessions.filter(s => ['cancelled', 'rescheduled'].includes(s.delivery)).length / sessions.length) : 0,
        assessments: Object.fromEntries(assessments.map(a => [a.state, a._count._all])), practicalObservations: obs, openIssues: issues, openFindings: findings, supportOpen: support, trainersOnLeave: leave, batchesSilent: silentBatches.size })
    }
    res.json({ cluster: c, rows, coverage: { connected: rows.filter(r => r.registryConnected).length, total: rows.length } })
  } catch (e) { next(e) }
})

// ── Support queue ─────────────────────────────────────────────────────────
r.get('/support', async (req, res, next) => {
  try {
    const where = {}
    if (req.user.role === 'trainer') where.ownerUserId = req.user.id
    else if (req.user.role === 'iti_principal') { const iti = await itiFor(req.user); where.trainee = { itiId: iti?.id } }
    else if (req.query.itiId) where.trainee = { itiId: String(req.query.itiId) }
    if (req.query.state) where.state = String(req.query.state)
    const [actions, referrals] = await Promise.all([
      prisma.supportAction.findMany({ where, include: { trainee: { select: { id: true, name: true, gender: true, batchId: true, itiId: true, batch: { select: { name: true } } } }, owner: { select: { name: true } } }, orderBy: [{ state: 'asc' }, { dueAt: 'asc' }] }),
      prisma.referral.findMany({ where: req.user.role === 'trainer' ? { toUserId: req.user.id } : req.user.role === 'iti_principal' ? { trainee: { itiId: (await itiFor(req.user))?.id } } : {}, include: { trainee: { select: { id: true, name: true, batchId: true } }, toUser: { select: { name: true } } }, orderBy: { createdAt: 'desc' } }),
    ])
    const byReason = {}
    for (const a of actions) if (a.state !== 'closed') byReason[a.reason] = (byReason[a.reason] || 0) + 1
    res.json({ actions, referrals: referrals.map(x => ({ ...x, shared: J(x.shared, {}) })), byReason })
  } catch (e) { next(e) }
})

r.post('/support', requireRole('trainer', 'iti_principal'), async (req, res, next) => {
  try {
    const body = z.object({ traineeId: z.string(), reason: z.string(), detail: z.string().optional(), nextAction: z.string().optional(), dueDays: z.number().int().default(5) }).parse(req.body)
    res.json({ action: await prisma.supportAction.create({ data: { traineeId: body.traineeId, reason: body.reason, detail: body.detail || null, ownerUserId: req.user.id, nextAction: body.nextAction || null, dueAt: new Date(Date.now() + body.dueDays * 86400000) } }) })
  } catch (e) { next(e) }
})

r.post('/support/:id/update', requireRole('trainer', 'iti_principal', 'spv_ceo'), async (req, res, next) => {
  try {
    const body = z.object({ state: z.enum(['open', 'in_progress', 'closed']).optional(), nextAction: z.string().optional(), dueAt: z.string().optional(), outcome: z.string().optional() }).parse(req.body)
    res.json({ action: await prisma.supportAction.update({ where: { id: req.params.id }, data: { ...body, dueAt: body.dueAt ? new Date(body.dueAt) : undefined, closedAt: body.state === 'closed' ? new Date() : undefined, ownerUserId: req.user.role === 'trainer' ? req.user.id : undefined } }) })
  } catch (e) { next(e) }
})

// ── Student 360 (principal / trainer / CEO) ───────────────────────────────
r.get('/students/:id', async (req, res, next) => {
  try {
    const t = await prisma.trainee.findUnique({ where: { id: req.params.id }, include: { iti: { select: { code: true, name: true } }, batch: { include: { trade: { select: { code: true, name: true } }, lead: { select: { name: true } } } } } })
    if (!t) return res.status(404).json({ error: 'not_found' })
    const since = daysAgo(15)
    const [marks, entries, obs, support, referrals, events, apps] = await Promise.all([
      prisma.attendanceMark.findMany({ where: { traineeId: t.id, session: { date: { gte: since } } }, include: { session: { select: { date: true, subject: { select: { name: true } } } } }, orderBy: { session: { date: 'desc' } } }),
      prisma.markEntry.findMany({ where: { traineeId: t.id }, include: { assessment: { select: { title: true, maxMarks: true, date: true, type: true, state: true } } } }),
      prisma.practicalObservation.findMany({ where: { traineeId: t.id }, include: { task: { select: { title: true } } }, orderBy: { observedAt: 'desc' } }),
      prisma.supportAction.findMany({ where: { traineeId: t.id }, orderBy: { createdAt: 'desc' } }),
      prisma.referral.findMany({ where: { traineeId: t.id }, orderBy: { createdAt: 'desc' } }),
      prisma.companionEvent.findMany({ where: { traineeId: t.id, source: 'direct' }, select: { stage: true, theme: true, topic: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.application.findMany({ where: { traineeId: t.id }, include: { opportunity: { select: { title: true, type: true, employer: { select: { name: true } } } } } }),
    ])
    res.json({ trainee: t, attendance: { ...attendanceStats(marks), recent: marks }, assessments: entries, practicals: obs.map(o => ({ ...o, scores: J(o.scores, {}) })), support, referrals, companionThemes: events, applications: apps })
  } catch (e) { next(e) }
})

// ── Grievances (kept from the compliance layer) ───────────────────────────
r.get('/grievances', async (req, res, next) => {
  try {
    let where = {}
    if (req.user.role === 'trainee') where = { raisedByUserId: req.user.id }
    else if (req.user.role === 'iti_principal') { const iti = await itiFor(req.user); where = { itiId: iti?.id } }
    res.json({ grievances: await prisma.grievance.findMany({ where, include: { raisedBy: { select: { name: true, role: true } }, iti: { select: { name: true, code: true } } }, orderBy: { createdAt: 'desc' } }) })
  } catch (e) { next(e) }
})

r.post('/grievances', async (req, res, next) => {
  try {
    const body = z.object({ category: z.string(), note: z.string(), itiId: z.string().optional() }).parse(req.body)
    const iti = body.itiId ? null : await itiFor(req.user)
    const g = await prisma.grievance.create({ data: { raisedByUserId: req.user.id, itiId: body.itiId || iti?.id || null, category: body.category, note: body.note } })
    await prisma.notification.create({ data: { type: 'system', title: 'New grievance', category: 'grievance', priority: 'normal', targetRoles: JSON.stringify(['iti_principal', 'spv_ceo']), message: `${req.user.name}: ${body.note.slice(0, 120)}`, action: JSON.stringify({ label: 'Open grievances', type: 'OPEN_GRIEVANCES_ADMIN' }) } })
    res.json({ grievance: g })
  } catch (e) { next(e) }
})

r.post('/grievances/:id/status', requireRole('iti_principal', 'spv_ceo'), async (req, res, next) => {
  try {
    const body = z.object({ status: z.enum(['open', 'investigating', 'resolved']), resolutionNote: z.string().optional() }).parse(req.body)
    res.json({ grievance: await prisma.grievance.update({ where: { id: req.params.id }, data: { status: body.status, resolutionNote: body.resolutionNote, resolvedAt: body.status === 'resolved' ? new Date() : null } }) })
  } catch (e) { next(e) }
})

export default r
