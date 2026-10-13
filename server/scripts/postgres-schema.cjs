#!/usr/bin/env node
// Derives prisma/schema.postgres.prisma from prisma/schema.prisma.
//
// Local development stays on SQLite (zero install). Hosted deployments use
// Render Postgres: this script swaps the datasource provider and nothing
// else, so the two schemas can never drift. It is run by the Render build
// and by start.cjs; the generated file is gitignored.
const fs = require('node:fs')
const path = require('node:path')

const src = path.join(__dirname, '..', 'prisma', 'schema.prisma')
const out = path.join(__dirname, '..', 'prisma', 'schema.postgres.prisma')
const schema = fs.readFileSync(src, 'utf8')
if (!/provider\s*=\s*"sqlite"/.test(schema)) { console.error('[postgres-schema] expected provider = "sqlite" in schema.prisma'); process.exit(1) }
const pg = schema
  .replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"')
  .replace(/^\/\/ PM-SETU Saathi — Prisma schema.*$/m, '// GENERATED from schema.prisma by scripts/postgres-schema.cjs — do not edit. Postgres provider for hosted deployments.')
fs.writeFileSync(out, pg)
console.log(`[postgres-schema] wrote ${path.relative(process.cwd(), out)}`)
