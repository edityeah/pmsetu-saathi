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

export default r
