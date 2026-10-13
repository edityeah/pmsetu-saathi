// Front-end dispatcher for actions returned by /api/ai/message (and by
// notification action buttons). Each action id maps to a canvas open.
// Keep in sync with server/src/llm/catalog.js.

const ACTION_TO_CANVAS = {
  // Module A
  OPEN_CLUSTER_HOME:             { type: 'cluster_home' },
  OPEN_INSTITUTE_PROFILE:        { type: 'institute_profile' },
  OPEN_FIVE_YEAR_TARGETS:        { type: 'five_year_targets' },
  OPEN_ANNUAL_PLAN:              { type: 'annual_plan' },
  OPEN_MILESTONE_BOARD:          { type: 'milestone_board' },
  OPEN_MY_COMMITMENTS:           { type: 'my_commitments' },
  // SPV compliance
  OPEN_TRANSFORMATION_DASHBOARD: { type: 'transformation_dashboard' },
  OPEN_TRANCHE_READINESS:        { type: 'tranche_readiness' },
  OPEN_SIP_BUDGET:               { type: 'sip_budget' },
  OPEN_CIVIL_WORKS:              { type: 'civil_works' },
  OPEN_PROCUREMENT:              { type: 'procurement' },
  OPEN_FINANCE_ESCROW:           { type: 'finance_escrow' },
  OPEN_MILESTONES:               { type: 'milestones' },
  OPEN_REPORTS:                  { type: 'reports' },
  OPEN_BOARD_MATTERS:            { type: 'board_matters' },
  OPEN_GRIEVANCES_ADMIN:         { type: 'grievances_admin' },
  // Module B
  OPEN_TRAINER_MY_DAY:           { type: 'trainer_my_day' },
  OPEN_ATTENDANCE_MARK:          { type: 'attendance_bot' },
  OPEN_ASSESSMENTS:              { type: 'assessments' },
  OPEN_PRACTICAL_BOT:            { type: 'practical_bot' },
  OPEN_FIELD_VISIT:              { type: 'field_visit' },
  OPEN_DAILY_OPS:                { type: 'daily_ops' },
  OPEN_INSTITUTE_TODAY:          { type: 'institute_today' },
  OPEN_CLUSTER_OPERATIONS:       { type: 'cluster_operations' },
  OPEN_SUPPORT_QUEUE:            { type: 'support_queue' },
  OPEN_ITI_DASHBOARD:            { type: 'iti_dashboard' },
  OPEN_MACHINES_INFRA:           { type: 'machines_infra' },
  OPEN_BATCHES:                  { type: 'batches' },
  OPEN_MODULE_PLAN:              { type: 'module_plan' },
  // Module C
  OPEN_WHAT_I_KNOW:              { type: 'what_i_know' },
  OPEN_MY_PLAN:                  { type: 'my_plan' },
  OPEN_APPLICATIONS:             { type: 'applications' },
  OPEN_HELP_FROM_INSTITUTE:      { type: 'help_from_institute' },
  OPEN_JOB_PREP:                 { type: 'job_prep' },
  OPEN_STUDENT_VOICE:            { type: 'student_voice' },
  OPEN_COMPANION_KB:             { type: 'companion_kb' },
  OPEN_MY_COURSE:                { type: 'my_course' },
  OPEN_DOUBT_SOLVER:             { type: 'doubt_solver' },
  OPEN_COURSE_SELECTION:         { type: 'course_selection' },
  OPEN_CAREER_COUNSELLOR:        { type: 'career_counsellor' },
  OPEN_OJT_LOGBOOK:              { type: 'ojt_logbook' },
  OPEN_PLACEMENT_CONFIRM:        { type: 'placement_confirm' },
  OPEN_ON_JOB_BUDDY:             { type: 'on_job_buddy' },
  OPEN_JOBS:                     { type: 'jobs' },
  OPEN_GRIEVANCE:                { type: 'grievance' },
  // Module D
  OPEN_PLACEMENT_PIPELINE:       { type: 'placement_pipeline' },
  OPEN_EMPLOYER_REGISTER:        { type: 'employer_register' },
  OPEN_FOR_MY_BATCHES:           { type: 'for_my_batches' },
  OPEN_PLACEMENTS_CLUSTER:       { type: 'placements_cluster' },
  OPEN_OJT_TRACKER:              { type: 'ojt_tracker' },
  OPEN_CONFIRM_HIRE:             { type: 'confirm_hire' },
  OPEN_POST_OPENING:             { type: 'post_opening' },
  // IMA / curriculum / state
  OPEN_VERIFICATION_QUEUE:       { type: 'verification_queue' },
  OPEN_KPI_AUDIT:                { type: 'kpi_audit' },
  OPEN_REPORT_REVIEW:            { type: 'report_review' },
  OPEN_COURSE_BUILDER:           { type: 'course_builder' },
  OPEN_NCVET_PIPELINE:           { type: 'ncvet_pipeline' },
  OPEN_STATE_SCORECARD:          { type: 'state_scorecard' },
  OPEN_NOTIFICATIONS:            { type: 'notifications' },
  // legacy ids still emitted by old notifications
  OPEN_ASSESSMENT_CAPTURE:       { type: 'assessments' },
}

export function dispatchActionForRole({ actionId, entities = {}, role, openCanvas, showToast }) {
  const c = ACTION_TO_CANVAS[actionId]
  if (!c) { showToast?.({ kind: 'warn', text: 'Action not yet wired in this prototype.' }); return }
  openCanvas?.({ ...c, ...entities })
}
