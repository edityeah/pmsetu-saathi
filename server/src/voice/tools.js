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
    { name: 'open_canvas', description: "Open a PM-SETU Saathi screen (and tab) in the user's UI, scoped to the ITI they named. Returns the live data shown on that screen so you can answer from it. Call it whenever the user asks to see, open, check, show or review something a screen covers, or asks a data question they would want to look at.", parameters: PARAMS(role) },
    { name: 'lookup_data', description: 'Read the live platform data behind a screen WITHOUT opening it. Use for quick numeric or status questions when the user did not ask to see the screen.', parameters: PARAMS(role) },
  ]
  if (flavour === 'chat') return defs.map(d => ({ type: 'function', function: { name: d.name, description: d.description, parameters: d.parameters } }))
  return defs.map(d => ({ type: 'function', name: d.name, description: d.description, parameters: d.parameters }))
}

// Backwards-compatible export used by older code paths.
export function toOpenAIToolDefs(role = 'spv_ceo') { return navToolDefs(role, 'realtime') }

export function toPersonaBriefing(role = 'spv_ceo') {
  return ['', '# UI orchestration — you can OPEN screens and READ live data', '',
    "Tools: `open_canvas(target, iti?, trade?, gender?, date?)` opens a screen and tab in the user's UI and returns its live data; `lookup_data(...)` returns the data without opening anything. When the user's request matches a target below, CALL THE TOOL — never just narrate. Speak naturally alongside the call, then fire it.", '',
    '## Targets (id — screen · tab (accepted filters). Example phrasings)', '', catalogBriefing(role), '',
    '## Strict rules',
    '- Two modes. Orchestration: the user asks to open, show, see or display a screen, dashboard, graph or list → call open_canvas and say in one line that you are showing it ("I am showing you today\'s attendance for Pusa"). Insight: the user asks a number or a status (how many, how much, is it working, what is remaining) → call lookup_data, answer the figure first in one or two sentences, then offer in one line to open the screen; open it only if they say yes or ask to see it. After an insight answer, offer ONE natural follow-up question.',
    '- [SCREEN DATA] notes carry the exact figures of the screen the user has open; when they ask about what they see, answer from those figures without a tool call.',
    '- Machines, workshops, labs or equipment "working" / "ready" today → ops_infrastructure (with the ITI). Courses, trades or programmes offered at an ITI → institute_trades. Rooms, labs, assets installed → institute_facilities. Student counts → registry_students; trainer counts → registry_trainers; money → budget_*; joins and placements → placement_analytics; employers and MoUs → employer_directory.',
    '- Every number you say about the cluster must come from the LIVE CLUSTER DATA in these instructions or from a tool result in this conversation. If you do not have it, call lookup_data first. Never quote remembered or approximate figures.',
    '- Pass the ITI the user named in `iti` (Pusa, Shahdara, Narela, Rohini, Okhla), including Hindi names.',
    "- Never announce \"I'll open X\" without immediately calling `open_canvas`. Don't read target ids aloud; speak the outcome (\"Infrastructure readiness for Pusa is open\").",
    "- If the user is already on that screen and asks about it, call lookup_data and answer — don't re-open it.",
  ].join('\n')
}
