// /api/placement — PRD Module D: Industry & Placement.
//   employer register · opportunity register (lead → checking → live → paused
//   → filled/expired → archived) · person-level application pipeline with
//   evidence levels (student_reported → document_supported →
//   employer_confirmed → independently_verified; disputed) · employment
//   spells (apprenticeship / OJT / wage) with follow-ups · employer feedback.
// A "placement" is never a single number: every stage transition records who
// said it and on what evidence.

import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../auth/middleware.js'
import { clusterFor, itiFor, traineeFor, employerFor, trainerBatchIds } from '../lib/scope.js'

const r = Router()
r.use(requireAuth)
const J = (s, d = null) => { try { return JSON.parse(s ?? 'null') ?? d } catch { return d } }
const STAGES = ['interested', 'prepared', 'referred', 'applied', 'interviewed', 'offered', 'joined', 'follow_up', 'declined', 'withdrawn', 'not_selected']
const EVIDENCE = ['none', 'student_reported', 'document_supported', 'employer_confirmed', 'independently_verified', 'disputed']
const EV_RANK = { none: 0, student_reported: 1, document_supported: 2, employer_confirmed: 3, independently_verified: 4, disputed: -1 }

async function appScope(user) {
  if (user.role === 'trainee') { const t = await traineeFor(user); return { traineeId: t?.id || '__none__' } }
  if (user.role === 'employer') { const e = await employerFor(user); return { opportunity: { employerId: e?.id || '__none__' } } }
  if (user.role === 'trainer') return { trainee: { batchId: { in: await trainerBatchIds(user) } } }
  if (user.role === 'iti_principal') { const iti = await itiFor(user); return { trainee: { itiId: iti?.id || '__none__' } } }
  return {}
}
const appInclude = { trainee: { select: { id: true, name: true, gender: true, status: true, itiId: true, batchId: true, iti: { select: { code: true, name: true } }, batch: { select: { name: true, tradeId: true, cohortLabel: true } } } }, opportunity: { include: { employer: { select: { id: true, name: true, city: true, sector: true } } } } }
const appView = a => ({ ...a, timeline: J(a.timeline, []), opportunity: a.opportunity ? { ...a.opportunity, tradeCodes: J(a.opportunity.tradeCodes, []), approvedItis: J(a.opportunity.approvedItis, []) } : null })

// ── Employers ─────────────────────────────────────────────────────────────
r.get('/employers', async (req, res, next) => {
  try {
    const c = await clusterFor(req.user)
    const employers = await prisma.employer.findMany({ where: { clusterId: c.id }, include: { opportunities: { select: { id: true, title: true, type: true, status: true, openings: true, filled: true, _count: { select: { applications: true } } } }, feedback: { orderBy: { date: 'desc' }, take: 3 }, _count: { select: { spells: true } } }, orderBy: [{ relationshipStatus: 'asc' }, { name: 'asc' }] })
    const joined = await prisma.application.groupBy({ by: ['opportunityId'], _count: { _all: true }, where: { stage: { in: ['joined', 'follow_up'] } } })
    const jo = Object.fromEntries(joined.map(x => [x.opportunityId, x._count._all]))
    res.json({ employers: employers.map(e => ({ ...e, sites: J(e.sites, []), participatingItis: J(e.participatingItis, []), joined: e.opportunities.reduce((s, o) => s + (jo[o.id] || 0), 0), live: e.opportunities.filter(o => o.status === 'live').length })) })
  } catch (e) { next(e) }
})

r.post('/employers', requireRole('spv_ceo', 'iti_principal'), async (req, res, next) => {
  try {
    const body = z.object({ name: z.string(), sector: z.string(), city: z.string(), contactName: z.string().optional(), relationshipStatus: z.enum(['lead', 'active', 'paused']).default('lead'), participatingItis: z.array(z.string()).default([]), ojtSlots: z.number().int().default(0), hiringCommitment: z.number().int().default(0) }).parse(req.body)
    const c = await clusterFor(req.user)
    const code = `EMP-DL-${String((await prisma.employer.count()) + 1).padStart(2, '0')}`
    res.json({ employer: await prisma.employer.create({ data: { clusterId: c.id, code, name: body.name, sector: body.sector, city: body.city, sites: JSON.stringify([body.city]), contactName: body.contactName || null, relationshipStatus: body.relationshipStatus, participatingItis: JSON.stringify(body.participatingItis), ojtSlots: body.ojtSlots, hiringCommitment: body.hiringCommitment, lastInteractionAt: new Date() } }) })
  } catch (e) { next(e) }
})

r.post('/employers/:id/update', requireRole('spv_ceo', 'iti_principal', 'employer'), async (req, res, next) => {
  try {
    const body = z.object({ relationshipStatus: z.enum(['lead', 'active', 'paused']).optional(), mouSigned: z.boolean().optional(), nextEngagementDays: z.number().int().optional(), note: z.string().optional() }).parse(req.body)
    const data = { lastInteractionAt: new Date() }
    if (body.relationshipStatus) data.relationshipStatus = body.relationshipStatus
    if (body.mouSigned) { data.mouSignedAt = new Date(); data.mouRef = `MOU/${req.params.id.slice(-4).toUpperCase()}/2026`; data.relationshipStatus = 'active' }
    if (body.nextEngagementDays) data.nextEngagementAt = new Date(Date.now() + body.nextEngagementDays * 86400000)
    const e = await prisma.employer.update({ where: { id: req.params.id }, data })
    if (body.note) await prisma.employerFeedback.create({ data: { employerId: e.id, kind: 'demand', text: body.note, date: new Date(), roleTag: req.user.role } })
    res.json({ employer: e })
  } catch (e) { next(e) }
})

// ── Opportunities ─────────────────────────────────────────────────────────
r.get('/opportunities', async (req, res, next) => {
  try {
    const c = await clusterFor(req.user)
    let where = { clusterId: c.id }
    if (req.user.role === 'employer') { const e = await employerFor(req.user); where.employerId = e?.id || '__none__' }
    if (req.query.status) where.status = String(req.query.status)
    const t = await traineeFor(req.user)
    const list = await prisma.opportunity.findMany({ where, include: { employer: { select: { id: true, name: true, city: true, sector: true, relationshipStatus: true } }, _count: { select: { applications: true } }, applications: t ? { where: { traineeId: t.id } } : false }, orderBy: [{ status: 'asc' }, { closingAt: 'asc' }] })
    let opps = list.map(o => ({ ...o, tradeCodes: J(o.tradeCodes, []), approvedItis: J(o.approvedItis, []), myApplication: t ? (o.applications?.[0] ? appView(o.applications[0]) : null) : undefined, applications: undefined }))
    if (t) {
      const trade = (await prisma.batch.findUnique({ where: { id: t.batchId }, select: { tradeId: true } }))?.tradeId
      opps = opps.filter(o => o.status === 'live' && (o.approvedItis.length === 0 || o.approvedItis.includes(t.itiId))).map(o => ({ ...o, tradeMatch: o.tradeCodes.includes(trade), eligible: o.type === 'ojt' ? t.status === 'active' : (t.status === 'completed' || o.type === 'apprenticeship') }))
      opps.sort((a, b) => (b.tradeMatch - a.tradeMatch) || (b.eligible - a.eligible))
    }
    res.json({ opportunities: opps })
  } catch (e) { next(e) }
})

r.post('/opportunities', requireRole('employer', 'spv_ceo', 'iti_principal'), async (req, res, next) => {
  try {
    const body = z.object({ title: z.string(), type: z.enum(['apprenticeship', 'ojt', 'wage']), tradeCodes: z.array(z.string()).default([]), location: z.string(), openings: z.number().int().min(1), wageMin: z.number().int().optional(), wageMax: z.number().int().optional(), stipend: z.number().int().optional(), eligibility: z.string().optional(), documents: z.string().optional(), process: z.string().optional(), shiftTravel: z.string().optional(), closingAt: z.string().optional(), startAt: z.string().optional(), employerId: z.string().optional() }).parse(req.body)
    const c = await clusterFor(req.user)
    const emp = req.user.role === 'employer' ? await employerFor(req.user) : await prisma.employer.findUnique({ where: { id: body.employerId || '' } })
    if (!emp) return res.status(400).json({ error: 'employer_required' })
    const o = await prisma.opportunity.create({ data: { clusterId: c.id, employerId: emp.id, title: body.title, type: body.type, tradeCodes: JSON.stringify(body.tradeCodes), location: body.location, openings: body.openings, wageMin: body.wageMin ?? null, wageMax: body.wageMax ?? null, wagePeriod: body.wageMin ? 'month' : null, stipend: body.stipend ?? null, eligibility: body.eligibility || null, documents: body.documents || null, process: body.process || null, shiftTravel: body.shiftTravel || null, closingAt: body.closingAt ? new Date(body.closingAt) : null, startAt: body.startAt ? new Date(body.startAt) : null, source: `${req.user.role} entry`, lastCheckedAt: new Date(), status: req.user.role === 'employer' ? 'checking' : 'lead', approvedItis: '[]' } })
    await prisma.notification.create({ data: { type: 'system', title: `New opportunity to check: ${body.title}`, category: 'placement', priority: 'normal', targetRoles: JSON.stringify(['spv_ceo', 'iti_principal']), message: `${emp.name} · ${body.type} · ${body.openings} openings. Verify details before publishing to students.`, action: JSON.stringify({ label: 'Employer register', type: 'OPEN_EMPLOYER_REGISTER' }) } })
    res.json({ opportunity: { ...o, tradeCodes: body.tradeCodes, approvedItis: [] } })
  } catch (e) { next(e) }
})

r.post('/opportunities/:id/status', requireRole('spv_ceo', 'iti_principal', 'employer'), async (req, res, next) => {
  try {
    const body = z.object({ status: z.enum(['lead', 'checking', 'live', 'paused', 'filled', 'expired', 'archived']), approvedItis: z.array(z.string()).optional() }).parse(req.body)
    const o = await prisma.opportunity.update({ where: { id: req.params.id }, data: { status: body.status, lastCheckedAt: new Date(), ...(body.approvedItis ? { approvedItis: JSON.stringify(body.approvedItis) } : {}), version: { increment: 1 } } })
    res.json({ opportunity: { ...o, tradeCodes: J(o.tradeCodes, []), approvedItis: J(o.approvedItis, []) } })
  } catch (e) { next(e) }
})

// ── Applications (the person-level pipeline) ──────────────────────────────
r.get('/applications', async (req, res, next) => {
  try {
    const where = await appScope(req.user)
    if (req.query.stage) where.stage = String(req.query.stage)
    if (req.query.itiId) where.trainee = { ...(where.trainee || {}), itiId: String(req.query.itiId) }
    if (req.query.opportunityId) where.opportunityId = String(req.query.opportunityId)
    if (req.query.evidenceLevel) where.evidenceLevel = String(req.query.evidenceLevel)
    const apps = await prisma.application.findMany({ where, include: appInclude, orderBy: { lastEventAt: 'desc' }, take: 400 })
    res.json({ applications: apps.map(appView) })
  } catch (e) { next(e) }
})

r.post('/applications', async (req, res, next) => {
  try {
    const body = z.object({ opportunityId: z.string(), traineeId: z.string().optional(), interest: z.enum(['interested', 'undecided', 'not_interested']).default('interested') }).parse(req.body)
    const t = req.user.role === 'trainee' ? await traineeFor(req.user) : await prisma.trainee.findUnique({ where: { id: body.traineeId || '' } })
    if (!t) return res.status(400).json({ error: 'trainee_required' })
    const existing = await prisma.application.findUnique({ where: { traineeId_opportunityId: { traineeId: t.id, opportunityId: body.opportunityId } } })
    if (existing) return res.json({ application: appView(await prisma.application.findUnique({ where: { id: existing.id }, include: appInclude })) })
    const a = await prisma.application.create({ data: { traineeId: t.id, opportunityId: body.opportunityId, stage: 'interested', interest: body.interest, ownerRole: 'SPV-IEPC', nextAction: 'Résumé review with trainer', dueAt: new Date(Date.now() + 5 * 86400000), timeline: JSON.stringify([{ at: new Date().toISOString().slice(0, 10), actor: req.user.role, event: 'Expressed interest', source: req.user.role === 'trainee' ? 'companion' : 'coordinator' }]) }, include: appInclude })
    await prisma.companionEvent.create({ data: { traineeId: t.id, itiId: t.itiId, stage: 'job_prep', topic: `Interested in ${a.opportunity.title}`, theme: 'aspiration', subtheme: a.opportunity.type, source: 'direct', confidence: 1, language: 'hi' } })
    res.json({ application: appView(a) })
  } catch (e) { next(e) }
})

// Stage transition with actor-based evidence.
r.post('/applications/:id/stage', async (req, res, next) => {
  try {
    const body = z.object({ stage: z.enum(STAGES).optional(), note: z.string().optional(), wage: z.number().int().optional(), date: z.string().optional(), evidenceLevel: z.enum(EVIDENCE).optional(), preparation: z.string().optional(), consent: z.boolean().optional(), applicationRef: z.string().optional(), interviewOutcome: z.string().optional() }).parse(req.body || {})
    const a = await prisma.application.findUnique({ where: { id: req.params.id }, include: { opportunity: true, trainee: { select: { userId: true, name: true } } } })
    if (!a) return res.status(404).json({ error: 'not_found' })
    const role = req.user.role, when = body.date ? new Date(body.date) : new Date()
    const timeline = J(a.timeline, [])
    const data = { lastEventAt: new Date() }
    let evidence = a.evidenceLevel, stage = body.stage || a.stage
    if (role === 'trainee') {
      if (!['interested', 'prepared', 'applied', 'offered', 'joined', 'declined', 'withdrawn'].includes(stage) && body.evidenceLevel !== 'disputed') return res.status(403).json({ error: 'stage_not_allowed_for_role' })
      if (body.consent) data.consentSharedAt = new Date()
      if (body.evidenceLevel === 'disputed') { evidence = 'disputed'; stage = a.stage }
      else if (['offered', 'joined'].includes(stage)) evidence = EV_RANK[evidence] < 1 ? 'student_reported' : evidence
    } else if (role === 'employer') {
      if (!['interviewed', 'offered', 'joined', 'not_selected'].includes(stage) && !body.evidenceLevel) return res.status(403).json({ error: 'stage_not_allowed_for_role' })
      if (body.evidenceLevel === 'disputed') evidence = 'disputed'
      else if (['offered', 'joined'].includes(stage)) evidence = 'employer_confirmed'
    } else if (role === 'ima_officer') {
      if (!body.evidenceLevel || !['independently_verified', 'disputed'].includes(body.evidenceLevel)) return res.status(400).json({ error: 'ima_sets_evidence_only' })
      evidence = body.evidenceLevel; stage = a.stage
    } else { // trainer / principal / CEO (coordinators)
      if (['offered', 'joined'].includes(stage) && EV_RANK[evidence] < 2) evidence = 'document_supported'
      if (body.evidenceLevel && EV_RANK[body.evidenceLevel] <= 2) evidence = body.evidenceLevel
    }
    data.stage = stage; data.evidenceLevel = evidence
    if (body.preparation) data.preparation = body.preparation
    if (stage === 'referred') data.referredAt = when
    if (stage === 'applied') { data.appliedAt = when; data.applicationRef = body.applicationRef || `REF-${a.id.slice(-5).toUpperCase()}` }
    if (stage === 'interviewed') { data.interviewAt = when; data.interviewOutcome = body.interviewOutcome || 'pending' }
    if (stage === 'offered') { data.offerAt = when; data.offerWage = body.wage ?? a.offerWage; data.offerSource = role }
    if (stage === 'joined') data.joinedAt = when
    if (body.note) data.evidenceNote = body.note
    data.nextAction = { interested: 'Résumé review with trainer', prepared: 'Ask consent and refer', referred: 'Confirm application lodged', applied: 'Chase interview date', interviewed: 'Collect employer feedback', offered: 'Confirm joining date', joined: 'Month-1 follow-up', follow_up: 'Month-3 follow-up' }[stage] || null
    data.dueAt = data.nextAction ? new Date(Date.now() + 7 * 86400000) : null
    timeline.push({ at: new Date().toISOString().slice(0, 10), actor: role, event: `${stage.replace(/_/g, ' ')}${body.evidenceLevel ? ' · ' + body.evidenceLevel.replace(/_/g, ' ') : ''}${body.note ? ' — ' + body.note : ''}`, source: role })
    data.timeline = JSON.stringify(timeline)
    const up = await prisma.application.update({ where: { id: a.id }, data, include: appInclude })
    if (stage === 'joined' && !(await prisma.employmentSpell.count({ where: { applicationId: a.id } }))) {
      const sp = await prisma.employmentSpell.create({ data: { traineeId: a.traineeId, applicationId: a.id, employerId: a.opportunity.employerId, type: a.opportunity.type, role: a.opportunity.title.replace(/ \(.*\)/, ''), startAt: when, wage: data.offerWage ?? a.offerWage ?? null, wagePeriod: 'month', stipend: a.opportunity.stipend, hoursTarget: a.opportunity.type === 'ojt' ? 150 : null, evidenceLevel: evidence } })
      for (const m of [30, 90]) await prisma.followUp.create({ data: { spellId: sp.id, dueAt: new Date(when.getTime() + m * 86400000) } })
      await prisma.opportunity.update({ where: { id: a.opportunityId }, data: { filled: { increment: 1 } } })
      if (a.opportunity.type === 'wage') await prisma.trainee.update({ where: { id: a.traineeId }, data: { status: 'placed' } }).catch(() => null)
    }
    if (role !== 'trainee' && a.trainee.userId) await prisma.notification.create({ data: { type: 'system', title: `Your application: ${stage.replace(/_/g, ' ')}`, category: 'placement', priority: 'normal', targetUserId: a.trainee.userId, message: `${a.opportunity.title} — updated by ${req.user.name}.${body.note ? ' ' + body.note : ''}`, action: JSON.stringify({ label: 'Applications', type: 'OPEN_APPLICATIONS' }) } })
    if (role === 'trainee' && ['offered', 'joined'].includes(stage)) await prisma.notification.create({ data: { type: 'reminder', title: `${a.trainee.name} reports ${stage}`, category: 'placement', priority: 'high', targetRoles: JSON.stringify(['employer', 'spv_ceo']), message: `${a.opportunity.title}. Employer confirmation raises the evidence level.`, action: JSON.stringify({ label: 'Confirm', type: 'OPEN_CONFIRM_HIRE' }) } })
    res.json({ application: appView(up) })
  } catch (e) { next(e) }
})

// Pipeline summary (CEO / principal / IMA / PMU).
r.get('/pipeline', async (req, res, next) => {
  try {
    const c = await clusterFor(req.user)
    const scope = await appScope(req.user)
    const where = { ...scope, ...(req.query.itiId ? { trainee: { ...(scope.trainee || {}), itiId: String(req.query.itiId) } } : {}) }
    const apps = await prisma.application.findMany({ where, include: { trainee: { select: { itiId: true, gender: true, batch: { select: { tradeId: true } } } }, opportunity: { select: { type: true, employerId: true, title: true } } } })
    const byStage = Object.fromEntries(STAGES.map(s => [s, 0]))
    for (const a of apps) byStage[a.stage] = (byStage[a.stage] || 0) + 1
    const joined = apps.filter(a => ['joined', 'follow_up'].includes(a.stage))
    const evidence = Object.fromEntries(EVIDENCE.map(e => [e, joined.filter(a => a.evidenceLevel === e).length]))
    const byType = {}
    for (const a of joined) byType[a.opportunity.type] = (byType[a.opportunity.type] || 0) + 1
    const itis = await prisma.iti.findMany({ where: { clusterId: c.id }, select: { id: true, code: true, name: true, registryConnected: true } })
    const perIti = itis.map(i => { const mine = apps.filter(a => a.trainee.itiId === i.id); const j = mine.filter(a => ['joined', 'follow_up'].includes(a.stage)); return { ...i, total: mine.length, referred: mine.filter(a => ['referred', 'applied', 'interviewed', 'offered', 'joined', 'follow_up'].includes(a.stage)).length, interviewed: mine.filter(a => ['interviewed', 'offered', 'joined', 'follow_up', 'not_selected'].includes(a.stage)).length, joined: j.length, employerConfirmedPlus: j.filter(a => EV_RANK[a.evidenceLevel] >= 3).length, women: j.filter(a => a.trainee.gender === 'F').length } })
    const overdue = await prisma.application.findMany({ where: { ...where, dueAt: { lt: new Date() }, stage: { notIn: ['declined', 'withdrawn', 'not_selected'] } }, include: appInclude, orderBy: { dueAt: 'asc' }, take: 20 })
    const disputed = await prisma.application.findMany({ where: { ...where, evidenceLevel: 'disputed' }, include: appInclude })
    const conv = { referredToInterview: byStage.referred + byStage.applied + byStage.interviewed + byStage.offered + byStage.joined + byStage.follow_up + byStage.not_selected, interviewedToOffer: byStage.interviewed + byStage.offered + byStage.joined + byStage.follow_up + byStage.not_selected }
    res.json({ total: apps.length, byStage, joined: joined.length, evidence, verifiedPlus: joined.filter(a => EV_RANK[a.evidenceLevel] >= 3).length, byType, perIti, overdue: overdue.map(appView), disputed: disputed.map(appView),
      conversion: { interviewPct: conv.referredToInterview ? Math.round(100 * (byStage.interviewed + byStage.offered + byStage.joined + byStage.follow_up + byStage.not_selected) / conv.referredToInterview) : null, offerPct: conv.interviewedToOffer ? Math.round(100 * (byStage.offered + byStage.joined + byStage.follow_up) / conv.interviewedToOffer) : null },
      wages: (() => { const w = joined.map(a => a.offerWage).filter(Boolean).sort((a, b) => a - b); return w.length ? { n: w.length, median: w[Math.floor(w.length / 2)], min: w[0], max: w[w.length - 1] } : null })() })
  } catch (e) { next(e) }
})

// Trainer view: applications for my batches grouped by what I owe them.
r.get('/for-my-batches', requireRole('trainer'), async (req, res, next) => {
  try {
    const batchIds = await trainerBatchIds(req.user)
    const apps = await prisma.application.findMany({ where: { trainee: { batchId: { in: batchIds } } }, include: appInclude, orderBy: { dueAt: 'asc' } })
    const referrals = await prisma.referral.findMany({ where: { kind: 'mock_interview', OR: [{ toUserId: req.user.id }, { trainee: { batchId: { in: batchIds } } }] }, include: { trainee: { select: { name: true } } } })
    const opps = await prisma.opportunity.findMany({ where: { status: 'live' }, include: { employer: { select: { name: true } } } })
    res.json({ applications: apps.map(appView), needPreparation: apps.filter(a => a.stage === 'interested').map(appView), mockInterviews: referrals, liveOpportunities: opps.map(o => ({ ...o, tradeCodes: J(o.tradeCodes, []), approvedItis: J(o.approvedItis, []) })) })
  } catch (e) { next(e) }
})

// ── Spells + follow-ups ───────────────────────────────────────────────────
r.get('/spells', async (req, res, next) => {
  try {
    let where = {}
    if (req.user.role === 'trainee') { const t = await traineeFor(req.user); where = { traineeId: t?.id } }
    else if (req.user.role === 'employer') { const e = await employerFor(req.user); where = { employerId: e?.id } }
    else if (req.user.role === 'trainer') where = { trainee: { batchId: { in: await trainerBatchIds(req.user) } } }
    else if (req.user.role === 'iti_principal') { const iti = await itiFor(req.user); where = { trainee: { itiId: iti?.id } } }
    if (req.query.type) where.type = String(req.query.type)
    const spells = await prisma.employmentSpell.findMany({ where, include: { trainee: { select: { id: true, name: true, gender: true, iti: { select: { code: true, name: true } }, batch: { select: { name: true, tradeId: true } } } }, employer: { select: { name: true, city: true } }, followUps: { orderBy: { dueAt: 'asc' } }, application: { select: { id: true, stage: true, evidenceLevel: true } } }, orderBy: { startAt: 'desc' } })
    res.json({ spells: spells.map(s => ({ ...s, logbook: J(s.logbook, []) })), followUpsDue: spells.flatMap(s => s.followUps.filter(f => !f.respondedAt && f.dueAt <= new Date()).map(f => ({ ...f, spell: { id: s.id, role: s.role, employer: s.employer, trainee: s.trainee } }))) })
  } catch (e) { next(e) }
})

r.post('/spells/:id/log', requireRole('trainee'), async (req, res, next) => {
  try {
    const body = z.object({ hours: z.number().min(0.5).max(12), task: z.string(), traineeNote: z.string().optional() }).parse(req.body)
    const s = await prisma.employmentSpell.findUnique({ where: { id: req.params.id } })
    const log = J(s.logbook, []); log.push({ date: new Date().toISOString().slice(0, 10), ...body })
    const up = await prisma.employmentSpell.update({ where: { id: s.id }, data: { logbook: JSON.stringify(log), hoursLogged: Math.min(s.hoursTarget || 9999, s.hoursLogged + body.hours) } })
    res.json({ spell: { ...up, logbook: log } })
  } catch (e) { next(e) }
})

r.post('/spells/:id/sign', requireRole('employer', 'iti_principal', 'trainer'), async (req, res, next) => {
  try {
    const s = await prisma.employmentSpell.findUnique({ where: { id: req.params.id } })
    const data = req.user.role === 'employer' ? { mentorSignedAt: new Date(), evidenceLevel: 'employer_confirmed' } : { itiSignedAt: new Date() }
    if ((data.mentorSignedAt || s.mentorSignedAt) && (data.itiSignedAt || s.itiSignedAt) && s.type === 'ojt') data.state = 'completed'
    res.json({ spell: await prisma.employmentSpell.update({ where: { id: s.id }, data }) })
  } catch (e) { next(e) }
})

r.post('/followups/:id/respond', async (req, res, next) => {
  try {
    const body = z.object({ status: z.enum(['working', 'not_working', 'unknown', 'changed']), note: z.string().optional() }).parse(req.body)
    const f = await prisma.followUp.update({ where: { id: req.params.id }, data: { status: body.status, note: body.note || null, respondedAt: new Date(), respondent: req.user.role === 'trainee' ? 'student' : req.user.role === 'employer' ? 'employer' : 'coordinator', attempts: { increment: 1 } } })
    if (body.status === 'not_working') { const s = await prisma.employmentSpell.update({ where: { id: f.spellId }, data: { state: 'exited', endAt: new Date() } }); await prisma.application.updateMany({ where: { id: s.applicationId || '' }, data: { stage: 'follow_up', nextAction: 'Re-engage: new opportunity match', dueAt: new Date(Date.now() + 5 * 86400000) } }) }
    res.json({ followUp: f })
  } catch (e) { next(e) }
})

r.get('/feedback', async (req, res, next) => {
  try { res.json({ feedback: await prisma.employerFeedback.findMany({ include: { employer: { select: { name: true } } }, orderBy: { date: 'desc' } }) }) } catch (e) { next(e) }
})

r.post('/feedback', requireRole('employer', 'spv_ceo', 'iti_principal'), async (req, res, next) => {
  try {
    const body = z.object({ kind: z.enum(['demand', 'interviewed', 'joined']), text: z.string().min(3), quotable: z.boolean().default(false), employerId: z.string().optional() }).parse(req.body)
    const emp = req.user.role === 'employer' ? await employerFor(req.user) : await prisma.employer.findUnique({ where: { id: body.employerId || '' } })
    res.json({ feedback: await prisma.employerFeedback.create({ data: { employerId: emp.id, kind: body.kind, text: body.text, quotable: body.quotable, date: new Date(), roleTag: req.user.role } }) })
  } catch (e) { next(e) }
})

// ── Section 5: placement analytics and the employer directory ──────────────
const STAGE_ORDER = ['interested', 'prepared', 'referred', 'applied', 'interviewed', 'offered', 'joined']
const stageRank = st => st === 'follow_up' ? 7 : STAGE_ORDER.indexOf(st) + 1   // declined / withdrawn / not_selected rank 0
const J2 = (s, d) => { try { return JSON.parse(s) } catch { return d } }

r.get('/analytics', async (req, res, next) => {
  try {
    const c = await clusterFor(req.user)
    const itis = await prisma.iti.findMany({ where: { clusterId: c.id }, orderBy: [{ kind: 'asc' }, { code: 'asc' }], select: { id: true, code: true, name: true } })
    let itiIds = itis.map(i => i.id)
    if (req.user.role === 'iti_principal' || req.user.role === 'trainer') { const i = await itiFor(req.user); itiIds = i ? [i.id] : [] }
    else if (req.query.itiId && req.query.itiId !== 'all') itiIds = [String(req.query.itiId)]
    const trade = req.query.trade && req.query.trade !== 'all' ? String(req.query.trade) : null
    const type = req.query.type && req.query.type !== 'all' ? String(req.query.type) : null
    const employerId = req.query.employerId && req.query.employerId !== 'all' ? String(req.query.employerId) : null
    const asOf = req.query.asOf ? new Date(String(req.query.asOf) + 'T23:59:59Z') : new Date()
    const appWhere = { trainee: { itiId: { in: itiIds }, ...(trade ? { batch: { tradeId: trade } } : {}) }, lastEventAt: { lte: asOf }, ...(type || employerId ? { opportunity: { ...(type ? { type } : {}), ...(employerId ? { employerId } : {}) } } : {}) }
    const [apps, spells, opps, pool, trades, employers] = await Promise.all([
      prisma.application.findMany({ where: appWhere, select: { id: true, traineeId: true, stage: true, evidenceLevel: true, joinedAt: true, offerWage: true, opportunity: { select: { type: true, employerId: true } }, trainee: { select: { itiId: true, gender: true, batch: { select: { tradeId: true } } } } } }),
      prisma.employmentSpell.findMany({ where: { trainee: { itiId: { in: itiIds } }, ...(type ? { type } : {}), ...(employerId ? { employerId } : {}), startAt: { lte: asOf } }, include: { followUps: true } }),
      prisma.opportunity.findMany({ where: { clusterId: c.id, status: 'live', ...(type ? { type } : {}), ...(employerId ? { employerId } : {}) }, select: { openings: true, filled: true } }),
      prisma.trainee.findMany({ where: { itiId: { in: itiIds }, ...(trade ? { batch: { tradeId: trade } } : {}), OR: [{ status: 'completed' }, { applications: { some: {} } }, { spells: { some: {} } }] }, select: { id: true, itiId: true, batch: { select: { tradeId: true } } } }),
      prisma.trade.findMany({ where: { batches: { some: { itiId: { in: itiIds } } } }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      prisma.employer.findMany({ where: { clusterId: c.id }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    ])
    // Distinct people per stage: a person counts at every stage they reached.
    const best = {}
    for (const a of apps) { const r = stageRank(a.stage); if (r > (best[a.traineeId] || 0)) best[a.traineeId] = r }
    const reached = k => Object.values(best).filter(r => r >= k).length
    const funnel = [{ stage: 'Eligible', n: pool.length }, ...STAGE_ORDER.map((st, i) => ({ stage: st === 'referred' ? 'Applied / referred' : st.charAt(0).toUpperCase() + st.slice(1), n: reached(i + 1) }))]
    // Collapse referred + applied into one step as in the brief.
    const f2 = funnel.filter(x => x.stage !== 'Applied'); f2.find(x => x.stage === 'Applied / referred').n = reached(3)
    for (let i = 1; i < f2.length; i++) f2[i].pct = f2[i - 1].n ? Math.round(100 * f2[i].n / f2[i - 1].n) : null
    const joinedApps = apps.filter(a => ['joined', 'follow_up'].includes(a.stage))
    const joinedPeople = new Set(joinedApps.map(a => a.traineeId))
    const level = l => new Set(joinedApps.filter(a => l.includes(a.evidenceLevel)).map(a => a.traineeId)).size
    const ladder = { reported: joinedPeople.size, employerConfirmed: level(['employer_confirmed', 'independently_verified']), independentlyVerified: level(['independently_verified']), disputed: level(['disputed']) }
    const activeSpells = spells.filter(x => x.state === 'active')
    const outcomes = ['wage', 'apprenticeship', 'ojt'].map(t => ({ type: t, n: new Set(activeSpells.filter(x => x.type === t).map(x => x.traineeId)).size }))
    // Retention checks: follow-ups bucketed by days after joining.
    const buckets = [{ label: 'D30', lo: 0, hi: 60 }, { label: 'D90', lo: 60, hi: 135 }, { label: 'D180', lo: 135, hi: 400 }]
    const retention = buckets.map(b => { const fus = activeSpells.flatMap(x => x.followUps.filter(f => { const d = (f.dueAt - x.startAt) / 86400000; return d >= b.lo && d < b.hi && f.dueAt <= asOf })); const responded = fus.filter(f => f.respondedAt); const working = responded.filter(f => f.status === 'working'); return { label: b.label, due: fus.length, responded: responded.length, coveragePct: fus.length ? Math.round(100 * responded.length / fus.length) : null, retentionPct: responded.length ? Math.round(100 * working.length / responded.length) : null } })
    const byIti = itis.filter(i => itiIds.includes(i.id)).map(i => { const ids = new Set(pool.filter(t => t.itiId === i.id).map(t => t.id)); const my = apps.filter(a => a.trainee.itiId === i.id); const b = {}; for (const a of my) { const r = stageRank(a.stage); if (r > (b[a.traineeId] || 0)) b[a.traineeId] = r }; const at = k => Object.values(b).filter(r => r >= k).length; return { id: i.id, code: i.code, name: i.name.replace('Government ITI ', ''), pool: ids.size, applied: at(3), interviewed: at(5), offered: at(6), joined: at(7), women: new Set(my.filter(a => ['joined', 'follow_up'].includes(a.stage) && a.trainee.gender === 'F').map(a => a.traineeId)).size } })
    // By trade (the principal's comparison): same distinct-people rule per trade.
    const tradeIds = [...new Set([...pool.map(t => t.batch?.tradeId), ...apps.map(a => a.trainee.batch?.tradeId)].filter(Boolean))]
    const byTrade = tradeIds.map(tid => { const ids = new Set(pool.filter(t => t.batch?.tradeId === tid).map(t => t.id)); const my = apps.filter(a => a.trainee.batch?.tradeId === tid); const b = {}; for (const a of my) { const r = stageRank(a.stage); if (r > (b[a.traineeId] || 0)) b[a.traineeId] = r }; const at = k => Object.values(b).filter(r => r >= k).length; return { id: tid, name: trades.find(t => t.id === tid)?.name || tid, pool: ids.size, applied: at(3), interviewed: at(5), offered: at(6), joined: at(7), women: new Set(my.filter(a => ['joined', 'follow_up'].includes(a.stage) && a.trainee.gender === 'F').map(a => a.traineeId)).size } }).sort((p, q) => q.joined - p.joined || q.pool - p.pool)
    const wages = joinedApps.map(a => a.offerWage).filter(Boolean).sort((a, b) => a - b)
    res.json({ filters: { itiId: itiIds.length === itis.length ? 'all' : itiIds[0], trade: trade || 'all', type: type || 'all', employerId: employerId || 'all', asOf: asOf.toISOString().slice(0, 10) }, options: { trades, employers },
      totals: { liveSeats: opps.reduce((s, o) => s + Math.max(0, o.openings - o.filled), 0), applications: apps.length, reportedJoins: joinedPeople.size, verifiedJoins: ladder.independentlyVerified, employerConfirmed: ladder.employerConfirmed, pool: pool.length, medianWage: wages.length ? wages[Math.floor(wages.length / 2)] : null },
      funnel: f2, outcomes, ladder, retention, byIti, byTrade })
  } catch (e) { next(e) }
})

r.get('/employers/:id/profile', async (req, res, next) => {
  try {
    const e = await prisma.employer.findUnique({ where: { id: req.params.id }, include: { opportunities: { orderBy: { createdAt: 'desc' } }, feedback: { orderBy: { date: 'desc' } }, spells: { include: { trainee: { select: { name: true, itiId: true } } }, orderBy: { startAt: 'desc' } } } })
    if (!e) return res.status(404).json({ error: 'not_found' })
    const apps = await prisma.application.findMany({ where: { opportunity: { employerId: e.id } }, select: { stage: true, evidenceLevel: true, traineeId: true, lastEventAt: true, opportunity: { select: { title: true } } }, orderBy: { lastEventAt: 'desc' } })
    const itis = J2(e.participatingItis, [])
    const trades = [...new Set(e.opportunities.flatMap(o => J2(o.tradeCodes, [])))]
    const live = e.opportunities.filter(o => o.status === 'live')
    const joined = new Set(apps.filter(a => ['joined', 'follow_up'].includes(a.stage)).map(a => a.traineeId)).size
    const description = `${e.name} is a ${e.sector.toLowerCase()} employer based in ${e.city}${J2(e.sites, []).length > 1 ? ` with sites at ${J2(e.sites, []).join(', ')}` : ''}. It works with ${itis.length ? itis.join(' and ') : 'the cluster'}${trades.length ? ` for ${trades.join(', ')} candidates` : ''}, ${e.mouSignedAt ? `under an MoU signed on ${e.mouSignedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : 'with no MoU yet'}, with a commitment of ${e.hiringCommitment} hires${e.ojtSlots ? ` and ${e.ojtSlots} OJT slots` : ''}. The relationship is owned by ${e.relationshipOwnerRole} and is ${e.relationshipStatus}.`
    const history = [
      ...e.feedback.map(f => ({ date: f.date, kind: f.kind === 'demand' ? 'Demand note' : f.kind === 'interviewed' ? 'Interview feedback' : 'Joining feedback', text: f.text, by: f.roleTag || 'SPV-IEPC' })),
      ...(e.mouSignedAt ? [{ date: e.mouSignedAt, kind: 'MoU signed', text: e.mouRef || 'MoU on file', by: e.relationshipOwnerRole }] : []),
      ...(e.lastInteractionAt ? [{ date: e.lastInteractionAt, kind: 'Last interaction', text: `${e.contactName || 'Contact'} via ${e.contactChannel || 'phone'}`, by: e.relationshipOwnerRole }] : []),
      ...(e.nextEngagementAt ? [{ date: e.nextEngagementAt, kind: 'Next engagement', text: 'Scheduled', by: e.relationshipOwnerRole }] : []),
    ].sort((a, b) => new Date(b.date) - new Date(a.date))
    res.json({ employer: { ...e, sites: J2(e.sites, []), participatingItis: itis, trades, description, opportunities: e.opportunities.map(o => ({ ...o, tradeCodes: J2(o.tradeCodes, []), approvedItis: J2(o.approvedItis, []) })), spells: undefined, feedback: undefined },
      stats: { liveOpportunities: live.length, liveSeats: live.reduce((s, o) => s + Math.max(0, o.openings - o.filled), 0), candidatesInProcess: apps.filter(a => ['referred', 'applied', 'interviewed', 'offered'].includes(a.stage)).length, joined, onOjt: e.spells.filter(x => x.type === 'ojt' && x.state === 'active').length },
      placements: e.spells.slice(0, 20).map(x => ({ id: x.id, name: x.trainee.name, itiId: x.trainee.itiId, role: x.role, type: x.type, startAt: x.startAt, state: x.state, evidenceLevel: x.evidenceLevel })),
      history })
  } catch (e) { next(e) }
})

export default r
