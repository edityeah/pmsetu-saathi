import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../auth/middleware.js'
import { clusterFor, itiFor, employerFor, profileOf, trainerBatchIds } from '../lib/scope.js'

const r = Router()
r.use(requireAuth)
const J = (s, d = null) => { try { return JSON.parse(s ?? 'null') ?? d } catch { return d } }

// Role-specific hydration so the home page / Saathi know who they're talking to.
r.get('/', async (req, res, next) => {
  try {
    const role = req.user.role
    const profile = profileOf(req.user)
    const cluster = await clusterFor(req.user)
    let extra = { cluster }
    if (role === 'trainee') {
      const t = await prisma.trainee.findUnique({
        where: { userId: req.user.id },
        include: {
          iti: true,
          batch: { include: { trade: true, lead: { select: { name: true } } } },
          applications: { include: { opportunity: { include: { employer: { select: { name: true, city: true } } } } }, orderBy: { lastEventAt: 'desc' } },
          spells: { include: { employer: { select: { name: true } }, followUps: { orderBy: { dueAt: 'asc' } } } },
          progress: { include: { module: true } },
        },
      })
      if (t) { t.applications = t.applications.map(a => ({ ...a, timeline: J(a.timeline, []), opportunity: { ...a.opportunity, tradeCodes: J(a.opportunity.tradeCodes, []) } })); t.spells = t.spells.map(s => ({ ...s, logbook: J(s.logbook, []) })) }
      extra.trainee = t
    } else if (role === 'iti_principal' || role === 'trainer') {
      const iti = await itiFor(req.user)
      extra.iti = iti
      if (role === 'trainer') {
        const ids = await trainerBatchIds(req.user)
        extra.batches = await prisma.batch.findMany({ where: { id: { in: ids } }, include: { trade: true, iti: true, _count: { select: { trainees: true } } } })
        extra.assignments = await prisma.trainerAssignment.findMany({ where: { trainerUserId: req.user.id }, include: { subject: { select: { id: true, name: true, type: true } }, batch: { select: { id: true, name: true } } } })
      }
    } else if (role === 'employer') {
      extra.employer = await employerFor(req.user)
    }
    res.json({
      user: { id: req.user.id, role, name: req.user.name, phone: req.user.phone, loginId: req.user.loginId, language: req.user.language, profile },
      ...extra,
    })
  } catch (e) { next(e) }
})

export default r
