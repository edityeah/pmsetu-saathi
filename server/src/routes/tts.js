// /api/tts/synthesize — Cartesia phrase-to-MP3 proxy.
// Body: { text: string, language?: 'en' | 'hi' | 'ta' | … }
// Response: audio/mpeg (binary)
//
// /api/tts/status — returns { configured: boolean, voiceId: string|null }

import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../auth/middleware.js'
import { cartesiaSynthesize, cartesiaConfigured } from '../llm/cartesia.js'

const r = Router()
r.use(requireAuth)

// Limit TTS calls — each one costs Cartesia credits. 200/hr per user.
r.use(rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 200,
  keyGenerator: (req) => req.user?.id || req.ip,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
}))

r.get('/status', (req, res) => {
  res.json({
    configured: cartesiaConfigured(),
    voiceId: process.env.CARTESIA_VOICE_ID || null,
    model: process.env.CARTESIA_MODEL_ID || 'sonic-2',
  })
})

r.post('/synthesize', async (req, res, next) => {
  try {
    const body = z.object({
      text: z.string().min(1).max(1500),
      language: z.string().optional(),
      voiceId: z.string().optional(),
    }).parse(req.body)

    const audio = await cartesiaSynthesize({
      text: body.text,
      language: body.language || 'en',
      voiceId: body.voiceId,
    })
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'no-store')
    res.send(audio)
  } catch (e) {
    if (e.code === 'cartesia_not_configured') {
      return res.status(503).json({ error: 'cartesia_not_configured' })
    }
    next(e)
  }
})

export default r
