// /api/companion — PRD Module C: Student Companion + Student Voice.
//   what the companion knows about me · my plan · referrals (ask my trainer /
//   help from the institute) · artifacts (profile, plan, résumé, checklists) ·
//   Student Voice dashboard (themes aggregated for principal / CEO; direct
//   vs inferred kept apart; guest sessions counted separately).

import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../auth/middleware.js'
import { clusterFor, itiFor, traineeFor, resolveItiId } from '../lib/scope.js'

const r = Router()
r.use(requireAuth)
const J = (s, d = null) => { try { return JSON.parse(s ?? 'null') ?? d } catch { return d } }
const todayUTC = () => { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())) }
const daysAgo = n => new Date(todayUTC().getTime() - n * 86400000)

r.get('/me', requireRole('trainee'), async (req, res, next) => {
  try {
    const t = await prisma.trainee.findUnique({ where: { userId: req.user.id }, include: { iti: true, batch: { include: { trade: true, lead: { select: { id: true, name: true } }, offering: { select: { id: true, launch: true } } } } } })
    if (!t) return res.status(404).json({ error: 'no_trainee' })
    const today = todayUTC(), since = daysAgo(15), in14 = new Date(today.getTime() + 14 * 86400000)
    const [marks, entries, obs, artifacts, referrals, apps, upcoming, sessionsToday, progress, events, support, spells] = await Promise.all([
      prisma.attendanceMark.findMany({ where: { traineeId: t.id, session: { date: { gte: since } } }, include: { session: { select: { date: true, subject: { select: { name: true } } } } }, orderBy: { session: { date: 'desc' } } }),
      prisma.markEntry.findMany({ where: { traineeId: t.id }, include: { assessment: { select: { title: true, maxMarks: true, date: true, type: true, state: true } } } }),
      prisma.practicalObservation.findMany({ where: { traineeId: t.id }, include: { task: { select: { title: true } } }, orderBy: { observedAt: 'desc' } }),
      prisma.companionArtifact.findMany({ where: { traineeId: t.id } }),
      prisma.referral.findMany({ where: { traineeId: t.id }, include: { toUser: { select: { name: true } } }, orderBy: { createdAt: 'desc' } }),
      prisma.application.findMany({ where: { traineeId: t.id }, include: { opportunity: { include: { employer: { select: { name: true, city: true } } } } }, orderBy: { lastEventAt: 'desc' } }),
      t.batchId ? prisma.assessmentPlan.findMany({ where: { batchId: t.batchId, state: 'planned', date: { gte: today, lte: in14 } }, orderBy: { date: 'asc' } }) : [],
      t.batchId ? prisma.session.findMany({ where: { batchId: t.batchId, date: today }, include: { subject: { select: { name: true, type: true } }, trainer: { select: { name: true } } }, orderBy: { startTime: 'asc' } }) : [],
      prisma.moduleProgress.findMany({ where: { traineeId: t.id }, include: { module: true } }),
      prisma.companionEvent.findMany({ where: { traineeId: t.id }, orderBy: { createdAt: 'desc' }, take: 12 }),
      prisma.supportAction.findMany({ where: { traineeId: t.id, state: { not: 'closed' } }, include: { owner: { select: { name: true } } } }),
      prisma.employmentSpell.findMany({ where: { traineeId: t.id }, include: { employer: { select: { name: true } }, followUps: { orderBy: { dueAt: 'asc' } } } }),
    ])
    const present = marks.filter(m => m.status === 'present' || m.status === 'late').length
    const attendance = { total: marks.length, present, pct: marks.length ? Math.round(100 * present / marks.length) : null, recent: marks.slice(0, 15) }
    const lastMark = entries.filter(e => e.marks != null).sort((a, b) => b.assessment.date - a.assessment.date)[0] || null
    const art = Object.fromEntries(artifacts.map(a => [a.kind, { ...a, content: J(a.content, {}) }]))
    res.json({ trainee: t, attendance, assessments: entries, lastMark, practicals: obs.map(o => ({ ...o, scores: J(o.scores, {}) })), artifacts: art, referrals: referrals.map(x => ({ ...x, shared: J(x.shared, {}) })), applications: apps.map(a => ({ ...a, timeline: J(a.timeline, []), opportunity: { ...a.opportunity, tradeCodes: J(a.opportunity.tradeCodes, []) } })), upcoming, sessionsToday, progress: progress.map(p => ({ ...p, lessonsDone: J(p.lessonsDone, []), module: { ...p.module, lessons: J(p.module.lessons, []) } })), events, support, spells: spells.map(s => ({ ...s, logbook: J(s.logbook, []) })) })
  } catch (e) { next(e) }
})

// Knowledge base (Student Companion workbook): the facts the companion must
// keep consistent. Filtered to the caller's ITI / programme when known.
r.get('/kb', async (req, res, next) => {
  try {
    const t = await traineeFor(req.user)
    const iti = t ? await prisma.iti.findUnique({ where: { id: t.itiId } }) : await itiFor(req.user)
    const batch = t?.batchId ? await prisma.batch.findUnique({ where: { id: t.batchId }, select: { tradeId: true } }) : null
    const itiCode = String(req.query.itiCode || iti?.code || '')
    const programCode = String(req.query.programCode || batch?.tradeId || '')
    const all = req.query.all === '1'
    const [courses, roles, interests, topics, support, signals, rules] = await Promise.all([
      prisma.kbCourse.findMany({ where: all || !itiCode ? {} : { itiCode }, orderBy: [{ itiCode: 'asc' }, { programCode: 'asc' }] }),
      prisma.kbRole.findMany({ where: all || !programCode ? {} : { programCode }, orderBy: { id: 'asc' } }),
      prisma.kbInterest.findMany({ orderBy: { id: 'asc' } }),
      prisma.kbTopic.findMany({ where: all || !programCode ? {} : { programCode }, orderBy: { id: 'asc' } }),
      prisma.supportContact.findMany({ where: all || !itiCode ? {} : { itiCode }, orderBy: { id: 'asc' } }),
      prisma.signalType.findMany({ orderBy: { code: 'asc' } }),
      prisma.responseRule.findMany({ orderBy: { id: 'asc' } }),
    ])
    res.json({ itiCode: itiCode || null, programCode: programCode || null, courses, roles, interests, topics, support, signals, rules })
  } catch (e) { next(e) }
})

// Log a companion signal. Trainees are attributed; guests pass a guestKey.
// signalCode follows the Signal Taxonomy (SIG-…) so dashboards can label it.
r.post('/event', async (req, res, next) => {
  try {
    const body = z.object({ stage: z.enum(['explore', 'career', 'doubt', 'practice', 'job_prep', 'barrier', 'support']), topic: z.string().min(2), theme: z.string().optional(), subtheme: z.string().optional(), source: z.enum(['direct', 'inferred']).default('direct'), confidence: z.number().min(0).max(1).optional(), language: z.string().optional(), guestKey: z.string().optional(), itiId: z.string().optional(), signalCode: z.string().optional(), conversationId: z.string().optional() }).parse(req.body)
    const t = await traineeFor(req.user)
    const ev = await prisma.companionEvent.create({ data: { traineeId: t?.id || null, itiId: t?.itiId || body.itiId || null, guestKey: t ? null : body.guestKey || `guest-${req.user.id.slice(-6)}`, stage: body.stage, topic: body.topic, theme: body.theme || null, subtheme: body.subtheme || null, source: body.source, confidence: body.confidence ?? (body.source === 'direct' ? 1 : 0.7), language: body.language || req.user.language || 'hi', signalCode: body.signalCode || null, conversationId: body.conversationId || null } })
    res.json({ event: ev })
  } catch (e) { next(e) }
})

r.get('/referrals', async (req, res, next) => {
  try {
    let where = {}
    if (req.user.role === 'trainee') { const t = await traineeFor(req.user); where = { traineeId: t?.id } }
    else if (req.user.role === 'trainer') where = { OR: [{ toUserId: req.user.id }, { toRole: 'trainer', toUserId: null, trainee: { batch: { leadUserId: req.user.id } } }] }
    else if (req.user.role === 'iti_principal') { const iti = await itiFor(req.user); where = { trainee: { itiId: iti?.id } } }
    const referrals = await prisma.referral.findMany({ where, include: { trainee: { select: { id: true, name: true, batchId: true, batch: { select: { name: true } } } }, toUser: { select: { name: true } } }, orderBy: { createdAt: 'desc' } })
    res.json({ referrals: referrals.map(x => ({ ...x, shared: J(x.shared, {}) })) })
  } catch (e) { next(e) }
})

// Trainee asks for help; what is shared is explicit and previewed.
r.post('/referrals', requireRole('trainee'), async (req, res, next) => {
  try {
    const body = z.object({ kind: z.enum(['doubt', 'support', 'counselling', 'mock_interview', 'registry_correction']), summary: z.string().min(3), toRole: z.enum(['trainer', 'principal', 'counsellor']), share: z.record(z.any()).optional() }).parse(req.body)
    const t = await prisma.trainee.findUnique({ where: { userId: req.user.id }, include: { batch: { select: { leadUserId: true } }, iti: { select: { principalUserId: true, code: true } } } })
    const toUserId = body.toRole === 'trainer' ? t.batch?.leadUserId : body.toRole === 'principal' ? t.iti?.principalUserId : null
    const ref = await prisma.referral.create({ data: { traineeId: t.id, kind: body.kind, summary: body.summary, shared: JSON.stringify(body.share || { note: body.summary }), toRole: body.toRole, toUserId } })
    await prisma.companionEvent.create({ data: { traineeId: t.id, itiId: t.itiId, stage: body.kind === 'doubt' ? 'doubt' : 'support', topic: body.summary, theme: body.kind === 'doubt' ? 'learning_need' : 'support_request', source: 'direct', confidence: 1, language: req.user.language || 'hi', signalCode: body.kind === 'doubt' ? 'SIG-TRAINER-REQ' : body.kind === 'counselling' ? 'SIG-COUNSELLING-REQ' : 'SIG-SUPPORT-REQ' } })
    await prisma.notification.create({ data: { type: 'system', title: `Referral from ${t.name}`, category: 'companion', priority: 'normal', targetUserId: toUserId || undefined, targetRoles: toUserId ? '[]' : JSON.stringify([body.toRole === 'principal' ? 'iti_principal' : 'trainer']), message: body.summary.slice(0, 160), action: JSON.stringify({ label: 'Open', type: 'OPEN_SUPPORT_QUEUE' }) } })
    res.json({ referral: ref })
  } catch (e) { next(e) }
})

r.post('/referrals/:id/respond', requireRole('trainer', 'iti_principal', 'spv_ceo'), async (req, res, next) => {
  try {
    const body = z.object({ state: z.enum(['accepted', 'contacted', 'action_agreed', 'resolved', 'still_open']), response: z.string().optional() }).parse(req.body)
    const ref = await prisma.referral.update({ where: { id: req.params.id }, data: { state: body.state, response: body.response || undefined, toUserId: req.user.id }, include: { trainee: { select: { userId: true } } } })
    await prisma.notification.create({ data: { type: 'system', title: `Your request: ${body.state.replace(/_/g, ' ')}`, category: 'companion', priority: 'normal', targetUserId: ref.trainee.userId, message: body.response || `${req.user.name} updated your request.`, action: JSON.stringify({ label: 'See reply', type: 'OPEN_HELP_FROM_INSTITUTE' }) } })
    res.json({ referral: ref })
  } catch (e) { next(e) }
})

r.get('/artifacts', requireRole('trainee'), async (req, res, next) => {
  try { const t = await traineeFor(req.user); res.json({ artifacts: (await prisma.companionArtifact.findMany({ where: { traineeId: t.id } })).map(a => ({ ...a, content: J(a.content, {}) })) }) } catch (e) { next(e) }
})

r.put('/artifacts/:kind', requireRole('trainee'), async (req, res, next) => {
  try {
    const body = z.object({ title: z.string().optional(), content: z.record(z.any()) }).parse(req.body)
    const t = await traineeFor(req.user)
    const existing = await prisma.companionArtifact.findFirst({ where: { traineeId: t.id, kind: req.params.kind } })
    const a = existing ? await prisma.companionArtifact.update({ where: { id: existing.id }, data: { title: body.title || existing.title, content: JSON.stringify(body.content) } }) : await prisma.companionArtifact.create({ data: { traineeId: t.id, kind: req.params.kind, title: body.title || req.params.kind, content: JSON.stringify(body.content) } })
    res.json({ artifact: { ...a, content: body.content } })
  } catch (e) { next(e) }
})

// Student Voice: aggregated themes. Principal → own ITI; CEO/IMA/PMU → cluster with per-ITI split.
r.get('/voice', async (req, res, next) => {
  try {
    const clusterWide = ['spv_ceo', 'ima_officer', 'state_pmu'].includes(req.user.role) && !req.query.itiId
    const itiId = clusterWide ? null : await resolveItiId(req.user, req.query.itiId)
    const days = Number(req.query.days || 30)
    const c = await clusterFor(req.user)
    const where = { createdAt: { gte: daysAgo(days) }, ...(itiId ? { itiId } : { iti: { clusterId: c.id } }) }
    const [events, itis, referrals, students, signalTypes] = await Promise.all([
      prisma.companionEvent.findMany({ where, select: { itiId: true, traineeId: true, guestKey: true, stage: true, theme: true, subtheme: true, topic: true, source: true, confidence: true, createdAt: true, recommendation: true, signalCode: true, trainee: { select: { batch: { select: { tradeId: true } } } } } }),
      prisma.iti.findMany({ where: { clusterId: c.id }, select: { id: true, code: true, name: true, registryConnected: true } }),
      prisma.referral.groupBy({ by: ['kind', 'state'], _count: { _all: true }, where: itiId ? { trainee: { itiId } } : {} }),
      prisma.trainee.count({ where: { status: 'active', ...(itiId ? { itiId } : { iti: { clusterId: c.id } }) } }),
      prisma.signalType.findMany(),
    ])
    // Signal Taxonomy roll-up: distinct students per code; sensitive codes with fewer than 3 students are suppressed.
    const sigMap = {}
    for (const e of events) { if (!e.signalCode) continue; const sg = sigMap[e.signalCode] ||= { code: e.signalCode, events: 0, students: new Set() }; sg.events++; if (e.traineeId) sg.students.add(e.traineeId) }
    const signals = signalTypes.map(st => { const sg = sigMap[st.code]; const n = sg ? sg.students.size : 0; const suppressed = st.sensitive !== 'No' && n > 0 && n < 3; return { ...st, events: sg ? sg.events : 0, students: suppressed ? null : n, suppressed } }).filter(x => x.events > 0 || req.query.allSignals === '1').sort((a, b) => b.events - a.events)
    const themes = {}
    for (const e of events) {
      const th = e.theme || 'other'; const t = themes[th] ||= { theme: th, total: 0, direct: 0, inferred: 0, students: new Set(), guests: 0, topics: {}, byIti: {}, recommendation: e.recommendation }
      t.total++; e.source === 'direct' ? t.direct++ : t.inferred++; if (e.traineeId) t.students.add(e.traineeId); else t.guests++
      t.topics[e.topic] = (t.topics[e.topic] || 0) + 1; t.byIti[e.itiId] = (t.byIti[e.itiId] || 0) + 1
    }
    const list = Object.values(themes).map(t => ({ ...t, students: t.students.size, topics: Object.entries(t.topics).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([topic, n]) => ({ topic, n })) })).sort((a, b) => b.total - a.total)
    const byStage = {}
    for (const e of events) byStage[e.stage] = (byStage[e.stage] || 0) + 1
    const byWeek = {}
    for (const e of events) { const k = Math.floor((todayUTC() - e.createdAt) / (7 * 86400000)); byWeek[k] = (byWeek[k] || 0) + 1 }
    const trend = [3, 2, 1, 0].map(k => ({ x: k === 0 ? 'this week' : `${k}w ago`, y: byWeek[k] || 0 }))
    const byProgramme = {}
    for (const e of events) { const p = e.trainee?.batch?.tradeId || 'guest'; byProgramme[p] = (byProgramme[p] || 0) + 1 }
    const uniqueStudents = new Set(events.filter(e => e.traineeId).map(e => e.traineeId)).size
    const perIti = itis.map(i => ({ ...i, events: events.filter(e => e.itiId === i.id).length, students: new Set(events.filter(e => e.itiId === i.id && e.traineeId).map(e => e.traineeId)).size }))
    const actions = list.slice(0, 4).map(t => ({ theme: t.theme, suggestion: t.recommendation || 'Review with batch leads', affected: t.students }))
    res.json({ signals, scope: clusterWide ? 'cluster' : 'iti', itiId, days, totals: { events: events.length, direct: events.filter(e => e.source === 'direct').length, inferred: events.filter(e => e.source === 'inferred').length, students: uniqueStudents, guests: new Set(events.filter(e => e.guestKey).map(e => e.guestKey)).size, activeStudents: students, participationPct: students ? Math.round(100 * uniqueStudents / students) : null }, themes: list, byStage, trend, byProgramme: Object.entries(byProgramme).map(([k, v]) => ({ label: k, value: v })).sort((a, b) => b.value - a.value), perIti, referrals: referrals.map(x => ({ kind: x.kind, state: x.state, n: x._count._all })), actions })
  } catch (e) { next(e) }
})

export default r
