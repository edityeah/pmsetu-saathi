// /api/realtime/session — mint an ephemeral OpenAI Realtime session.
//
// Why this exists: the browser cannot hold OPENAI_API_KEY (a leaked key is a
// blank cheque on the project). OpenAI's Realtime API issues short-lived
// ephemeral tokens for exactly this case: server uses its real key to ask for
// a session, browser uses the ephemeral `client_secret` to open a WebRTC
// connection direct to OpenAI for ~1 minute.
//
// Docs: https://platform.openai.com/docs/api-reference/realtime-sessions
//
// We accept a persona + extraSystem so we can stamp the conversational
// instructions and voice on the session at creation time.

import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../auth/middleware.js'
import { buildRoleContext } from '../llm/roleContext.js'
import { toOpenAIToolDefs, toPersonaBriefing } from '../voice/tools.js'

const r = Router()
r.use(requireAuth)

// Cap mint rate per user — each session can chew tokens, so we don't want a
// runaway client spawning hundreds.
r.use(rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 120,                       // ~2 sessions / minute / user
  keyGenerator: (req) => req.user?.id || req.ip,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
}))

// Updated for OpenAI Realtime GA (Aug 2025). The previous beta API was
// retired; OpenAI now responds 400 to any call that sends OpenAI-Beta:
// realtime=v1. Defaults updated to the GA model name.
//
// Legacy env values like `gpt-4o-realtime-preview-2024-12-17` were valid
// against the old beta endpoint but the GA WebRTC `/v1/realtime/calls`
// path requires the GA model name. Silently upgrade those so a stale
// Render env doesn't break the SDP handshake. Set a non-legacy override
// via env to opt out (e.g. a future dated GA snapshot).
const LEGACY_REALTIME_MODELS = new Set([
  'gpt-4o-realtime-preview',
  'gpt-4o-realtime-preview-2024-12-17',
  'gpt-4o-realtime-preview-2024-10-01',
  'gpt-4o-mini-realtime-preview',
  'gpt-4o-mini-realtime-preview-2024-12-17',
])
const ENV_MODEL = process.env.OPENAI_REALTIME_MODEL
const MODEL = (ENV_MODEL && !LEGACY_REALTIME_MODELS.has(ENV_MODEL))
  ? ENV_MODEL
  : 'gpt-realtime'
// `verse` and `ballad` are the warmest Indian-English-friendly OpenAI voices.
const VOICE  = process.env.OPENAI_REALTIME_VOICE || 'verse'

// Persona system prompts kept close to /api/ai/stream so behaviour is consistent
// across text and voice modes. Voice replies are intentionally short — long
// monologues are painful to listen to.
const PERSONA_PROMPTS = {
  'career-counsellor':
    "You are Karuna, an empathetic AI career counsellor for ITI trainees in a PM-SETU upgraded cluster. Be specific, practical and warm; refer to the cluster's trades, industry partners and OJT. In voice mode keep replies under 4 sentences. Never invent salary numbers.",
  'learning-assistant':
    "You are Guru ji, an AI tutor for ITI trainees (8th/10th/12th pass). Teach in micro-lessons (what it is, real shop-floor example, quick check). Speak simply, Indian context, check understanding often. Keep voice turns short.",
  'general':
    "You are Saathi, the AI companion built into PM-SETU Saathi — the cluster platform for Hub-and-Spoke ITI transformation under PM-SETU. Adapt tone and depth to the user's role (described below). Keep voice replies brief and natural.",
}

// Role-specific framing + data packs live in server/src/llm/roleContext.js so
// both /api/realtime/session and /api/ai/stream consume the same context.

// Knowledge-base directive shared by every persona — defines the canonical
// sources to consult for qualification / course / job-role questions.
const KB_DIRECTIVE =
  "KNOWLEDGE SOURCES (always prefer these over generic web results):\n" +
  "- National Qualifications Register (NQR) at https://www.nqr.gov.in/qualifications-search/ — authoritative source for Indian qualifications, NSQF levels, awarding bodies (Sector Skill Councils), QP codes, NOS units, sector mapping and job-role definitions. Use this for ANY question about courses, qualifications, NSQF levels, awarding bodies, sectors or job roles. Cite the QP code (e.g. APP/Q0204) when you reference a qualification.\n" +
  "- NSDC / MSDE official portals — for schemes (PMKVY, DDU-GKY, NAPS, SIB, PM Vishwakarma) and current eligibility / stipend rules.\n" +
  "When details aren't already in this conversation, use web search to pull from these sources rather than relying on memory."

// Language behaviour: mirror the user's language. If they speak English,
// reply in English. If they speak Hindi, reply in Hindi (Devanagari script
// is fine). Same for Marathi, Gujarati, Bengali, Tamil, Telugu, Kannada,
// Malayalam, Punjabi, Odia, Assamese, Urdu — match whichever they used.
// Don't switch mid-conversation unless they switch first.
const LANGUAGE_RULE =
  "LANGUAGE RULES:\n" +
  "- Detect the language the user spoke in this turn and reply in the SAME language.\n" +
  "- English → English. Hindi → Hindi (Devanagari is fine). Marathi → Marathi. Gujarati → Gujarati. Bengali → Bengali. Tamil → Tamil. Telugu → Telugu. Kannada → Kannada. Malayalam → Malayalam. Punjabi → Punjabi (Gurmukhi). Odia → Odia. Assamese → Assamese. Urdu → Urdu.\n" +
  "- If the user mixes English + an Indian language in one sentence (code-switching), reply in the same mixed style.\n" +
  "- Do NOT pre-emptively switch languages. Wait for the user to switch first.\n" +
  "- Scheme names, employer names, place names, NSQF codes and numbers can stay in their original form (English/Latin script) inside a non-English reply — that's natural Indian usage."

const BodySchema = z.object({
  persona: z.string().optional(),
  extraSystem: z.string().max(4000).optional(),
  language: z.string().optional(),     // hint only; the model auto-detects
  voice: z.string().optional(),
  role: z.string().optional(),         // user role — drives ROLE_OPENERS
})

r.post('/session', async (req, res, next) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'openai_not_configured' })
    }
    const body = BodySchema.parse(req.body || {})

    // ── ARISE MX teacher persona — completely different instruction shape
    // (uses its own base prompt + chapter-specific RAG chunks). Skip the
    // generic PERSONA_PROMPTS / role addendum / canvas-tool briefing.
    let instructions
    {
      const base = PERSONA_PROMPTS[body.persona] || PERSONA_PROMPTS.general
      const roleAddendum = buildRoleContext({ persona: body.persona, role: body.role })
      const parts = [base]
      if (roleAddendum) parts.push(roleAddendum)
      parts.push(KB_DIRECTIVE)
      parts.push(LANGUAGE_RULE)
      // Voice-tool routing table appended late so it has recency weight.
      parts.push(toPersonaBriefing())
      if (body.extraSystem) parts.push(body.extraSystem)
      instructions = parts.join('\n\n')
    }

    const voice = body.voice || VOICE
    // GA Realtime API payload — session is wrapped under a `session` envelope
    // and the field set differs from the old beta. Audio block carries voice
    // + transcription + turn detection; modalities live at session level via
    // the `output_modalities` array.
    const sessionConfig = {
      type: 'realtime',
      model: MODEL,
      instructions,
      // Tools baked into the session at mint time. Client-side handlers
      // live in web/src/utils/voiceTools.js; dispatch happens in
      // web/src/utils/realtimeVoice.js when a response.function_call_
      // arguments.done event arrives on the data channel.
      tools: toOpenAIToolDefs(),
      // tool_choice: 'auto' is Realtime's default — the model decides
      // when to call a tool vs. just respond. Leaving it implicit.
      output_modalities: ['audio'],
      audio: {
        input: {
          // Whisper for live transcription with auto language detection so
          // we capture Hindi, Marathi, Gujarati, Tamil, Bengali etc. in
          // their native scripts instead of forcing Latin transliteration.
          transcription: { model: 'whisper-1' },
          // Server VAD for natural turn-taking + barge-in (interrupts the
          // model's response when the user starts speaking again).
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 700,
            create_response: true,
            interrupt_response: true,
          },
        },
        output: { voice },
      },
    }

    // GA endpoint: /v1/realtime/client_secrets mints a short-lived client
    // secret. The old /v1/realtime/sessions path was retired in Aug 2025 —
    // calling it now returns "The Realtime Beta API is no longer supported."
    const r2 = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ session: sessionConfig }),
    })
    if (!r2.ok) {
      const txt = await r2.text().catch(() => '')
      console.error('[realtime] session mint failed', r2.status, txt.slice(0, 400))
      return res.status(502).json({ error: 'realtime_mint_failed', detail: txt.slice(0, 200) })
    }
    const minted = await r2.json()
    // GA response shape: { value, expires_at, session }. Old beta nested it
    // under `client_secret.value`. Handle both for forward-compat.
    const clientSecret = minted.value || minted.client_secret?.value
    const expiresAt    = minted.expires_at || minted.client_secret?.expires_at
    res.json({ clientSecret, expiresAt, model: MODEL, voice })
  } catch (e) {
    console.error('[realtime] error', e?.message || e)
    next(e)
  }
})

export default r
