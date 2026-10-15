import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

import authRoutes from './routes/auth.js'
import meRoutes from './routes/me.js'
import lookupRoutes from './routes/lookups.js'
import clusterRoutes from './routes/cluster.js'
import itiRoutes from './routes/itis.js'
import batchRoutes from './routes/batches.js'
import lmsRoutes from './routes/lms.js'
import planRoutes from './routes/plan.js'
import opsRoutes from './routes/ops.js'
import companionRoutes from './routes/companion.js'
import placementRoutes from './routes/placement.js'
import stateRoutes from './routes/state.js'
import notificationRoutes from './routes/notifications.js'
import chatRoutes from './routes/chats.js'
import aiRoutes from './routes/ai.js'
import avatarRoutes from './routes/avatar.js'
import ttsRoutes from './routes/tts.js'
import whisperRoutes from './routes/whisper.js'
import realtimeRoutes from './routes/realtime.js'
import ocrRoutes from './routes/ocr.js'
import adminRoutes from './routes/admin.js'
import headlineRoutes from './routes/headline.js'
import analyticsRoutes from './routes/analytics.js'

const app = express()
app.set('trust proxy', 1)
app.use(express.json({ limit: '5mb' }))
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173', credentials: true }))

if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    const url = req.originalUrl || req.url
    if (url === '/api/health') return next()
    const t0 = Date.now()
    res.on('finish', () => { const code = res.statusCode; console.log(`${code >= 400 ? '⚠' : '·'} ${code} ${req.method} ${url} ${Date.now() - t0}ms`) })
    next()
  })
}

app.get('/api/health', (req, res) => res.json({ ok: true, app: 'pmsetu-saathi', ts: Date.now() }))
app.use(rateLimit({ windowMs: 60 * 60 * 1000, limit: 3000, standardHeaders: 'draft-7', legacyHeaders: false, skip: (req) => req.path === '/api/health' }))

// public
app.use('/api/auth', authRoutes)
app.use('/api/lookups', lookupRoutes)
// authed
app.use('/api/me', meRoutes)
app.use('/api/headline', headlineRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/cluster', clusterRoutes)
app.use('/api/itis', itiRoutes)
app.use('/api/batches', batchRoutes)
app.use('/api/lms', lmsRoutes)
app.use('/api/plan', planRoutes)
app.use('/api/ops', opsRoutes)
app.use('/api/companion', companionRoutes)
app.use('/api/placement', placementRoutes)
app.use('/api/state', stateRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/chats', chatRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/avatar', avatarRoutes)
app.use('/api/tts', ttsRoutes)
app.use('/api/whisper', whisperRoutes)
app.use('/api/realtime', realtimeRoutes)
app.use('/api/ocr', ocrRoutes)
app.use('/api/admin', adminRoutes)

if (process.env.NODE_ENV === 'production') {
  const webDist = path.resolve(__dirname, '../../web/dist')
  app.use('/assets', express.static(path.join(webDist, 'assets'), { maxAge: '1y', immutable: true }))
  app.use(express.static(webDist, { index: false, setHeaders: (res, file) => { if (file.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate') } }))
  app.get(/^\/(?!api(\/|$)).*/, (req, res) => { res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); res.sendFile(path.join(webDist, 'index.html')) })
}

app.use((err, req, res, next) => {
  console.error('[err]', err)
  res.status(err.status || 500).json({ error: err.message || 'internal_error', code: err.code })
})

const port = Number(process.env.PORT || 8787)
app.listen(port, () => console.log(`[pmsetu] server on http://localhost:${port}  (NODE_ENV=${process.env.NODE_ENV || 'development'})`))
