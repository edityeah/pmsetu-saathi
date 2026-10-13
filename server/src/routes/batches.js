// /api/batches — rosters with attendance (from sessions), marks and practicals.
import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../auth/middleware.js'
import { clusterFor, itiFor, trainerBatchIds } from '../lib/scope.js'

const r = Router()
r.use(requireAuth)
const todayUTC = () => { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())) }

r.get('/', async (req, res, next) => {
  try {
    let where = {}
    if (req.user.role === 'trainer') where = { id: { in: await trainerBatchIds(req.user) } }
    else if (req.user.role === 'iti_principal') { const iti = await itiFor(req.user); where = { itiId: iti?.id } }
    else { const c = await clusterFor(req.user); where = { iti: { clusterId: c.id } } }
    if (req.query.itiId) where.itiId = String(req.query.itiId)
    const batches = await prisma.batch.findMany({ where, include: { trade: true, iti: { select: { name: true, code: true, kind: true } }, lead: { select: { name: true } }, _count: { select: { trainees: true } } }, orderBy: [{ state: 'asc' }, { itiId: 'asc' }, { name: 'asc' }] })
    res.json({ batches })
  } catch (e) { next(e) }
})

r.get('/:id', async (req, res, next) => {
  try {
    const b = await prisma.batch.findUnique({ where: { id: req.params.id }, include: { trade: { include: { modules: { orderBy: { index: 'asc' } } } }, iti: true, lead: { select: { name: true } }, assignments: { include: { trainer: { select: { name: true } }, subject: true } }, trainees: { orderBy: { name: 'asc' } } } })
    if (!b) return res.status(404).json({ error: 'not_found' })
    const since = new Date(todayUTC().getTime() - 15 * 86400000)
    const ids = b.trainees.map(t => t.id)
    const [marks, entries, obs, progress, support] = await Promise.all([
      prisma.attendanceMark.findMany({ where: { traineeId: { in: ids }, session: { date: { gte: since } } }, select: { traineeId: true, status: true } }),
      prisma.markEntry.findMany({ where: { traineeId: { in: ids }, marks: { not: null } }, include: { assessment: { select: { maxMarks: true } } } }),
      prisma.practicalObservation.findMany({ where: { traineeId: { in: ids } }, select: { traineeId: true, result: true } }),
      prisma.moduleProgress.findMany({ where: { traineeId: { in: ids }, module: { tradeId: b.tradeId } } }),
      prisma.supportAction.findMany({ where: { traineeId: { in: ids }, state: { not: 'closed' } }, select: { traineeId: true, reason: true } }),
    ])
    const roster = b.trainees.map(t => {
      const mine = marks.filter(a => a.traineeId === t.id)
      const present = mine.filter(a => a.status === 'present' || a.status === 'late').length
      const myEntries = entries.filter(a => a.traineeId === t.id)
      const avg = myEntries.length ? Math.round(myEntries.reduce((s, a) => s + 100 * a.marks / a.assessment.maxMarks, 0) / myEntries.length) : null
      const curr = progress.find(p => p.traineeId === t.id && b.trade.modules.find(m => m.id === p.moduleId)?.index === b.currentModule)
      const attendancePct = mine.length ? Math.round(100 * present / mine.length) : null
      const needsRe = obs.filter(o => o.traineeId === t.id && o.result === 'needs_re_practice').length
      const risk = (t.status === 'dropped') ? 'dropped' : (attendancePct != null && attendancePct < 70) || (avg != null && avg < 40) ? 'high' : (attendancePct != null && attendancePct < 80) || needsRe ? 'medium' : 'low'
      return { ...t, attendancePct, absences: mine.filter(a => a.status === 'absent').length, avgScore: avg, assessments: myEntries.length, practicalsNeedRe: needsRe, currentModulePct: curr?.pctComplete ?? 0, risk, support: support.filter(s => s.traineeId === t.id).map(s => s.reason) }
    })
    res.json({ batch: b, roster })
  } catch (e) { next(e) }
})

// Trainee's own attendance summary
r.get('/me/attendance-summary', async (req, res, next) => {
  try {
    const t = await prisma.trainee.findUnique({ where: { userId: req.user.id } })
    if (!t) return res.status(404).json({ error: 'no_trainee' })
    const rows = await prisma.attendanceMark.findMany({ where: { traineeId: t.id }, include: { session: { select: { date: true, subject: { select: { name: true } } } } }, orderBy: { session: { date: 'desc' } }, take: 60 })
    const present = rows.filter(a => a.status === 'present' || a.status === 'late').length
    res.json({ total: rows.length, present, pct: rows.length ? Math.round(100 * present / rows.length) : 0, recent: rows.slice(0, 12) })
  } catch (e) { next(e) }
})

export default r
