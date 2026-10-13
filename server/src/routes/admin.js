// /api/admin — operator endpoints for a hosted deployment (no dashboard
// shell needed). Guarded by ADMIN_TOKEN (header `x-admin-token`).
//   GET  /api/admin/status   row counts + last seed run
//   POST /api/admin/seed     re-run the demo seed (wipes and rebuilds the data)
//   POST /api/admin/rag      embed the knowledge base (needs OPENAI_API_KEY)
import { Router } from 'express'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { prisma } from '../db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SERVER_DIR = path.resolve(__dirname, '../..')
const r = Router()

const jobs = { seed: null, rag: null }

function guard(req, res, next) {
  const want = process.env.ADMIN_TOKEN
  if (!want) return res.status(503).json({ error: 'admin_token_not_configured', hint: 'Set ADMIN_TOKEN in the environment.' })
  const got = req.get('x-admin-token') || req.query.token
  if (got !== want) return res.status(401).json({ error: 'unauthorized' })
  next()
}
r.use(guard)

function launch(kind, script) {
  if (jobs[kind]?.running) return jobs[kind]
  const job = { kind, running: true, startedAt: new Date().toISOString(), finishedAt: null, code: null, log: '' }
  jobs[kind] = job
  const child = spawn(process.execPath, [script], { cwd: SERVER_DIR, env: process.env })
  const push = chunk => { job.log = (job.log + chunk.toString()).slice(-6000) }
  child.stdout.on('data', push); child.stderr.on('data', push)
  child.on('exit', code => { job.running = false; job.code = code; job.finishedAt = new Date().toISOString() })
  return job
}

r.get('/status', async (req, res, next) => {
  try {
    const counts = {}
    for (const m of ['user', 'iti', 'trainee', 'batch', 'session', 'attendanceMark', 'planTask', 'kpi', 'opportunity', 'application', 'companionEvent', 'kbCourse', 'knowledgeChunk']) counts[m] = await prisma[m].count()
    res.json({ ok: true, database: process.env.DATABASE_URL?.startsWith('postgres') ? 'postgres' : 'sqlite', counts, jobs })
  } catch (e) { next(e) }
})

r.post('/seed', (req, res) => { res.json({ job: launch('seed', 'src/seed/seed.js'), hint: 'Poll GET /api/admin/status for progress; the seed takes ~10 s on Postgres.' }) })
r.post('/rag', (req, res) => { res.json({ job: launch('rag', 'src/rag/ingest.js') }) })

export default r
