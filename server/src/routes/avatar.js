// Avatar (Anam) session minting + persona lookup.

import { Router } from 'express'
import { requireAuth } from '../auth/middleware.js'
import { mintAnamSession, PERSONAS } from '../llm/anam.js'

const r = Router()
r.use(requireAuth)

// List configured personas
r.get('/personas', (req, res) => {
  res.json({
    personas: Object.entries(PERSONAS).map(([id, p]) => ({
      id, name: p.name, useWebSearch: !!p.useWebSearch,
    })),
  })
})

// Mint an Anam session token for the requested persona.
// Body: { persona: 'career-counsellor', context?: 'extra trainee context for system prompt' }
r.post('/session', async (req, res, next) => {
  try {
    const persona = req.body?.persona || 'general'
    const userContext = req.body?.context || `User name: ${req.user.name}. Role: ${req.user.role}.`
    const token = await mintAnamSession({ persona, userContext })
    res.json({
      ...token,
      persona,
      configured: true,
    })
  } catch (e) {
    if (e.code === 'anam_not_configured') {
      return res.status(503).json({ error: 'anam_not_configured', message: 'ANAM_API_KEY not set on the server.' })
    }
    next(e)
  }
})

export default r
