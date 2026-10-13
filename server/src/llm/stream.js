// OpenAI streaming + web search helpers.
//
// Uses the modern Responses API when tools (web_search_preview) are requested,
// and falls back to the standard Chat Completions API otherwise. Both stream
// deltas back via the onChunk callback so the route can pipe them straight
// into SSE → Anam talkStream.streamMessageChunk().

import { openai, CHAT_MODEL } from './openai.js'

// Stream a chat turn. `onChunk(delta)` is called for every text fragment.
// `onCitation(c)` (optional) for web_search citations as they appear.
export async function streamChat({ system, messages, useWebSearch = false, fast = false, onChunk, onCitation = () => {} }) {
  if (!openai) throw new Error('OPENAI_API_KEY not configured')

  // In `fast` mode (voice / video calls) use gpt-4o-mini — first-token latency
  // is ~2x faster than gpt-4o on short replies, and the quality drop is
  // imperceptible for the kind of conversational turns voice agents produce.
  // Overridable via env if you need a different mini model.
  const model = fast ? (process.env.OPENAI_FAST_MODEL || 'gpt-4o-mini') : CHAT_MODEL

  // ── Responses API path (with web search tool) ────────────────────────
  if (useWebSearch) {
    // Build a single user-facing input from the message history.
    const input = messages.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    }))

    const stream = await openai.responses.stream({
      model,
      instructions: system,
      input,
      tools: [{ type: 'web_search_preview' }],
    })

    for await (const event of stream) {
      // text deltas
      if (event.type === 'response.output_text.delta') {
        if (event.delta) onChunk(event.delta)
      }
      // citation events (vary by SDK version — handle the common shapes)
      else if (event.type === 'response.output_text.annotation.added' && event.annotation) {
        onCitation(event.annotation)
      }
    }
    return
  }

  // ── Standard chat-completions streaming ───────────────────────────────
  const stream = await openai.chat.completions.create({
    model,
    messages: [{ role: 'system', content: system }, ...messages],
    stream: true,
    temperature: 0.7,
    max_tokens: fast ? 200 : 800,   // fast mode forces brevity at the API level
  })
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content
    if (delta) onChunk(delta)
  }
}

// One-shot web search (non-streaming). Returns the full Response object with
// output_text + citations. Used by Discover Courses + Find Jobs canvases that
// want structured cards rather than a streaming chat reply.
export async function webSearch({ query, instructions = '' } = {}) {
  if (!openai) throw new Error('OPENAI_API_KEY not configured')
  const resp = await openai.responses.create({
    model: CHAT_MODEL,
    instructions: instructions || 'You are a research assistant. Use web search to find current, verifiable information. Be concise and cite sources.',
    input: query,
    tools: [{ type: 'web_search_preview' }],
  })
  return {
    text: resp.output_text || '',
    raw: resp,
    citations: extractCitations(resp),
  }
}

function extractCitations(resp) {
  const out = []
  for (const item of resp.output || []) {
    for (const part of item.content || []) {
      for (const ann of part.annotations || []) {
        if (ann.type === 'url_citation' || ann.type === 'web_search') {
          out.push({ title: ann.title || ann.url, url: ann.url })
        }
      }
    }
  }
  return out
}
