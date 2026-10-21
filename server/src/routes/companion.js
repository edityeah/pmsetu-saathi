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
import { RECORD_FIELDS, CHAT_FIELDS, INTEREST_ITEMS, PERSONALITY_ITEMS, completeness, nextProbes, scoreAssessment, readiness, synthCareerReport } from '../llm/career.js'

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


// ══════════════════════════════════════════════════════════════════════════
// Student view: skill passport, document vault, timetable, marks analytics,
// placement journey, upskilling. Every figure carries its source; nothing is
// invented — a missing fact shows as missing.
// ══════════════════════════════════════════════════════════════════════════
const STANDARD_DOCS = [{ name: 'Class 10 marksheet', kind: 'marksheet' }, { name: 'Aadhaar', kind: 'id' }, { name: 'Passport photo', kind: 'photo' }, { name: 'Caste / income certificate', kind: 'certificate', hint: 'Needed for some scholarships' }]
const pctOf = (a, b) => b ? Math.round(100 * a / b) : null
async function me(req) { const t = await prisma.trainee.findUnique({ where: { userId: req.user.id }, include: { iti: { select: { id: true, code: true, name: true } }, batch: { include: { trade: true, lead: { select: { name: true } } } } } }); if (!t) throw Object.assign(new Error('no_trainee'), { status: 404 }); return t }

r.get('/passport', requireRole('trainee'), async (req, res, next) => {
  try {
    const t = await me(req)
    const [progress, obs, entries, artifacts, events, docs] = await Promise.all([
      prisma.moduleProgress.findMany({ where: { traineeId: t.id }, include: { module: { select: { title: true, credits: true, kind: true } } } }),
      prisma.practicalObservation.findMany({ where: { traineeId: t.id, result: 'demonstrated' }, include: { task: { select: { title: true } } }, orderBy: { observedAt: 'desc' } }),
      prisma.markEntry.findMany({ where: { traineeId: t.id, marks: { not: null }, reviewState: 'confirmed' }, include: { assessment: { select: { title: true, maxMarks: true, date: true, type: true } } } }),
      prisma.companionArtifact.findMany({ where: { traineeId: t.id } }),
      prisma.companionEvent.findMany({ where: { traineeId: t.id, theme: { in: ['course_interest', 'aspiration'] } }, orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.traineeDocument.findMany({ where: { traineeId: t.id } }),
    ])
    const art = Object.fromEntries(artifacts.map(a => [a.kind, J(a.content, {})]))
    const stated = [
      ...(art.profile?.interests || []).map(x => ({ label: x, at: null })),
      ...events.map(e => ({ label: e.topic, at: e.createdAt })),
      ...((art.resume?.skills || []).map(x => ({ label: x, at: null }))),
    ].filter((x, i, arr) => x.label && arr.findIndex(y => y.label.toLowerCase() === x.label.toLowerCase()) === i).slice(0, 10)
    const verified = [
      ...progress.filter(p => p.pctComplete >= 100).map(p => ({ label: p.module.title, source: 'module', detail: `${p.module.credits} credits`, at: p.lastActivityAt })),
      ...obs.map(o => ({ label: o.task.title, source: 'practical', detail: 'demonstrated under observation', at: o.observedAt })),
      ...entries.filter(e => e.marks >= 0.6 * e.assessment.maxMarks).map(e => ({ label: e.assessment.title, source: 'assessment', detail: `${e.marks} of ${e.assessment.maxMarks}`, at: e.assessment.date })),
    ]
    const inProgress = progress.filter(p => p.pctComplete > 0 && p.pctComplete < 100).map(p => ({ label: p.module.title, pct: p.pctComplete }))
    const certificates = docs.filter(d => ['certificate', 'letter'].includes(d.kind)).map(d => ({ name: d.name, state: d.state, verifiedAt: d.verifiedAt }))
    const idVerified = docs.some(d => d.kind === 'id' && d.state === 'verified')
    const pct = Math.min(100, (idVerified ? 15 : 0) + Math.min(15, stated.length * 5) + Math.min(40, verified.length * 8) + (art.resume ? 15 : 0) + Math.min(15, certificates.length * 8))
    res.json({ trainee: { id: t.id, name: t.name, trade: t.batch?.trade?.name, batch: t.batch?.name, iti: t.iti?.name, passportId: `SAATHI-${t.iti?.code}-${t.id.slice(-4)}` }, pct, stated, verified, inProgress, certificates, resume: !!art.resume })
  } catch (e) { next(e) }
})

r.get('/documents', requireRole('trainee'), async (req, res, next) => {
  try {
    const t = await me(req)
    const docs = await prisma.traineeDocument.findMany({ where: { traineeId: t.id }, orderBy: { createdAt: 'asc' } })
    const list = [...docs.map(d => ({ ...d, standard: STANDARD_DOCS.some(s => s.name === d.name) })), ...STANDARD_DOCS.filter(s => !docs.some(d => d.name === s.name)).map(s => ({ id: `missing-${s.kind}`, name: s.name, kind: s.kind, source: null, state: 'missing', note: s.hint || null, standard: true }))]
    res.json({ documents: list, counts: { verified: list.filter(d => d.state === 'verified').length, self: list.filter(d => d.state === 'self').length, awaiting: list.filter(d => d.state === 'awaiting').length, missing: list.filter(d => d.state === 'missing').length } })
  } catch (e) { next(e) }
})
r.post('/documents', requireRole('trainee'), async (req, res, next) => {
  try {
    const t = await me(req)
    const body = z.object({ name: z.string().min(1), kind: z.string().default('other'), source: z.enum(['upload', 'digilocker']).default('upload') }).parse(req.body)
    const d = await prisma.traineeDocument.create({ data: { traineeId: t.id, name: body.name, kind: body.kind, source: body.source, state: body.source === 'digilocker' ? 'verified' : (body.kind === 'certificate' || body.kind === 'marksheet' ? 'awaiting' : 'self'), verifiedAt: body.source === 'digilocker' ? new Date() : null, note: body.source === 'upload' && (body.kind === 'certificate' || body.kind === 'marksheet') ? 'Uploaded; institute check pending' : null } })
    res.json({ document: d })
  } catch (e) { next(e) }
})
// DigiLocker fetch (demo): the standard documents arrive verified.
r.post('/documents/digilocker', requireRole('trainee'), async (req, res, next) => {
  try {
    const t = await me(req)
    const have = await prisma.traineeDocument.findMany({ where: { traineeId: t.id } })
    const created = []
    for (const s of STANDARD_DOCS.filter(x => x.kind !== 'photo')) {
      const ex = have.find(d => d.name === s.name)
      if (ex && ex.state === 'verified') continue
      if (ex) { created.push(await prisma.traineeDocument.update({ where: { id: ex.id }, data: { source: 'digilocker', state: 'verified', verifiedAt: new Date(), note: null } })) }
      else created.push(await prisma.traineeDocument.create({ data: { traineeId: t.id, name: s.name, kind: s.kind, source: 'digilocker', state: 'verified', verifiedAt: new Date() } }))
    }
    res.json({ fetched: created.length })
  } catch (e) { next(e) }
})

r.get('/timetable', requireRole('trainee'), async (req, res, next) => {
  try {
    const t = await me(req)
    const today = todayUTC()
    const from = req.query.from ? new Date(String(req.query.from) + 'T00:00:00Z') : new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * 86400000)
    const to = new Date(from.getTime() + 7 * 86400000)
    if (!t.batchId) return res.json({ enrolled: false, week: [], exams: [], today: [], summary: {} })
    const [sessions, marks, exams, entries] = await Promise.all([
      prisma.session.findMany({ where: { batchId: t.batchId, date: { gte: from, lt: to } }, include: { subject: { select: { name: true, type: true } }, trainer: { select: { name: true } } }, orderBy: [{ date: 'asc' }, { startTime: 'asc' }] }),
      prisma.attendanceMark.findMany({ where: { traineeId: t.id, session: { date: { gte: from, lt: to } } }, select: { sessionId: true, status: true } }),
      prisma.assessmentPlan.findMany({ where: { batchId: t.batchId, date: { gte: new Date(today.getTime() - 30 * 86400000) } }, include: { subject: { select: { name: true } } }, orderBy: { date: 'asc' } }),
      prisma.markEntry.findMany({ where: { traineeId: t.id }, select: { assessmentId: true, marks: true } }),
    ])
    const mine = Object.fromEntries(marks.map(m => [m.sessionId, m.status]))
    const days = []
    for (let i = 0; i < 7; i++) { const d = new Date(from.getTime() + i * 86400000); const ss = sessions.filter(s => s.date.getTime() === d.getTime()); days.push({ date: d, label: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }), isToday: d.getTime() === today.getTime(), sessions: ss.map(s => ({ id: s.id, startTime: s.startTime, subject: s.subject.name, kind: s.kind, room: s.room, trainer: s.substituteName || s.trainer?.name || null, delivery: s.delivery, attendance: mine[s.id] || null })) }) }
    const ex = exams.map(a => { const e = entries.find(x => x.assessmentId === a.id); const daysLeft = Math.round((a.date - today) / 86400000); return { id: a.id, title: a.title, type: a.type, subject: a.subject?.name || null, date: a.date, daysLeft, state: a.state, maxMarks: a.maxMarks, marks: e?.marks ?? null, pct: e?.marks != null ? pctOf(e.marks, a.maxMarks) : null } })
    const week = sessions.filter(s => s.delivery !== 'cancelled')
    res.json({ enrolled: true, batch: { name: t.batch.name, trade: t.batch.trade.name, lead: t.batch.lead?.name || null }, from, to, week: days, today: days.find(d => d.isToday)?.sessions || [], exams: ex, summary: { classes: week.length, practicals: week.filter(s => s.kind === 'practical').length, nextExam: ex.find(x => x.daysLeft >= 0 && x.state === 'planned') || null } })
  } catch (e) { next(e) }
})

r.get('/marks', requireRole('trainee'), async (req, res, next) => {
  try {
    const t = await me(req)
    const today = todayUTC(), since = new Date(today.getTime() - 15 * 86400000)
    const [entries, plans, marks, obs] = await Promise.all([
      prisma.markEntry.findMany({ where: { traineeId: t.id }, include: { assessment: { select: { id: true, title: true, maxMarks: true, date: true, type: true, state: true, subject: { select: { name: true } } } } } }),
      t.batchId ? prisma.assessmentPlan.findMany({ where: { batchId: t.batchId }, include: { subject: { select: { name: true } } }, orderBy: { date: 'asc' } }) : [],
      prisma.attendanceMark.findMany({ where: { traineeId: t.id, session: { date: { gte: since, lte: today }, attendanceState: { not: 'not_reported' } } }, select: { status: true } }),
      prisma.practicalObservation.findMany({ where: { traineeId: t.id }, include: { task: { select: { title: true } } }, orderBy: { observedAt: 'desc' } }),
    ])
    const byId = Object.fromEntries(entries.map(e => [e.assessmentId, e]))
    const series = plans.map(a => { const e = byId[a.id]; const reviewed = e && ['confirmed'].includes(e.reviewState); return { id: a.id, title: a.title, type: a.type, subject: a.subject?.name || null, date: a.date, maxMarks: a.maxMarks, marks: e?.marks ?? null, pct: e?.marks != null ? pctOf(e.marks, a.maxMarks) : null, state: a.state, status: a.state === 'planned' ? 'upcoming' : e ? (e.status === 'absent' ? 'absent' : reviewed ? 'reviewed' : 'awaiting_check') : 'awaiting_check', reviewState: e?.reviewState || null, source: e?.source || null } })
    const scored = series.filter(s => s.pct != null)
    const byType = ['theory', 'practical', 'viva'].map(k => { const rs = scored.filter(s => s.type === k); return { type: k, n: rs.length, avgPct: rs.length ? Math.round(rs.reduce((a, b) => a + b.pct, 0) / rs.length) : null } }).filter(x => x.n)
    const present = marks.filter(m => m.status === 'present' || m.status === 'late').length, counted = marks.filter(m => ['present', 'late', 'absent'].includes(m.status)).length
    const last = [...scored].sort((a, b) => b.date - a.date)[0] || null
    const next = series.find(s => s.state === 'planned' && s.date >= today) || null
    res.json({ trainee: { name: t.name, trade: t.batch?.trade?.name, batch: t.batch?.name }, attendance: { pct: pctOf(present, counted), present, total: counted, threshold: 75, windowDays: 15 }, lastExam: last, nextExam: next ? { ...next, daysLeft: Math.round((next.date - today) / 86400000) } : null, series, byType, average: scored.length ? Math.round(scored.reduce((a, b) => a + b.pct, 0) / scored.length) : null, practicals: obs.map(o => ({ title: o.task.title, result: o.result, at: o.observedAt })), correctionRoute: 'Disputed marks go through the institute correction route; Saathi cannot edit them.' })
  } catch (e) { next(e) }
})

r.get('/placement-journey', requireRole('trainee'), async (req, res, next) => {
  try {
    const t = await me(req)
    const [apps, artifacts, spells] = await Promise.all([
      prisma.application.findMany({ where: { traineeId: t.id }, include: { opportunity: { include: { employer: { select: { name: true, city: true } } } } }, orderBy: { lastEventAt: 'desc' } }),
      prisma.companionArtifact.findMany({ where: { traineeId: t.id } }),
      prisma.employmentSpell.findMany({ where: { traineeId: t.id }, include: { employer: { select: { name: true } } } }),
    ])
    const rank = { interested: 1, prepared: 2, referred: 3, applied: 3, interviewed: 4, offered: 5, joined: 6, follow_up: 6 }
    const live = apps.filter(a => !['declined', 'withdrawn', 'not_selected'].includes(a.stage))
    const at = k => live.filter(a => (rank[a.stage] || 0) >= k).length
    const funnel = [{ stage: 'Interested', n: at(1) }, { stage: 'Applied', n: at(3) }, { stage: 'Interviewed', n: at(4) }, { stage: 'Offered', n: at(5) }, { stage: 'Joined', n: at(6) }]
    const art = Object.fromEntries(artifacts.map(a => [a.kind, J(a.content, {})]))
    const resume = art.resume || null
    const fields = [['name', !!(resume?.name || t.name)], ['course', !!(resume?.course || t.batch?.trade?.name)], ['skills', (resume?.skills || []).length > 0], ['languages', (resume?.languages || []).length > 0], ['contact', !!t.phone], ['summary', !!resume?.summary]]
    const resumePct = Math.round(100 * fields.filter(f => f[1]).length / fields.length)
    const applications = apps.map(a => ({ id: a.id, title: a.opportunity.title, employer: a.opportunity.employer.name, city: a.opportunity.employer.city, type: a.opportunity.type, pay: a.opportunity.wageMin ? `₹${a.opportunity.wageMin.toLocaleString('en-IN')}–${(a.opportunity.wageMax || a.opportunity.wageMin).toLocaleString('en-IN')} / month` : a.opportunity.stipend ? `₹${a.opportunity.stipend.toLocaleString('en-IN')} stipend` : null, stage: a.stage, stageRank: rank[a.stage] || 0, evidenceLevel: a.evidenceLevel, nextAction: a.nextAction, lastEventAt: a.lastEventAt, checkedAt: a.opportunity.lastCheckedAt, offerWage: a.offerWage, timeline: J(a.timeline, []) }))
    const interviews = applications.filter(a => ['interviewed', 'applied', 'referred'].includes(a.stage)).map(a => ({ id: a.id, title: a.title, employer: a.employer, status: a.stage === 'interviewed' ? 'cleared or awaiting result' : 'to be scheduled', nextAction: a.nextAction }))
    res.json({ trainee: { name: t.name, trade: t.batch?.trade?.name }, kpis: { applications: live.length, apprenticeship: live.filter(a => a.opportunity.type !== 'wage').length, wage: live.filter(a => a.opportunity.type === 'wage').length, interviews: live.filter(a => (rank[a.stage] || 0) >= 4).length, interviewsScheduled: live.filter(a => ['applied', 'referred'].includes(a.stage) && a.nextAction).length, offers: live.filter(a => (rank[a.stage] || 0) >= 5).length, joined: live.filter(a => (rank[a.stage] || 0) >= 6).length, resumePct, resumeMissing: fields.filter(f => !f[1]).map(f => f[0]) }, funnel, applications, interviews, spells: spells.map(s => ({ id: s.id, role: s.role, employer: s.employer.name, type: s.type, startAt: s.startAt, evidenceLevel: s.evidenceLevel })) })
  } catch (e) { next(e) }
})

r.get('/upskilling', requireRole('trainee'), async (req, res, next) => {
  try {
    const t = await me(req)
    const programCode = t.batch?.tradeId || null
    const [roles, courses, spells, kbc] = await Promise.all([
      programCode ? prisma.kbRole.findMany({ where: { programCode }, orderBy: { id: 'asc' } }) : [],
      prisma.trade.findMany({ where: { kind: { in: ['short_term', 'new_specialist'] } }, orderBy: { name: 'asc' }, select: { id: true, code: true, name: true, kind: true, durationValue: true, durationUnit: true, entryAssumption: true, roleDirection: true, status: true } }),
      prisma.employmentSpell.findMany({ where: { traineeId: t.id }, include: { employer: { select: { name: true } } }, orderBy: { startAt: 'desc' } }),
      programCode ? prisma.kbCourse.findMany({ where: { programCode }, take: 1 }) : [],
    ])
    const checked = kbc[0]?.sourceTreatment ? 'Course catalogue · checked at seed' : null
    const programmes = courses.map(c => ({ id: c.id, title: `${c.name} — ${c.kind === 'short_term' ? 'short programme' : 'new programme'}`, provider: 'Cluster ITIs (PM-SETU)', entry: c.entryAssumption || 'Entry facts to be confirmed', why: c.roleDirection ? `Leads to ${c.roleDirection.toLowerCase()}` : null, duration: c.durationValue ? `${c.durationValue} ${c.durationUnit}` : null, verified: c.status === 'approved', checkedAt: c.status === 'approved' ? checked : null }))
    const nextRoles = roles.map(r => ({ id: r.id, roleName: r.roleName, sector: r.sector, progression: r.progression, skillsToBuild: r.skillsToBuild, entryPathway: r.entryPathway, workplace: r.typicalWorkplace }))
    res.json({ trainee: { name: t.name, trade: t.batch?.trade?.name }, current: spells[0] ? { role: spells[0].role, employer: spells[0].employer.name, type: spells[0].type, startAt: spells[0].startAt, evidenceLevel: spells[0].evidenceLevel } : null, programmes, nextRoles, questions: ['What experience do I need before this qualification?', 'What does it cost and is there a scholarship?', 'Can I study while working?', 'Which employers value this most?'] })
  } catch (e) { next(e) }
})


// ══════════════════════════════════════════════════════════════════════════
// Career counselling (Disha-style, ITI-grounded): progressive profile,
// assessment, report. State lives in CompanionArtifact kinds career_profile,
// career_assessment and career_report.
// ══════════════════════════════════════════════════════════════════════════
async function careerRecord(t) {
  const today = todayUTC(), since = new Date(today.getTime() - 15 * 86400000)
  const [marks, entries, obs, progress] = await Promise.all([
    prisma.attendanceMark.findMany({ where: { traineeId: t.id, session: { date: { gte: since, lte: today }, attendanceState: { not: 'not_reported' } } }, select: { status: true } }),
    prisma.markEntry.findMany({ where: { traineeId: t.id, marks: { not: null } }, include: { assessment: { select: { maxMarks: true } } } }),
    prisma.practicalObservation.count({ where: { traineeId: t.id, result: 'demonstrated' } }),
    prisma.moduleProgress.findMany({ where: { traineeId: t.id }, select: { pctComplete: true } }),
  ])
  const present = marks.filter(m => m.status === 'present' || m.status === 'late').length, counted = marks.filter(m => ['present', 'late', 'absent'].includes(m.status)).length
  const avg = entries.length ? Math.round(100 * entries.reduce((s, e) => s + e.marks / e.assessment.maxMarks, 0) / entries.length) : null
  const stage = t.status === 'placed' ? 'Placed' : t.status === 'completed' ? 'Pass-out' : `Year ${t.studyYear} trainee`
  return { current_stage: stage, trade: t.batch?.trade?.name || null, tradeCode: t.batch?.tradeId || null, batch: t.batch?.name || null, iti: t.iti?.name || null, attendance: counted ? Math.round(100 * present / counted) : null, marks: avg, practicals: obs, modulesDone: progress.filter(p => p.pctComplete >= 100).length, education: t.education }
}
async function careerArtifacts(t) {
  const rows = await prisma.companionArtifact.findMany({ where: { traineeId: t.id, kind: { in: ['career_profile', 'career_assessment', 'career_report', 'resume'] } } })
  const get = k => { const r = rows.find(x => x.kind === k); return r ? J(r.content, {}) : null }
  return { profile: get('career_profile') || {}, assessment: get('career_assessment'), report: get('career_report'), resume: get('resume') }
}
async function saveArtifact(t, kind, title, content) {
  const ex = await prisma.companionArtifact.findFirst({ where: { traineeId: t.id, kind } })
  if (ex) return prisma.companionArtifact.update({ where: { id: ex.id }, data: { title, content: JSON.stringify(content) } })
  return prisma.companionArtifact.create({ data: { traineeId: t.id, kind, title, content: JSON.stringify(content) } })
}
async function careerContext(t, record) {
  const code = record.tradeCode
  const [roles, opps, courses, apps, docs, events] = await Promise.all([
    code ? prisma.kbRole.findMany({ where: { programCode: code }, orderBy: { id: 'asc' } }) : [],
    prisma.opportunity.findMany({ where: { clusterId: t.iti?.clusterId || undefined, status: 'live' }, include: { employer: { select: { name: true } } }, orderBy: { closingAt: 'asc' } }),
    prisma.trade.findMany({ where: { kind: { in: ['short_term', 'new_specialist'] } }, select: { id: true, name: true, kind: true, status: true, roleDirection: true } }),
    prisma.application.count({ where: { traineeId: t.id, stage: { notIn: ['declined', 'withdrawn', 'not_selected'] } } }),
    prisma.traineeDocument.count({ where: { traineeId: t.id, state: 'verified' } }),
    prisma.companionEvent.count({ where: { traineeId: t.id, stage: 'career' } }),
  ])
  const forTrade = opps.filter(o => { try { const tc = JSON.parse(o.tradeCodes || '[]'); return !code || tc.length === 0 || tc.includes(code) } catch { return true } }).map(o => ({ id: o.id, title: o.title, employer: o.employer.name, type: o.type, location: o.location, pay: o.wageMin ? `₹${o.wageMin.toLocaleString('en-IN')}–${(o.wageMax || o.wageMin).toLocaleString('en-IN')} / month` : o.stipend ? `₹${o.stipend.toLocaleString('en-IN')} stipend` : null, openings: o.openings - o.filled }))
  return { roles: roles.map(r => ({ id: r.id, roleName: r.roleName, summary: r.summary, progression: r.progression, entryPathway: r.entryPathway, skillsToBuild: r.skillsToBuild, workplace: r.typicalWorkplace })), opportunities: forTrade, programmes: courses.map(c => ({ id: c.id, title: `${c.name} — ${c.kind === 'short_term' ? 'short programme' : 'new programme'}`, verified: c.status === 'approved', why: c.roleDirection })), activity: { applications: apps, docsVerified: docs, careerEvents: events, opportunitiesViewed: apps > 0 } }
}

r.get('/career', requireRole('trainee'), async (req, res, next) => {
  try {
    const t = await me(req)
    const [record, art, ctx] = await Promise.all([careerRecord(t), careerArtifacts(t), null])
    const c = await careerContext(t, record)
    const profile = { ...art.profile, psychometric_profile: art.assessment || null }
    const comp = completeness(profile, record)
    const known = [
      ...RECORD_FIELDS.map(f => ({ key: f.key, label: f.label, value: f.key === 'trade' ? [record.trade, record.batch].filter(Boolean).join(' · ') : f.key === 'attendance' ? (record.attendance != null ? `${record.attendance}% in 15 days` : null) : f.key === 'marks' ? (record.marks != null ? `${record.marks}% average` : null) : f.key === 'practicals' ? `${record.practicals} demonstrated · ${record.modulesDone} modules done` : record[f.key], source: 'record' })),
      ...(art.assessment ? [{ key: 'assessment', label: 'Psychometric assessment', value: `Completed · leans ${art.assessment.top.join(' and ')}`, source: 'assessment' }] : []),
      ...CHAT_FIELDS.map(f => ({ key: f.key, label: f.label, value: Array.isArray(art.profile[f.key]) ? art.profile[f.key].join(', ') : art.profile[f.key] || null, source: 'stated' })),
    ]
    res.json({ trainee: { name: t.name, trade: record.trade, tradeCode: record.tradeCode, batch: record.batch, iti: record.iti }, record, completeness: comp, known, probes: nextProbes(art.profile), assessment: art.assessment ? { holland_code: art.assessment.holland_code, top: art.assessment.top, completed_at: art.assessment.completed_at, items: art.assessment.items } : null, report: art.report ? { generatedAt: art.report.generatedAt, source: art.report.source } : null, roles: c.roles, opportunities: c.opportunities.slice(0, 5), readiness: readiness({ record, profile, activity: c.activity }) })
  } catch (e) { next(e) }
})

r.get('/career/assessment', requireRole('trainee'), async (req, res) => {
  res.json({ interest: INTEREST_ITEMS.map(i => ({ id: i.id, icon: i.icon, text: i.text })), personality: PERSONALITY_ITEMS.map(p => ({ id: p.id, left: p.left, right: p.right })), interestOptions: ['Not interested', 'Slightly', 'Moderately', 'Very', 'Extremely'], personalityOptions: ['Exactly like me', 'Somewhat like me', 'Not sure', 'Somewhat like me', 'Exactly like me'], minutes: 10 })
})

r.post('/career/assessment', requireRole('trainee'), async (req, res, next) => {
  try {
    const t = await me(req)
    const body = z.object({ responses: z.array(z.object({ itemId: z.string(), value: z.number().int().min(1).max(5) })).min(10) }).parse(req.body)
    const scored = scoreAssessment(body.responses)
    await saveArtifact(t, 'career_assessment', 'Career assessment', scored)
    await prisma.companionEvent.create({ data: { traineeId: t.id, itiId: t.itiId, stage: 'career', topic: 'Psychometric assessment completed', theme: 'aspiration', source: 'direct', signalCode: 'SIG-ASSESSMENT-DONE' } }).catch(() => null)
    res.json({ assessment: scored })
  } catch (e) { next(e) }
})

r.post('/career/profile', requireRole('trainee'), async (req, res, next) => {
  try {
    const t = await me(req)
    const art = await careerArtifacts(t)
    const body = z.object({ delta: z.record(z.any()) }).parse(req.body)
    const merged = { ...art.profile }
    for (const f of CHAT_FIELDS) if (f.key in body.delta) merged[f.key] = body.delta[f.key]
    await saveArtifact(t, 'career_profile', 'Career profile', merged)
    res.json({ profile: merged })
  } catch (e) { next(e) }
})

r.post('/career/report', requireRole('trainee'), async (req, res, next) => {
  try {
    const t = await me(req)
    const [record, art] = await Promise.all([careerRecord(t), careerArtifacts(t)])
    const c = await careerContext(t, record)
    const profile = { ...art.profile, psychometric_profile: art.assessment || null }
    const comp = completeness(profile, record)
    if (!comp.reportUnlocked) return res.status(409).json({ error: comp.assessmentDone ? 'locked' : 'assessment_required', completeness: comp })
    const dims = readiness({ record, profile, activity: c.activity })
    const report = await synthCareerReport({ record, profile, psych: art.assessment, roles: c.roles, opportunities: c.opportunities, programmes: c.programmes, readinessDims: dims, name: t.name })
    await saveArtifact(t, 'career_report', report.title, report)
    await prisma.companionEvent.create({ data: { traineeId: t.id, itiId: t.itiId, stage: 'career', topic: 'Career report generated', theme: 'aspiration', source: 'direct', signalCode: 'SIG-REPORT-DONE' } }).catch(() => null)
    res.json({ report })
  } catch (e) { next(e) }
})

r.get('/career/report', requireRole('trainee'), async (req, res, next) => {
  try { const t = await me(req); const art = await careerArtifacts(t); res.json({ report: art.report || null }) } catch (e) { next(e) }
})

export default r
