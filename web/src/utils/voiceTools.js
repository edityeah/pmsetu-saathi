// Voice tool handlers. Both tools resolve on the server (/api/ai/navigate),
// which maps a target + ITI to the canvas context and returns the live data
// behind that screen, so the agent speaks the numbers the dashboard shows.
import { api } from '../api/client.js'

export const TOOLS = {
  open_canvas: {
    handler: async (args, ctx) => {
      if (!args?.target) return { ok: false, error: 'target missing' }
      if (!ctx?.openCanvas) return { ok: false, error: 'voice ctx not bound' }
      const r = await api.navigate({ ...args, open: true })
      try { ctx.openCanvas(r.canvas); ctx.showToast?.({ kind: 'info', text: `Opened: ${r.label}` }) } catch (e) { return { ok: false, error: String(e?.message || e) } }
      return { ok: true, opened: r.label, data: r.data }
    },
  },
  lookup_data: {
    handler: async (args) => {
      if (!args?.target) return { ok: false, error: 'target missing' }
      const r = await api.navigate({ ...args, open: false })
      return { ok: true, screen: r.label, data: r.data }
    },
  },
}

export async function handleVoiceToolCall(name, args, ctx) {
  const tool = TOOLS[name]
  if (!tool) return { ok: false, error: `unknown tool: ${name}` }
  try { return await tool.handler(args || {}, ctx || {}) } catch (e) { return { ok: false, error: String(e?.message || e) } }
}
