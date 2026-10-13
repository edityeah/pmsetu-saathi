import { chatJSON, hasOpenAI } from './openai.js'
import { ACTIONS, actionsForRole, actionAllowed } from './catalog.js'

const SCHEMA_HINT = `{
  "intent": "<ACTION_ID or null>",
  "module": "<module string or null>",
  "entities": { "...": "..." },
  "confidence": 0..1,
  "assistantText": "<short text shown above any card>",
  "language": "en" | "hi" | "...",
  "chips": ["<suggested follow-up 1>", "<suggested follow-up 2>"]
}`

export async function interpretAction({ text, role, language = 'en' }) {
  if (!hasOpenAI()) return null
  const allowed = actionsForRole(role)
  const system = `You are Saathi, the KSK conversational agent. Classify the user's request into one of the allowed action IDs below.
Allowed actions for role "${role}":
${allowed.map(a => `- ${a.id} (${a.module}): ${a.description}`).join('\n')}

Rules:
1. If the user's request maps to one of the actions, return that action ID. Otherwise return null intent.
2. confidence must be 0–1. Use 0.85+ only for unambiguous matches.
3. assistantText: ≤120 chars, in the user's language. Plain conversational tone.
4. chips: 2 short follow-up suggestions the user might tap. Never duplicate the user's input.
5. Always return strict JSON. Never include markdown or commentary.`
  const out = await chatJSON({ system, user: text, schemaHint: SCHEMA_HINT })
  if (!out) return null
  if (!out.intent || !actionAllowed(out.intent, role)) {
    return { intent: null, module: null, entities: {}, confidence: 0, assistantText: out.assistantText || '', language: out.language || language, chips: out.chips || [] }
  }
  return {
    intent: out.intent,
    module: out.module || ACTIONS[out.intent]?.module || null,
    entities: out.entities || {},
    confidence: clamp01(out.confidence ?? 0.7),
    assistantText: out.assistantText || '',
    language: out.language || language,
    chips: Array.isArray(out.chips) ? out.chips.slice(0, 3) : [],
  }
}

function clamp01(x) { return Math.max(0, Math.min(1, Number(x) || 0)) }
