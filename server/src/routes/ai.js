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
import { interpretNavigation, resolveNavigation, answerFromData, followUpsFor } from '../nav/interpret.js'
import { targetsForRole } from '../nav/catalog.js'
import { chatText } from '../llm/openai.js'
import { livePack } from '../nav/snapshot.js'
import { navToolDefs } from '../voice/tools.js'
import { extractCareerDelta, CHAT_FIELDS } from '../llm/career.js'
import { traineeFor } from '../lib/scope.js'

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

// Rules appended to the general persona so the streaming chat uses the tools.
const NAV_TOOL_RULES = (role) => `SCREEN TOOLS: you can open screens in this user's UI with open_canvas(target, iti?, trade?, gender?, date?) and read live platform data with lookup_data(same arguments). Two modes. (1) Orchestration: when the user asks to open, show, see or display a screen, dashboard, graph, chart or list, CALL open_canvas and say in one line that you are showing it ("I'm showing you the Infrastructure readiness screen for Pusa."). (2) Insight: when the user asks a data question (how many, how much, is it working, what is remaining…), call lookup_data, answer ONLY from the returned data quoting the numbers exactly, then offer the screen in one line ("I can open the Budget analytics screen for Pusa if you want.") and end with three numbered deeper-dive questions the user could ask next (1. … 2. … 3. …). Do not open a screen the user did not ask to see; if they reply yes or pick a number, act on it. Targets for role ${role} are listed in the tool's enum; machines, workshops or labs working today → ops_infrastructure; courses or trades offered → institute_trades; facilities and assets installed → institute_facilities.`

function isQuestionLike(text) {
  return /\?\s*$/.test(text) || /\b(why|how|what|when|where|explain|kya|kyun|kaise|samjhao|batao)\b/i.test(text)
}

r.post('/message', async (req, res, next) => {
  try {
    const body = z.object({ text: z.string().min(1), language: z.string().optional() }).parse(req.body)
    const text = body.text.trim()
    const role = req.user.role

    // 1) Navigation first: any request that a screen answers opens that
    //    screen (right tab, right ITI) and, when it is a question, reads the
    //    answer from the live data behind that screen.
    const nav = await interpretNavigation({ text, role, language: body.language })
    if (nav?.target && nav.confidence >= 0.5) {
      const r0 = await resolveNavigation(req, { target: nav.target, ...nav.entities, withData: true })
      if (!r0.error) {
        const followUps = nav.followUps?.length === 3 ? nav.followUps : followUpsFor(nav.target, nav.entities, r0.iti?.name)
        const cta = { label: `Open ${r0.label}`, canvas: r0.canvas }
        // Every navigation request is answered in the chat: a data question
        // gets its answer, a "show me" request gets a two-sentence summary of
        // what the screen holds. The screen itself opens only from the Open
        // button under the answer, never by itself.
        const question = nav.wantsAnswer && !nav.wantsScreen ? text : `Summarise what ${r0.label}${r0.iti?.name ? ` for ${r0.iti.name}` : ''} shows right now in two short sentences, quoting the key figures.`
        const answer = await answerFromData({ question, label: r0.label, data: r0.data, language: nav.language, target: nav.target, itiName: r0.iti?.name }).catch(() => null)
        const fallback = nav.language === 'hi' ? `${r0.label} तैयार है। नीचे Open दबाकर देखें।` : `${r0.label} is ready. Tap Open below to see the full screen.`
        return res.json({ responseType: 'answer', target: nav.target, answer: { text: answer || fallback, citations: [], language: nav.language }, cta, followUps, meta: { label: r0.label, canvas: r0.canvas } })
      }
    }

    if (!hasOpenAI()) return res.json({ responseType: 'none', reason: 'openai_not_configured' })

    // 2) Knowledge fallback (scheme, policy, platform) from the RAG corpus.
    const rag = await ragAnswer({ question: text, role })
    if (rag.answer) {
      return res.json({ responseType: 'answer', answer: { text: rag.answer, citations: rag.citations, language: body.language || 'en' } })
    }

    // 3) Roles whose catalog is section-only (the CEO) get a direct answer
    //    from the scheme facts and the live cluster pack instead of a jump
    //    to a screen outside their sections.
    if (!targetsForRole(role).some(t => t.legacy)) {
      const pack = await livePack(req).catch(() => '')
      const roleCtx = buildRoleContext({ persona: 'general', role }) || ''
      const ans = await chatText({ system: `You are Saathi inside PM-SETU Saathi, talking to the ${role}. Answer in at most three short sentences, plain text, in the user's language. Use the facts below; for cluster numbers use only the LIVE CLUSTER DATA. If the answer needs a screen, name the section it lives in (Budget Analytics, Institute Profile, Cluster Registry, Daily Operations, Placement Analytics, Support and Alerts).\n\n${roleCtx}\n\n${pack}`, user: text }).catch(() => null)
      if (ans) return res.json({ responseType: 'answer', answer: { text: ans, citations: [], language: nav?.language || body.language || 'en' } })
    }

    // 4) Legacy intent classifier as a last resort (other roles' actions).
    const intent = await interpretAction({ text, role, language: body.language })
    if (intent?.intent && intent.confidence >= 0.5) {
      return res.json({ responseType: 'action', actionId: intent.intent, module: intent.module, entities: intent.entities, confidence: intent.confidence, meta: { assistantText: intent.assistantText, chips: intent.chips, language: intent.language } })
    }

    return res.json({
      responseType: 'none',
      assistantText: nav?.assistantText || intent?.assistantText || "I'm not sure how to help with that yet. Try one of the suggested chips.",
      chips: nav?.chips?.length ? nav.chips : (intent?.chips || []),
    })
  } catch (e) { next(e) }
})

// ── Navigate (voice and streaming tools) ──────────────────────────────────
// Body: { target, iti?, trade?, gender?, date?, year?, open?: boolean }
// Returns the canvas context to open and the live data behind that screen.
r.post('/navigate', async (req, res, next) => {
  try {
    const body = z.object({ target: z.string(), iti: z.string().nullable().optional(), trade: z.string().nullable().optional(), gender: z.string().nullable().optional(), date: z.string().nullable().optional(), year: z.union([z.string(), z.number()]).nullable().optional(), category: z.string().nullable().optional(), open: z.boolean().optional() }).parse(req.body || {})
    const out = await resolveNavigation(req, { ...body, withData: true })
    if (out.error) return res.status(400).json({ error: out.error })
    res.json(out)
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
      // Live numbers from the same routes the dashboards read (60 s cache).
      if (!body.persona || body.persona === 'general') { const pack = await livePack(req).catch(() => ''); if (pack) system += '\n\n' + pack }
      // Card toolbox — tells the LLM when/how to emit <<<KSKCARD>>>...<<<END>>>
      // fences. Skipped in fast mode (cards bloat the system prompt by ~3KB and
      // the agent is speaking, not drawing UI).
      if (!fast) system += '\n\n' + CARD_TOOLBOX
      if (body.extraSystem) system += '\n\nAdditional context:\n' + body.extraSystem
      if (!body.persona || body.persona === 'general') system += '\n\n' + NAV_TOOL_RULES(req.user.role)
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
    // Marker filter: <<TAKE_ASSESSMENT>> and <<GENERATE_REPORT>> become card
    // events and never reach the bubble. Text after a '<<' is held until the
    // marker closes or proves not to be one.
    let hold = ''
    const MARKERS = { '<<TAKE_ASSESSMENT>>': 'take_assessment', '<<GENERATE_REPORT>>': 'generate_report' }
    const emitText = (text) => { if (!text) return; fullText += text; res.write(`data: ${JSON.stringify({ delta: text })}\n\n`) }
    const filterMarkers = (text) => {
      let buf = hold + text; hold = ''
      let out = ''
      while (buf.length) {
        const i = buf.indexOf('<<')
        if (i < 0) { if (buf.endsWith('<')) { out += buf.slice(0, -1); hold = '<' } else out += buf; buf = ''; break }
        out += buf.slice(0, i); buf = buf.slice(i)
        const j = buf.indexOf('>>')
        if (j < 0) { if (buf.length > 32) { out += buf.slice(0, 2); buf = buf.slice(2); continue } hold = buf; buf = ''; break }
        const tok = buf.slice(0, j + 2); buf = buf.slice(j + 2)
        if (MARKERS[tok]) res.write(`data: ${JSON.stringify({ card: { type: MARKERS[tok] } })}\n\n`)
        else out += tok
      }
      emitText(out)
    }
    const cardParser = new CardParser({
      onText: (text) => filterMarkers(text),
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
        // Screen tools: open_canvas opens a screen in the user's UI (and
        // returns its live data); lookup_data only returns the data.
        tools: (!body.persona || body.persona === 'general') ? navToolDefs(req.user.role, 'chat') : [],
        onToolCall: async (name, args) => {
          if (name !== 'open_canvas' && name !== 'lookup_data') return { ok: false, error: 'unknown tool' }
          const out = await resolveNavigation(req, { ...args, withData: true })
          if (out.error) return { ok: false, error: out.error }
          if (name === 'open_canvas') res.write(`data: ${JSON.stringify({ navigate: { canvas: out.canvas, label: out.label } })}\n\n`)
          else res.write(`data: ${JSON.stringify({ offer: { canvas: out.canvas, label: out.label } })}\n\n`)
          return { ok: true, opened: name === 'open_canvas' ? out.label : undefined, screen: out.label, data: out.data }
        },
        onCitation: (c) => {
          if (c.url) {
            citations.push({ url: c.url, title: c.title || c.url })
            res.write(`data: ${JSON.stringify({ citation: { url: c.url, title: c.title || c.url } })}\n\n`)
          }
        },
      })
      cardParser.flush()
      if (hold) { const h = hold; hold = ''; emitText(h) }
      console.log(`[ai/stream] ok in ${Date.now() - t0}ms · ${fullText.length} chars · ${citations.length} citations`)
      // Career counselling: read what the student just told Karuna into the
      // progressive profile (fire-and-forget; never blocks the reply).
      if (body.persona === 'career-counsellor' && req.user.role === 'trainee' && lastUser?.content) {
        ;(async () => {
          try {
            const t = await traineeFor(req.user); if (!t) return
            const ex = await prisma.companionArtifact.findFirst({ where: { traineeId: t.id, kind: 'career_profile' } })
            const profile = ex ? JSON.parse(ex.content || '{}') : {}
            const delta = await extractCareerDelta({ profile, userText: lastUser.content, assistantText: fullText })
            if (!Object.keys(delta).length) return
            const next = { ...profile, ...delta }
            if (ex) await prisma.companionArtifact.update({ where: { id: ex.id }, data: { content: JSON.stringify(next) } })
            else await prisma.companionArtifact.create({ data: { traineeId: t.id, kind: 'career_profile', title: 'Career profile', content: JSON.stringify(next) } })
            if (!res.writableEnded) res.write(`data: ${JSON.stringify({ profileDelta: Object.keys(delta) })}\n\n`)
          } catch (e) { console.warn('[career extractor]', e?.message || e) }
        })()
      }
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
  rateLimit({ windowMs: 60 * 60 * 1000, limit: 600, keyGenerator: (req) => req.user?.id || req.ip }),
  async (req, res, next) => {
    try {
      const body = z.object({
        image:        z.string().min(20),    // data URL
        persona:      z.string().optional(),
        lastQuestion: z.string().optional(),
        role:         z.string().optional(),
        screen:       z.object({ title: z.string().optional(), tab: z.string().nullable().optional(), context: z.string().optional() }).optional(),
      }).parse(req.body)
      if (!hasOpenAI()) return res.status(503).json({ error: 'openai_not_configured' })

      const roleLine = body.role ? `User's role: ${body.role}.` : ''
      const askLine  = body.lastQuestion ? `User just asked: "${body.lastQuestion}".` : ''
      const screenLine = body.screen ? `The app reports the open screen is "${body.screen.title}"${body.screen.tab ? ` (${body.screen.tab} tab)` : ''} and its data is: ${body.screen.context || 'not published'}. Where the picture shows a figure, transcribe it exactly as printed; if it disagrees with the reported data, say which you read from the picture.` : ''
      const system = [
        "You are the eyes of a live AI assistant guiding an Indian skilling-platform user (PM-SETU Saathi).",
        "Look at the screenshot and reply with ONE compact paragraph (≤90 words): 1) which screen and tab is visible, 2) the headline figures exactly as printed (label: value), 3) the clickable elements the user can tap right now by visible label and location, 4) anything selected or in progress.",
        "Transcribe numbers digit by digit; never round or guess. Do NOT speculate beyond what is visible. No markdown, no preamble.",
        roleLine, askLine, screenLine,
      ].filter(Boolean).join(' ')

      const resp = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: [
            { type: 'text', text: 'Describe the current screen.' },
            { type: 'image_url', image_url: { url: body.image, detail: 'high' } },
          ] },
        ],
        max_tokens: 320,
        temperature: 0.1,
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
