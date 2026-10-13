import OpenAI from 'openai'

const apiKey = process.env.OPENAI_API_KEY
export const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o'
export const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small'

export const openai = apiKey ? new OpenAI({ apiKey }) : null

export function hasOpenAI() { return Boolean(apiKey) }

export async function chatJSON({ system, user, schemaHint, temperature = 0 }) {
  if (!openai) return null
  const resp = await openai.chat.completions.create({
    model: CHAT_MODEL,
    response_format: { type: 'json_object' },
    temperature,
    max_tokens: 600,
    messages: [
      { role: 'system', content: system + (schemaHint ? `\nReturn JSON exactly matching: ${schemaHint}` : '') },
      { role: 'user', content: user },
    ],
  })
  const txt = resp.choices?.[0]?.message?.content
  if (!txt) return null
  try { return JSON.parse(txt) } catch { return null }
}

export async function chatText({ system, user, temperature = 0.2 }) {
  if (!openai) return null
  const resp = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature,
    max_tokens: 600,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  })
  return resp.choices?.[0]?.message?.content || null
}

export async function embed(text) {
  if (!openai) return null
  const resp = await openai.embeddings.create({ model: EMBED_MODEL, input: text })
  return resp.data?.[0]?.embedding || null
}
