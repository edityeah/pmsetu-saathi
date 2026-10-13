import { verifyToken } from './jwt.js'
import { prisma } from '../db.js'

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  const payload = token ? verifyToken(token) : null
  if (!payload?.sub) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub } })
  if (!user) return res.status(401).json({ error: 'unauthorized' })
  req.user = user
  next()
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'unauthorized' })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'forbidden', need: roles })
    }
    next()
  }
}
