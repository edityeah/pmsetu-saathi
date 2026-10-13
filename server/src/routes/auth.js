import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../db.js'
import { signToken } from '../auth/jwt.js'
import { issueOtp, verifyOtp } from '../auth/otp.js'

const r = Router()

// ── PHONE OTP ────────────────────────────────────────────────────────────────

r.post('/phone/request-otp', async (req, res, next) => {
  try {
    const { phone } = z.object({ phone: z.string().min(10) }).parse(req.body)
    const user = await prisma.user.findUnique({ where: { phone } })
    if (!user) return res.status(404).json({ error: 'phone_not_registered' })
    const result = await issueOtp({ channel: 'phone', identifier: phone })
    res.json({ ...result, role: user.role, demoOtp: '1234' })
  } catch (e) { next(e) }
})

r.post('/phone/verify-otp', async (req, res, next) => {
  try {
    const { phone, code } = z.object({ phone: z.string(), code: z.string() }).parse(req.body)
    const ok = await verifyOtp({ channel: 'phone', identifier: phone, code })
    if (!ok.ok) return res.status(401).json({ error: ok.reason || 'invalid_otp' })
    const user = await prisma.user.findUnique({ where: { phone } })
    if (!user) return res.status(404).json({ error: 'phone_not_registered' })
    const token = signToken(user)
    res.json({ token, user: publicUser(user) })
  } catch (e) { next(e) }
})

// ── AADHAAR (trainee) ────────────────────────────────────────────────────────

r.post('/aadhaar/request-otp', async (req, res, next) => {
  try {
    const { aadhaar } = z.object({ aadhaar: z.string().min(12) }).parse(req.body)
    const norm = aadhaar.replace(/\s|-/g, '')
    const user = await prisma.user.findUnique({ where: { aadhaar: norm } })
    if (!user) return res.status(404).json({ error: 'aadhaar_not_registered' })
    if (user.role !== 'trainee') return res.status(403).json({ error: 'aadhaar_login_only_for_trainees' })
    const result = await issueOtp({ channel: 'aadhaar', identifier: norm })
    const linkedPhone = user.phone || ''
    const maskedPhone = linkedPhone ? linkedPhone.replace(/(\d{2})\d{6}(\d{2})/, '$1XXXXXX$2') : ''
    res.json({ ...result, maskedPhone, demoOtp: '123456' })
  } catch (e) { next(e) }
})

r.post('/aadhaar/verify-otp', async (req, res, next) => {
  try {
    const { aadhaar, code } = z.object({ aadhaar: z.string(), code: z.string() }).parse(req.body)
    const norm = aadhaar.replace(/\s|-/g, '')
    const ok = await verifyOtp({ channel: 'aadhaar', identifier: norm, code })
    if (!ok.ok) return res.status(401).json({ error: ok.reason || 'invalid_otp' })
    const user = await prisma.user.findUnique({ where: { aadhaar: norm } })
    if (!user) return res.status(404).json({ error: 'aadhaar_not_registered' })
    const token = signToken(user)
    res.json({ token, user: publicUser(user), kycVerified: true })
  } catch (e) { next(e) }
})

// ── Role sign-in (ID + password) ──────────────────────────────────────────────────────

r.post('/role/login', async (req, res, next) => {
  try {
    const { loginId, password } = z.object({ loginId: z.string(), password: z.string() }).parse(req.body)
    const user = await prisma.user.findUnique({ where: { loginId: loginId.toUpperCase() } })
    if (!user || !user.passwordHash) return res.status(401).json({ error: 'invalid_credentials' })
    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' })
    const token = signToken(user)
    res.json({ token, user: publicUser(user) })
  } catch (e) { next(e) }
})

function publicUser(u) {
  let profile = {}
  try { profile = JSON.parse(u.profile || '{}') } catch {}
  return {
    id: u.id,
    role: u.role,
    name: u.name,
    phone: u.phone,
    aadhaar: u.aadhaar ? `XXXXXXXX${u.aadhaar.slice(-4)}` : null,
    loginId: u.loginId,
    language: u.language,
    profile,
  }
}

export default r
