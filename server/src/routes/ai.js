// /api/ai — Swifty endpoint family.
//   /message    one-shot intent classification + RAG fallback (used by Ask Swifty home box)
//   /stream     SSE streaming chat (used by avatar text/voice/video modes)
//   /search     web-search-only one-shot (used by Discover Courses + Find Jobs)
//   /ask        legacy RAG-only
//   /interpret  legacy intent-only

import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../auth/middleware.js'
import { interpretAction } from '../llm/interpret.js'
import { ragAnswer } from '../llm/rag.js'
import { hasOpenAI } from '../llm/openai.js'
import { streamChat, webSearch } from '../llm/stream.js'
import { openai } from '../llm/openai.js'
import { getPersona } from '../llm/anam.js'
import { ensureThread, addMessage, getContext } from '../llm/zep.js'
import { CardParser } from '../llm/cardParser.js'
import { CARD_TOOLBOX } from '../llm/cardPrompts.js'
import { buildRoleContext } from '../llm/roleContext.js'
import { prisma } from '../db.js'

const r = Router()
r.use(requireAuth)

const perSession = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_PER_HOUR || 50),
  keyGenerator: req => req.user?.id || req.ip,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
})
r.use(perSession)

function isQuestionLike(text) {
  return /\?\s*$/.test(text) || /\b(why|how|what|when|where|explain|kya|kyun|kaise|samjhao|batao)\b/i.test(text)
}

r.post('/message', async (req, res, next) => {
  try {
    if (!hasOpenAI()) return res.json({ responseType: 'none', reason: 'openai_not_configured' })
    const body = z.object({ text: z.string().min(1), language: z.string().optional() }).parse(req.body)
    const text = body.text.trim()
    const role = req.user.role

    const questionFirst = isQuestionLike(text)

    if (questionFirst) {
      const rag = await ragAnswer({ question: text, role })
      if (rag.answer) {
        return res.json({
          responseType: 'answer',
          answer: { text: rag.answer, citations: rag.citations, language: body.language || 'en' },
        })
      }
    }

    const intent = await interpretAction({ text, role, language: body.language })
    if (intent?.intent && intent.confidence >= 0.5) {
      return res.json({
        responseType: 'action',
        actionId: intent.intent,
        module: intent.module,
        entities: intent.entities,
        confidence: intent.confidence,
        meta: { assistantText: intent.assistantText, chips: intent.chips, language: intent.language },
      })
    }

    if (!questionFirst) {
      const rag = await ragAnswer({ question: text, role })
      if (rag.answer) {
        return res.json({
          responseType: 'answer',
          answer: { text: rag.answer, citations: rag.citations, language: body.language || 'en' },
        })
      }
    }

    return res.json({
      responseType: 'none',
      assistantText: intent?.assistantText || "I'm not sure how to help with that yet. Try one of the suggested chips.",
      chips: intent?.chips || [],
    })
  } catch (e) { next(e) }
})

// ── Streaming chat (text + avatar voice/video modes) ──────────────────────
// Body: {
//   persona: 'career-counsellor' | 'mock-interviewer' | 'learning-assistant' | 'general',
//   messages: [{role:'user'|'assistant', content:'...'}, ...],
//   extraSystem?: string,   // additional context appended to persona prompt
//   useWebSearch?: boolean, // override persona default
// }
// Streams SSE: data: {"delta":"…"}\n\n   … then data: {"done":true}\n\n
r.post('/stream', async (req, res, next) => {
  try {
    if (!hasOpenAI()) {
      return res.status(503).json({ error: 'openai_not_configured' })
    }
    const body = z.object({
      persona: z.string().default('general'),
      messages: z.array(z.object({ role: z.enum(['user', 'assistant', 'system']), content: z.string() })).min(1),
      extraSystem: z.string().optional(),
      useWebSearch: z.boolean().optional(),
      role: z.string().optional(),     // drives role-aware persona context
      fast: z.boolean().optional(),    // voice/video mode → mini model, no Zep awaits, no cards
    }).parse(req.body)

    const persona = getPersona(body.persona)
    const useWebSearch = body.useWebSearch ?? !!persona.useWebSearch
    const fast = !!body.fast

    // Zep memory — best-effort. In normal mode we await ensureThread + getContext
    // so we can inject the rolling memory into the system prompt. In `fast` mode
    // (voice / video calls) we skip both awaits — saves 200-500 ms of first-token
    // latency. Background addMessage still runs below so the convo is logged.
    const threadId = fast
      ? null
      : await ensureThread(req.user.id, body.persona, { firstName: req.user.name?.split(' ')[0] }).catch(() => null)
    const memCtx = (!fast && threadId) ? (await getContext(threadId).catch(() => '')) : ''

    let system
    const ariseMode = false
    {
      system = persona.systemPrompt
      // In fast mode add a tight reply-length directive — keeps Anam lip-sync
      // tolerable and shaves OpenAI generation time.
      if (fast) {
        system += '\n\nVOICE/VIDEO MODE: Reply in ≤2 short sentences. No bullet lists, no headers, no markdown. Plain conversational English (or whichever language the user spoke).'
      }
      // Role context: when Saathi (general persona) is talking to a non-trainee
      // role, append role-specific framing + a heavy data pack (e.g. NSDC Academy
      // numbers for nsdc_officer) so the agent answers like an analyst with real
      // figures and emits chart cards.
      const roleAddendum = buildRoleContext({ persona: body.persona, role: body.role })
      if (roleAddendum) system += '\n\n' + roleAddendum
      // Card toolbox — tells the LLM when/how to emit <<<KSKCARD>>>...<<<END>>>
      // fences. Skipped in fast mode (cards bloat the system prompt by ~3KB and
      // the agent is speaking, not drawing UI).
      if (!fast) system += '\n\n' + CARD_TOOLBOX
      if (body.extraSystem) system += '\n\nAdditional context:\n' + body.extraSystem
      if (memCtx)           system += '\n\nWhat you remember about this user:\n' + memCtx
    }

    // Save the latest user message — fire-and-forget so Zep latency / errors
    // never block the response path.
    const lastUser = [...body.messages].reverse().find(m => m.role === 'user')
    if (lastUser && threadId) addMessage(threadId, 'user', lastUser.content)

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    let fullText = ''
    const citations = []
    // Two streaming parsers chained:
    //   raw LLM text → BoardParser (peels off <<<BOARD:kind>>>…<<<END>>>
    //   and <<<DIAGRAM>>>id<<<END>>> fences into `board`/`diagram` SSE
    //   events for the ARISE classroom) → CardParser (peels off
    //   <<<KSKCARD>>>…<<<END>>> JSON fences into `card` events for
    //   Saathi-style rich UI) → final `delta` events for the chat bubble.
    // Only ARISE persona sessions actually receive board fences, but
    // running the parser is cheap when the stream contains none.
    const cardParser = new CardParser({
      onText: (text) => {
        fullText += text
        res.write(`data: ${JSON.stringify({ delta: text })}\n\n`)
      },
      onCard: (card) => {
        res.write(`data: ${JSON.stringify({ card })}\n\n`)
      },
    })
    const lastUserText = lastUser?.content?.slice(0, 120) || ''
    console.log(`[ai/stream] user=${req.user?.id} role=${body.role || '-'} persona=${body.persona} webSearch=${useWebSearch} systemLen=${system.length} msg="${lastUserText}"`)
    const t0 = Date.now()
    try {
      await streamChat({
        system,
        messages: body.messages.filter(m => m.role !== 'system'),
        useWebSearch,
        fast,
        // Feed through the board parser first (peels board/diagram
        // fences) and then it forwards clean text to the card parser
        // (peels card fences) and finally out as delta events.
        onChunk: (delta) => { cardParser.feed(delta) },
        onCitation: (c) => {
          if (c.url) {
            citations.push({ url: c.url, title: c.title || c.url })
            res.write(`data: ${JSON.stringify({ citation: { url: c.url, title: c.title || c.url } })}\n\n`)
          }
        },
      })
      cardParser.flush()
      console.log(`[ai/stream] ok in ${Date.now() - t0}ms · ${fullText.length} chars · ${citations.length} citations`)
    } catch (e) {
      console.error(`[ai/stream] FAILED after ${Date.now() - t0}ms:`, e?.message || e)
      res.write(`data: ${JSON.stringify({ error: e.message || String(e) })}\n\n`)
    }

    // Persist assistant response — fire-and-forget (see above)
    if (fullText && threadId) addMessage(threadId, 'assistant', fullText)

    res.write(`data: ${JSON.stringify({ done: true, citations })}\n\n`)
    res.end()
  } catch (e) { next(e) }
})

// ── Web search one-shot (Discover Courses / Find Jobs) ────────────────────
r.post('/search', async (req, res, next) => {
  try {
    if (!hasOpenAI()) return res.status(503).json({ error: 'openai_not_configured' })
    const body = z.object({
      query: z.string().min(1),
      instructions: z.string().optional(),
    }).parse(req.body)
    const out = await webSearch({ query: body.query, instructions: body.instructions })
    res.json(out)
  } catch (e) { next(e) }
})

// pure RAG (used by Ask AI panel when user explicitly asks a knowledge question)
r.post('/ask', async (req, res, next) => {
  try {
    const body = z.object({ question: z.string().min(1), module: z.string().optional() }).parse(req.body)
    const out = await ragAnswer({ question: body.question, role: req.user.role, module: body.module ?? null })
    res.json(out)
  } catch (e) { next(e) }
})

// /describe-screen — vision-driven screen-share guidance.
//
// Body: { image: 'data:image/jpeg;base64,...', persona?: string, lastQuestion?: string,
//         role?: string }
//
// Used by AvatarCall while the user is screen-sharing: every few seconds we
// post the current frame, get back a short description (UI in view, actions
// available, KSK-context where possible). The client injects this back into
// the live Realtime conversation as system context so the agent can guide the
// user — "tap the Discover Courses tile in the top right", etc.
//
// Cost guard: 60/hr/user is plenty for a demo; bump in prod if needed.
r.post('/describe-screen',
  rateLimit({ windowMs: 60 * 60 * 1000, limit: 60, keyGenerator: (req) => req.user?.id || req.ip }),
  async (req, res, next) => {
    try {
      const body = z.object({
        image:        z.string().min(20),    // data URL
        persona:      z.string().optional(),
        lastQuestion: z.string().optional(),
        role:         z.string().optional(),
      }).parse(req.body)
      if (!hasOpenAI()) return res.status(503).json({ error: 'openai_not_configured' })

      const roleLine = body.role ? `User's role: ${body.role}.` : ''
      const askLine  = body.lastQuestion ? `User just asked: "${body.lastQuestion}".` : ''
      const system = [
        "You are the eyes of a live AI assistant guiding an Indian skilling-platform user (PM-SETU Saathi).",
        "Look at the screenshot and reply with ONE compact paragraph (≤60 words) describing:",
        "1) which screen is visible (Home / a specific module / a dialog), 2) the key clickable elements the user can tap RIGHT NOW (by visible label + location, e.g. \"top-right blue 'New chat' button\", \"the third card labelled 'Skill Passport' in the OPEN AN APP grid\"), 3) any in-progress state the user might be stuck on.",
        "Do NOT speculate beyond what's visible. Use the exact button / card labels you can read. No markdown, no preamble — just the description.",
        roleLine, askLine,
      ].filter(Boolean).join(' ')

      const resp = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: [
            { type: 'text', text: 'Describe the current screen.' },
            { type: 'image_url', image_url: { url: body.image, detail: 'low' } },
          ] },
        ],
        max_tokens: 220,
        temperature: 0.2,
      })
      const description = resp.choices?.[0]?.message?.content?.trim() || ''
      res.json({ description })
    } catch (e) {
      console.error('[describe-screen] failed', e?.message || e)
      next(e)
    }
  }
)

// pure intent classification (frontend can use directly)
r.post('/interpret', async (req, res, next) => {
  try {
    const body = z.object({ text: z.string().min(1) }).parse(req.body)
    const out = await interpretAction({ text: body.text, role: req.user.role })
    res.json(out || { intent: null })
  } catch (e) { next(e) }
})

export default r
