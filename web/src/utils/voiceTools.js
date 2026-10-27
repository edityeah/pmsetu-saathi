// Voice tool handlers. Both tools resolve on the server (/api/ai/navigate),
// which maps a target + ITI to the canvas context and returns the live data
// behind that screen, so the agent speaks the numbers the dashboard shows.
import { api } from '../api/client.js'

// Both tools place an Open button and follow-ups in the call transcript and
// hand the live data back to the model. The screen opens only when the user
// taps the button (the same rule as the text chat).
async function offerScreen(args, ctx) {
  if (!args?.target) return { ok: false, error: 'target missing' }
  const r = await api.navigate({ ...args, open: false })
  try { ctx?.offer?.({ label: r.label, canvas: r.canvas, followUps: r.followUps || [] }) } catch {}
  return { ok: true, screen: r.label, data: r.data, note: `An "Open ${r.label}" button and three follow-up questions are now in the user's chat. Do not say you opened or are showing the screen; the user taps the button.` }
}
export const TOOLS = {
  open_canvas: { handler: offerScreen },
  lookup_data: { handler: offerScreen },
}

export async function handleVoiceToolCall(name, args, ctx) {
  const tool = TOOLS[name]
  if (!tool) return { ok: false, error: `unknown tool: ${name}` }
  try { return await tool.handler(args || {}, ctx || {}) } catch (e) { return { ok: false, error: String(e?.message || e) } }
}
