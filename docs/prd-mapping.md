# PRD → prototype mapping

_Last updated: 2026-10-13_

How the four modules in the PM SETU product requirements document map onto routes, models and screens, and which dummy-data tabs feed each.

## Module A — SIP & Annual Plan Tracker

| PRD element | Data (workbook tab → model) | Route | Screen |
|---|---|---|---|
| Cluster and ITI anchors | ITIs, SIP overview, Site annual budgets → `Cluster`, `Iti` | `GET /api/plan/home` | Cluster Home |
| Institute profile, 7 tabs with confirmation | ITIs, Offerings, Course annual plan, Packages, Launch gates, registry Faculty → `Iti.profileSections` | `GET /api/plan/itis/:code/profile`, `POST …/profile/confirm` | Institute Profile |
| Five-year targets | Course annual plan, KPI plan, KPI definitions, Five year budget, Phasing → `Offering`, `OfferingPlan`, `Kpi.targets`, `Package.yearly` | `GET /api/plan/targets` | Five-Year Targets |
| Annual plan: outcomes / workplan / calendar | KPI plan (Y1), AOP all years, Y1 tasks → `AopRecord`, `PlanTask` | `GET /api/plan/annual`, `POST /api/plan/tasks/:id/update`, `…/review` | Annual Plan |
| Task states | planned → in_progress → blocked → reported_complete → completed → reviewed / returned; evidence note required to report complete | same | Annual Plan, Milestone Board |
| Milestone board, dependency chain, slip | Y1 tasks (Predecessor) + `Milestone` | `GET /api/plan/milestone-board` | Milestone Board |
| Change requests | `ChangeRequest` (proposed → approved_internal / returned / routed_formal) | `GET/POST /api/plan/changes`, `POST …/:id/decide` | Milestone Board, Cluster Home |
| Launch gates (space, staff, course, student) | Launch gates → `LaunchGate`; course gate opens when the trade is approved | `GET /api/plan/gates`, `POST …/:id/state`, `POST /api/lms/trades/:id/status` | Institute Profile, NCVET Pipeline |
| Risks and evidence rules | Risks and changes, Evidence rules → `Risk`, `EvidenceRule` | `GET /api/plan/risks` | Cluster Home |
| Trainer commitments | Trainer assignments + assessments, rechecks, support, referrals | `GET /api/plan/my-commitments` | My Commitments |

Money rule: `PlanTask` has no budget field. Spend lives on `AopRecord.spentCr` (per package per year) and is aggregated into `BudgetLine` by category for the tranche arithmetic.

## Module B — Institute Operations

| PRD element | Model | Route | Screen |
|---|---|---|---|
| Timetable sessions with delivery status | `Session` (scheduled / delivered / partial / rescheduled / cancelled) | `GET /api/ops/sessions`, `POST …/:id/delivery` | Attendance, Institute Today |
| Attendance per session, five marks, offline, principal confirm | `AttendanceMark` (present / absent / late / excused / roster_issue); `Session.attendanceState` not_reported → submitted / needs_review → confirmed; `syncState` | `POST /api/ops/sessions/:id/attendance`, `…/sync`, `…/confirm`, `POST /api/ops/marks/:id/correct` | Attendance (trainer + principal views), Trainer's Day |
| Assessments: calendar, typed or scanned marks, review | `AssessmentPlan` (planned → marks_pending → submitted / needs_review → confirmed), `MarkEntry` (source manual / ocr, confidence, reviewState) | `GET/POST /api/ops/assessments`, `POST …/:id/scan`, `…/marks`, `…/review` | Assessments |
| Practical observation with rubric | `PracticalTask`, `PracticalObservation` (demonstrated / developing / needs_re_practice / not_observed, recheckAt) | `GET /api/ops/practicals`, `POST /api/ops/practicals/observe` | Practical Bot |
| Field visit checklist and findings | `Visit`, `Finding` (open → action_assigned → closed) | `GET/POST /api/ops/visits`, `POST /api/ops/findings/:id/close` | Field Visit |
| Daily ops issues | `OpsIssue` (equipment / space / consumables / safety / timetable / trainer) | `GET/POST /api/ops/issues`, `POST …/:id/update` | Daily Ops |
| Trainer availability | `TrainerAvailability` | `POST /api/ops/availability` | Trainer's Day, Institute Today |
| Institute today: coverage, silent classes, reviews | computed | `GET /api/ops/institute-today` | Institute Today |
| Cluster operations with coverage | computed; non-connected ITIs return `registryConnected: false` | `GET /api/ops/cluster-operations` | Cluster Operations |
| Support queue | `SupportAction` (repeated_absence / low_result / recheck_due / companion_referral), `Referral` | `GET /api/ops/support`, `POST …/:id/update` | Support Queue |
| Student 360 | computed | `GET /api/ops/students/:id` | Student (from rosters, support queue, pipeline) |

Coverage rule: dashboards show `null` → "—" / "no feed" when nothing was submitted; averages are computed only over reported sessions and say so.

## Module C — Student Companion + Student Voice

| PRD element | Model | Route | Screen |
|---|---|---|---|
| What the companion knows; corrections | `Trainee`, marks, practicals, `CompanionArtifact.profile`, direct `CompanionEvent`s, `Referral` (registry_correction) | `GET /api/companion/me`, `POST /api/companion/referrals` | What I Know |
| My plan (today, tests, career steps) | sessions, `AssessmentPlan`, `CompanionArtifact.career_plan` | `GET /api/companion/me`, `PUT /api/companion/artifacts/:kind` | My Plan |
| Ask my trainer / help from institute, explicit sharing | `Referral` (sent → accepted → contacted → action_agreed → resolved; `shared` JSON) | `GET/POST /api/companion/referrals`, `POST …/:id/respond` | Help from Institute, Doubt Solver (Ask my trainer), Support Queue |
| Companion signals | `CompanionEvent` (stage, theme, direct / inferred, confidence, guestKey) | `POST /api/companion/event` | logged by Doubt Solver, quick checks, applications |
| Job prep | `CompanionArtifact.resume`, `.application_checklist`, mock-interview referral | `PUT /api/companion/artifacts/:kind` | Job Prep |
| Student Voice dashboard | aggregated `CompanionEvent` by theme / stage / week / programme / ITI; direct vs inferred; guests counted separately | `GET /api/companion/voice` | Student Voice (principal: own ITI; CEO: cluster) |

### Student Companion knowledge base (Student_Companion_Dummy KB.xlsx)

| KB sheet | Model | Where it is used |
|---|---|---|
| Course Catalogue (18) | `KbCourse` | Choose a Course cards (practical focus, sample project, tools, Y1 intake); Karuna/Saathi grounding; Companion KB screen |
| Role Catalogue + Course Role Map (24) | `KbRole` (map fields merged) | Career Counsellor role cards; "set as target" writes `SIG-ROLE-STATED` and seeds the career plan |
| Interest Map (16) | `KbInterest` | Choose a Course interest chips → suggested programme + clarifying question |
| Learning Topics (36) | `KbTopic` | Doubt Solver topic chips with safety level and escalation rule; `SIG-DOUBT-TOPIC` / `SIG-STILL-CONFUSED` |
| Support Directory (12) | `SupportContact` | Help from Institute: who handles what, consent step, response time |
| Opportunities (12) | `Employer` (EMP-KB-xx) + `Opportunity` (OPP-001…012, live, approved for PUS+SHA) | Opportunities, Job Prep checklist, placement pipeline |
| Signal Taxonomy (24) | `SignalType`; `CompanionEvent.signalCode` | Student Voice signal table (distinct students; sensitive signals under 3 students suppressed) |
| Response Rules (15) | `ResponseRule` | Appended to the companion persona prompt (`roleContext.js`) and shown in the Companion KB screen |

Route: `GET /api/companion/kb` (filtered to the caller's ITI and programme; `all=1` for the full set). `POST /api/companion/event` accepts `signalCode` and `conversationId`.

## Module D — Industry & Placement

| PRD element | Model | Route | Screen |
|---|---|---|---|
| Employer register (by role) | `Employer` (lead / active / paused, MoU, participating ITIs, feedback) | `GET/POST /api/placement/employers`, `POST …/:id/update` | Employer Register |
| Opportunity lifecycle | `Opportunity` (lead → checking → live → paused → filled / expired → archived; approvedItis; version) | `GET/POST /api/placement/opportunities`, `POST …/:id/status` | Employer Register, Post an Opportunity, Opportunities (student) |
| Person-level pipeline | `Application` (interested → prepared → referred → applied → interviewed → offered → joined → follow_up; declined / withdrawn / not_selected) with `timeline` | `GET/POST /api/placement/applications`, `POST …/:id/stage` | Placement Pipeline, My Applications, Placement for my batches |
| Evidence levels | `Application.evidenceLevel`: none → student_reported → document_supported → employer_confirmed → independently_verified; disputed. Set by actor: student, coordinator, employer, IMA | same | Joined Records, Confirm Hires, Report Offer / Joining |
| Employment spells and follow-ups | `EmploymentSpell` (apprenticeship / ojt / wage; logbook; mentor + ITI sign-off), `FollowUp` (month 1, month 3) | `GET /api/placement/spells`, `POST …/:id/log`, `…/sign`, `POST /api/placement/followups/:id/respond` | OJT Tracker, OJT Logbook, On-Job Buddy |
| Employer feedback | `EmployerFeedback` (demand / interviewed / joined; quotable) | `GET/POST /api/placement/feedback` | Employer Register |

KPI linkage: K06 (MoUs), K07 (apprenticeships started), K21 (conversion) and the placement KPIs read from these tables; only employer-confirmed or independently verified joins should reach a reported figure.

## What stays as it was

Compliance screens (transformation dashboard, tranche readiness with simulator, SIP budget, civil works, procurement, escrow & UCs, milestones & evidence, reports & AOP, board matters), the IMA, industry partner, curriculum developer and State PMU personas, the LMS (My Course, Doubt Solver), and Saathi chat / voice. They now read the Delhi data: budget lines are Year-1 categories aggregated from the 66 packages, civil works are the 15 civil packages, procurement packages are the Year-1 equipment and digital packages, and placements come from the application pipeline.

## Data provenance

`server/scripts/convert-xlsx.py` converts the three workbooks to `server/data/delhi/{plan,registry,mapping}.json`. The seed reads them verbatim and layers synthetic operations on top with a fixed random seed, so every re-seed produces the same demo. Registry dates are shifted +1 year so that Year 1 of the plan is Aug 2026 – Jul 2027 and today is month 3. Fields the registry lacks (social category, SC/ST/EWS) are left null and the matching KPI (K12) is marked "no source" rather than estimated.
