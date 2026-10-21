// Career counselling for ITI trainees — the Disha approach (progressive
// profile, a psychometric assessment, a structured report) rebuilt around
// what an ITI student actually has: a trade, a batch, an attendance and
// marks record, practicals, cluster courses, cluster employers and the
// companion role map. Nothing generic: every pathway names a cluster option.
import { openai, chatJSON, hasOpenAI } from './openai.js'

// ── Profile fields and weights ───────────────────────────────────────────────
// Three blocks add to 100: the ITI record (30, filled automatically), the
// assessment (30), and what the student tells Karuna (40). The full career
// report unlocks at 70, so a student who has taken the assessment and told
// Karuna a little gets a report; the record alone does not.
export const RECORD_FIELDS = [
  { key: 'current_stage', label: 'Where you are', weight: 6 },
  { key: 'trade', label: 'Trade and batch', weight: 6 },
  { key: 'attendance', label: 'Attendance', weight: 6 },
  { key: 'marks', label: 'Marks so far', weight: 6 },
  { key: 'practicals', label: 'Practicals demonstrated', weight: 6 },
]
export const CHAT_FIELDS = [
  { key: 'career_direction', type: 'array', label: 'Roles you are considering', weight: 4, probe: 'Which roles after the course are you thinking about, even loosely?' },
  { key: 'skills_claimed', type: 'array', label: 'Skills you say you have', weight: 3, probe: 'What have you repaired, built or wired outside class that you are proud of?' },
  { key: 'strengths', type: 'array', label: 'Strengths', weight: 3, probe: 'What do trainers or friends say you are good at in the workshop?' },
  { key: 'gaps', type: 'array', label: 'Gaps you want to close', weight: 3, probe: 'Which topic or tool still feels shaky?' },
  { key: 'values_motivations', type: 'string', label: 'What drives you', weight: 3, probe: 'What matters more right now: money soon, learning deeply, or a stable government-type job?' },
  { key: 'work_preferences', type: 'string', label: 'Work preferences', weight: 3, probe: 'Site work with travel, a fixed workshop, or a service desk: which suits you?' },
  { key: 'financial_runway', type: 'string', label: 'Money situation', weight: 3, probe: 'Do you need a stipend from the first month, or can you wait a few months for a better role?' },
  { key: 'geographical_mobility', type: 'string', label: 'Where you can work', weight: 3, probe: 'Can you work anywhere in Delhi NCR, or only near home? Would you move to another city?' },
  { key: 'family_social', type: 'string', label: 'Family context', weight: 2, probe: 'What does your family expect from this course?' },
  { key: 'time_urgency', type: 'string', label: 'How soon you need a result', weight: 2, probe: 'By when do you need to be earning?' },
  { key: 'goal_3_months', type: 'string', label: 'Goal in 3 months', weight: 2, probe: 'What would make the next three months a success?' },
  { key: 'goal_3_years', type: 'string', label: 'Goal in 3 years', weight: 2, probe: 'Where do you see yourself in three years?' },
  { key: 'success_description', type: 'string', label: 'What success looks like', weight: 2, probe: 'Describe a good day at work five years from now.' },
  { key: 'avoidance', type: 'string', label: 'What you want to avoid', weight: 2, probe: 'What kind of work would you refuse even if it paid well?' },
  { key: 'role_models', type: 'array', label: 'People you admire', weight: 1, probe: 'Is there someone in your trade or family whose career you admire?' },
  { key: 'self_confidence', type: 'string', label: 'Confidence', weight: 1, probe: 'How confident do you feel about getting a job after this course?' },
  { key: 'emotional_state', type: 'string', label: 'How you feel about it', weight: 1 },
]
export const ASSESSMENT_WEIGHT = 30
export const FULL_REPORT_THRESHOLD = 70

export function completeness(profile = {}, record = {}) {
  const parts = { record: 0, assessment: 0, conversation: 0 }
  for (const f of RECORD_FIELDS) if (record[f.key] != null && record[f.key] !== '') parts.record += f.weight
  if (profile.psychometric_profile?.holland_code) parts.assessment = ASSESSMENT_WEIGHT
  for (const f of CHAT_FIELDS) { const v = profile[f.key]; if (Array.isArray(v) ? v.length : (v != null && String(v).trim())) parts.conversation += f.weight }
  const total = Math.round(parts.record + parts.assessment + parts.conversation)
  return { ...parts, total, threshold: FULL_REPORT_THRESHOLD, reportUnlocked: total >= FULL_REPORT_THRESHOLD }
}

export function nextProbes(profile = {}, n = 3) {
  return CHAT_FIELDS.filter(f => f.probe && !(Array.isArray(profile[f.key]) ? profile[f.key].length : profile[f.key])).slice(0, n).map(f => f.probe)
}

// ── Extractor: what the student told Karuna this turn ────────────────────────
export async function extractCareerDelta({ profile, userText, assistantText }) {
  if (!hasOpenAI()) return {}
  const schema = CHAT_FIELDS.map(f => `  "${f.key}"?: ${f.type === 'array' ? 'string[]' : 'string'}  // ${f.label}`).join('\n')
  const out = await chatJSON({
    system: `You extract structured facts an ITI student states in a career-counselling chat. Return ONLY a JSON object of NEW or UPDATED fields from the latest user turn. Array fields: return the full updated array (existing + new, deduped, short items). Never invent; omit anything the student did not say. Output {} if nothing new.`,
    user: `Schema:\n{\n${schema}\n}\n\nCurrent profile:\n${JSON.stringify(Object.fromEntries(CHAT_FIELDS.map(f => [f.key, profile[f.key]]).filter(([, v]) => v != null)))}\n\nStudent said:\n${userText}\n\nKaruna replied:\n${String(assistantText || '').slice(0, 1200)}\n\nReturn the JSON delta.`,
  }).catch(() => null)
  if (!out || typeof out !== 'object') return {}
  const delta = {}
  for (const f of CHAT_FIELDS) {
    if (!(f.key in out) || out[f.key] == null) continue
    const v = out[f.key]
    if (f.type === 'array') { const inc = (Array.isArray(v) ? v : [v]).map(x => typeof x === 'string' ? x : JSON.stringify(x)).filter(Boolean); const ex = Array.isArray(profile[f.key]) ? profile[f.key] : []; const seen = new Set(); delta[f.key] = [...ex, ...inc].filter(x => { const k = x.toLowerCase().trim(); if (seen.has(k)) return false; seen.add(k); return true }) }
    else if (typeof v === 'string' && v.trim()) delta[f.key] = v.trim()
  }
  return delta
}

// ── Assessment items: ITI activities, not abstract pictures ─────────────────
// Interest: 24 activities, four per RIASEC code, rated 1–5. Personality: ten
// statement pairs, two per Big-5 trait, five positions from left to right.
export const INTEREST_ITEMS = [
  { id: 'I_R_1', c: 'R', icon: '🔧', text: 'Strip down a motor, find the fault and put it back together' },
  { id: 'I_R_2', c: 'R', icon: '⚡', text: 'Wire a distribution board from a drawing and test it live' },
  { id: 'I_R_3', c: 'R', icon: '🏗️', text: 'Install equipment on a site with a team, in the heat, on a deadline' },
  { id: 'I_R_4', c: 'R', icon: '🧰', text: 'Service air conditioners or machines on a maintenance round' },
  { id: 'I_I_1', c: 'I', icon: '📐', text: 'Measure a part precisely and work out why it is out of tolerance' },
  { id: 'I_I_2', c: 'I', icon: '🔍', text: 'Read a circuit and trace where the signal is being lost' },
  { id: 'I_I_3', c: 'I', icon: '🤖', text: 'Program a CNC machine or a PLC and test the result' },
  { id: 'I_I_4', c: 'I', icon: '📊', text: 'Keep a log of machine readings and spot a pattern before a failure' },
  { id: 'I_A_1', c: 'A', icon: '✏️', text: 'Draw a layout or a fabrication design on paper or CAD' },
  { id: 'I_A_2', c: 'A', icon: '🎨', text: 'Finish a product so it looks good, not just works' },
  { id: 'I_A_3', c: 'A', icon: '📹', text: 'Make a short video showing how to do a repair step by step' },
  { id: 'I_A_4', c: 'A', icon: '🪚', text: 'Build something of your own design in the workshop' },
  { id: 'I_S_1', c: 'S', icon: '🧑‍🏫', text: 'Teach a junior how to use a tool safely' },
  { id: 'I_S_2', c: 'S', icon: '🤝', text: 'Visit a customer, listen to the problem and explain the fix' },
  { id: 'I_S_3', c: 'S', icon: '🏥', text: 'Work in a hospital or school keeping equipment running for people' },
  { id: 'I_S_4', c: 'S', icon: '🗣️', text: 'Settle a disagreement in your team on how a job should be done' },
  { id: 'I_E_1', c: 'E', icon: '🏪', text: 'Run your own repair or fabrication shop one day' },
  { id: 'I_E_2', c: 'E', icon: '📋', text: 'Lead a crew of four on a site and take responsibility for the day' },
  { id: 'I_E_3', c: 'E', icon: '💬', text: 'Convince a contractor to give your team the work' },
  { id: 'I_E_4', c: 'E', icon: '💰', text: 'Quote a price for a job and negotiate it' },
  { id: 'I_C_1', c: 'C', icon: '📦', text: 'Keep the tool store and stock register exact' },
  { id: 'I_C_2', c: 'C', icon: '🧾', text: 'Fill job cards, checklists and quality records every day' },
  { id: 'I_C_3', c: 'C', icon: '💻', text: 'Enter data and prepare reports on a computer' },
  { id: 'I_C_4', c: 'C', icon: '✅', text: 'Follow a fixed procedure exactly, every time, without shortcuts' },
]
export const PERSONALITY_ITEMS = [
  { id: 'P_O_1', c: 'O', left: 'I like trying a new tool or method even if it might not work', right: 'I prefer the method I already know works' },
  { id: 'P_O_2', c: 'O', left: 'New machines and ideas excite me', right: 'I would rather master one thing fully' },
  { id: 'P_C_1', c: 'C', left: 'I finish a job to the end and clean up after', right: 'I lose interest once the main part is done' },
  { id: 'P_C_2', c: 'C', left: 'I plan the steps before I start', right: 'I start and figure it out as I go' },
  { id: 'P_E_1', c: 'E', left: 'I enjoy working with a noisy group', right: 'I do my best work alone and quiet' },
  { id: 'P_E_2', c: 'E', left: 'I speak up first in a group', right: 'I wait and listen before I say anything' },
  { id: 'P_A_1', c: 'A', left: 'I help a classmate even when I am behind', right: 'I focus on my own work first' },
  { id: 'P_A_2', c: 'A', left: 'I avoid arguments and find a middle way', right: 'I say what I think even if it causes friction' },
  { id: 'P_N_1', c: 'N', left: 'Before an exam or interview I get very tense', right: 'I stay calm before an exam or interview' },
  { id: 'P_N_2', c: 'N', left: 'A mistake at work stays with me for days', right: 'I correct a mistake and move on' },
]
export const RIASEC_NAMES = { R: 'Realistic (hands-on)', I: 'Investigative (figuring out)', A: 'Artistic (designing, making)', S: 'Social (helping, teaching)', E: 'Enterprising (leading, selling)', C: 'Conventional (organising, records)' }
export const BIG5_NAMES = { O: 'Openness', C: 'Conscientiousness', E: 'Extraversion', A: 'Agreeableness', N: 'Emotional sensitivity' }

const sten = pct => Math.max(1, Math.min(10, Math.round(pct * 9 + 1)))
const label = s => s <= 2 ? 'very low' : s <= 4 ? 'low' : s <= 6 ? 'mid' : s <= 8 ? 'high' : 'very high'

export function scoreAssessment(responses) {
  const iRaw = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 }, iN = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 }
  const pRaw = { O: 0, C: 0, E: 0, A: 0, N: 0 }, pN = { O: 0, C: 0, E: 0, A: 0, N: 0 }
  for (const r of responses) {
    const it = INTEREST_ITEMS.find(x => x.id === r.itemId)
    if (it) { const s = Number(r.value); if (s >= 1 && s <= 5) { iRaw[it.c] += s; iN[it.c]++ } ; continue }
    const p = PERSONALITY_ITEMS.find(x => x.id === r.itemId)
    if (p) { const pos = Number(r.value); if (pos >= 1 && pos <= 5) { pRaw[p.c] += 3 - pos; pN[p.c]++ } }
  }
  const riasec = {}; for (const c of Object.keys(iRaw)) { const mean = iN[c] ? iRaw[c] / iN[c] : 1; const s = sten((mean - 1) / 4); riasec[c] = { sten: s, label: label(s), name: RIASEC_NAMES[c], items: iN[c] } }
  const big5 = {}; for (const c of Object.keys(pRaw)) { const mean = pN[c] ? pRaw[c] / pN[c] : 0; const s = sten((mean + 2) / 4); big5[c] = { sten: s, label: label(s), name: BIG5_NAMES[c], items: pN[c] } }
  const order = Object.keys(riasec).sort((a, b) => riasec[b].sten - riasec[a].sten || iRaw[b] - iRaw[a])
  const vals = responses.map(r => Number(r.value)).filter(Number.isFinite)
  const mean = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length)
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, vals.length))
  const extreme = vals.filter(v => v === 1 || v === 5).length / Math.max(1, vals.length)
  return { completed_at: new Date().toISOString(), items: responses.length, riasec, big5, holland_code: order.slice(0, 3).join(''), top: order.slice(0, 2).map(c => RIASEC_NAMES[c]), flags: { high_acquiescence: mean > 4.2, high_extreme: extreme > 0.7, low_variability: sd < 0.6 } }
}

// ── Readiness: five dimensions scored from the record, the profile and activity ─
export function readiness({ record, profile, activity }) {
  const has = k => Array.isArray(profile[k]) ? profile[k].length > 0 : !!profile[k]
  const dims = [
    { key: 'self_awareness', label: 'Self-awareness', score: Math.min(100, (profile.psychometric_profile ? 50 : 0) + ['strengths', 'gaps', 'values_motivations', 'work_preferences', 'avoidance'].filter(has).length * 10), why: profile.psychometric_profile ? 'Assessment done; strengths and preferences stated' : 'Take the assessment to see your interest and personality profile' },
    { key: 'exploration', label: 'Career exploration', score: Math.min(100, (has('career_direction') ? 40 : 0) + Math.min(30, (activity.careerEvents || 0) * 10) + (activity.opportunitiesViewed ? 30 : 0)), why: has('career_direction') ? 'You have named roles you are considering' : 'Name two or three roles you are weighing' },
    { key: 'decision', label: 'Decision-making', score: Math.min(100, ['goal_3_months', 'goal_3_years', 'success_description', 'financial_runway', 'geographical_mobility'].filter(has).length * 20), why: 'Goals and constraints make a decision possible' },
    { key: 'action', label: 'Action-planning', score: Math.min(100, (activity.resume ? 30 : 0) + Math.min(40, (activity.applications || 0) * 20) + (activity.docsVerified >= 2 ? 30 : 0)), why: `${activity.applications || 0} applications, résumé ${activity.resume ? 'drafted' : 'not started'}, ${activity.docsVerified || 0} verified documents` },
    { key: 'resilience', label: 'Resilience', score: Math.min(100, (record.attendance != null ? Math.round(record.attendance) : 0) * 0.6 + (record.marks != null ? Math.round(record.marks) * 0.4 : 0)), why: `Attendance ${record.attendance ?? '—'}% and marks ${record.marks ?? '—'}% show how you keep going` },
  ]
  return dims.map(d => ({ ...d, score: Math.round(d.score) }))
}

// ── Report synthesis: grounded in the trade, the record, the KB and live cluster options ─
export async function synthCareerReport({ record, profile, psych, roles, opportunities, programmes, readinessDims, name }) {
  const base = {
    title: `Career report · ${name}`, generatedAt: new Date().toISOString(),
    snapshot: { name, stage: record.current_stage, trade: record.trade, batch: record.batch, iti: record.iti, attendance: record.attendance, marks: record.marks, practicals: record.practicals, modulesDone: record.modulesDone },
    interests: psych ? Object.entries(psych.riasec).map(([k, v]) => ({ key: k, name: v.name, sten: v.sten, level: v.label })) : null,
    personality: psych ? Object.entries(psych.big5).map(([k, v]) => ({ key: k, name: v.name, sten: v.sten, level: v.label })) : null,
    hollandCode: psych?.holland_code || null,
    readiness: readinessDims,
    options: { apprenticeships: opportunities.filter(o => o.type !== 'wage').slice(0, 4), wageRoles: opportunities.filter(o => o.type === 'wage').slice(0, 4), programmes: programmes.slice(0, 4), roles: roles.slice(0, 4) },
  }
  const ctx = `Student: ${name}. ${record.trade || 'Trade not set'} at ${record.iti}, ${record.current_stage}. Attendance ${record.attendance ?? '—'}%, marks ${record.marks ?? '—'}%, ${record.practicals ?? 0} practicals demonstrated, ${record.modulesDone ?? 0} modules done.
Profile: ${JSON.stringify(Object.fromEntries(CHAT_FIELDS.map(f => [f.key, profile[f.key]]).filter(([, v]) => v != null && (Array.isArray(v) ? v.length : true))))}
Assessment: ${psych ? `Holland ${psych.holland_code}; RIASEC ${Object.entries(psych.riasec).map(([k, v]) => `${k}=${v.sten}`).join(' ')}; Big-5 ${Object.entries(psych.big5).map(([k, v]) => `${k}=${v.sten}`).join(' ')}` : 'not taken'}
Roles for this trade (companion KB): ${roles.map(r => `${r.roleName}: ${r.summary}; progression ${r.progression}; entry ${r.entryPathway}`).join(' | ') || 'none'}
Live opportunities for this trade in the cluster: ${opportunities.map(o => `${o.title} at ${o.employer} (${o.type}${o.pay ? ', ' + o.pay : ''}, ${o.location})`).join(' | ') || 'none right now'}
Programmes after experience: ${programmes.map(p => `${p.title} (${p.verified ? 'approved' : 'entry facts to confirm'})`).join(' | ') || 'none'}
Readiness: ${readinessDims.map(d => `${d.label} ${d.score}`).join(', ')}`
  if (!hasOpenAI()) {
    return { ...base, summary: `${name} is ${/^[AEIOU]/i.test(record.trade || 'ITI') ? 'an' : 'a'} ${record.trade || 'ITI'} trainee at ${record.iti} with ${record.attendance ?? '—'}% attendance and ${record.marks ?? '—'}% average marks.${psych ? ` The assessment points to ${psych.top.join(' and ')} interests (Holland ${psych.holland_code}).` : ''}`, pathways: [
      { title: 'Apprenticeship or OJT first', fit: 'Builds verified experience while earning a stipend; the usual first step from this trade.', options: base.options.apprenticeships.map(o => `${o.title} at ${o.employer}`), caution: 'Stipend, not wage; confirm the start date before leaving a batch.' },
      { title: 'Wage role in the trade', fit: 'For a student who needs income now and already has strong practicals.', options: base.options.wageRoles.map(o => `${o.title} at ${o.employer}`), caution: 'An offer is not a join; keep evidence.' },
      { title: 'Build on the trade with a programme', fit: 'After experience, a short programme or a new specialist course in the cluster opens the next role.', options: base.options.programmes.map(p => p.title), caution: 'Entry facts need confirming where marked.' },
    ], nextActions: ['Keep attendance above 80% this month', 'Add one stated project to the résumé and ask a trainer to verify it', 'Express interest in one live opportunity for your trade'], humanHelp: 'Ask your trainer for a mock interview before the first application.', source: 'template' }
  }
  const out = await chatJSON({
    system: `You are Karuna, career counsellor for ITI trainees in a PM-SETU cluster. Write the report for THIS student only from the facts given. Pathways must name the concrete cluster options supplied (employers, programmes, roles); never invent an employer, wage or guarantee. Plain Indian English, second person, short sentences. Return strict JSON:
{
  "summary": "3-4 sentences: who the student is, what the record and assessment say, the direction that fits",
  "interestNarrative": "2-3 sentences on the RIASEC/Big-5 pattern and what it means for shop-floor vs service vs office work (or say the assessment is pending)",
  "pathways": [ { "title": "...", "fit": "why this fits (record + profile + assessment)", "options": ["concrete option from the list"], "firstStep": "one action", "caution": "one honest caveat" } ],   // exactly 3, ordered best fit first; apprenticeship/OJT, wage role, and study/upskilling should each be considered
  "nextActions": ["action in the next 30 days", "...", "..."],   // exactly 3, each checkable
  "humanHelp": "one sentence on when to ask a trainer, the placement cell or a counsellor",
  "readinessNote": "one sentence on the weakest readiness dimension and how to lift it"
}`,
    user: ctx,
  }).catch(() => null)
  if (!out) return synthCareerReport({ record, profile, psych: null, roles, opportunities, programmes, readinessDims, name, _force: true })
  return { ...base, summary: out.summary, interestNarrative: out.interestNarrative, pathways: (out.pathways || []).slice(0, 3), nextActions: (out.nextActions || []).slice(0, 3), humanHelp: out.humanHelp, readinessNote: out.readinessNote, source: 'model' }
}
