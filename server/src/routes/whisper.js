// /api/whisper/transcribe — proxy mic-captured audio to OpenAI Whisper.
// Accepts raw audio bytes (audio/webm or audio/mp4). Returns { text, language? }.
//
// Rate-limited per user (mic chunks can fire frequently — guard against runaway
// transcription cost).

import { Router } from 'express'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../auth/middleware.js'
import { openai, hasOpenAI } from '../llm/openai.js'
import { toFile } from 'openai'

const r = Router()
r.use(requireAuth)

r.use(rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 600,                  // ~10 transcriptions / minute per user
  keyGenerator: (req) => req.user?.id || req.ip,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
}))

// Accept binary audio. 10 MB cap (Whisper limit is 25 MB; we use far less).
// Force-accept any content-type so audio/webm;codecs=opus parses correctly —
// express.raw's default media-type matcher fails on the `;codecs=` parameter.
r.post(
  '/transcribe',
  express.raw({ type: () => true, limit: '10mb' }),
  async (req, res, next) => {
    try {
      if (!hasOpenAI()) return res.status(503).json({ error: 'openai_not_configured' })
      const buf = req.body
      const len = Buffer.isBuffer(buf) ? buf.length : 0
      console.log(`[whisper] received ${len} bytes content-type=${req.headers['content-type']}`)
      if (!buf || !Buffer.isBuffer(buf) || buf.length === 0) {
        return res.status(400).json({ error: 'no_audio' })
      }

      const mime = req.headers['content-type'] || 'audio/webm'
      const ext = mime.includes('webm') ? 'webm' : mime.includes('mp4') ? 'm4a' : mime.includes('wav') ? 'wav' : 'webm'
      const language = (req.headers['x-language'] || 'en').toString().slice(0, 5)

      const file = await toFile(buf, `chunk.${ext}`, { type: mime })

      // gpt-4o-transcribe is the newer, faster, more accurate model. Falls
      // back to whisper-1 if the project doesn't have access.
      let result
      try {
        result = await openai.audio.transcriptions.create({
          file,
          model: 'gpt-4o-transcribe',
          language: language === 'en' ? undefined : language,
        })
      } catch (e) {
        const msg = String(e?.message || e)
        if (/model/i.test(msg) || /not.*found/i.test(msg)) {
          result = await openai.audio.transcriptions.create({
            file,
            model: 'whisper-1',
            language: language === 'en' ? undefined : language,
          })
        } else { throw e }
      }

      res.json({ text: (result.text || '').trim() })
    } catch (e) {
      console.error('[whisper] transcribe failed:', e?.message || e)
      next(e)
    }
  }
)

export default r
