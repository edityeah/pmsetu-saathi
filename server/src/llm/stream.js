// OpenAI streaming + web search helpers.
//
// Uses the Responses API when web search is requested, and the Chat
// Completions API otherwise. Both stream deltas back via onChunk. Both paths
// accept function tools (`tools`, in chat-completions shape) and run up to
// two tool rounds: the model calls a tool, we resolve it through onToolCall,
// feed the result back and let the model finish its reply.

import { openai, CHAT_MODEL } from './openai.js'

const MAX_ROUNDS = 3

export async function streamChat({ system, messages, useWebSearch = false, fast = false, tools = [], onToolCall = null, onChunk, onCitation = () => {} }) {
  if (!openai) throw new Error('OPENAI_API_KEY not configured')
  const model = fast ? (process.env.OPENAI_FAST_MODEL || 'gpt-4o-mini') : CHAT_MODEL
  const fnTools = (tools || []).filter(t => t.type === 'function')

  // ── Responses API path (web search, optional function tools) ──────────
  if (useWebSearch) {
    let input = messages.map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }))
    const rTools = [{ type: 'web_search_preview' }, ...fnTools.map(t => ({ type: 'function', name: t.function.name, description: t.function.description, parameters: t.function.parameters }))]
    let previousId = null
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const stream = await openai.responses.stream({ model, instructions: system, input, tools: rTools, ...(previousId ? { previous_response_id: previousId } : {}) })
      const calls = []
      for await (const event of stream) {
        if (event.type === 'response.output_text.delta') { if (event.delta) onChunk(event.delta) }
        else if (event.type === 'response.output_text.annotation.added' && event.annotation) onCitation(event.annotation)
        else if (event.type === 'response.output_item.done' && event.item?.type === 'function_call') calls.push(event.item)
      }
      const final = await stream.finalResponse().catch(() => null)
      if (!calls.length || !onToolCall) return
      previousId = final?.id || null
      input = []
      for (const c of calls) {
        let args = {}; try { args = JSON.parse(c.arguments || '{}') } catch {}
        const result = await onToolCall(c.name, args).catch(e => ({ ok: false, error: String(e?.message || e) }))
        input.push({ type: 'function_call_output', call_id: c.call_id, output: JSON.stringify(result).slice(0, 12000) })
      }
    }
    return
  }

  // ── Chat-completions path (optional function tools) ───────────────────
  let convo = [{ role: 'system', content: system }, ...messages]
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const stream = await openai.chat.completions.create({
      model, messages: convo, stream: true, temperature: 0.7,
      max_tokens: fast ? 300 : 800,
      ...(fnTools.length ? { tools: fnTools, tool_choice: 'auto' } : {}),
    })
    const calls = new Map()
    for await (const chunk of stream) {
      const d = chunk.choices?.[0]?.delta
      if (!d) continue
      if (d.content) onChunk(d.content)
      for (const tc of d.tool_calls || []) {
        const cur = calls.get(tc.index) || { id: '', name: '', args: '' }
        if (tc.id) cur.id = tc.id
        if (tc.function?.name) cur.name += tc.function.name
        if (tc.function?.arguments) cur.args += tc.function.arguments
        calls.set(tc.index, cur)
      }
    }
    if (!calls.size || !onToolCall) return
    const list = [...calls.values()]
    convo = [...convo, { role: 'assistant', content: null, tool_calls: list.map(c => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.args || '{}' } })) }]
    for (const c of list) {
      let args = {}; try { args = JSON.parse(c.args || '{}') } catch {}
      const result = await onToolCall(c.name, args).catch(e => ({ ok: false, error: String(e?.message || e) }))
      convo.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify(result).slice(0, 12000) })
    }
  }
}

// One-shot web search (non-streaming).
export async function webSearch({ query, instructions = '' } = {}) {
  if (!openai) throw new Error('OPENAI_API_KEY not configured')
  const resp = await openai.responses.create({
    model: CHAT_MODEL,
    instructions: instructions || 'You are a research assistant. Use web search to find current, verifiable information. Be concise and cite sources.',
    input: query,
    tools: [{ type: 'web_search_preview' }],
  })
  return { text: resp.output_text || '', raw: resp, citations: extractCitations(resp) }
}

function extractCitations(resp) {
  const out = []
  for (const item of resp.output || []) for (const part of item.content || []) for (const ann of part.annotations || []) {
    if (ann.type === 'url_citation' || ann.type === 'web_search') out.push({ title: ann.title || ann.url, url: ann.url })
  }
  return out
}
