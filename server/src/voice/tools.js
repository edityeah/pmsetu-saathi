// Voice and chat tools. Two tools, both resolved by /api/ai/navigate on the
// server so chat, voice and the dashboards agree on screens and numbers:
//   open_canvas(target, iti?, trade?, gender?, date?)  — opens a screen + tab
//   lookup_data(target, iti?, trade?, gender?, date?)  — live data, no UI change
// The target list comes from server/src/nav/catalog.js per role.
import { targetsForRole, catalogBriefing } from '../nav/catalog.js'

const PARAMS = (role) => ({
  type: 'object',
  properties: {
    target: { type: 'string', enum: targetsForRole(role).map(t => t.id), description: 'Target id from the catalogue (screen + tab).' },
    iti: { type: ['string', 'null'], description: 'ITI the user named: Pusa, Shahdara, Narela, Rohini, Okhla, or code PUS/SHA/NAR/ROH/OKH. Null for the whole cluster.' },
    trade: { type: ['string', 'null'], description: 'Trade code if named (ELE, FIT, COP, LWD, LMC, LTR, LSM, LRA, LEM, LMV, LDM, LST, CNC).' },
    gender: { type: ['string', 'null'], description: 'F or M when the user asks about women/female or men/male.' },
    date: { type: ['string', 'null'], description: 'YYYY-MM-DD when a specific day was named.' },
    category: { type: ['string', 'null'], description: 'Budget work-package category when named: Civil, Digital, Equipment, Faculty, Governance, Operations, Staff, Student industry.' },
  },
  required: ['target'],
  additionalProperties: false,
})

export function navToolDefs(role, flavour = 'realtime') {
  const defs = [
    { name: 'open_canvas', description: "Offer a PM-SETU Saathi screen (and tab) to the user, scoped to the ITI they named: an Open button for that screen and three follow-up questions appear in their chat, and the live data shown on that screen is returned so you can answer from it. The screen opens only when the user taps the button. Call it whenever the user asks to see, open, check, show or review something a screen covers.", parameters: PARAMS(role) },
    { name: 'lookup_data', description: 'Read the live platform data behind a screen to answer a numeric or status question. An Open button for that screen and three follow-up questions appear in the user\'s chat as well.', parameters: PARAMS(role) },
  ]
  if (flavour === 'chat') return defs.map(d => ({ type: 'function', function: { name: d.name, description: d.description, parameters: d.parameters } }))
  return defs.map(d => ({ type: 'function', name: d.name, description: d.description, parameters: d.parameters }))
}

// Backwards-compatible export used by older code paths.
export function toOpenAIToolDefs(role = 'spv_ceo') { return navToolDefs(role, 'realtime') }

export function toPersonaBriefing(role = 'spv_ceo') {
  return ['', '# UI orchestration — you can OPEN screens and READ live data', '',
    "Tools: `open_canvas(target, iti?, trade?, gender?, date?)` and `lookup_data(...)` both return the live data behind a screen and place an Open button plus three follow-up questions for that screen in the user's chat. Nothing opens by itself: the user taps the button when they want the screen. When the user's request matches a target below, CALL THE TOOL — never just narrate. Speak naturally alongside the call, then fire it.", '',
    '## Targets (id — screen · tab (accepted filters). Example phrasings)', '', catalogBriefing(role), '',
    '## Strict rules',
    '- Two modes. Orchestration: the user asks to open, show, see or display a screen, dashboard, graph or list → call open_canvas, give the one or two key figures from the returned data, and say in one line that the Open button for that screen is in their chat ("Today\'s attendance for Pusa is 91%; tap Open in the chat to see the registers"). Insight: the user asks a number or a status (how many, how much, is it working, what is remaining) → call lookup_data, answer the figure first in one or two sentences, then say in one line that the screen is a tap away. In both modes the chat already lists three follow-up questions; mention ONE of them naturally at the end.',
    '- [SCREEN DATA] system notes carry the exact figures of the screen the user has open, with its ITI, tab and filters; [SCREEN] notes describe the shared picture. When the user asks about what they see ("this", "here", "on my screen", a figure they point at), answer from the LATEST [SCREEN DATA] note first and the [SCREEN] note second, in that screen\'s scope. Do NOT call lookup_data for that: a lookup without the same ITI and filters returns cluster-wide figures that will not match the screen.',
    '- Machines, workshops, labs or equipment "working" / "ready" today → ops_infrastructure (with the ITI). Courses, trades or programmes offered at an ITI → institute_trades. Rooms, labs, assets installed → institute_facilities. Student counts → registry_students; trainer counts → registry_trainers; money → budget_*; joins and placements → placement_analytics; employers and MoUs → employer_directory.',
    '- Every number you say must come from a [SCREEN DATA] or [SCREEN] note, a tool result in this conversation, or the LIVE CLUSTER DATA in these instructions, in that order of preference when the user is looking at a screen. If you have none of these, call lookup_data with the ITI the user named or the one on their screen. Never quote remembered or approximate figures.',
    '- Pass the ITI the user named in `iti` (Pusa, Shahdara, Narela, Rohini, Okhla), including Hindi names.',
    "- Never say you are opening or showing a screen: you cannot open it, the user does. Don't read target ids aloud; speak the outcome (\"Infrastructure readiness for Pusa is ready to open from the chat\").",
    "- If the user is already on that screen and asks about it, answer from the [SCREEN DATA] note — don't re-open it and don't look it up again.",
  ].join('\n')
}
