// PM-SETU action catalog — mirror of web/src/nlp/dispatch.js. The intent
// classifier is constrained to this list; every action lists the roles that
// may invoke it. Keep ids in sync with the frontend ACTION_TO_CANVAS map.

export const ACTIONS = {
  // Module A — SIP & annual plan
  OPEN_CLUSTER_HOME:             { module: 'cluster_home',             roles: ['spv_ceo', 'ima_officer', 'state_pmu'], description: 'Cluster home: 5 ITIs, Year-1 envelope vs plan, tasks overdue, launch gates, risks.' },
  OPEN_INSTITUTE_PROFILE:        { module: 'institute_profile',        roles: ['iti_principal', 'spv_ceo', 'ima_officer'], description: 'Institute profile: overview, trades, staffing, infrastructure, budget, targets, launch gates.' },
  OPEN_FIVE_YEAR_TARGETS:        { module: 'five_year_targets',        roles: ['spv_ceo', 'iti_principal', 'ima_officer', 'state_pmu', 'curriculum_dev'], description: 'Five-year targets: places and enrolments per course, KPI trajectories, site budgets, phasing.' },
  OPEN_ANNUAL_PLAN:              { module: 'annual_plan',              roles: ['spv_ceo', 'iti_principal', 'ima_officer', 'state_pmu'], description: 'Annual plan: Year-1 outcomes, workplan (AOP records with tasks), quarterly calendar.' },
  OPEN_MILESTONE_BOARD:          { module: 'milestone_board',          roles: ['spv_ceo', 'iti_principal', 'ima_officer'], description: 'Milestone board: overdue and blocked tasks with predecessor chain, change requests.' },
  OPEN_MY_COMMITMENTS:           { module: 'my_commitments',           roles: ['trainer'], description: 'Trainer commitments: batches and subjects, assessments due, rechecks, support actions, referrals.' },

  // SPV compliance layer
  OPEN_TRANSFORMATION_DASHBOARD: { module: 'transformation_dashboard', roles: ['spv_ceo', 'state_pmu', 'ima_officer'], description: 'Transformation dashboard: KPIs vs baseline, per-ITI progress, tranche readiness.' },
  OPEN_TRANCHE_READINESS:        { module: 'tranche_readiness',        roles: ['spv_ceo', 'state_pmu', 'ima_officer'], description: 'Fund-release readiness: 75% utilisation, AOP approval, cost-weighted KPI score.' },
  OPEN_SIP_BUDGET:               { module: 'sip_budget',               roles: ['spv_ceo', 'state_pmu', 'ima_officer'], description: 'SIP budget by category and package; committed vs utilised; 20% civil cap.' },
  OPEN_CIVIL_WORKS:              { module: 'civil_works',              roles: ['spv_ceo', 'iti_principal', 'ima_officer'], description: 'Civil works by ITI: frozen work units, measured completion, inspection.' },
  OPEN_PROCUREMENT:              { module: 'procurement',              roles: ['spv_ceo', 'ima_officer'], description: 'Procurement packages: planned → tendered → awarded → delivered → installed.' },
  OPEN_FINANCE_ESCROW:           { module: 'finance_escrow',           roles: ['spv_ceo', 'state_pmu', 'ima_officer'], description: 'Escrow deposits by source, utilisation certificates, PFMS matching.' },
  OPEN_MILESTONES:               { module: 'milestones',               roles: ['spv_ceo', 'iti_principal'], description: 'Milestones and evidence packs submitted to the IMA.' },
  OPEN_REPORTS:                  { module: 'reports',                  roles: ['spv_ceo'], description: 'Quarterly reports, AOP and annual report — generate the IMA report pack.' },
  OPEN_BOARD_MATTERS:            { module: 'board_matters',            roles: ['spv_ceo'], description: 'Board agenda: reserved matters needing Centre/State consent, delegated matters.' },
  OPEN_GRIEVANCES_ADMIN:         { module: 'grievances_admin',         roles: ['spv_ceo', 'iti_principal'], description: 'Grievance register and resolution.' },

  // Module B — institute operations
  OPEN_TRAINER_MY_DAY:           { module: 'trainer_my_day',           roles: ['trainer'], description: "Trainer's day: today's sessions, pending attendance, marks to enter, rechecks, referrals." },
  OPEN_ATTENDANCE_MARK:          { module: 'attendance_bot',           roles: ['trainer', 'iti_principal'], description: 'Attendance bot: submit a session register (present / absent / late / excused / roster issue), works offline.' },
  OPEN_ASSESSMENTS:              { module: 'assessments',              roles: ['trainer', 'iti_principal'], description: 'Assessments: calendar, enter or scan marks, principal review of low-confidence entries.' },
  OPEN_PRACTICAL_BOT:            { module: 'practical_bot',            roles: ['trainer', 'iti_principal'], description: 'Practical bot: rubric observation per student (demonstrated / developing / needs re-practice).' },
  OPEN_FIELD_VISIT:              { module: 'field_visit',              roles: ['iti_principal', 'spv_ceo', 'ima_officer'], description: 'Field visit checklist for a workshop; findings with owners and due dates.' },
  OPEN_DAILY_OPS:                { module: 'daily_ops',                roles: ['trainer', 'iti_principal', 'spv_ceo'], description: 'Daily ops: raise or resolve equipment, space, consumables, safety and timetable issues.' },
  OPEN_INSTITUTE_TODAY:          { module: 'institute_today',          roles: ['iti_principal', 'spv_ceo', 'ima_officer'], description: 'Institute today: coverage, classes without reports, trainers on leave, reviews pending, support queue.' },
  OPEN_CLUSTER_OPERATIONS:       { module: 'cluster_operations',       roles: ['spv_ceo', 'ima_officer', 'state_pmu'], description: 'Cluster operations: per-ITI coverage, attendance, assessments, issues; which ITIs are registry-connected.' },
  OPEN_SUPPORT_QUEUE:            { module: 'support_queue',            roles: ['trainer', 'iti_principal', 'spv_ceo'], description: 'Support queue: students flagged for repeated absence, low results, rechecks, referrals.' },
  OPEN_ITI_DASHBOARD:            { module: 'iti_dashboard',            roles: ['iti_principal', 'spv_ceo', 'ima_officer'], description: 'One ITI: seats, attendance, trainers, machines, civil, placements.' },
  OPEN_MACHINES_INFRA:           { module: 'machines_infra',           roles: ['iti_principal', 'spv_ceo', 'trainer', 'ima_officer'], description: 'Machine and lab asset register with functional status.' },
  OPEN_BATCHES:                  { module: 'batches',                  roles: ['iti_principal', 'spv_ceo', 'trainer'], description: 'Batches, rosters, at-risk students.' },
  OPEN_MODULE_PLAN:              { module: 'module_plan',              roles: ['trainer'], description: 'Lesson plan for the current 240-hour module.' },

  // Module C — student companion
  OPEN_WHAT_I_KNOW:              { module: 'what_i_know',              roles: ['trainee'], description: 'What the companion knows about me: attendance, marks, practicals, interests, barriers — and what I can correct.' },
  OPEN_MY_PLAN:                  { module: 'my_plan',                  roles: ['trainee'], description: 'My plan: this week, upcoming tests, career steps, checklists.' },
  OPEN_APPLICATIONS:             { module: 'applications',             roles: ['trainee'], description: 'My applications: interest → prepared → referred → applied → interviewed → offered → joined.' },
  OPEN_HELP_FROM_INSTITUTE:      { module: 'help_from_institute',      roles: ['trainee'], description: 'Ask my trainer or principal for help; see what was shared and the reply.' },
  OPEN_JOB_PREP:                 { module: 'job_prep',                 roles: ['trainee'], description: 'Job prep: résumé, documents checklist, mock interview request.' },
  OPEN_COMPANION_KB:             { module: 'companion_kb',             roles: ['spv_ceo', 'iti_principal', 'curriculum_dev', 'ima_officer'], description: 'Student Companion knowledge base: course catalogue, roles, interest map, learning topics, support directory, signal taxonomy, response rules.' },
  OPEN_STUDENT_VOICE:            { module: 'student_voice',            roles: ['iti_principal', 'spv_ceo', 'ima_officer'], description: 'Student Voice: aggregated themes from companion conversations (travel cost, timetable, devices, facilities, course interest).' },
  OPEN_MY_COURSE:                { module: 'my_course',                roles: ['trainee'], description: 'My course: modules, lessons, credits, quick checks.' },
  OPEN_DOUBT_SOLVER:             { module: 'doubt_solver',             roles: ['trainee'], description: 'AI tutor for the current module — doubts and revision; can refer to my trainer.' },
  OPEN_COURSE_SELECTION:         { module: 'course_selection',         roles: ['trainee'], description: 'Which trade or short course fits me — counselling with cluster seats and launch dates.' },
  OPEN_CAREER_COUNSELLOR:        { module: 'career_counsellor',        roles: ['trainee'], description: 'Career guidance: roles, wages, pathways after this trade.' },
  OPEN_OJT_LOGBOOK:              { module: 'ojt_logbook',              roles: ['trainee'], description: 'OJT / apprenticeship logbook: hours and tasks; mentor sign-off status.' },
  OPEN_PLACEMENT_CONFIRM:        { module: 'placement_confirm',        roles: ['trainee'], description: 'Report an offer or joining, or dispute what the record says.' },
  OPEN_ON_JOB_BUDDY:             { module: 'on_job_buddy',             roles: ['trainee'], description: 'After joining: month-1 and month-3 follow-ups, support at work.' },
  OPEN_JOBS:                     { module: 'jobs',                     roles: ['trainee'], description: 'Live opportunities (apprenticeship, OJT, wage) approved for my ITI.' },
  OPEN_GRIEVANCE:                { module: 'grievance',                roles: ['trainee', 'trainer'], description: 'Raise a grievance.' },

  // Module D — industry & placement
  OPEN_PLACEMENT_PIPELINE:       { module: 'placement_pipeline',       roles: ['spv_ceo', 'iti_principal', 'ima_officer', 'state_pmu'], description: 'Placement pipeline: person-level stages, evidence levels, conversion, disputes.' },
  OPEN_EMPLOYER_REGISTER:        { module: 'employer_register',        roles: ['spv_ceo', 'iti_principal', 'employer'], description: 'Employer and opportunity register: relationship status, MoUs, openings lifecycle, feedback.' },
  OPEN_FOR_MY_BATCHES:           { module: 'for_my_batches',           roles: ['trainer'], description: 'Placement for my batches: who needs résumé review, mock interview, referral.' },
  OPEN_PLACEMENTS_CLUSTER:       { module: 'placements_cluster',       roles: ['spv_ceo', 'iti_principal', 'ima_officer', 'state_pmu'], description: 'Joined records with evidence levels; IMA sampling.' },
  OPEN_OJT_TRACKER:              { module: 'ojt_tracker',              roles: ['iti_principal', 'spv_ceo', 'employer', 'trainer'], description: 'OJT and apprenticeship spells: hours, mentor and ITI sign-off, follow-ups.' },
  OPEN_CONFIRM_HIRE:             { module: 'confirm_hire',             roles: ['employer'], description: 'Employer confirms interviews, offers and joining; raises the evidence level.' },
  OPEN_POST_OPENING:             { module: 'post_opening',             roles: ['employer'], description: 'Post an opportunity (apprenticeship, OJT, wage) for cluster students.' },

  // IMA
  OPEN_VERIFICATION_QUEUE:       { module: 'verification_queue',       roles: ['ima_officer'], description: 'Milestones submitted by the SPV awaiting verification.' },
  OPEN_KPI_AUDIT:                { module: 'kpi_audit',                roles: ['ima_officer', 'state_pmu'], description: 'KPI values with coverage, source and verification flags.' },
  OPEN_REPORT_REVIEW:            { module: 'report_review',            roles: ['ima_officer', 'state_pmu'], description: 'Review quarterly reports and AOPs; approve or return.' },

  // Curriculum developer (CMS)
  OPEN_COURSE_BUILDER:           { module: 'course_builder',           roles: ['curriculum_dev', 'spv_ceo'], description: 'Build and edit 240-hour modules, lessons and OJT for a trade.' },
  OPEN_NCVET_PIPELINE:           { module: 'ncvet_pipeline',           roles: ['curriculum_dev', 'spv_ceo'], description: 'Course approval pipeline: draft → CSTARI → NCVET → approved; launch gates it unlocks.' },

  // State PMU
  OPEN_STATE_SCORECARD:          { module: 'state_scorecard',          roles: ['state_pmu'], description: 'State scorecard across clusters: utilisation, KPI score, milestones.' },

  // Shared
  OPEN_NOTIFICATIONS:            { module: 'notifications',            roles: ['*'], description: 'Open notifications.' },
  ANSWER_QUESTION:               { module: 'ask_ai',                   roles: ['*'], description: 'Answer a question about PM-SETU, the SPV, the cluster or the platform.' },
}

export function actionsForRole(role) {
  const out = []
  for (const [id, def] of Object.entries(ACTIONS)) {
    if (def.roles.includes('*') || def.roles.includes(role)) out.push({ id, module: def.module, description: def.description })
  }
  return out
}

export function actionAllowed(actionId, role) {
  const a = ACTIONS[actionId]
  if (!a) return false
  return a.roles.includes('*') || a.roles.includes(role)
}
