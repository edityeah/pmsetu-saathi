#!/usr/bin/env node
// Universal launcher. Whatever Render's dashboard runs — `node start.cjs`,
// `npm start` from the repo root, or `npm start` from web/ — this file makes
// sure the production Express server comes up with a built SPA behind it.
//
// We deliberately avoid relying on render.yaml alone because Render's
// dashboard settings, once a service is created, persist and silently
// override the blueprint. This file is the rescue boat for that case.
//
// CommonJS (.cjs) on purpose — Node will run it regardless of any package
// "type": "module" setting in any of the workspaces.

const { spawnSync, spawn } = require('node:child_process')
const path = require('node:path')
const fs   = require('node:fs')

const ROOT       = __dirname
const WEB_DIR    = path.join(ROOT, 'web')
const SERVER_DIR = path.join(ROOT, 'server')
const DIST       = path.join(WEB_DIR, 'dist')
const DIST_HTML  = path.join(DIST, 'index.html')

// Force NODE_ENV=production so the Express index.js serves the built SPA.
process.env.NODE_ENV = process.env.NODE_ENV || 'production'

function run(cmd, args, opts = {}) {
  console.log(`[start] $ ${cmd} ${args.join(' ')}  (cwd=${opts.cwd || ROOT})`)
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true, ...opts })
  if (r.status !== 0) {
    console.error(`[start] FAILED: ${cmd} ${args.join(' ')} → exit ${r.status}`)
    process.exit(r.status || 1)
  }
}

// 1) Build the SPA if it isn't already on disk. On Render this normally
//    happens during the build phase, but if someone deploys without a
//    build phase, we bootstrap it here.
if (!fs.existsSync(DIST_HTML)) {
  console.log('[start] web/dist not found — building SPA now')
  if (!fs.existsSync(path.join(WEB_DIR, 'node_modules'))) {
    run('npm', ['install', '--include=dev', '--no-audit', '--no-fund'], { cwd: WEB_DIR })
  }
  run('npm', ['run', 'build'], { cwd: WEB_DIR })
  if (!fs.existsSync(DIST_HTML)) {
    console.error('[start] Vite build did not produce web/dist/index.html')
    process.exit(1)
  }
}

// 2) Pick the Prisma schema: SQLite locally, Postgres on Render. The Postgres
//    variant is derived from schema.prisma so the two never drift.
const isPostgres = /^postgres/i.test(process.env.DATABASE_URL || '')
if (isPostgres) run('node', ['scripts/postgres-schema.cjs'], { cwd: SERVER_DIR })
const SCHEMA = isPostgres ? 'prisma/schema.postgres.prisma' : 'prisma/schema.prisma'

// Make sure server deps + Prisma client are present.
if (!fs.existsSync(path.join(SERVER_DIR, 'node_modules'))) {
  run('npm', ['install', '--include=dev', '--no-audit', '--no-fund'], { cwd: SERVER_DIR })
  run('npx', ['prisma', 'generate', '--schema', SCHEMA], { cwd: SERVER_DIR })
}

// 3) Push the Prisma schema to the database (idempotent). Only attempt this
//    if DATABASE_URL is set, so dev-on-laptop scenarios don't crash.
if (process.env.DATABASE_URL) {
  console.log(`[start] applying Prisma schema (${SCHEMA}) to database`)
  const r = spawnSync('npx', ['prisma', 'db', 'push', '--schema', SCHEMA, '--accept-data-loss', '--skip-generate'], {
    cwd: SERVER_DIR, stdio: 'inherit', shell: true,
  })
  if (r.status !== 0) {
    console.warn('[start] prisma db push exited non-zero; continuing anyway so the server still boots')
  }
}

// 4) Hand control over to the Express server. Exec semantics — Render watches
//    PID 1, so we want the server itself to be the process Render manages.
console.log('[start] launching Express server  (NODE_ENV=production)')
const child = spawn('node', ['src/index.js'], { cwd: SERVER_DIR, stdio: 'inherit', shell: false })
child.on('exit', code => process.exit(code ?? 0))
process.on('SIGTERM', () => child.kill('SIGTERM'))
process.on('SIGINT',  () => child.kill('SIGINT'))
