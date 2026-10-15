// Navigation catalog — the one list of screens, tabs and filters that chat,
// streaming chat and voice can open. Every target names the canvas it opens,
// the tab inside it, which entities it accepts (ITI, trade, gender, date) and
// example phrasings. Role lists keep a trainee out of the budget and keep the
// CEO on the six-section home instead of the older operations screens.
import { ACTIONS } from '../llm/catalog.js'

const ANALYST = ['spv_ceo', 'ima_officer', 'state_pmu']
const ANALYST_P = ['spv_ceo', 'iti_principal', 'ima_officer', 'state_pmu']

// Section targets (the CEO's six sections; the principal shares most of them).
const SECTION_TARGETS = [
  // 1 · Budget analytics
  { id: 'budget_overview', canvas: 'budget_analytics', tab: 'overview', label: 'Budget analytics · Allocations and releases', roles: ANALYST, params: ['iti', 'year', 'category'], say: ['budget', 'how much has been allocated', 'funds released to Narela', 'how much fund has been provided to Shahdara for civil', 'AOP allocation by ITI', 'release by work package'] },
  { id: 'budget_release_history', canvas: 'budget_analytics', tab: 'history', label: 'Budget analytics · Release history', roles: ANALYST, params: ['iti', 'year', 'category'], say: ['release history', 'every release', 'when was the last release', 'list the releases to Rohini'] },
  { id: 'budget_utilisation', canvas: 'budget_analytics', tab: 'utilisation', label: 'Budget analytics · Utilisation', roles: ANALYST, params: ['year'], say: ['funds utilised', 'utilisation against the 75% gate', 'how much have we spent', 'utilisation certificates'] },
  // 2 · Institute profile
  { id: 'institute_overview', canvas: 'institute_profile', tab: 'overview', label: 'Institute profile · Overview', roles: ANALYST_P, params: ['iti'], say: ['institute profile', 'tell me about ITI Okhla', 'overview of Pusa', 'how many students and trainers at Shahdara', 'campus and rooms'] },
  { id: 'institute_trades', canvas: 'institute_profile', tab: 'trades', label: 'Institute profile · Trade offerings', roles: ANALYST_P, params: ['iti'], say: ['courses offered at Shahdara', 'which trades does Narela run', 'trade offerings', 'places and enrolments by course', 'how many courses'] },
  { id: 'institute_facilities', canvas: 'institute_profile', tab: 'infrastructure', label: 'Institute profile · Facilities and labs', roles: ANALYST_P, params: ['iti'], say: ['facilities and labs at Pusa', 'asset register', 'machines installed at Rohini', 'civil packages at the ITI', 'rooms and labs'] },
  { id: 'institute_staffing', canvas: 'institute_profile', tab: 'staffing', label: 'Institute profile · Staffing', roles: ['iti_principal', 'ima_officer'], params: ['iti'], say: ['staffing tab', 'trainer plan'] },
  { id: 'institute_launch_gates', canvas: 'institute_profile', tab: 'launch_gates', label: 'Institute profile · Launch gates', roles: ['iti_principal', 'ima_officer'], params: ['iti'], say: ['launch gates', 'is the welding course ready to launch'] },
  // 3 · Cluster registry
  { id: 'registry_students', canvas: 'cluster_registry', tab: 'students', label: 'Cluster registry · Student registry', roles: ANALYST_P, params: ['iti', 'trade', 'gender'], say: ['student registry', 'how many students in Narela', 'female students', 'list electrician students', 'enrolment by trade'] },
  { id: 'registry_trainers', canvas: 'cluster_registry', tab: 'trainers', label: 'Cluster registry · Trainer registry', roles: ANALYST_P, params: ['iti', 'trade'], say: ['trainer registry', 'how many trainers at Okhla', 'faculty by programme', 'who teaches welding', 'who teaches the electrician course in Shahdara', 'which instructors take fitter batches'] },
  // 4 · Daily operations
  { id: 'ops_overview', canvas: 'daily_operations', tab: 'overview', label: 'Daily operations · Overview', roles: ANALYST_P, params: ['iti', 'date'], say: ['daily operations', 'how is today going', 'operations overview', 'what happened today across the ITIs'] },
  { id: 'ops_attendance', canvas: 'daily_operations', tab: 'attendance', label: 'Daily operations · Attendance', roles: ANALYST_P, params: ['iti', 'trade', 'date'], say: ['attendance today', 'attendance at Rohini', 'which registers are pending', 'attendance trend'] },
  { id: 'ops_assessment', canvas: 'daily_operations', tab: 'assessment', label: 'Daily operations · Assessment', roles: ANALYST_P, params: ['iti', 'trade', 'date'], say: ['assessments today', 'marks awaiting review', 'practical checks conducted', 'results by trade'] },
  { id: 'ops_infrastructure', canvas: 'daily_operations', tab: 'infrastructure', label: 'Daily operations · Infrastructure readiness', roles: ANALYST_P, params: ['iti', 'trade', 'date'], say: ['are the machines working at Pusa', 'which workshops are ready', 'lab readiness', 'equipment status today', 'which labs are unavailable', 'is the welding shop usable'] },
  { id: 'ops_events', canvas: 'daily_operations', tab: 'events', label: 'Daily operations · Upcoming events', roles: ANALYST_P, params: ['iti'], say: ['upcoming events', 'what is due this month', 'IMA deadlines', 'employer visits coming up'] },
  // 5 · Placement analytics
  { id: 'placement_analytics', canvas: 'placement_pipeline', tab: null, label: 'Placement analytics', roles: ANALYST_P, params: ['iti', 'trade'], say: ['placement pipeline', 'how many joined', 'placement funnel', 'verified placements', 'retention after joining', 'placements from Shahdara'] },
  { id: 'employer_directory', canvas: 'employer_register', tab: null, label: 'Employer directory', roles: ['spv_ceo', 'iti_principal', 'employer'], params: [], say: ['employer directory', 'which employers are active', 'MoU status', 'live opportunities', 'who is hiring welders'] },
  // 6 · Support and alerts
  { id: 'student_voice', canvas: 'student_voice', tab: null, label: 'Student voice', roles: ['spv_ceo', 'iti_principal', 'ima_officer'], params: ['iti'], say: ['student voice', 'what are students saying', 'barriers students face', 'travel cost complaints'] },
  { id: 'grievances', canvas: 'grievances_admin', tab: null, label: 'Grievances', roles: ['spv_ceo', 'iti_principal'], params: ['iti'], say: ['grievances', 'open complaints', 'grievance register'] },
  { id: 'notifications', canvas: 'notifications', tab: null, label: 'Notifications and alerts', roles: ['*'], params: [], say: ['notifications', 'alerts', 'any reminders', 'IMA queries'] },
]

// Screens the six sections replaced for the CEO; the CEO never navigates there.
const CEO_HIDDEN = new Set(['machines_infra', 'iti_dashboard', 'cluster_operations', 'institute_today', 'daily_ops', 'support_queue', 'batches', 'field_visit', 'sip_budget', 'placements_cluster', 'ojt_tracker', 'attendance_bot', 'assessments', 'institute_profile', 'student_voice', 'grievances_admin', 'notifications', 'placement_pipeline', 'employer_register'])
const SECTION_CANVASES = new Set(SECTION_TARGETS.map(t => t.canvas))

const LEGACY_SAY = {
  cluster_home: ['cluster home', 'how are the five ITIs doing', 'year one envelope'], five_year_targets: ['five year targets', 'enrolment plan by year', 'KPI trajectory'], annual_plan: ['annual plan', 'year one workplan', 'assign a task'], milestone_board: ['milestone board', 'what is overdue', 'blocked tasks', 'change requests'], my_commitments: ['my commitments', 'my batches and subjects'],
  transformation_dashboard: ['transformation dashboard', 'KPI overview'], tranche_readiness: ['are we ready for the next tranche', 'fund release conditions', 'cost-weighted KPI score'], sip_budget: ['SIP budget by category'], civil_works: ['civil works', 'lab construction', 'which works are delayed'], procurement: ['procurement', 'equipment packages', 'tender status'], finance_escrow: ['escrow balance', 'who has deposited'], milestones: ['milestones for IMA', 'submit evidence'], reports: ['quarterly report', 'IMA pack', 'AOP'], board_matters: ['board agenda', 'reserved matters'],
  trainer_my_day: ['my day', 'pending attendance'], attendance_bot: ['mark attendance', 'submit the register'], assessments: ['enter marks', 'scan the mark sheet'], practical_bot: ['record a practical'], field_visit: ['start a workshop visit'], daily_ops: ['raise an issue', 'machine is broken'], institute_today: ['institute today', 'which classes have not reported'], cluster_operations: ['cluster operations', 'coverage by ITI'], support_queue: ['support queue', 'students at risk'], iti_dashboard: ['my ITI dashboard'], machines_infra: ['machine status', 'which machines are not working'], batches: ['show batches', 'batch roster'], module_plan: ['lesson plan'],
  what_i_know: ['what do you know about me', 'my attendance', 'my marks'], my_plan: ['my plan', 'upcoming tests'], applications: ['my applications', 'did I get the job'], help_from_institute: ['ask my trainer', 'I need help'], job_prep: ['prepare my résumé', 'mock interview'], companion_kb: ['companion knowledge base'], my_course: ['open my course', 'continue learning'], doubt_solver: ['I have a doubt', 'explain this topic'], course_selection: ['which trade should I pick'], career_counsellor: ['career guidance', 'what jobs after this trade'], ojt_logbook: ['log my OJT hours'], placement_confirm: ['I got the job', 'I joined'], on_job_buddy: ['check in about my job'], jobs: ['show job openings', 'apprenticeships for my trade'], grievance: ['file a grievance'],
  for_my_batches: ['placement for my batches', 'résumé review'], placements_cluster: ['joined records', 'sample placements'], ojt_tracker: ['OJT status', 'mentor sign-off'], confirm_hire: ['confirm hires', 'confirm joining'], post_opening: ['post a job', 'we need electricians'],
  verification_queue: ['what needs verification'], kpi_audit: ['audit the KPIs'], report_review: ['review the quarterly report'], course_builder: ['edit the module', 'build a course'], ncvet_pipeline: ['approval status', 'NCVET review'], state_scorecard: ['state scorecard', 'compare clusters'],
}

const LEGACY_TARGETS = Object.entries(ACTIONS).filter(([id, a]) => id !== 'ANSWER_QUESTION' && a.module).map(([id, a]) => {
  let roles = a.roles
  if (SECTION_CANVASES.has(a.module)) roles = roles.filter(r => r !== 'spv_ceo' && r !== 'iti_principal' && r !== 'ima_officer' && r !== 'state_pmu')
  // The CEO navigates only within the six sections.
  roles = roles.filter(r => r !== 'spv_ceo')
  return { id: a.module, canvas: a.module, tab: null, label: a.description.split(':')[0], roles, params: ['iti'], say: LEGACY_SAY[a.module] || [], legacy: true, actionId: id }
}).filter(t => t.roles.length)

export const NAV_TARGETS = [...SECTION_TARGETS, ...LEGACY_TARGETS]
export const TARGET_BY_ID = Object.fromEntries(NAV_TARGETS.map(t => [t.id, t]))

export function targetsForRole(role) {
  return NAV_TARGETS.filter(t => t.roles.includes('*') || t.roles.includes(role))
}
export function targetAllowed(id, role) {
  const t = TARGET_BY_ID[id]
  return !!t && (t.roles.includes('*') || t.roles.includes(role))
}

// ITI name resolution: "pusa", "ITI Shahdara", "Government ITI Narela", codes.
export function resolveIti(text, itis) {
  if (!text) return null
  const s = String(text).toLowerCase().replace(/government|govt\.?|iti|institute|^\s+|\s+$/g, '').trim()
  if (!s) return null
  for (const i of itis) {
    const name = i.name.toLowerCase().replace(/government|govt\.?|iti/g, '').trim()
    if (i.code.toLowerCase() === s || name === s || name.includes(s) || s.includes(name)) return i
  }
  return null
}

// Canvas context the client passes to openCanvas. Every key a section canvas
// reads is set so the same context works for all of them.
export function buildContext(target, ent = {}, iti = null) {
  const filters = {}
  if (iti) { filters.scope = iti.id; filters.itiId = iti.id }
  if (ent.trade) filters.trade = ent.trade
  if (ent.gender) filters.gender = ent.gender === 'F' || /^f|women|female/i.test(ent.gender) ? 'F' : 'M'
  if (ent.date) filters.date = ent.date
  if (ent.year) filters.year = ent.year
  if (ent.category && (target.params || []).includes('category')) filters.category = ent.category
  const ctx = { type: target.canvas, _k: Date.now() }
  if (target.tab) ctx.tab = target.tab
  if (iti) { ctx.itiId = iti.id; ctx.itiCode = iti.code }
  if (Object.keys(filters).length) ctx.filters = filters
  return ctx
}

// Trade names → registry codes; budget words → work-package categories.
export const TRADE_WORDS = { electrician: 'ELE', electrical: 'ELE', fitter: 'FIT', copa: 'COP', computer: 'COP', welder: 'LWD', welding: 'LWD', machinist: 'LMC', 'machine shop': 'LMC', turner: 'LTR', 'sheet metal': 'LSM', rac: 'LRA', refrigeration: 'LRA', hvac: 'LRA', 'electronics mechanic': 'LEM', electronics: 'LEM', mmv: 'LMV', 'motor vehicle': 'LMV', draughtsman: 'LDM', steno: 'LST', stenographer: 'LST', cnc: 'CNC' }
export const CATEGORY_WORDS = { civil: 'Civil', construction: 'Civil', building: 'Civil', digital: 'Digital', loms: 'Digital', equipment: 'Equipment', machines: 'Equipment', faculty: 'Faculty', trainers: 'Faculty', governance: 'Governance', operations: 'Operations', recurring: 'Operations', staff: 'Staff', 'student industry': 'Student industry', placement: 'Student industry' }
export function tradeFromText(text) { const t = String(text || '').toLowerCase(); for (const [w, c] of Object.entries(TRADE_WORDS)) if (t.includes(w)) return c; const m = t.match(/\b(ELE|FIT|COP|LWD|LMC|LTR|LSM|LRA|LEM|LMV|LDM|LST|CNC)\b/i); return m ? m[1].toUpperCase() : null }
export function categoryFromText(text) { const t = String(text || '').toLowerCase(); for (const [w, c] of Object.entries(CATEGORY_WORDS)) if (t.includes(w)) return c; return null }

export function catalogBriefing(role) {
  const ts = targetsForRole(role)
  return ts.map(t => `- ${t.id} — ${t.label}${t.params?.length ? ` (accepts: ${t.params.join(', ')})` : ''}. Say: ${t.say.slice(0, 4).map(s => `"${s}"`).join(' · ')}`).join('\n')
}
