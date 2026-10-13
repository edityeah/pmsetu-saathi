import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'ksk-dev-secret-change-me'
const TTL = '12h'

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.name },
    SECRET,
    { expiresIn: TTL }
  )
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET)
  } catch {
    return null
  }
}
