// server/src/voice/tools.js — mirror of web/src/utils/voiceTools.js.
// Voice sessions get one tool: open_canvas(canvas_id). The catalogue below
// teaches the model which utterance opens which screen for EVERY role.

export const CANVAS_CATALOG = [
  // Module A — plan
  { id: 'cluster_home',             label: 'Cluster Home',             utterances: ['show the cluster', 'how are the five ITIs doing', 'year one envelope'] },
  { id: 'institute_profile',        label: 'Institute Profile',        utterances: ['open the institute profile', 'confirm the staffing tab', 'what does Pusa look like'] },
  { id: 'five_year_targets',        label: 'Five-Year Targets',        utterances: ['five year targets', 'enrolment plan by year', 'KPI trajectory'] },
  { id: 'annual_plan',              label: 'Annual Plan',              utterances: ['annual plan', 'year one workplan', 'what is due this quarter'] },
  { id: 'milestone_board',          label: 'Milestone Board',          utterances: ['milestone board', 'what is overdue', 'which tasks are blocked', 'change requests'] },
  { id: 'my_commitments',           label: 'My Commitments',           utterances: ['my commitments', 'what have I committed to', 'my batches and subjects'] },
  // SPV compliance
  { id: 'transformation_dashboard', label: 'Transformation Dashboard', utterances: ['show the cluster dashboard', 'how is the transformation going', 'KPI overview'] },
  { id: 'tranche_readiness',        label: 'Tranche Readiness',        utterances: ['are we ready for the next tranche', 'fund release conditions', 'cost-weighted KPI score'] },
  { id: 'sip_budget',               label: 'SIP Budget',               utterances: ['show the budget', 'utilisation by category', 'how much have we spent'] },
  { id: 'civil_works',              label: 'Civil Works',              utterances: ['civil works status', 'how is the lab construction going', 'which works are delayed'] },
  { id: 'procurement',              label: 'Procurement',              utterances: ['procurement pipeline', 'equipment packages', 'tender status'] },
  { id: 'finance_escrow',           label: 'Finance & Escrow',         utterances: ['escrow balance', 'utilisation certificates', 'who has deposited'] },
  { id: 'milestones',               label: 'Milestones',               utterances: ['milestones for IMA', 'submit evidence', 'what is pending verification'] },
  { id: 'reports',                  label: 'Reports & AOP',            utterances: ['quarterly report', 'generate the IMA pack', 'annual operational plan'] },
  { id: 'board_matters',            label: 'Board Matters',            utterances: ['board agenda', 'reserved matters', 'what needs state consent'] },
  { id: 'grievances_admin',         label: 'Grievances',               utterances: ['open grievances', 'complaints register'] },
  // Module B — operations
  { id: 'trainer_my_day',           label: 'My Day',                   utterances: ['my day', 'what do I have today', 'pending attendance'] },
  { id: 'attendance_bot',           label: 'Attendance',               utterances: ['mark attendance', 'take attendance', 'submit the register'] },
  { id: 'assessments',              label: 'Assessments',              utterances: ['enter marks', 'scan the mark sheet', 'assessment calendar', 'review marks'] },
  { id: 'practical_bot',            label: 'Practical Bot',            utterances: ['record a practical', 'who needs re-practice', 'rubric observation'] },
  { id: 'field_visit',              label: 'Field Visit',              utterances: ['start a workshop visit', 'visit checklist', 'open findings'] },
  { id: 'daily_ops',                label: 'Daily Ops',                utterances: ['raise an issue', 'machine is broken', 'consumables finished', 'room double booked'] },
  { id: 'institute_today',          label: 'Institute Today',          utterances: ['institute today', 'which classes have not reported', 'who is on leave'] },
  { id: 'cluster_operations',       label: 'Cluster Operations',       utterances: ['cluster operations', 'coverage by ITI', 'which ITIs are reporting'] },
  { id: 'support_queue',            label: 'Support Queue',            utterances: ['support queue', 'who needs follow-up', 'students at risk', 'referrals'] },
  { id: 'iti_dashboard',            label: 'ITI Dashboard',            utterances: ['my ITI dashboard', 'show my institute', 'seats and attendance'] },
  { id: 'machines_infra',           label: 'Machines & Labs',          utterances: ['machine status', 'which machines are not working', 'lab assets'] },
  { id: 'batches',                  label: 'Batches',                  utterances: ['show batches', 'at-risk students', 'batch roster'] },
  { id: 'module_plan',              label: 'Module Plan',              utterances: ['lesson plan', 'what do I teach today', 'module plan'] },
  // Module C — companion
  { id: 'what_i_know',              label: 'What I Know',              utterances: ['what do you know about me', 'my attendance', 'my marks', 'correct my record'] },
  { id: 'my_plan',                  label: 'My Plan',                  utterances: ['my plan', 'what is this week', 'upcoming tests', 'my career steps'] },
  { id: 'applications',             label: 'Applications',             utterances: ['my applications', 'did I get the job', 'apprenticeship status'] },
  { id: 'help_from_institute',      label: 'Help from Institute',      utterances: ['ask my trainer', 'I need help', 'talk to the principal', 'my referrals'] },
  { id: 'job_prep',                 label: 'Job Prep',                 utterances: ['prepare my résumé', 'documents checklist', 'mock interview'] },
  { id: 'student_voice',            label: 'Student Voice',            utterances: ['student voice', 'what are students saying', 'barriers students face'] },
  { id: 'companion_kb',             label: 'Companion Knowledge Base', utterances: ['companion knowledge base', 'what does the companion know about courses', 'response rules', 'signal taxonomy'] },
  { id: 'my_course',                label: 'My Course',                utterances: ['open my course', 'continue learning', 'my modules', 'my credits'] },
  { id: 'doubt_solver',             label: 'Doubt Solver',             utterances: ['I have a doubt', 'explain this topic', 'help me revise'] },
  { id: 'course_selection',         label: 'Choose a Course',          utterances: ['which trade should I pick', 'help me choose a course', 'short courses available'] },
  { id: 'career_counsellor',        label: 'Career Counsellor',        utterances: ['career guidance', 'what jobs after this trade', 'wage for electrician'] },
  { id: 'ojt_logbook',              label: 'OJT Logbook',              utterances: ['log my OJT hours', 'OJT logbook', 'my training at the employer'] },
  { id: 'placement_confirm',        label: 'Report Offer / Joining',   utterances: ['I got the job', 'I joined', 'dispute the placement record'] },
  { id: 'on_job_buddy',             label: 'On-Job Buddy',             utterances: ['check in about my job', 'I am still working', 'problem at work'] },
  { id: 'jobs',                     label: 'Opportunities',            utterances: ['show job openings', 'apprenticeships for my trade', 'OJT openings'] },
  { id: 'grievance',                label: 'Grievance',                utterances: ['file a grievance', 'raise a complaint'] },
  // Module D — industry & placement
  { id: 'placement_pipeline',       label: 'Placement Pipeline',       utterances: ['placement pipeline', 'how many joined', 'evidence levels', 'disputed placements'] },
  { id: 'employer_register',        label: 'Employer Register',        utterances: ['employer register', 'which employers are active', 'opportunities to check', 'MoU status'] },
  { id: 'for_my_batches',           label: 'Placement for My Batches', utterances: ['placement for my batches', 'who needs a résumé review', 'mock interviews'] },
  { id: 'placements_cluster',       label: 'Joined Records',           utterances: ['joined records', 'verified placements', 'sample placements'] },
  { id: 'ojt_tracker',              label: 'OJT Tracker',              utterances: ['OJT status', 'on the job training hours', 'mentor sign-off'] },
  { id: 'confirm_hire',             label: 'Confirm Hires',            utterances: ['confirm hires', 'pending confirmations', 'confirm joining'] },
  { id: 'post_opening',             label: 'Post Opportunity',         utterances: ['post a job', 'we need electricians', 'add an opening'] },
  // IMA
  { id: 'verification_queue',       label: 'Verification Queue',       utterances: ['what needs verification', 'milestone queue', 'verify evidence'] },
  { id: 'kpi_audit',                label: 'KPI Audit',                utterances: ['audit the KPIs', 'verify enrolment numbers', 'KPI evidence'] },
  { id: 'report_review',            label: 'Report Review',            utterances: ['review the quarterly report', 'approve the AOP'] },
  // Curriculum
  { id: 'course_builder',           label: 'Course Builder',           utterances: ['edit the module', 'build a course', 'add lessons'] },
  { id: 'ncvet_pipeline',           label: 'NCVET Pipeline',           utterances: ['approval status', 'submit to CSTARI', 'NCVET review'] },
  // State
  { id: 'state_scorecard',          label: 'State Scorecard',          utterances: ['state scorecard', 'compare clusters', 'which cluster is lagging'] },
  { id: 'notifications',            label: 'Updates & Alerts',         utterances: ['show notifications', 'any alerts', 'my reminders'] },
]

export const CANVAS_IDS = CANVAS_CATALOG.map(c => c.id)
export const CANVAS_BY_ID = Object.fromEntries(CANVAS_CATALOG.map(c => [c.id, c]))

export const TOOLS = [
  {
    group: 'open',
    name: 'open_canvas',
    description: "Open one of PM-SETU Saathi's screens in the user's UI. Call this whenever the user asks to see, open, check, mark, log, confirm or review anything the app supports (see the briefing for utterance→canvas mapping).",
    parameters: { type: 'object', properties: { canvas_id: { type: 'string', enum: CANVAS_IDS, description: 'Canonical canvas id from the catalogue.' } }, required: ['canvas_id'], additionalProperties: false },
  },
]

export function toOpenAIToolDefs() {
  return TOOLS.map(t => ({ type: 'function', name: t.name, description: t.description, parameters: t.parameters }))
}

export function toPersonaBriefing() {
  const lines = ['', '# UI orchestration — you can OPEN screens for the user', '',
    "You have one tool: `open_canvas(canvas_id)`. When the user's intent matches a canvas below, CALL THE TOOL — never just narrate. Speak naturally alongside the call, then fire it.", '', '## Canvas → typical utterances', '']
  for (const c of CANVAS_CATALOG) lines.push(`- \`${c.id}\` — ${c.label}. User says: ${c.utterances.slice(0, 3).map(u => `"${u}"`).join(' · ')}`)
  lines.push('', '## Strict rules',
    '- Only open canvases that make sense for the user\'s role (a trainee cannot open the SPV budget; a CEO has no "my course").',
    "- Never announce \"I'll open X\" without immediately calling `open_canvas`.",
    "- Don't read canvas ids aloud; speak the outcome (\"Milestone board khul gaya hai\").",
    '- If the user is already on a canvas and asks about it, answer — don\'t re-open it.')
  return lines.join('\n')
}
