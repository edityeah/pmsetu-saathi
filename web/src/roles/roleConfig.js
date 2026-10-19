// PM-SETU Saathi roles — labels, scopes, home layout, app tiles, suggestions,
// allowed canvases. Eight personas across the three layers:
//   Administration  → spv_ceo, iti_principal, ima_officer, state_pmu, employer
//   Operations      → trainer
//   Learning        → curriculum_dev (CMS), trainee (LMS + companion)
// The PRD's four modules shape the CEO, principal, trainer and student tiles:
//   A SIP & annual plan · B institute operations · C student companion ·
//   D industry & placement. The other four personas keep their screens.

export const ROLE_LABELS = {
  spv_ceo:        'SPV CEO',
  iti_principal:  'ITI Principal',
  trainer:        'Instructor',
  trainee:        'Student',
  ima_officer:    'IMA Verifier',
  employer:       'Industry Partner',
  curriculum_dev: 'Curriculum Developer',
  state_pmu:      'State PMU',
}

export const ROLE_SCOPES = {
  spv_ceo:        'Cluster · Pusa hub + 4 spokes',
  iti_principal:  'One ITI',
  trainer:        'Assigned batches',
  trainee:        'Self',
  ima_officer:    'Cluster verification',
  employer:       'Opportunities + joiners',
  curriculum_dev: 'Courses & modules',
  state_pmu:      'State clusters',
}

export const ROLE_HOME_LAYOUT = {
  spv_ceo: 'desktop', iti_principal: 'desktop', ima_officer: 'desktop', curriculum_dev: 'desktop', state_pmu: 'desktop',
  trainer: 'mobile', trainee: 'mobile', employer: 'mobile',
}

export const ROLE_TAGLINE = {
  spv_ceo:        'Saathi · Plan, run, prove',
  iti_principal:  'Saathi · Run your ITI today',
  trainer:        'Saathi · Your day, your batches',
  trainee:        'Saathi · Learn → practise → work',
  ima_officer:    'Saathi · Verify, then release',
  employer:       'Saathi · Host, hire, confirm',
  curriculum_dev: 'Saathi · 240-hour modules',
  state_pmu:      'Saathi · State scorecard',
}

export const ROLE_BOTS = {
  spv_ceo: [
    // 1 · Budget Analytics
    { id: 'bud_alloc',   name: 'Allocations and releases', desc: 'AOP allocation · released to ITIs · balance · by work package', icon: '🧾', tone: 'amber',   canvas: 'budget_analytics',   tab: 'overview',       section: 'budget' },
    { id: 'bud_hist',    name: 'Release history',          desc: 'Every release: work package, project, date, project status',     icon: '🗂️', tone: 'orange',  canvas: 'budget_analytics',   tab: 'history',        section: 'budget' },
    { id: 'bud_util',    name: 'Utilisation',              desc: 'Certified utilisation by line against the 75% tranche gate',     icon: '🏦', tone: 'lime',    canvas: 'budget_analytics',   tab: 'utilisation',    section: 'budget' },
    // 2 · Institute Profile
    { id: 'ip_overview', name: 'Overview',                 desc: 'Students, trainers, rooms, budget, tasks per ITI',               icon: '🏫', tone: 'violet',  canvas: 'institute_profile',  tab: 'overview',       section: 'profile' },
    { id: 'ip_trades',   name: 'Trade offerings',          desc: 'Courses, places and planned enrolments by year',                 icon: '📚', tone: 'indigo',  canvas: 'institute_profile',  tab: 'trades',         section: 'profile' },
    { id: 'ip_labs',     name: 'Facilities and labs',      desc: 'Rooms, machines, civil packages at the ITI',                     icon: '🏢', tone: 'orange',  canvas: 'institute_profile',  tab: 'infrastructure', section: 'profile' },
    // 3 · Cluster registry
    { id: 'reg_students', name: 'Student registry',        desc: 'Active students by ITI, trade, gender, year',                    icon: '🎓', tone: 'fuchsia', canvas: 'cluster_registry',   tab: 'students',       section: 'registry' },
    { id: 'reg_trainers', name: 'Trainer registry',        desc: 'Faculty by ITI and programme · assignments · availability',      icon: '👩‍🏫', tone: 'emerald', canvas: 'cluster_registry',   tab: 'trainers',       section: 'registry' },
    // 4 · Daily operations
    { id: 'ops_att',     name: 'Attendance',               desc: 'Coverage and attendance by ITI and batch for a day',             icon: '🗓️', tone: 'indigo',  canvas: 'daily_operations',   tab: 'attendance',     section: 'ops' },
    { id: 'ops_assess',  name: 'Assessment',               desc: 'Plans, marks awaiting review, results by ITI and trade',         icon: '📝', tone: 'violet',  canvas: 'daily_operations',   tab: 'assessment',     section: 'ops' },
    { id: 'ops_infra',   name: 'Infrastructure readiness', desc: 'Rooms, machines, civil works, launch gates',                     icon: '⚙️', tone: 'teal',    canvas: 'daily_operations',   tab: 'infrastructure', section: 'ops' },
    { id: 'ops_events',  name: 'Upcoming events',          desc: 'Assessments, IMA milestones, reports, employer dates',           icon: '📅', tone: 'sky',     canvas: 'daily_operations',   tab: 'events',         section: 'ops' },
    // 5 · Placement analytics
    { id: 'pipeline',    name: 'Placement Pipeline',       desc: 'Person-level stages · evidence levels · disputes',               icon: '🤝', tone: 'emerald', canvas: 'placement_pipeline',                        section: 'placement' },
    { id: 'employers',   name: 'Employer Directory',       desc: 'Relationships · MoUs · opportunities · feedback',                icon: '🏭', tone: 'teal',    canvas: 'employer_register',                         section: 'placement' },
    // 6 · Support and alerts
    { id: 'voice',       name: 'Student voice',            desc: 'Themes students raise · barriers · course interest',             icon: '🗣️', tone: 'pink',    canvas: 'student_voice',                             section: 'support' },
    { id: 'grievances',  name: 'Grievances',               desc: 'Student + staff register · resolution',                          icon: '🆘', tone: 'rose',    canvas: 'grievances_admin',                          section: 'support' },
    { id: 'updates',     name: 'Notifications and alerts', desc: 'IMA queries · status requests · deadlines',                      icon: '🔔', tone: 'indigo',  canvas: 'notifications',                             section: 'support' },
  ],
  iti_principal: [
    // 1 · Budget analytics
    { id: 'budget',      name: 'Budget analytics',           desc: 'AOP allocation, releases and utilisation for my ITI',          icon: '🧾', tone: 'amber',   canvas: 'budget_analytics',   tab: 'overview',       section: 'budget' },
    // 2 · My institute
    { id: 'profile',     name: 'Institute profile',          desc: 'Students, trainers, rooms, budget, tasks',                     icon: '🏫', tone: 'violet',  canvas: 'institute_profile',  tab: 'overview',       section: 'institute' },
    { id: 'campus',      name: 'Campus facilities',          desc: 'Rooms, machines, civil packages',                              icon: '🏢', tone: 'orange',  canvas: 'institute_profile',  tab: 'infrastructure', section: 'institute' },
    { id: 'trades',      name: 'Trade offerings and capacity', desc: 'Courses, places and planned enrolments by year',             icon: '📚', tone: 'indigo',  canvas: 'institute_profile',  tab: 'trades',         section: 'institute' },
    { id: 'students',    name: 'Student registry',           desc: 'Active students by trade, gender, year',                       icon: '🎓', tone: 'fuchsia', canvas: 'cluster_registry',   tab: 'students',       section: 'institute' },
    { id: 'trainers',    name: 'Trainer registry',           desc: 'Faculty by programme · assignments · availability',            icon: '👩‍🏫', tone: 'emerald', canvas: 'cluster_registry',   tab: 'trainers',       section: 'institute' },
    { id: 'batches',     name: 'Trades and batches',         desc: 'Running batches · rosters · at-risk students',                 icon: '🗂️', tone: 'lime',    canvas: 'batches',                                   section: 'institute' },
    // 3 · Daily operations
    { id: 'ops_att',     name: 'Attendance',                 desc: 'Coverage and attendance by batch for a day',                   icon: '🗓️', tone: 'indigo',  canvas: 'daily_operations',   tab: 'attendance',     section: 'ops' },
    { id: 'ops_assess',  name: 'Assessment',                 desc: 'Plans, marks awaiting review, results by trade',               icon: '📝', tone: 'violet',  canvas: 'daily_operations',   tab: 'assessment',     section: 'ops' },
    { id: 'ops_infra',   name: 'Infrastructure readiness',   desc: 'Workshops and labs ready for today',                           icon: '⚙️', tone: 'teal',    canvas: 'daily_operations',   tab: 'infrastructure', section: 'ops' },
    { id: 'ops_events',  name: 'Upcoming events',            desc: 'Assessments, IMA milestones, employer dates',                  icon: '📅', tone: 'sky',     canvas: 'daily_operations',   tab: 'events',         section: 'ops' },
    // 4 · Placement analytics
    { id: 'pipeline',    name: 'Placement Pipeline',         desc: 'My students: stages, evidence, retention',                     icon: '🤝', tone: 'emerald', canvas: 'placement_pipeline',                        section: 'placement' },
    { id: 'employers',   name: 'Employer Directory',         desc: 'Employers, MoUs, live opportunities',                          icon: '🏭', tone: 'teal',    canvas: 'employer_register',                         section: 'placement' },
    // 5 · Support and alerts
    { id: 'voice',       name: 'Student voice',              desc: 'Themes students raise at my ITI',                              icon: '🗣️', tone: 'pink',    canvas: 'student_voice',                             section: 'support' },
    { id: 'grievances',  name: 'Grievances',                 desc: 'Open issues at my ITI · resolution',                           icon: '🆘', tone: 'rose',    canvas: 'grievances_admin',                          section: 'support' },
    { id: 'updates',     name: 'Notifications and alerts',   desc: 'SPV circulars · deadlines · reminders',                        icon: '🔔', tone: 'indigo',  canvas: 'notifications',                             section: 'support' },
  ],
  trainer: [
    { id: 'myday',       name: 'My Day',             desc: "Today's sessions · pending attendance · marks to enter",       icon: '🌅', tone: 'indigo',  canvas: 'trainer_my_day' },
    { id: 'attendance',  name: 'Attendance',         desc: 'Submit a session register · works offline',                   icon: '🗓️', tone: 'amber',   canvas: 'attendance_bot' },
    { id: 'assess',      name: 'Assessments',        desc: 'Enter or scan marks · calendar',                              icon: '📝', tone: 'violet',  canvas: 'assessments' },
    { id: 'practical',   name: 'Practical Bot',      desc: 'Rubric observation per student · rechecks',                   icon: '🔧', tone: 'teal',    canvas: 'practical_bot' },
    { id: 'commit',      name: 'My Commitments',     desc: 'Batches, subjects, deadlines, referrals',                     icon: '📌', tone: 'sky',     canvas: 'my_commitments' },
    { id: 'support',     name: 'Support Queue',      desc: 'Students flagged for follow-up · referrals to me',            icon: '🫶', tone: 'rose',    canvas: 'support_queue' },
    { id: 'ops',         name: 'Daily Ops',          desc: 'Raise an issue: equipment, consumables, room, safety',        icon: '🛠️', tone: 'orange',  canvas: 'daily_ops' },
    { id: 'placement',   name: 'Placement · my batches', desc: 'Résumé reviews · mock interviews · referrals',             icon: '🤝', tone: 'emerald', canvas: 'for_my_batches' },
    { id: 'batches',     name: 'My Batches',         desc: 'Rosters · attendance · marks · risk',                         icon: '📚', tone: 'lime',    canvas: 'batches' },
    { id: 'module',      name: 'Module Plan',        desc: 'Lesson plan for the current 240-hour module',                 icon: '📖', tone: 'fuchsia', canvas: 'module_plan' },
    { id: 'machines',    name: 'Lab Machines',       desc: 'Report a non-functional machine',                             icon: '⚙️', tone: 'teal',    canvas: 'machines_infra' },
    { id: 'updates',     name: 'Updates & Alerts',   desc: 'Referrals · circulars · reminders',                           icon: '🔔', tone: 'pink',    canvas: 'notifications' },
  ],
  trainee: [
    { id: 'course',      name: 'My Course',          desc: 'Modules · lessons · credits · quick checks',                  icon: '📚', tone: 'indigo',  canvas: 'my_course',          section: 'learn' },
    { id: 'doubt',       name: 'Doubt Solver',       desc: 'Guru ji explains · or ask your trainer',                     icon: '💡', tone: 'emerald', canvas: 'doubt_solver',       section: 'learn' },
    { id: 'know',        name: 'What I Know',        desc: 'My attendance, marks, practicals, interests — fix mistakes', icon: '🪪', tone: 'sky',     canvas: 'what_i_know',        section: 'learn' },
    { id: 'plan',        name: 'My Plan',            desc: 'This week · upcoming tests · career steps',                   icon: '🗺️', tone: 'violet',  canvas: 'my_plan',            section: 'learn' },
    { id: 'choose',      name: 'Choose a Course',    desc: 'Which trade or new programme fits me',                        icon: '🧭', tone: 'teal',    canvas: 'course_selection',   section: 'learn' },
    { id: 'jobs',        name: 'Opportunities',      desc: 'Apprenticeship · OJT · wage openings for my ITI',             icon: '💼', tone: 'teal',    canvas: 'jobs',               section: 'work' },
    { id: 'apps',        name: 'My Applications',    desc: 'Interested → prepared → referred → interviewed → joined',     icon: '📨', tone: 'emerald', canvas: 'applications',       section: 'work' },
    { id: 'prep',        name: 'Job Prep',           desc: 'Résumé · documents · mock interview',                         icon: '🎒', tone: 'amber',   canvas: 'job_prep',           section: 'work' },
    { id: 'career',      name: 'Career Counsellor',  desc: 'Karuna · roles, wages, pathways',                             icon: '🎯', tone: 'fuchsia', canvas: 'career_counsellor',  section: 'work' },
    { id: 'ojt',         name: 'OJT Logbook',        desc: 'Log hours at the employer · mentor sign-off',                 icon: '🛠️', tone: 'orange',  canvas: 'ojt_logbook',        section: 'work' },
    { id: 'placement',   name: 'Report Offer / Joining', desc: 'Tell your ITI you got an offer or joined; dispute errors', icon: '🤝', tone: 'violet',  canvas: 'placement_confirm',  section: 'work' },
    { id: 'buddy',       name: 'On-Job Buddy',       desc: 'Month-1 and month-3 check-ins after you join',                icon: '🧑‍🤝‍🧑', tone: 'lime', canvas: 'on_job_buddy',       section: 'work' },
    { id: 'help',        name: 'Help from Institute', desc: 'Ask your trainer or principal · see their reply',            icon: '🙋', tone: 'sky',     canvas: 'help_from_institute',section: 'help' },
    { id: 'grievance',   name: 'Grievance',          desc: 'Trainer absent, machine broken, facilities',                  icon: '🆘', tone: 'rose',    canvas: 'grievance',          section: 'help' },
    { id: 'updates',     name: 'Updates & Alerts',   desc: 'Deadlines · reminders · replies',                             icon: '🔔', tone: 'pink',    canvas: 'notifications',      section: 'help' },
  ],
  ima_officer: [
    { id: 'queue',       name: 'Verification Queue', desc: 'Milestones submitted by the SPV · evidence review',       icon: '🧾', tone: 'indigo',  canvas: 'verification_queue' },
    { id: 'kpi',         name: 'KPI Audit',          desc: 'Values vs source and coverage · verify or flag',          icon: '🎯', tone: 'rose',    canvas: 'kpi_audit' },
    { id: 'tranche',     name: 'Tranche Certification', desc: 'Conditions met? Certify for release',                  icon: '🏦', tone: 'emerald', canvas: 'tranche_readiness' },
    { id: 'reports',     name: 'Report Review',      desc: 'Quarterly reports · AOP · return or approve',             icon: '📄', tone: 'sky',     canvas: 'report_review' },
    { id: 'placements',  name: 'Placement Sampling', desc: 'Sample joined records · mark independently verified',     icon: '🤝', tone: 'pink',    canvas: 'placements_cluster' },
    { id: 'civil',       name: 'Site Inspections',   desc: 'Civil works progress vs claimed',                         icon: '🏢', tone: 'orange',  canvas: 'civil_works' },
    { id: 'procurement', name: 'Procurement Check',  desc: 'Delivered vs installed vs commissioned',                  icon: '📦', tone: 'teal',    canvas: 'procurement' },
    { id: 'itis',        name: 'ITI Field View',     desc: 'Seat utilisation, machines, attendance per ITI',          icon: '🏫', tone: 'violet',  canvas: 'iti_dashboard' },
    { id: 'updates',     name: 'Updates & Alerts',   desc: 'New submissions · deadlines',                             icon: '🔔', tone: 'amber',   canvas: 'notifications' },
  ],
  employer: [
    { id: 'confirm',     name: 'Confirm Hires',      desc: 'Interviews, offers and joiners reported by students',     icon: '✅', tone: 'emerald', canvas: 'confirm_hire' },
    { id: 'ojt',         name: 'OJT Trainees',       desc: 'Trainees at your site · sign the logbook',                icon: '🛠️', tone: 'amber',   canvas: 'ojt_tracker' },
    { id: 'post',        name: 'Post an Opening',    desc: 'Apprenticeship, OJT or wage opportunity',                 icon: '➕', tone: 'indigo',  canvas: 'post_opening' },
    { id: 'hires',       name: 'My Hires',           desc: 'All joiners with your firm · evidence state',             icon: '👥', tone: 'sky',     canvas: 'placements_cluster' },
    { id: 'updates',     name: 'Updates & Alerts',   desc: 'Confirmations due · placement drives',                    icon: '🔔', tone: 'pink',    canvas: 'notifications' },
  ],
  curriculum_dev: [
    { id: 'builder',     name: 'Course Builder',     desc: '240-hour modules · lessons · OJT · learning outcomes',    icon: '🧱', tone: 'indigo',  canvas: 'course_builder' },
    { id: 'pipeline',    name: 'NCVET Pipeline',     desc: 'Draft → CSTARI → NCVET review → approved · launch gates', icon: '📜', tone: 'amber',   canvas: 'ncvet_pipeline' },
    { id: 'library',     name: 'Trade Library',      desc: 'All trades, offerings per ITI, module status',            icon: '📚', tone: 'emerald', canvas: 'course_builder' },
    { id: 'updates',     name: 'Updates & Alerts',   desc: 'NCVET queries · SPV requests',                            icon: '🔔', tone: 'pink',    canvas: 'notifications' },
  ],
  state_pmu: [
    { id: 'scorecard',   name: 'State Scorecard',    desc: 'All clusters · utilisation · KPI score · milestones',     icon: '🗺️', tone: 'indigo',  canvas: 'state_scorecard' },
    { id: 'tranche',     name: 'Tranche Status',     desc: 'Conditions per cluster · state share due',                icon: '🏦', tone: 'emerald', canvas: 'tranche_readiness' },
    { id: 'reports',     name: 'AOP Approvals',      desc: 'AOPs and quarterly reports awaiting SSC',                 icon: '📄', tone: 'sky',     canvas: 'report_review' },
    { id: 'kpi',         name: 'KPI Audit',          desc: 'Cluster KPIs with coverage and verification flags',       icon: '🎯', tone: 'rose',    canvas: 'kpi_audit' },
    { id: 'dashboard',   name: 'Cluster Dashboard',  desc: 'Drill into the Delhi cluster',                            icon: '🏗️', tone: 'violet',  canvas: 'transformation_dashboard' },
    { id: 'updates',     name: 'Updates & Alerts',   desc: 'MSDE scorecard · submissions',                            icon: '🔔', tone: 'pink',    canvas: 'notifications' },
  ],
}

export const ROLE_SECTIONS = {
  spv_ceo: {
    order: ['budget', 'profile', 'registry', 'ops', 'placement', 'support'],
    meta: {
      budget:    { title: 'Budget Analytics',   subtitle: 'Allocations and releases, release history, utilisation',             accent: 'from-amber-50 to-white',   ring: 'ring-amber-200',   dot: 'bg-amber-500' },
      profile:   { title: 'Institute Profile',  subtitle: 'One ITI at a time: overview, trade offerings, facilities',    accent: 'from-violet-50 to-white',  ring: 'ring-violet-200',  dot: 'bg-violet-500' },
      registry:  { title: 'Cluster Registry',   subtitle: 'Students and trainers across the five ITIs',                  accent: 'from-fuchsia-50 to-white', ring: 'ring-fuchsia-200', dot: 'bg-fuchsia-500' },
      ops:       { title: 'Daily Operations',   subtitle: 'Attendance, assessment, infrastructure, upcoming events',     accent: 'from-indigo-50 to-white',  ring: 'ring-indigo-200',  dot: 'bg-indigo-500' },
      placement: { title: 'Placement Analytics', subtitle: 'Pipeline and employers',                                     accent: 'from-emerald-50 to-white', ring: 'ring-emerald-200', dot: 'bg-emerald-500' },
      support:   { title: 'Support and Alerts', subtitle: 'What students raise, grievances, notifications',              accent: 'from-rose-50 to-white',    ring: 'ring-rose-200',    dot: 'bg-rose-500' },
    },
  },
  iti_principal: {
    order: ['budget', 'institute', 'ops', 'placement', 'support'],
    meta: {
      budget:    { title: 'Budget Analytics',    subtitle: 'Allocation, releases and utilisation for my ITI',                 accent: 'from-amber-50 to-white',   ring: 'ring-amber-200',   dot: 'bg-amber-500' },
      institute: { title: 'My Institute',        subtitle: 'Profile, campus, trade offerings, students, trainers, batches',  accent: 'from-violet-50 to-white',  ring: 'ring-violet-200',  dot: 'bg-violet-500' },
      ops:       { title: 'Daily Operations',    subtitle: 'Attendance, assessment, infrastructure, upcoming events',        accent: 'from-indigo-50 to-white',  ring: 'ring-indigo-200',  dot: 'bg-indigo-500' },
      placement: { title: 'Placement Analytics', subtitle: 'Pipeline and employers for my students',                         accent: 'from-emerald-50 to-white', ring: 'ring-emerald-200', dot: 'bg-emerald-500' },
      support:   { title: 'Support and Alerts',  subtitle: 'What students raise, grievances, notifications',                 accent: 'from-rose-50 to-white',    ring: 'ring-rose-200',    dot: 'bg-rose-500' },
    },
  },
  trainee: {
    order: ['learn', 'work', 'help'],
    meta: {
      learn: { title: 'Learn', subtitle: 'Your course, your doubts, what Saathi knows', accent: 'from-indigo-50 to-white', ring: 'ring-indigo-200', dot: 'bg-indigo-500' },
      work:  { title: 'Work', subtitle: 'Opportunities, applications, prep, OJT, on the job', accent: 'from-emerald-50 to-white', ring: 'ring-emerald-200', dot: 'bg-emerald-500' },
      help:  { title: 'Help', subtitle: 'Your institute, grievances and notices', accent: 'from-rose-50 to-white', ring: 'ring-rose-200', dot: 'bg-rose-500' },
    },
  },
}

export const ROLE_SUGGESTIONS = {
  spv_ceo: ['What is overdue on the milestone board?', 'Which ITIs are reporting operations data?', 'Are we on track for the Year-2 first tranche?', 'What are students raising most this month?', 'How many joined records are employer-confirmed?'],
  iti_principal: ['What is attendance today?', 'Which workshops are not ready?', 'How many students joined a job this year?', 'Which courses do we offer?', 'What are students raising most this month?'],
  trainer: ['What do I have today?', 'Mark attendance for my 09:30 class', 'Enter marks for practical check 1', 'Who needs a recheck?', 'Which students want help?'],
  trainee: ['Open my plan', 'Teen-phase circuit samajh nahi aaya', 'Apprenticeship ke liye kya documents chahiye?', 'Meri attendance kaisi hai?', 'Mere trainer se baat karni hai'],
  ima_officer: ['What is waiting for verification?', 'Which KPI values have a source?', 'Sample three joined placement records', 'Review the Q2 quarterly report'],
  employer: ['Confirm the joiners reported this week', 'Which trainees are on OJT with us?', 'Post an opening for 6 electricians'],
  curriculum_dev: ['Open the Advanced Welding programme', 'Which launch gates depend on NCVET approval?', 'Draft module 3 for the automation programme'],
  state_pmu: ['Where does the Delhi cluster stand?', 'Which AOPs are pending with the SSC?', 'What share is the state due in July 2027?'],
}

export const ROLE_CANVASES = {
  spv_ceo: ['cluster_home', 'institute_profile', 'five_year_targets', 'annual_plan', 'milestone_board', 'transformation_dashboard', 'tranche_readiness', 'milestones', 'reports', 'sip_budget', 'civil_works', 'procurement', 'finance_escrow', 'board_matters', 'cluster_operations', 'institute_today', 'student_voice', 'companion_kb', 'placement_pipeline', 'employer_register', 'placements_cluster', 'ojt_tracker', 'iti_dashboard', 'batches', 'machines_infra', 'support_queue', 'student_profile', 'daily_ops', 'field_visit', 'assessments', 'attendance_bot', 'grievances_admin', 'notifications', 'saathi_assistant'],
  iti_principal: ['institute_today', 'attendance_bot', 'assessments', 'support_queue', 'field_visit', 'daily_ops', 'batches', 'institute_profile', 'annual_plan', 'milestone_board', 'five_year_targets', 'milestones', 'student_voice', 'companion_kb', 'placement_pipeline', 'employer_register', 'placements_cluster', 'ojt_tracker', 'machines_infra', 'civil_works', 'iti_dashboard', 'practical_bot', 'student_profile', 'grievances_admin', 'notifications', 'saathi_assistant'],
  trainer: ['trainer_my_day', 'attendance_bot', 'assessments', 'practical_bot', 'my_commitments', 'support_queue', 'daily_ops', 'for_my_batches', 'batches', 'module_plan', 'machines_infra', 'ojt_tracker', 'student_profile', 'notifications', 'saathi_assistant'],
  trainee: ['my_course', 'doubt_solver', 'what_i_know', 'my_plan', 'course_selection', 'jobs', 'applications', 'job_prep', 'career_counsellor', 'ojt_logbook', 'placement_confirm', 'on_job_buddy', 'help_from_institute', 'grievance', 'notifications', 'saathi_assistant'],
  ima_officer: ['verification_queue', 'kpi_audit', 'tranche_readiness', 'report_review', 'placements_cluster', 'placement_pipeline', 'civil_works', 'procurement', 'iti_dashboard', 'transformation_dashboard', 'cluster_home', 'cluster_operations', 'milestone_board', 'notifications', 'saathi_assistant'],
  employer: ['confirm_hire', 'ojt_tracker', 'post_opening', 'placements_cluster', 'notifications', 'saathi_assistant'],
  curriculum_dev: ['course_builder', 'ncvet_pipeline', 'five_year_targets', 'companion_kb', 'notifications', 'saathi_assistant'],
  state_pmu: ['state_scorecard', 'tranche_readiness', 'report_review', 'kpi_audit', 'transformation_dashboard', 'cluster_home', 'cluster_operations', 'placement_pipeline', 'notifications', 'saathi_assistant'],
}

export function defaultBotsFor(role) { return ROLE_BOTS[role] || [] }
export function suggestionsFor(role) { return ROLE_SUGGESTIONS[role] || [] }
export function canvasesFor(role)    { return ROLE_CANVASES[role] || [] }
export function homeLayoutFor(role)  { return ROLE_HOME_LAYOUT[role] || 'desktop' }
export function sectionsFor(role)    { return ROLE_SECTIONS[role] || null }
