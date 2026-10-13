// /api/itis — the ITI operations layer (principal + CEO drill-down).
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth, requireRole } from '../auth/middleware.js'
import { clusterFor, itiFor } from '../lib/scope.js'

const r = Router()
r.use(requireAuth)
const todayUTC = () => { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())) }

r.get('/', async (req, res, next) => {
  try {
    const c = await clusterFor(req.user)
    const itis = await prisma.iti.findMany({ where: { clusterId: c.id }, orderBy: [{ kind: 'asc' }, { name: 'asc' }], include: { principal: { select: { name: true } }, _count: { select: { trainees: { where: { status: 'active' } }, batches: { where: { state: 'running' } }, machines: true } } } })
    res.json({ itis })
  } catch (e) { next(e) }
})

// "mine" resolves the caller's ITI (principal / trainer / trainee); CEO gets the hub.
r.get('/:id/dashboard', async (req, res, next) => {
  try {
    let iti = null
    if (req.params.id === 'mine') iti = await itiFor(req.user)
    if (!iti) {
      const c = await clusterFor(req.user)
      iti = req.params.id === 'mine' ? await prisma.iti.findFirst({ where: { clusterId: c.id, kind: 'hub' } }) : await prisma.iti.findFirst({ where: { OR: [{ id: req.params.id }, { code: req.params.id }] } })
    }
    if (!iti) return res.status(404).json({ error: 'iti_not_found' })
    const since = new Date(todayUTC().getTime() - 14 * 86400000)
    const [offerings, batches, active, women, dropped, placedVerified, machines, civil, grievances, sessions, trainers, issues, tasks] = await Promise.all([
      prisma.offering.findMany({ where: { itiId: iti.id }, include: { trade: true, plans: { where: { period: { in: ['Baseline', 'Y1'] } } }, _count: { select: { batches: true } } } }),
      prisma.batch.findMany({ where: { itiId: iti.id }, include: { trade: true, lead: { select: { name: true } }, _count: { select: { trainees: true } } }, orderBy: [{ state: 'asc' }, { name: 'asc' }] }),
      prisma.trainee.count({ where: { itiId: iti.id, status: 'active' } }),
      prisma.trainee.count({ where: { itiId: iti.id, status: 'active', gender: 'F' } }),
      prisma.trainee.count({ where: { itiId: iti.id, status: 'dropped' } }),
      prisma.application.count({ where: { stage: { in: ['joined', 'follow_up'] }, evidenceLevel: { in: ['employer_confirmed', 'independently_verified'] }, trainee: { itiId: iti.id } } }),
      prisma.machine.findMany({ where: { itiId: iti.id }, include: { trade: { select: { name: true, code: true } } }, orderBy: { status: 'asc' } }),
      prisma.civilWork.findMany({ where: { itiId: iti.id } }),
      prisma.grievance.findMany({ where: { itiId: iti.id }, orderBy: { createdAt: 'desc' }, include: { raisedBy: { select: { name: true, role: true } } } }),
      prisma.session.findMany({ where: { batch: { itiId: iti.id }, date: { gte: since } }, select: { date: true, delivery: true, attendanceState: true, presentCount: true, absentCount: true } }),
      prisma.user.findMany({ where: { role: 'trainer', profile: { contains: `"itiCode":"${iti.code}"` } }, select: { id: true, name: true } }),
      prisma.opsIssue.count({ where: { itiId: iti.id, state: { not: 'resolved' } } }),
      prisma.planTask.findMany({ where: { itiId: iti.id }, select: { state: true, dueAt: true } }),
    ])
    const reported = sessions.filter(s => ['submitted', 'confirmed', 'needs_review'].includes(s.attendanceState))
    const present = reported.reduce((s, x) => s + (x.presentCount || 0), 0), total = reported.reduce((s, x) => s + (x.presentCount || 0) + (x.absentCount || 0), 0)
    const attendancePct = total ? Math.round(100 * present / total) : null
    const scheduled = sessions.filter(s => !['cancelled', 'rescheduled'].includes(s.delivery))
    const coveragePct = scheduled.length ? Math.round(100 * reported.length / scheduled.length) : null
    const needsReview = sessions.filter(s => s.attendanceState === 'needs_review').length
    const byDay = {}
    for (const s of reported) { const k = s.date.toISOString().slice(0, 10); byDay[k] ||= { total: 0, present: 0 }; byDay[k].total += (s.presentCount || 0) + (s.absentCount || 0); byDay[k].present += s.presentCount || 0 }
    const trend = Object.entries(byDay).sort().map(([x, v]) => ({ x: x.slice(5), y: v.total ? Math.round(100 * v.present / v.total) : null }))
    const seatsPlanned = offerings.reduce((s, o) => s + (o.plans.find(p => p.period === 'Y1')?.places || 0), 0)
    const machineStats = { total: machines.length, functional: machines.filter(m => m.status === 'functional' || m.status === 'installed').length, nonFunctional: machines.filter(m => m.status === 'non_functional' || m.status === 'baseline_obsolete').length, awaiting: machines.filter(m => m.status === 'awaiting_commissioning').length, ordered: machines.filter(m => m.status === 'ordered').length }
    const plan = JSON.parse(iti.trainerPlan || '{}')
    const sanctioned = plan.Y1 || trainers.length
    const tradesView = offerings.map(o => ({ offeringId: o.id, trade: o.trade, launch: o.launch, baseline: o.plans.find(p => p.period === 'Baseline'), y1: o.plans.find(p => p.period === 'Y1'), batches: o._count.batches }))
    res.json({
      iti, trades: tradesView, batches, trainers,
      kpis: { active: iti.registryConnected ? active : null, women, womenPct: active ? Math.round(100 * women / active) : null, dropped, seatsPlanned, seatUtilPct: iti.registryConnected && iti.seatCapacity ? Math.round(100 * active / iti.seatCapacity) : null, attendancePct, coveragePct, needsReview, placedVerified, trainerVacancyPct: sanctioned ? Math.max(0, Math.round(100 * (sanctioned - trainers.length) / sanctioned)) : null, sanctioned, openIssues: issues, tasksOverdue: tasks.filter(t => t.dueAt < new Date() && !['completed', 'reviewed'].includes(t.state)).length, tasksTotal: tasks.length },
      attendanceTrend: trend, machines, machineStats, civil, grievances, registryConnected: iti.registryConnected,
    })
  } catch (e) { next(e) }
})

r.post('/machines/:id/status', requireRole('iti_principal', 'spv_ceo', 'trainer'), async (req, res, next) => {
  try {
    const body = z.object({ status: z.enum(['functional', 'installed', 'non_functional', 'awaiting_commissioning', 'ordered', 'baseline_obsolete']) }).parse(req.body)
    const m = await prisma.machine.update({ where: { id: req.params.id }, data: { status: body.status, installedAt: body.status === 'functional' ? new Date() : undefined } })
    res.json({ machine: m })
  } catch (e) { next(e) }
})

export default r
