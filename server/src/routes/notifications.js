import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth } from '../auth/middleware.js'

const r = Router()
r.use(requireAuth)

r.get('/', async (req, res, next) => {
  try {
    const list = await prisma.notification.findMany({
      where: {
        OR: [
          { targetUserId: req.user.id },
          { targetUserId: null, targetRoles: { contains: req.user.role } },
        ],
        dismissedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    const parsed = list.map(n => ({ ...n, action: safeJson(n.action), targetRoles: safeJson(n.targetRoles) }))
    res.json({ notifications: parsed })
  } catch (e) { next(e) }
})

r.post('/:id/read', async (req, res, next) => {
  try {
    const n = await prisma.notification.findUnique({ where: { id: req.params.id } })
    if (!n) return res.status(404).json({ error: 'not_found' })
    const updated = await prisma.notification.update({ where: { id: n.id }, data: { readAt: new Date() } })
    res.json({ notification: updated })
  } catch (e) { next(e) }
})

r.post('/:id/dismiss', async (req, res, next) => {
  try {
    const n = await prisma.notification.findUnique({ where: { id: req.params.id } })
    if (!n) return res.status(404).json({ error: 'not_found' })
    const updated = await prisma.notification.update({ where: { id: n.id }, data: { dismissedAt: new Date() } })
    res.json({ notification: updated })
  } catch (e) { next(e) }
})

r.post('/broadcast', async (req, res, next) => {
  try {
    if (!['spv_ceo', 'state_pmu', 'ima_officer', 'iti_principal'].includes(req.user.role)) {
      return res.status(403).json({ error: 'forbidden' })
    }
    const body = z.object({
      title: z.string(), message: z.string(), targetRoles: z.array(z.string()),
      category: z.string().default('scheme_announcement'),
      priority: z.string().default('normal'),
    }).parse(req.body)
    const created = await prisma.notification.create({
      data: {
        type: 'broadcast', title: body.title, message: body.message, category: body.category,
        priority: body.priority, targetRoles: JSON.stringify(body.targetRoles),
      },
    })
    res.json({ notification: created })
  } catch (e) { next(e) }
})

function safeJson(s) { try { return JSON.parse(s || 'null') } catch { return null } }

export default r
