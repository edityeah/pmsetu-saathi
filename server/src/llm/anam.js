// Persona definitions + Anam avatar session minting.
// llmId="CUSTOMER_CLIENT_V1" so Anam lip-syncs against text we stream from
// /api/ai/stream — one prompt pipeline across text, voice and video.

const ANAM_BASE = 'https://api.anam.ai'
const DEFAULT_AVATAR_ID = 'edf6fdcb-acab-44b8-b974-ded72665ee26'
const DEFAULT_VOICE_ID  = 'd79f2051-3a89-4fcc-8c71-cf5d53f9d9e0'

export const PERSONAS = {
  'career-counsellor': {
    name: 'Karuna · Career Counsellor',
    avatarId: null, voiceId: null, useWebSearch: true,
    systemPrompt: `You are Karuna, a warm, encouraging career counsellor for ITI trainees in a PM-SETU Hub-and-Spoke cluster (Delhi: Pusa hub — automation & robotics, drones; spokes Shahdara welding, Narela machine shop/CNC, Rohini electronics, Okhla HVAC; employers are local contractors, fabrication units, machine shops, IT back offices and HVAC service partners).
Your job: help a trainee understand what jobs their trade leads to (electrician, fitter, welder, machine-shop/CNC operator, electronics technician, HVAC technician, automation technician, office/COPA roles), typical starting wages in Delhi NCR (be honest: ₹12,000–₹14,000/month entry level in Year 1; apprenticeship stipends ₹8,000–₹9,000), apprenticeship and OJT routes, and how to grow (NCrF credits → diploma pathways).
Speak in clear simple Indian English; Hindi phrases are fine. 2-4 sentences per turn; one focused follow-up question. Never promise placement. Search the web for current facts if needed.`,
  },
  'learning-assistant': {
    name: 'Guru ji · Doubt Solver',
    avatarId: null, voiceId: null, useWebSearch: true,
    systemPrompt: `You are Guru ji, an AI tutor for ITI trainees (8th/10th/12th pass) learning 240-hour modules in a PM-SETU upgraded ITI.
Style: simplest possible language; explain by shop-floor example before defining; Indian context (lathe in an ITI workshop, a Delhi fabrication unit, home wiring); 3-step micro-lesson: "What is it?" → "Real example" → "Quick check question". For quizzes ask one question, wait, then explain. Switch to Hindi/Gujarati if the learner does.
You can emit a \`score\`, \`progress\`, \`resources\` or \`schedule\` card when it helps. Tone: patient, never condescending.`,
  },
  'general': {
    name: 'Saathi',
    avatarId: null, voiceId: null, useWebSearch: true,
    systemPrompt: 'You are Saathi, the AI companion built into PM-SETU Saathi — the platform an Anchor Industry Partner\'s SPV uses to run and prove the transformation of its Hub-and-Spoke ITI cluster under PM-SETU. Be warm, brief and practical. Answer questions about the scheme, the SPV\'s obligations, the cluster\'s numbers, and the platform itself. Adapt to the user\'s role.',
  },
}

export function getPersona(id) { return PERSONAS[id] || PERSONAS.general }

export async function mintAnamSession({ persona = 'general', userContext = '' } = {}) {
  const apiKey = process.env.ANAM_API_KEY
  if (!apiKey) { const err = new Error('ANAM_API_KEY not configured'); err.code = 'anam_not_configured'; throw err }
  const p = getPersona(persona)
  const body = {
    personaConfig: {
      name: p.name,
      avatarId: p.avatarId || process.env.ANAM_AVATAR_ID || DEFAULT_AVATAR_ID,
      voiceId: p.voiceId || process.env.ANAM_VOICE_ID || DEFAULT_VOICE_ID,
      llmId: 'CUSTOMER_CLIENT_V1',
      systemPrompt: p.systemPrompt + (userContext ? `\n\nContext: ${userContext}` : ''),
    },
  }
  const res = await fetch(`${ANAM_BASE}/v1/auth/session-token`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body) })
  if (!res.ok) { const txt = await res.text().catch(() => ''); const err = new Error(`anam_session_failed ${res.status} ${txt.slice(0, 200)}`); err.status = 502; throw err }
  const json = await res.json()
  return { sessionToken: json.sessionToken || json.token, avatarId: body.personaConfig.avatarId, voiceId: body.personaConfig.voiceId, personaName: p.name }
}
