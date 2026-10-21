// Canvas module registry — maps `canvas.type` → component + header metadata.
import GenericCanvas from './GenericCanvas.jsx'
import DailyOperationsCanvas from './DailyOperationsCanvas.jsx'
import ClusterRegistryCanvas from './ClusterRegistryCanvas.jsx'
import BudgetAnalyticsCanvas from './BudgetAnalyticsCanvas.jsx'
import MyInstituteCanvas from './MyInstituteCanvas.jsx'
import SkillPassportCanvas from './SkillPassportCanvas.jsx'
import DocumentVaultCanvas from './DocumentVaultCanvas.jsx'
import TimetableCanvas from './TimetableCanvas.jsx'
import MarksAnalyticsCanvas from './MarksAnalyticsCanvas.jsx'
import PlacementJourneyCanvas from './PlacementJourneyCanvas.jsx'
import ResumeBuilderCanvas from './ResumeBuilderCanvas.jsx'
import UpskillingCanvas from './UpskillingCanvas.jsx'
import NotificationsCanvas from './NotificationsCanvas.jsx'
import SaathiAssistantCanvas from './SaathiAssistantCanvas.jsx'
import GrievanceCanvas from './GrievanceCanvas.jsx'
// Module A — SIP & annual plan
import ClusterHomeCanvas from './ClusterHomeCanvas.jsx'
import InstituteProfileCanvas from './InstituteProfileCanvas.jsx'
import FiveYearTargetsCanvas from './FiveYearTargetsCanvas.jsx'
import AnnualPlanCanvas from './AnnualPlanCanvas.jsx'
import MilestoneBoardCanvas from './MilestoneBoardCanvas.jsx'
import MyCommitmentsCanvas from './MyCommitmentsCanvas.jsx'
// SPV compliance layer
import TransformationDashboardCanvas from './TransformationDashboardCanvas.jsx'
import TrancheReadinessCanvas from './TrancheReadinessCanvas.jsx'
import MilestonesCanvas from './MilestonesCanvas.jsx'
import ReportsCanvas from './ReportsCanvas.jsx'
import SipBudgetCanvas from './SipBudgetCanvas.jsx'
import CivilWorksCanvas from './CivilWorksCanvas.jsx'
import ProcurementCanvas from './ProcurementCanvas.jsx'
import FinanceEscrowCanvas from './FinanceEscrowCanvas.jsx'
import BoardMattersCanvas from './BoardMattersCanvas.jsx'
// Module B — institute operations
import TrainerMyDayCanvas from './TrainerMyDayCanvas.jsx'
import AttendanceBotCanvas from './AttendanceBotCanvas.jsx'
import AssessmentsCanvas from './AssessmentsCanvas.jsx'
import PracticalBotCanvas from './PracticalBotCanvas.jsx'
import FieldVisitCanvas from './FieldVisitCanvas.jsx'
import DailyOpsCanvas from './DailyOpsCanvas.jsx'
import InstituteTodayCanvas from './InstituteTodayCanvas.jsx'
import ClusterOperationsCanvas from './ClusterOperationsCanvas.jsx'
import SupportQueueCanvas from './SupportQueueCanvas.jsx'
import StudentProfileCanvas from './StudentProfileCanvas.jsx'
import ItiDashboardCanvas from './ItiDashboardCanvas.jsx'
import MachinesCanvas from './MachinesCanvas.jsx'
import BatchesCanvas from './BatchesCanvas.jsx'
import ModulePlanCanvas from './ModulePlanCanvas.jsx'
import GrievancesAdminCanvas from './GrievancesAdminCanvas.jsx'
// Module C — student companion
import WhatIKnowCanvas from './WhatIKnowCanvas.jsx'
import MyPlanCanvas from './MyPlanCanvas.jsx'
import ApplicationsCanvas from './ApplicationsCanvas.jsx'
import HelpFromInstituteCanvas from './HelpFromInstituteCanvas.jsx'
import JobPrepCanvas from './JobPrepCanvas.jsx'
import StudentVoiceCanvas from './StudentVoiceCanvas.jsx'
import CompanionKbCanvas from './CompanionKbCanvas.jsx'
import MyCourseCanvas from './MyCourseCanvas.jsx'
import DoubtSolverCanvas from './DoubtSolverCanvas.jsx'
import CourseSelectionCanvas from './CourseSelectionCanvas.jsx'
import CareerCounsellorCanvas from './CareerCounsellorCanvas.jsx'
import OjtLogbookCanvas from './OjtLogbookCanvas.jsx'
import PlacementConfirmCanvas from './PlacementConfirmCanvas.jsx'
import OnJobBuddyCanvas from './OnJobBuddyCanvas.jsx'
import JobsCanvas from './JobsCanvas.jsx'
// Module D — industry & placement
import PlacementPipelineCanvas from './PlacementPipelineCanvas.jsx'
import EmployerRegisterCanvas from './EmployerRegisterCanvas.jsx'
import ForMyBatchesCanvas from './ForMyBatchesCanvas.jsx'
import PlacementsCanvas from './PlacementsCanvas.jsx'
import OjtTrackerCanvas from './OjtTrackerCanvas.jsx'
import ConfirmHireCanvas from './ConfirmHireCanvas.jsx'
import PostOpeningCanvas from './PostOpeningCanvas.jsx'
// Curriculum, verification, state
import CourseBuilderCanvas from './CourseBuilderCanvas.jsx'
import NcvetPipelineCanvas from './NcvetPipelineCanvas.jsx'
import VerificationQueueCanvas from './VerificationQueueCanvas.jsx'
import KpiAuditCanvas from './KpiAuditCanvas.jsx'
import ReportReviewCanvas from './ReportReviewCanvas.jsx'
import StateScorecardCanvas from './StateScorecardCanvas.jsx'

export const CANVAS_MODULES = {
  cluster_home: ClusterHomeCanvas, institute_profile: InstituteProfileCanvas, five_year_targets: FiveYearTargetsCanvas, annual_plan: AnnualPlanCanvas, milestone_board: MilestoneBoardCanvas, my_commitments: MyCommitmentsCanvas,
  transformation_dashboard: TransformationDashboardCanvas, tranche_readiness: TrancheReadinessCanvas, milestones: MilestonesCanvas, reports: ReportsCanvas, sip_budget: SipBudgetCanvas, civil_works: CivilWorksCanvas, procurement: ProcurementCanvas, finance_escrow: FinanceEscrowCanvas, board_matters: BoardMattersCanvas,
  trainer_my_day: TrainerMyDayCanvas, attendance_bot: AttendanceBotCanvas, attendance_mark: AttendanceBotCanvas, assessments: AssessmentsCanvas, assessment_capture: AssessmentsCanvas, practical_bot: PracticalBotCanvas, field_visit: FieldVisitCanvas, daily_ops: DailyOpsCanvas, institute_today: InstituteTodayCanvas, cluster_operations: ClusterOperationsCanvas, support_queue: SupportQueueCanvas, student_profile: StudentProfileCanvas,
  iti_dashboard: ItiDashboardCanvas, machines_infra: MachinesCanvas, batches: BatchesCanvas, module_plan: ModulePlanCanvas, grievances_admin: GrievancesAdminCanvas,
  what_i_know: WhatIKnowCanvas, my_plan: MyPlanCanvas, applications: ApplicationsCanvas, help_from_institute: HelpFromInstituteCanvas, job_prep: JobPrepCanvas, student_voice: StudentVoiceCanvas, companion_kb: CompanionKbCanvas,
  my_course: MyCourseCanvas, doubt_solver: DoubtSolverCanvas, course_selection: CourseSelectionCanvas, career_counsellor: CareerCounsellorCanvas, ojt_logbook: OjtLogbookCanvas, placement_confirm: PlacementConfirmCanvas, on_job_buddy: OnJobBuddyCanvas, jobs: JobsCanvas, grievance: GrievanceCanvas,
  placement_pipeline: PlacementPipelineCanvas, employer_register: EmployerRegisterCanvas, for_my_batches: ForMyBatchesCanvas, placements_cluster: PlacementsCanvas, ojt_tracker: OjtTrackerCanvas, confirm_hire: ConfirmHireCanvas, post_opening: PostOpeningCanvas,
  course_builder: CourseBuilderCanvas, ncvet_pipeline: NcvetPipelineCanvas, verification_queue: VerificationQueueCanvas, kpi_audit: KpiAuditCanvas, report_review: ReportReviewCanvas, state_scorecard: StateScorecardCanvas,
  notifications: NotificationsCanvas, saathi_assistant: SaathiAssistantCanvas,
  daily_operations: DailyOperationsCanvas, cluster_registry: ClusterRegistryCanvas, budget_analytics: BudgetAnalyticsCanvas, my_institute: MyInstituteCanvas,
  skill_passport: SkillPassportCanvas, document_vault: DocumentVaultCanvas, timetable: TimetableCanvas, marks_analytics: MarksAnalyticsCanvas, placement_journey: PlacementJourneyCanvas, resume_builder: ResumeBuilderCanvas, upskilling: UpskillingCanvas,
  __default__: GenericCanvas,
}

const META = {
  daily_operations: { title: 'Daily Operations', subtitle: 'Attendance · assessment · infrastructure readiness · upcoming events', icon: '🗓️' },
  my_institute: { title: 'My Institute', subtitle: 'Profile · campus facilities · trade offerings · students · trainers · batches', icon: '🏫' },
  skill_passport: { title: 'Skill Passport', subtitle: 'Verified skills · stated interests · certificates', icon: '🎖️' },
  document_vault: { title: 'Document Vault', subtitle: 'DigiLocker · uploads · what is verified', icon: '🗂️' },
  timetable: { title: 'Timetable', subtitle: "Today · this week · exams", icon: '🗓️' },
  marks_analytics: { title: 'Marks & Analytics', subtitle: 'Every assessment with its source and date', icon: '📊' },
  placement_journey: { title: 'My Placement KPIs', subtitle: 'Applications · interviews · offers', icon: '🔻' },
  resume_builder: { title: 'Résumé Builder', subtitle: 'From your record and passport', icon: '📄' },
  upskilling: { title: 'Future Upskilling', subtitle: 'Programmes and next roles after experience', icon: '📈' },
  cluster_registry: { title: 'Cluster Registry', subtitle: 'Student registry · enrolment analytics · trainer registry', icon: '🗂️' },
  budget_analytics: { title: 'Budget Analytics', subtitle: 'AOP utilisation against the approved allocation', icon: '🧾' },
  cluster_home: { title: 'Cluster Home', subtitle: 'SIP funding · Year-1 by category and ITI · this month · headline KPIs · risks', icon: '🏠' },
  institute_profile: { title: 'Institute Profile', subtitle: 'Overview · trades · staffing · infrastructure · budget · targets · launch gates', icon: '🏫' },
  five_year_targets: { title: 'Five-Year Targets', subtitle: 'Places, enrolments, KPI trajectories, site budgets, phasing', icon: '📈' },
  annual_plan: { title: 'Annual Plan', subtitle: 'Workplan (AOP records + tasks) · calendar · assign tasks to principals', icon: '🗓️' },
  milestone_board: { title: 'Milestone Board', subtitle: 'Overdue, blocked, returned · dependency chain · change requests', icon: '🧭' },
  my_commitments: { title: 'My Commitments', subtitle: 'Batches, subjects, deadlines, referrals', icon: '📌' },
  transformation_dashboard: { title: 'Transformation Dashboard', subtitle: 'KPIs vs baseline · per-ITI progress · tranche readiness', icon: '🏗️' },
  tranche_readiness: { title: 'Tranche Readiness', subtitle: 'Guidelines §4.2 · cost-weighted KPI · 75% utilisation · AOP', icon: '🎯' },
  milestones: { title: 'Milestones & Evidence', subtitle: 'Submitted to the Independent Monitoring Agency', icon: '✅' },
  reports: { title: 'Reports & AOP', subtitle: 'Quarterly IMA pack · Annual Operational Plan', icon: '📄' },
  sip_budget: { title: 'SIP Budget', subtitle: '₹213 Cr · 66 packages · Year-1 lines', icon: '🧾' },
  civil_works: { title: 'Civil Works', subtitle: 'Frozen work units · measured completion · inspection · ≤20% of budget', icon: '🏢' },
  procurement: { title: 'Procurement', subtitle: 'Equipment and digital packages · delivered vs installed', icon: '📦' },
  finance_escrow: { title: 'Escrow & Utilisation Certificates', subtitle: 'Deposits by source · UCs · PFMS matching', icon: '🏦' },
  board_matters: { title: 'Board & Reserved Matters', subtitle: 'SHA reserved matters · delegated to CEO', icon: '⚖️' },
  trainer_my_day: { title: 'My Day', subtitle: "Today's sessions · what is owed · sync state", icon: '🌅' },
  attendance_bot: { title: 'Attendance', subtitle: 'One session · five marks · delivery status · offline-safe', icon: '🗓️' },
  attendance_mark: { title: 'Attendance', subtitle: 'One session · five marks · delivery status · offline-safe', icon: '🗓️' },
  assessments: { title: 'Assessments', subtitle: 'Calendar · enter or scan marks · principal review', icon: '📝' },
  assessment_capture: { title: 'Assessments', subtitle: 'Calendar · enter or scan marks · principal review', icon: '📝' },
  practical_bot: { title: 'Practical Bot', subtitle: 'Rubric observation per student · rechecks', icon: '🔧' },
  field_visit: { title: 'Field Visit', subtitle: 'Workshop checklist · findings with owners', icon: '🧰' },
  daily_ops: { title: 'Daily Ops', subtitle: 'Equipment · space · consumables · safety · timetable · trainer cover', icon: '🛠️' },
  institute_today: { title: 'Institute Today', subtitle: 'Coverage · silent classes · leave · reviews · support', icon: '🌅' },
  cluster_operations: { title: 'Cluster Operations', subtitle: 'Per-ITI coverage, attendance, assessments, issues', icon: '📡' },
  support_queue: { title: 'Support Queue', subtitle: 'Repeated absence · low results · rechecks · referrals', icon: '🫶' },
  student_profile: { title: 'Student', subtitle: 'Attendance · marks · practicals · support · applications', icon: '🪪' },
  iti_dashboard: { title: 'ITI Dashboard', subtitle: 'Intake · attendance coverage · trainers · machines · civil', icon: '🔎' },
  machines_infra: { title: 'Machines & Labs', subtitle: 'Asset register · functional status', icon: '⚙️' },
  batches: { title: 'Batches & Rosters', subtitle: 'Attendance · marks · practicals · risk', icon: '📚' },
  module_plan: { title: 'Module Plan', subtitle: 'Current 240-hour module · lessons', icon: '📖' },
  grievances_admin: { title: 'Support and grievance', subtitle: 'Case queue · escalations · resolution · knowledge and help', icon: '🆘' },
  what_i_know: { title: 'What I Know', subtitle: 'Your record, your signals, what was shared', icon: '🪪' },
  my_plan: { title: 'My Plan', subtitle: 'Today · upcoming tests · career steps', icon: '🗺️' },
  applications: { title: 'My Applications', subtitle: 'Interested → prepared → referred → applied → interviewed → offered → joined', icon: '📨' },
  help_from_institute: { title: 'Help from Institute', subtitle: 'Ask your trainer or principal · see the reply', icon: '🙋' },
  job_prep: { title: 'Job Prep', subtitle: 'Résumé · documents · mock interview', icon: '🎒' },
  student_voice: { title: 'Student Voice', subtitle: 'Themes from companion conversations · direct vs inferred', icon: '🗣️' },
  companion_kb: { title: 'Companion Knowledge Base', subtitle: 'Courses · roles · interests · topics · support · signals · rules', icon: '📖' },
  my_course: { title: 'My Course', subtitle: 'Modules · lessons · credits', icon: '📚' },
  doubt_solver: { title: 'Doubt Solver', subtitle: 'Guru ji · AI tutor · or ask your trainer', icon: '💡' },
  course_selection: { title: 'Choose a Course', subtitle: 'Trades and new programmes in your cluster', icon: '🧭' },
  career_counsellor: { title: 'Career Counsellor', subtitle: 'Karuna · roles, wages, pathways', icon: '🎯' },
  ojt_logbook: { title: 'OJT Logbook', subtitle: 'Log hours and tasks · mentor sign-off', icon: '🛠️' },
  placement_confirm: { title: 'Report Offer / Joining', subtitle: 'Your own signal; employer confirms', icon: '🤝' },
  on_job_buddy: { title: 'On-Job Buddy', subtitle: 'Month-1 and month-3 check-ins · support at work', icon: '🧑‍🤝‍🧑' },
  jobs: { title: 'Opportunities', subtitle: 'Checked by the SPV · approved for your ITI', icon: '💼' },
  grievance: { title: 'Grievance', subtitle: 'Raise and track', icon: '🆘' },
  placement_pipeline: { title: 'Placement Pipeline', subtitle: 'Person-level stages · evidence levels · conversion', icon: '🤝' },
  employer_register: { title: 'Employer Directory', subtitle: 'Relationships · MoUs · opportunity lifecycle · feedback', icon: '🏭' },
  for_my_batches: { title: 'Placement · My Batches', subtitle: 'Résumé reviews · mock interviews · referrals', icon: '🤝' },
  placements_cluster: { title: 'Joined Records', subtitle: 'Evidence levels · IMA sampling', icon: '🤝' },
  ojt_tracker: { title: 'OJT Tracker', subtitle: 'Spells · hours · mentor + ITI sign-off', icon: '🛠️' },
  confirm_hire: { title: 'Confirm Hires', subtitle: 'Employer confirmation raises the evidence level', icon: '✅' },
  post_opening: { title: 'Post an Opportunity', subtitle: 'Apprenticeship · OJT · wage', icon: '➕' },
  course_builder: { title: 'Course Builder', subtitle: '240-hour modules · lessons · OJT', icon: '🧱' },
  ncvet_pipeline: { title: 'NCVET Pipeline', subtitle: 'Draft → CSTARI → NCVET → approved · launch gates', icon: '📜' },
  verification_queue: { title: 'Verification Queue', subtitle: 'Milestones submitted by the SPV', icon: '🧾' },
  kpi_audit: { title: 'KPI Audit', subtitle: 'Values vs source and coverage · verification flags', icon: '🎯' },
  report_review: { title: 'Report Review', subtitle: 'Quarterly reports · AOP', icon: '📄' },
  state_scorecard: { title: 'State Scorecard', subtitle: 'Clusters · utilisation · KPI score · milestones', icon: '🗺️' },
  notifications: { title: 'Notifications', subtitle: 'Reminders & broadcasts', icon: '🔔' },
  saathi_assistant: { title: 'Saathi', subtitle: 'Your PM-SETU companion · opens any screen, answers anything', icon: '✨' },
}

export function getCanvasMeta(type) { return META[type] || { title: String(type || '').replace(/_/g, ' '), subtitle: '', icon: '🗂' } }
export function moduleFor(type) { return CANVAS_MODULES[type] || CANVAS_MODULES.__default__ }
