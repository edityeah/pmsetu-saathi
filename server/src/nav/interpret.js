// Navigation intent: which target (screen + tab) the user wants, with the
// ITI, trade, gender or date they named. Used by the typed home box and as
// the shared resolver behind the chat and voice tools.
import { chatJSON, chatText, hasOpenAI } from '../llm/openai.js'
import { prisma } from '../db.js'
import { clusterFor, itiFor } from '../lib/scope.js'
import { targetsForRole, targetAllowed, TARGET_BY_ID, resolveIti, buildContext, catalogBriefing, tradeFromText, categoryFromText } from './catalog.js'
import { summaryFor } from './snapshot.js'

const SCHEMA = `{
  "target": "<target id or null>",
  "confidence": 0..1,
  "iti": "<ITI name or code the user mentioned, or null>",
  "trade": "<trade code if named (ELE, FIT, COP, LWD, LMC, LTR, LSM, LRA, LEM, LMV, LDM, LST, CNC), or null>",
  "gender": "<F|M|null>",
  "category": "<budget work-package category if named: Civil, Digital, Equipment, Faculty, Governance, Operations, Staff, Student industry; else null>",
  "date": "<YYYY-MM-DD if a specific day was named, or null>",
  "wantsAnswer": true|false,
  "assistantText": "<≤120 chars in the user's language: what you are opening / showing>",
  "language": "en" | "hi" | "...",
  "chips": ["<follow-up 1>", "<follow-up 2>"]
}`

// Keyword router: used when there is no OpenAI key and as a fallback when the
// model returns nothing. Scores each target by overlap with its phrasings.
const KEYWORDS = {
  ops_infrastructure: ['machine', 'machines', 'workshop', 'workshops', 'lab', 'labs', 'equipment', 'working', 'ready', 'readiness', 'usable', 'functional', 'infrastructure', 'मशीन', 'वर्कशॉप'],
  institute_trades: ['course', 'courses', 'trade offering', 'trades offered', 'trades', 'programme', 'programmes', 'offered', 'offer', 'कोर्स', 'ट्रेड'],
  institute_facilities: ['facilities', 'facility', 'rooms', 'asset', 'assets', 'installed', 'civil package'],
  institute_overview: ['profile', 'overview', 'about iti', 'tell me about', 'campus'],
  registry_students: ['student', 'students', 'enrolment', 'enrollment', 'female', 'women', 'girls', 'registry', 'छात्र', 'विद्यार्थी'],
  my_institute_batches: ['batch', 'batches', 'roster', 'at-risk', 'at risk'],
  registry_trainers: ['trainer', 'trainers', 'faculty', 'instructor', 'instructors', 'teacher', 'teachers', 'teach', 'teaches', 'who teaches', 'taught by', 'who takes', 'प्रशिक्षक', 'पढ़ाता', 'पढ़ाते'],
  ops_attendance: ['attendance', 'register', 'registers', 'present', 'absent', 'उपस्थिति', 'हाज़िरी', 'हाजिरी'],
  ops_assessment: ['assessment', 'assessments', 'marks', 'exam', 'test', 'results', 'practical check'],
  ops_events: ['event', 'events', 'upcoming', 'deadline', 'deadlines', 'calendar', 'due'],
  ops_overview: ['daily operations', 'today', 'operations', 'how is the day'],
  budget_utilisation: ['utilised', 'utilisation', 'utilization', 'spent', 'spend', 'tranche gate', 'uc', 'certificate'],
  budget_release_history: ['release history', 'releases', 'released', 'last release'],
  budget_overview: ['budget', 'allocation', 'allocated', 'fund', 'funds', 'money', 'aop', 'provided to', 'given to', 'बजट', 'फंड'],
  placement_analytics: ['placement', 'placements', 'placed', 'joined', 'joins', 'offer', 'offers', 'funnel', 'retention', 'प्लेसमेंट'],
  employer_directory: ['employer', 'employers', 'company', 'companies', 'mou', 'hiring', 'opportunity', 'opportunities', 'industry partner'],
  student_voice: ['student voice', 'students saying', 'barrier', 'barriers', 'complain', 'travel cost', 'themes'],
  grievances: ['grievance', 'grievances', 'complaint', 'complaints', 'शिकायत'],
  notifications: ['notification', 'notifications', 'alert', 'alerts', 'reminder', 'reminders'],
}
const ITI_WORDS = /\b(pusa|shahdara|narela|rohini|okhla|pus|sha|nar|roh|okh)\b|पूसा|शाहदरा|नरेला|रोहिणी|ओखला/i
const HI_ITI = { 'पूसा': 'Pusa', 'शाहदरा': 'Shahdara', 'नरेला': 'Narela', 'रोहिणी': 'Rohini', 'ओखला': 'Okhla' }
export function heuristicNavigation({ text, role }) {
  const t = String(text || '').toLowerCase()
  let best = null, bestScore = 0
  const P_MAP = role === 'iti_principal' ? { institute_overview: 'my_institute_profile', institute_trades: 'my_institute_trades', institute_facilities: 'my_institute_facilities', registry_students: 'my_institute_students', registry_trainers: 'my_institute_trainers' } : {}
  for (let [id, words] of Object.entries(KEYWORDS)) {
    id = P_MAP[id] || id
    if (!targetAllowed(id, role)) continue
    let score = 0
    for (const w of words) if (t.includes(w)) score += w.includes(' ') ? 3 : (w.length > 5 ? 2 : 1)
    if (score > bestScore) { best = id; bestScore = score }
  }
  // Legacy screens by label words ("open civil works").
  if (!best) for (const tg of targetsForRole(role)) { const l = tg.label.toLowerCase(); if ((l.length > 3 && t.includes(l)) || (tg.say || []).some(p => p.length > 4 && t.includes(p.toLowerCase()))) { best = tg.id; bestScore = 2; break } }
  if (!best) return null
  const m = t.match(ITI_WORDS)
  const iti = m ? (HI_ITI[m[0]] || m[0]) : null
  const gender = /\b(female|women|girls|ladki|महिला)\b/.test(t) ? 'F' : null
  return { target: best, confidence: Math.min(0.9, 0.5 + bestScore * 0.1), entities: { iti, trade: tradeFromText(t), gender, date: null, category: categoryFromText(t) }, wantsAnswer: /\?|how many|how much|kitn|is |are |what|which|who |kaun|kya|kitne|कितने|क्या|कौन/.test(t), assistantText: '', language: /[\u0900-\u097F]/.test(t) ? 'hi' : 'en', chips: [], heuristic: true }
}

export async function interpretNavigation({ text, role, language = 'en' }) {
  if (!hasOpenAI()) return heuristicNavigation({ text, role })
  const system = `You are Saathi's router for PM-SETU Saathi (role: ${role}). Decide which screen and tab answers the user's request, and pull out the entities they named.

TARGETS for this role (id — screen · tab (accepted filters). Example phrasings):
${catalogBriefing(role)}

Rules:
1. Pick the most specific target. Questions about machines, workshops, labs, equipment "working" or "ready" today → ops_infrastructure. Courses, trades, programmes offered at an ITI → institute_trades. Rooms, labs, assets installed at an ITI → institute_facilities. Counts of students → registry_students; trainers → registry_trainers. Money → budget_*. Joins, placements, offers → placement_analytics. Employers, MoUs, openings → employer_directory.
2. A question about data ("how many…", "is… working", "what is the attendance at…") is STILL a navigation to the screen that shows it; set wantsAnswer=true so the number is read out from live data.
3. Return target=null only for scheme/policy knowledge questions or chit-chat with no screen.
4. iti: copy the ITI the user named (Pusa, Shahdara, Narela, Rohini, Okhla, or a code). Hindi/transliterated names count (पूसा, शाहदरा, नरेला, रोहिणी, ओखला).
5. confidence 0.85+ only when the target is unambiguous. Strict JSON only.`
  const out = await chatJSON({ system, user: text, schemaHint: SCHEMA }).catch(() => null)
  if (!out) return heuristicNavigation({ text, role })
  const ok = out.target && targetAllowed(out.target, role)
  if (!ok) { const h = heuristicNavigation({ text, role }); if (h && h.confidence >= 0.7) return { ...h, assistantText: out.assistantText || '', chips: out.chips || [] } }
  return {
    target: ok ? out.target : null,
    confidence: ok ? clamp01(out.confidence ?? 0.7) : 0,
    entities: { iti: out.iti || null, trade: out.trade || tradeFromText(text), gender: out.gender || null, date: out.date || null, category: out.category || categoryFromText(text) },
    wantsAnswer: !!out.wantsAnswer,
    assistantText: out.assistantText || '',
    language: out.language || language,
    chips: Array.isArray(out.chips) ? out.chips.slice(0, 3) : [],
  }
}

// Resolve a target + entities into a canvas context and (optionally) the live
// data behind that screen. Shared by /api/ai/message, /api/ai/navigate and the
// streaming chat tool.
export async function resolveNavigation(req, { target, iti, trade, gender, date, year, category, withData = true }) {
  const role = req.user.role
  if (!targetAllowed(target, role)) return { error: `target ${target} is not available for ${role}` }
  const t = TARGET_BY_ID[target]
  const c = await clusterFor(req.user)
  const itis = await prisma.iti.findMany({ where: { clusterId: c.id }, select: { id: true, code: true, name: true } })
  let itiRow = iti ? resolveIti(iti, itis) : null
  if (role === 'iti_principal' || role === 'trainer') { const own = await itiFor(req.user); itiRow = own ? { id: own.id, code: own.code, name: own.name } : null } // always their own ITI
  const ent = { trade: trade || null, gender: gender || null, date: date || null, year: year || null, category: category || null }
  const canvas = buildContext(t, ent, itiRow)
  const filters = { itiId: itiRow?.id, itiCode: itiRow?.code, trade: ent.trade, gender: canvas.filters?.gender, date: ent.date, year: ent.year, category: ent.category }
  const data = withData ? await summaryFor(req, target, filters) : null
  return { target, label: t.label + (itiRow ? ` · ${itiRow.name}` : ''), canvas, iti: itiRow, data }
}

// Short spoken/typed answer from the live data for the screen being opened.
// Plain-language line from the data when no model is available.
export function templateAnswer(target, data, itiName) {
  if (!data || data.error) return null
  const where = itiName ? `${itiName}: ` : 'Across the cluster: '
  try {
    switch (target) {
      case 'ops_infrastructure': { const t = data.totals; const bad = (data.workshops || []).filter(w => w.status !== 'ready'); return `${where}${t.ready} of ${t.inScope} workshops are ready on ${data.date}, ${t.restricted} restricted and ${t.unavailable} unavailable${bad.length ? ` (${bad.map(w => `${w.name} ${w.status}`).join(', ')})` : ''}.` }
      case 'my_institute_trades': case 'institute_trades': return `${data.iti} offers ${data.coursesOffered} courses: ${(data.courses || []).map(c => `${c.name} (${c.enrolledNow ?? '—'} enrolled, ${c.runningBatches} batches)`).join(', ')}.`
      case 'my_institute_facilities': case 'institute_facilities': return `${data.iti}: ${data.rooms.working} of ${data.rooms.baseline} rooms working; ${data.machines.functional} of ${data.machines.total} machines functional, ${data.machines.awaitingCommissioning} awaiting commissioning, ${data.machines.ordered} ordered.`
      case 'my_institute_profile': case 'institute_overview': return `${data.iti.name} (${data.iti.kind}): ${data.students.active} active students (${data.students.women} women), ${data.staffing.registryTrainers} trainers, ${data.rooms.working} of ${data.rooms.baseline} rooms working, ${data.tasks.completed} of ${data.tasks.total} Year-1 tasks completed.`
      case 'my_institute_students': case 'registry_students': return data.filters?.gender ? `${where}${data.total} active ${data.filters.gender === 'F' ? 'female' : 'male'} students${data.byTrade?.length ? `, most in ${data.byTrade[0].name} (${data.byTrade[0].n})` : ''}.` : `${where}${data.total} active students (${data.gender?.female ?? '—'} female, ${data.gender?.male ?? '—'} male). ${data.coverage}.`
      case 'my_institute_trainers': case 'registry_trainers': return data.trade ? `${where}${data.total} ${data.trade} trainers: ${(data.trainers || []).map(x => x.name).join(', ')}${data.total > (data.trainers || []).length ? ' and more' : ''}.` : `${where}${data.total} trainers in the registry${data.byIti?.length > 1 ? ` (${data.byIti.map(i => `${i.code} ${i.n}`).join(', ')})` : ''}.`
      case 'ops_attendance': return `${where}attendance ${data.totals.attendancePct}% with ${data.totals.reported} of ${data.totals.scheduled} registers reported on ${data.date}${data.fallbackToLatestReportedDay ? ' (latest reported day)' : ''}.`
      case 'ops_assessment': return `${where}${data.totals.conducted} of ${data.totals.scheduled} assessments conducted on ${data.date}, ${data.totals.marksUploaded} with marks uploaded, ${data.totals.review} awaiting review.`
      case 'ops_overview': return `${where}attendance ${data.attendance.attendancePct}% (${data.attendance.coveragePct}% coverage) on ${data.date}; ${data.readiness.ready} of ${data.readiness.inScope} workshops ready; ${data.upcomingEvents} events in the next 30 days.`
      case 'ops_events': return `${data.totals.total} events between ${data.from} and ${data.to}: ${Object.entries(data.byKind || {}).map(([k, v]) => `${v} ${k}`).join(', ')}.`
      case 'budget_overview': return `${where}${data.category ? data.category + ' work packages: ' : ''}₹${data.totals.allocationCr} Cr allocated, ₹${data.totals.releasedCr} Cr released (${data.totals.releasedPct}%), balance ₹${data.totals.balanceCr} Cr.`
      case 'budget_release_history': return `${data.releases} releases so far; latest ${data.latest?.[0] ? `${data.latest[0].date} ₹${data.latest[0].amountCr} Cr to ${data.latest[0].iti} for ${data.latest[0].package}` : '—'}.`
      case 'budget_utilisation': return data.scope ? `${where}₹${data.totals.utilisedCr} Cr utilised of ₹${data.totals.releasedCr} Cr released (${data.totals.utilisedPct}%); ₹${data.totals.unspentReleaseCr} Cr released but unspent, ₹${data.totals.awaitingReleaseCr} Cr awaiting release.` : `₹${data.totals.utilisedCr} Cr utilised of ₹${data.totals.budgetCr} Cr (${data.totals.utilisedPct}%), ₹${data.totals.committedCr} Cr committed (${data.totals.committedPct}%); the tranche gate is 75%.`
      case 'placement_analytics': return `${where}${data.totals.reportedJoins} reported joins from a pool of ${data.totals.pool}, ${data.totals.employerConfirmed} employer-confirmed and ${data.totals.verifiedJoins} independently verified; ${data.totals.liveSeats} live opening seats.`
      case 'employer_directory': return `${data.employers} employers in the directory, ${data.activePartners} active partners, ${data.withMou} with an MoU, ${data.liveOpportunities} live opportunities.`
      case 'student_voice': return `${data.totals.events} companion events from ${data.totals.students} students in ${data.days} days; top themes ${(data.themes || []).slice(0, 3).map(t => `${t.theme} (${t.students})`).join(', ')}.`
      case 'grievances': return `${where}${data.totals.open} open cases, ${data.totals.overdue} overdue, ${data.totals.escalated} escalated, ${data.totals.resolvedThisMonth} resolved this month${data.openByCategory?.length ? `; most are ${data.openByCategory[0].category.replace(/_/g, ' ')} (${data.openByCategory[0].n})` : ''}.`
      case 'notifications': return `${data.total} notifications, ${data.unread} unread.`
      default: return null
    }
  } catch { return null }
}

export async function answerFromData({ question, label, data, language = 'en', target = null, itiName = null }) {
  if (!data || data.error) return null
  if (!hasOpenAI()) return templateAnswer(target, data, itiName)
  const system = `You are Saathi inside PM-SETU Saathi. The user asked a question and the screen "${label}" is being opened for them. Answer in at most two short sentences, in ${language === 'hi' ? 'Hindi' : 'the user\'s language'}, using ONLY the DATA below; quote the numbers exactly as given and name the ITI when one is in scope. If the data does not contain the answer, say what the screen shows instead. No markdown, no lists.\n\nDATA:\n${JSON.stringify(data).slice(0, 6000)}`
  return chatText({ system, user: question, temperature: 0.1 })
}

function clamp01(x) { return Math.max(0, Math.min(1, Number(x) || 0)) }
