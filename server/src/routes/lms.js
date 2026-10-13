// /api/lms — the learning layer. CMS (trades + 240-hour modules) and the
// trainee-facing LMS (progress, lessons, quick checks). Assessments and
// practicals recorded by trainers live in /api/ops.
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../auth/middleware.js'

const r = Router()
r.use(requireAuth)

const parse = (s, d = []) => { try { return JSON.parse(s || 'null') ?? d } catch { return d } }

// ── CMS ────────────────────────────────────────────────────────────────────
r.get('/trades', async (req, res, next) => {
  try {
    const trades = await prisma.trade.findMany({ include: { modules: { orderBy: { index: 'asc' } }, offerings: { include: { iti: { select: { code: true, name: true } }, plans: { where: { period: 'Y1' } }, gates: true } }, subjects: true, _count: { select: { batches: true } } }, orderBy: [{ kind: 'asc' }, { name: 'asc' }] })
    res.json({ trades: trades.map(t => ({ ...t, modules: t.modules.map(m => ({ ...m, lessons: parse(m.lessons) })), itis: t.offerings.map(o => ({ iti: o.iti, offeringId: o.id, launch: o.launch, seats: o.plans[0]?.places || 0, gates: o.gates })) })) })
  } catch (e) { next(e) }
})

r.get('/trades/:id', async (req, res, next) => {
  try {
    const t = await prisma.trade.findUnique({ where: { id: req.params.id }, include: { modules: { orderBy: { index: 'asc' } }, subjects: true } })
    if (!t) return res.status(404).json({ error: 'not_found' })
    res.json({ trade: { ...t, modules: t.modules.map(m => ({ ...m, lessons: parse(m.lessons) })) } })
  } catch (e) { next(e) }
})

r.post('/trades', requireRole('curriculum_dev', 'spv_ceo'), async (req, res, next) => {
  try {
    const body = z.object({ code: z.string(), name: z.string(), sector: z.string(), nsqfLevel: z.number().int(), kind: z.enum(['existing_core', 'existing_other', 'new_specialist', 'short_term']), totalHours: z.number().int().optional(), durationValue: z.number().int().optional() }).parse(req.body)
    const months = body.durationValue || (body.kind === 'short_term' ? 0 : 12)
    const t = await prisma.trade.create({ data: { id: body.code, code: body.code, name: body.name, sector: body.sector, nsqfLevel: body.nsqfLevel, kind: body.kind, status: 'draft', durationValue: body.kind === 'short_term' ? (body.totalHours || 120) : months, durationUnit: body.kind === 'short_term' ? 'hours' : 'months', totalHours: body.totalHours || months * 100 } })
    // Scaffold the standard PM-SETU structure: 240 h modules (8 credits) + 150 h OJT
    if (body.kind !== 'short_term') {
      const n = months >= 24 ? 5 : 3
      for (let i = 1; i <= n; i++) await prisma.courseModule.create({ data: { tradeId: t.id, index: i, title: `${body.name} — ${i <= (n === 5 ? 3 : 2) ? 'core' : 'specialist'} module ${i}`, kind: i <= (n === 5 ? 3 : 2) ? 'core' : 'specific', hours: 240, credits: 8, status: 'draft', lessons: '[]', authorId: req.user.id } })
      await prisma.courseModule.create({ data: { tradeId: t.id, index: n + 1, title: 'On-the-Job Training (150 h)', kind: 'ojt', hours: 150, credits: 5, status: 'draft', lessons: '[]', authorId: req.user.id } })
    } else {
      await prisma.courseModule.create({ data: { tradeId: t.id, index: 1, title: `${body.name} — module`, kind: 'specific', hours: body.totalHours || 120, credits: Math.round((body.totalHours || 120) / 30), status: 'draft', lessons: '[]', authorId: req.user.id } })
    }
    res.json({ trade: t })
  } catch (e) { next(e) }
})

r.post('/trades/:id/status', requireRole('curriculum_dev', 'spv_ceo'), async (req, res, next) => {
  try {
    const body = z.object({ status: z.enum(['draft', 'submitted_cstari', 'ncvet_review', 'approved']) }).parse(req.body)
    const t = await prisma.trade.update({ where: { id: req.params.id }, data: { status: body.status } })
    // Course-route launch gates follow the approval status.
    if (body.status === 'approved') await prisma.launchGate.updateMany({ where: { offering: { tradeId: t.id }, id: { endsWith: '-COURSE' }, state: 'pending' }, data: { state: 'ready' } })
    res.json({ trade: t })
  } catch (e) { next(e) }
})

r.put('/modules/:id', requireRole('curriculum_dev', 'spv_ceo', 'trainer'), async (req, res, next) => {
  try {
    const body = z.object({ title: z.string().optional(), lessons: z.array(z.object({ title: z.string(), type: z.string(), minutes: z.number() })).optional(), status: z.string().optional(), hours: z.number().optional() }).parse(req.body)
    const data = { ...body }
    if (body.lessons) data.lessons = JSON.stringify(body.lessons)
    if (body.hours) data.credits = Math.round(body.hours / 30)
    const m = await prisma.courseModule.update({ where: { id: req.params.id }, data })
    res.json({ module: { ...m, lessons: parse(m.lessons) } })
  } catch (e) { next(e) }
})

// ── LMS (trainee) ──────────────────────────────────────────────────────────
r.get('/my-course', async (req, res, next) => {
  try {
    const t = await prisma.trainee.findUnique({ where: { userId: req.user.id }, include: { batch: { include: { trade: { include: { modules: { orderBy: { index: 'asc' } } } }, lead: { select: { name: true } } } }, iti: true } })
    if (!t?.batch) return res.json({ enrolled: false })
    const [progress, entries, spell] = await Promise.all([
      prisma.moduleProgress.findMany({ where: { traineeId: t.id } }),
      prisma.markEntry.findMany({ where: { traineeId: t.id }, include: { assessment: { select: { title: true, type: true, maxMarks: true, date: true, state: true } } }, orderBy: { assessment: { date: 'desc' } } }),
      prisma.employmentSpell.findFirst({ where: { traineeId: t.id, type: { in: ['ojt', 'apprenticeship'] } }, include: { employer: true } }),
    ])
    const quizzes = entries.filter(e => e.assessment.type === 'quiz')
    const modules = t.batch.trade.modules.map(m => {
      const p = progress.find(x => x.moduleId === m.id)
      const locked = m.index > t.batch.currentModule && m.kind !== 'ojt'
      return { ...m, lessons: parse(m.lessons), pctComplete: p?.pctComplete || 0, hoursLogged: p?.hoursLogged || 0, lessonsDone: parse(p?.lessonsDone), locked, current: m.index === t.batch.currentModule, quiz: quizzes.find(q => q.assessment.title.includes(`M${m.index} `)) || null }
    })
    const totalCredits = modules.reduce((s, m) => s + (m.pctComplete === 100 ? m.credits : 0), 0)
    const totalHours = modules.reduce((s, m) => s + m.hoursLogged, 0)
    res.json({ enrolled: true, trainee: t, batch: t.batch, trade: t.batch.trade, modules, creditsEarned: totalCredits, creditsTotal: modules.reduce((s, m) => s + m.credits, 0), hoursLogged: totalHours, hoursTotal: modules.reduce((s, m) => s + m.hours, 0), assessments: entries.filter(e => e.assessment.type !== 'quiz'), ojt: spell ? { ...spell, logbook: parse(spell.logbook) } : null })
  } catch (e) { next(e) }
})

r.post('/my-course/lesson-done', requireRole('trainee'), async (req, res, next) => {
  try {
    const body = z.object({ moduleId: z.string(), lessonIndex: z.number().int() }).parse(req.body)
    const t = await prisma.trainee.findUnique({ where: { userId: req.user.id } })
    const m = await prisma.courseModule.findUnique({ where: { id: body.moduleId } })
    const lessons = parse(m.lessons)
    const existing = await prisma.moduleProgress.findUnique({ where: { traineeId_moduleId: { traineeId: t.id, moduleId: m.id } } })
    const done = new Set(parse(existing?.lessonsDone))
    done.add(body.lessonIndex)
    const pct = lessons.length ? Math.round(100 * done.size / lessons.length) : 100
    const mins = lessons.filter((_, i) => done.has(i)).reduce((s, l) => s + (l.minutes || 0), 0)
    const p = await prisma.moduleProgress.upsert({
      where: { traineeId_moduleId: { traineeId: t.id, moduleId: m.id } },
      update: { lessonsDone: JSON.stringify([...done]), pctComplete: pct, hoursLogged: Math.min(m.hours, Math.round(mins / 60)), lastActivityAt: new Date() },
      create: { traineeId: t.id, moduleId: m.id, lessonsDone: JSON.stringify([...done]), pctComplete: pct, hoursLogged: Math.min(m.hours, Math.round(mins / 60)), lastActivityAt: new Date() },
    })
    res.json({ progress: { ...p, lessonsDone: [...done] } })
  } catch (e) { next(e) }
})

// Quick-check result → a per-batch "quiz" assessment plan + the trainee's entry.
r.post('/my-course/quiz', requireRole('trainee'), async (req, res, next) => {
  try {
    const body = z.object({ moduleId: z.string(), score: z.number(), maxScore: z.number(), title: z.string().optional() }).parse(req.body)
    const t = await prisma.trainee.findUnique({ where: { userId: req.user.id } })
    const m = await prisma.courseModule.findUnique({ where: { id: body.moduleId } })
    const title = `M${m.index} quick check · ${m.title.slice(0, 40)}`
    let plan = await prisma.assessmentPlan.findFirst({ where: { batchId: t.batchId, type: 'quiz', title } })
    if (!plan) plan = await prisma.assessmentPlan.create({ data: { batchId: t.batchId, title, type: 'quiz', topic: m.title, maxMarks: body.maxScore, date: new Date(), evaluatorName: 'LMS auto-check', state: 'confirmed' } })
    const entry = await prisma.markEntry.upsert({ where: { assessmentId_traineeId: { assessmentId: plan.id, traineeId: t.id } }, update: { marks: body.score, status: 'scored', reviewState: 'confirmed' }, create: { assessmentId: plan.id, traineeId: t.id, marks: body.score, status: 'scored', source: 'manual', reviewState: 'confirmed' } })
    await prisma.companionEvent.create({ data: { traineeId: t.id, itiId: t.itiId, stage: 'practice', topic: `${title}: ${body.score}/${body.maxScore}`, theme: 'learning_need', subtheme: body.score / body.maxScore < 0.5 ? 'quiz_low' : 'quiz_ok', source: 'inferred', confidence: 0.8, language: 'hi' } })
    res.json({ assessment: { ...entry, title, maxMarks: body.maxScore, result: body.score / body.maxScore >= 0.5 ? 'pass' : 'fail' } })
  } catch (e) { next(e) }
})

export default r
