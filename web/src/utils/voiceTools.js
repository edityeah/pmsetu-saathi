// Client-side mirror of server/src/voice/tools.js — keep ids in sync.
export const CANVAS_CATALOG = [
  { id: 'cluster_home', label: 'Cluster Home' }, { id: 'institute_profile', label: 'Institute Profile' }, { id: 'five_year_targets', label: 'Five-Year Targets' },
  { id: 'annual_plan', label: 'Annual Plan' }, { id: 'milestone_board', label: 'Milestone Board' }, { id: 'my_commitments', label: 'My Commitments' },
  { id: 'transformation_dashboard', label: 'Transformation Dashboard' }, { id: 'tranche_readiness', label: 'Tranche Readiness' },
  { id: 'sip_budget', label: 'SIP Budget' }, { id: 'civil_works', label: 'Civil Works' }, { id: 'procurement', label: 'Procurement' },
  { id: 'finance_escrow', label: 'Finance & Escrow' }, { id: 'milestones', label: 'Milestones' }, { id: 'reports', label: 'Reports & AOP' },
  { id: 'board_matters', label: 'Board Matters' }, { id: 'grievances_admin', label: 'Grievances' },
  { id: 'trainer_my_day', label: 'My Day' }, { id: 'attendance_bot', label: 'Attendance' }, { id: 'assessments', label: 'Assessments' }, { id: 'practical_bot', label: 'Practical Bot' },
  { id: 'field_visit', label: 'Field Visit' }, { id: 'daily_ops', label: 'Daily Ops' }, { id: 'institute_today', label: 'Institute Today' }, { id: 'cluster_operations', label: 'Cluster Operations' }, { id: 'support_queue', label: 'Support Queue' },
  { id: 'iti_dashboard', label: 'ITI Dashboard' }, { id: 'machines_infra', label: 'Machines & Labs' }, { id: 'batches', label: 'Batches' }, { id: 'module_plan', label: 'Module Plan' },
  { id: 'what_i_know', label: 'What I Know' }, { id: 'my_plan', label: 'My Plan' }, { id: 'applications', label: 'Applications' }, { id: 'help_from_institute', label: 'Help from Institute' }, { id: 'job_prep', label: 'Job Prep' }, { id: 'student_voice', label: 'Student Voice' }, { id: 'companion_kb', label: 'Companion Knowledge Base' },
  { id: 'my_course', label: 'My Course' }, { id: 'doubt_solver', label: 'Doubt Solver' }, { id: 'course_selection', label: 'Choose a Course' },
  { id: 'career_counsellor', label: 'Career Counsellor' }, { id: 'ojt_logbook', label: 'OJT Logbook' }, { id: 'placement_confirm', label: 'Report Offer / Joining' },
  { id: 'on_job_buddy', label: 'On-Job Buddy' }, { id: 'jobs', label: 'Opportunities' }, { id: 'grievance', label: 'Grievance' },
  { id: 'placement_pipeline', label: 'Placement Pipeline' }, { id: 'employer_register', label: 'Employer Register' }, { id: 'for_my_batches', label: 'Placement for My Batches' },
  { id: 'placements_cluster', label: 'Joined Records' }, { id: 'ojt_tracker', label: 'OJT Tracker' }, { id: 'confirm_hire', label: 'Confirm Hires' }, { id: 'post_opening', label: 'Post Opportunity' },
  { id: 'verification_queue', label: 'Verification Queue' }, { id: 'kpi_audit', label: 'KPI Audit' }, { id: 'report_review', label: 'Report Review' },
  { id: 'course_builder', label: 'Course Builder' }, { id: 'ncvet_pipeline', label: 'NCVET Pipeline' },
  { id: 'state_scorecard', label: 'State Scorecard' }, { id: 'notifications', label: 'Updates & Alerts' },
]
export const CANVAS_BY_ID = Object.fromEntries(CANVAS_CATALOG.map(c => [c.id, c]))

export const TOOLS = {
  open_canvas: {
    handler: async ({ canvas_id }, ctx) => {
      if (!canvas_id) return { ok: false, error: 'canvas_id missing' }
      const meta = CANVAS_BY_ID[canvas_id]
      if (!meta) return { ok: false, error: `unknown canvas: ${canvas_id}` }
      if (!ctx?.openCanvas) return { ok: false, error: 'voice ctx not bound' }
      try {
        ctx.openCanvas({ type: canvas_id })
        ctx.showToast?.({ kind: 'info', text: `Opened: ${meta.label}` })
        return { ok: true, canvas_id, title: meta.label }
      } catch (e) { return { ok: false, error: String(e?.message || e) } }
    },
  },
}

export async function handleVoiceToolCall(name, args, ctx) {
  const tool = TOOLS[name]
  if (!tool) return { ok: false, error: `unknown tool: ${name}` }
  try { return await tool.handler(args || {}, ctx || {}) } catch (e) { return { ok: false, error: String(e?.message || e) } }
}
