// Lightweight RAG over JSON-encoded embeddings stored in SQLite.
// For dev/demo we do cosine in JS over the full corpus — corpus is small (<1000 chunks).

import { prisma } from '../db.js'
import { chatText, embed, hasOpenAI } from './openai.js'

const MIN_SIM = 0.30

export async function ragAnswer({ question, role, module = null }) {
  if (!hasOpenAI()) return { answer: null, citations: [], reason: 'no_llm' }
  const qVec = await embed(question)
  if (!qVec) return { answer: null, citations: [], reason: 'no_embedding' }
  const chunks = await prisma.knowledgeChunk.findMany({
    where: module ? { OR: [{ module: null }, { module }] } : {},
    take: 1000,
  })
  if (chunks.length === 0) return { answer: null, citations: [], reason: 'empty_kb' }
  const scored = chunks.map(c => {
    let v
    try { v = JSON.parse(c.embedding) } catch { v = null }
    if (!v) return { c, sim: 0 }
    return { c, sim: cosine(qVec, v) }
  }).filter(x => x.sim >= MIN_SIM).sort((a, b) => b.sim - a.sim).slice(0, 5)
  if (scored.length === 0) return { answer: null, citations: [], reason: 'low_similarity' }
  const context = scored.map(s => `### ${s.c.source}${s.c.heading ? ' — ' + s.c.heading : ''}\n${s.c.content}`).join('\n\n')
  const sys = `You are Saathi, KSK's conversational skilling companion. Answer the user's question using ONLY the context below.
If the answer is not in the context, say so directly. Be concise (≤4 short sentences). Plain text — no markdown.`
  const ans = await chatText({ system: sys + '\n\nCONTEXT:\n' + context, user: question, temperature: 0.1 })
  const citations = scored.map(s => ({ source: s.c.source, heading: s.c.heading, sim: Number(s.sim.toFixed(3)) }))
  return { answer: ans, citations, reason: 'ok' }
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1)
}
