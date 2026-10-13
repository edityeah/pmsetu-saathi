import { prisma } from '../db.js'

// Demo-grade OTP. Phone OTP is always '1234' for any seeded phone. Aadhaar OTP is '123456'.
// Real OTPs persisted with TTL so we can show the codepath even though demo codes always work.

const TTL_MS = 10 * 60 * 1000

export async function issueOtp({ channel, identifier }) {
  const code = channel === 'aadhaar' ? '123456' : '1234'
  const expiresAt = new Date(Date.now() + TTL_MS)
  await prisma.otpCode.create({ data: { channel, identifier, code, expiresAt } })
  return { ok: true, channel, identifier, hintLastTwo: code.slice(-2) }
}

export async function verifyOtp({ channel, identifier, code }) {
  // Demo bypass: hard-coded codes always pass.
  const demoOk = (channel === 'aadhaar' && code === '123456') || (channel === 'phone' && code === '1234')
  if (demoOk) return { ok: true }
  // Otherwise check the issued codes
  const row = await prisma.otpCode.findFirst({
    where: { channel, identifier, code, consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
  if (!row) return { ok: false, reason: 'invalid_or_expired' }
  await prisma.otpCode.update({ where: { id: row.id }, data: { consumed: true } })
  return { ok: true }
}
