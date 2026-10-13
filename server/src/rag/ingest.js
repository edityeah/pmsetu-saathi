// Ingest markdown knowledge files into the KnowledgeChunk table with OpenAI embeddings.
//
// Usage: node src/rag/ingest.js [glob]   (default: ../data/knowledge/*.md)

import 'dotenv/config'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { prisma } from '../db.js'
import { embed, hasOpenAI } from '../llm/openai.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const CHUNK_TOKENS = 450
const CHUNK_CHARS  = CHUNK_TOKENS * 4

function chunkMarkdown(text) {
  // Split by H2/H3 headings, then size-cap.
  const parts = []
  const blocks = text.split(/^(##+\s.+?)$/gm)
  let currentHeading = null
  let buffer = ''
  for (const b of blocks) {
    if (!b) continue
    if (/^##+\s/.test(b)) { if (buffer) { parts.push({ heading: currentHeading, content: buffer.trim() }); buffer = '' } ; currentHeading = b.replace(/^##+\s/, '').trim() }
    else buffer += b
  }
  if (buffer.trim()) parts.push({ heading: currentHeading, content: buffer.trim() })
  // size-cap
  const out = []
  for (const p of parts) {
    if (p.content.length <= CHUNK_CHARS) { out.push(p); continue }
    let i = 0
    while (i < p.content.length) {
      out.push({ heading: p.heading, content: p.content.slice(i, i + CHUNK_CHARS) })
      i += CHUNK_CHARS
    }
  }
  return out
}

async function ingestFile(filePath) {
  const slug = path.basename(filePath, '.md')
  const raw = await fs.readFile(filePath, 'utf-8')
  const chunks = chunkMarkdown(raw)
  console.log(`[ingest] ${slug}: ${chunks.length} chunks`)
  await prisma.knowledgeChunk.deleteMany({ where: { source: slug } })
  for (const c of chunks) {
    const v = await embed(c.content)
    if (!v) continue
    await prisma.knowledgeChunk.create({
      data: { source: slug, heading: c.heading || null, content: c.content, embedding: JSON.stringify(v), tokens: Math.ceil(c.content.length / 4) },
    })
  }
}

async function main() {
  if (!hasOpenAI()) {
    console.error('OPENAI_API_KEY not set — cannot embed. Aborting.')
    process.exit(1)
  }
  const dir = path.resolve(__dirname, '../../data/knowledge')
  let files = []
  try { files = (await fs.readdir(dir)).filter(f => f.endsWith('.md')).map(f => path.join(dir, f)) } catch {}
  if (!files.length) { console.warn(`No knowledge files in ${dir}.`); process.exit(0) }
  for (const f of files) await ingestFile(f)
  console.log(`[ingest] done. ${files.length} files.`)
}

main().catch(e => { console.error(e); process.exit(1) })
