import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db.js'
import { requireAuth } from '../auth/middleware.js'

const r = Router()
r.use(requireAuth)

r.get('/', async (req, res, next) => {
  try {
    const threads = await prisma.chatThread.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    })
    res.json({ threads })
  } catch (e) { next(e) }
})

r.post('/', async (req, res, next) => {
  try {
    const body = z.object({ title: z.string(), bot: z.string().optional() }).parse(req.body)
    const t = await prisma.chatThread.create({ data: { userId: req.user.id, title: body.title, bot: body.bot ?? null } })
    res.json({ thread: t })
  } catch (e) { next(e) }
})

r.get('/:id/messages', async (req, res, next) => {
  try {
    const msgs = await prisma.chatMessage.findMany({ where: { threadId: req.params.id }, orderBy: { createdAt: 'asc' }, take: 500 })
    res.json({ messages: msgs })
  } catch (e) { next(e) }
})

r.post('/:id/messages', async (req, res, next) => {
  try {
    const body = z.object({
      role: z.enum(['user', 'bot']),
      text: z.string(),
      html: z.string().optional(),
      actions: z.any().optional(),
      meta: z.any().optional(),
    }).parse(req.body)
    const m = await prisma.chatMessage.create({
      data: {
        threadId: req.params.id, role: body.role, text: body.text,
        html: body.html ?? null,
        actions: body.actions ? JSON.stringify(body.actions) : null,
        meta: body.meta ? JSON.stringify(body.meta) : null,
      },
    })
    await prisma.chatThread.update({ where: { id: req.params.id }, data: { updatedAt: new Date() } })
    res.json({ message: m })
  } catch (e) { next(e) }
})

export default r
