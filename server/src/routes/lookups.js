// Public lookups — no auth. Demo login pickers + reference lists.
import { Router } from 'express'
import { prisma } from '../db.js'

const r = Router()

// Only the curated demo accounts (not all 109 trainers / 1,564 students).
r.get('/demo-users', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { loginId: { not: null }, passwordHash: { not: null }, NOT: { loginId: { startsWith: 'USR-SYN-FAC-' } } },
      select: { id: true, role: true, name: true, phone: true, loginId: true, profile: true },
      orderBy: { createdAt: 'asc' },
    })
    const demoTrainer = await prisma.user.findUnique({ where: { loginId: 'USR-SYN-FAC-0001' }, select: { id: true, role: true, name: true, phone: true, loginId: true, profile: true } })
    res.json({ users: [...users, ...(demoTrainer ? [demoTrainer] : [])].map(u => ({ ...u, profile: safe(u.profile) })) })
  } catch (e) { next(e) }
})

r.get('/trades', async (req, res, next) => {
  try { res.json({ trades: await prisma.trade.findMany({ include: { _count: { select: { modules: true, offerings: true } } }, orderBy: { name: 'asc' } }) }) } catch (e) { next(e) }
})

r.get('/itis', async (req, res, next) => {
  try { res.json({ itis: await prisma.iti.findMany({ orderBy: [{ kind: 'asc' }, { name: 'asc' }] }) }) } catch (e) { next(e) }
})

r.get('/employers', async (req, res, next) => {
  try { res.json({ employers: await prisma.employer.findMany({ include: { opportunities: { where: { status: 'live' } } } }) }) } catch (e) { next(e) }
})

function safe(s) { try { return JSON.parse(s || '{}') } catch { return {} } }
export default r
