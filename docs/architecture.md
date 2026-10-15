# PM-SETU Saathi — architecture

_Last updated: 2026-10-13_

## 1. Thesis

Under PM-SETU every cluster SPV must prove its transformation to an Independent Monitoring Agency before money moves: 10% advance in Year 1, then two 50% tranches a year against ≥75% utilisation, an approved Annual Operational Plan, and ≥80% of KPI targets scored cost-weighted. PM-SETU Saathi is the system that produces that proof — and runs the cluster day to day so the proof is a by-product, not a reporting exercise.

The PRD adds four operating modules on top of the compliance layer: **A** SIP & annual plan tracker, **B** institute operations, **C** student companion + Student Voice, **D** industry & placement. See `docs/prd-mapping.md` for the element-by-element mapping.

## 2. Stack

Same skeleton as KSK (Kaushal Samiksha Kendra):

- **Frontend** `web/`: Vite + React 18 + Tailwind + lucide-react + recharts. No router; `AppContext.screen` drives pages, `AppContext.canvas` drives the right-hand canvas overlay. Role config in `web/src/roles/roleConfig.js`; canvases in `web/src/canvas/modules/` (registry in `index.js`); shared primitives in `_ui.jsx` (incl. `Tabs`, `Chips`, `NoFeed`, `Timeline`, `nil`/`fmtPct` for missing values); analyst dashboards use `_AnalystCanvasShell.jsx` (dashboard on top, Saathi underneath).
- **Backend** `server/`: Node + Express + Prisma on SQLite (provider-neutral schema; Postgres for hosting). OpenAI for Saathi (intent classification → canvas open, streaming chat with card fences, RAG over `server/data/knowledge`, voice via Realtime, OCR via vision). `server/src/lib/kpiEngine.js` holds the fund-release arithmetic; `server/src/lib/scope.js` resolves which cluster / ITI / batches / employer a user acts on (`trainerBatchIds`, `batchScope`, `resolveItiId`).
- **Data**: `server/data/delhi/*.json` converted from the three dummy workbooks by `server/scripts/convert-xlsx.py`; `server/src/seed/seed.js` loads them and layers deterministic synthetic operations.
- **CEO screens after the October review**: Cluster Home opens with the money (funding split, Year-1 by category and by ITI, five-year packages), then the month's tiles, then headline KPIs as a baseline/target/current table, then risks and change requests; the SIP Budget tile is gone (its content lives on Cluster Home). Five-Year Targets leads with a stacked spend-phasing chart (`StackedBarCard.jsx`, by category or by ITI) and folds the enrolment plan. Annual Plan has Workplan and Calendar only, ITI and category dropdowns, and an **Assign a task** toggle (`_AssignTask.jsx` → `POST /api/plan/tasks`, which creates a `PlanTask` under an AOP record and notifies the principal via `lib/notify.js`); task cards show an assignment stage (assigned / in progress, evidence awaited / evidence missing / submitted / returned) and the CEO can ask the principal for status (`POST /api/plan/tasks/:id/ask`). Civil Works and Procurement carry the same assign toggle plus ask-for-status (`/api/cluster/civil/:id/ask`, `/api/cluster/procurement/:id/ask`); the CEO no longer edits civil progress. Milestones submit evidence through a note form. Run the cluster is ITI Drill-down (batches folded), Placement Pipeline, Employer Register, Student Voice (no statements table), Grievances, Updates.
- **CEO headline cards (five)**: Attendance today, Female enrolment, Funds utilised, Upcoming events, Enrolment / seat utilisation. Each carries `open: { canvas, tab, filters }` and lands on a section view with those filters applied: Daily Operations → Attendance (date, scope) or Upcoming events (from, days, status); Cluster Registry → Student registry (gender, status, year) or Enrolment analytics (year, scope); Budget Analytics → Utilisation (AOP year, scope). The views read `/api/analytics/{attendance,events,students,enrolment,utilisation}` (`server/src/routes/analytics.js`); attendance falls back to the latest day with reported sessions and says so.
- **Headline strip**: `GET /api/headline` (`server/src/routes/headline.js`) returns the five numbers each role should see first (value, ring percentage against target, coverage hint, owning module). `web/src/components/HeadlineStrip.jsx` renders it as one fold on the home page above the module sections; tapping a tile opens the module. Figures with no source show "—".
- **Saathi as saved threads**: screens open standalone with no chat on them. Every non-chat canvas gets an **Ask Saathi** button in its header (`CanvasPanel.jsx`); analyst dashboards (`_AnalystCanvasShell.jsx`) also offer it on each card and as ready questions. All of these call `askSaathi()` (AppContext), which opens the `saathi_assistant` canvas with the screen's published context (`useSaathiContext()` in `web/src/canvas/CanvasSaathi.jsx`), an optional first prompt, and `from` so Back returns to the screen. The thread is saved with a `Screen · first question` title and the screen context in `ChatThread.canvasState`, so reopening it from the sidebar restores the same context. Companion screens (Karuna / Guru ji) remain conversations themselves.
- **Responsive**: one code path for desktop and phone. Home collapses the sidebar behind a menu; canvases go full-screen under 768px; grids stack to one or two columns; tables scroll inside their own container; the hero wraps its controls.
- **Auth**: demo-grade JWT. Role sign-in (ID + password) or phone OTP.

## 3. Personas and scope

| Role | Scope | Layout | Modules |
|---|---|---|---|
| spv_ceo | one cluster (5 ITIs; 2 registry-connected) | desktop | A, B (cluster ops), C (Student Voice), D + compliance |
| iti_principal | one ITI | desktop | A (profile, tasks), B, C (Student Voice), D |
| trainer | assigned batches and subjects | mobile | A (commitments), B, D (for my batches) |
| trainee | self | mobile | C, D (opportunities, applications, spells) + LMS |
| ima_officer | cluster verification | desktop | compliance, KPI audit, placement sampling |
| employer | own opportunities and joiners | mobile | D |
| curriculum_dev | trades and modules | desktop | CMS, NCVET pipeline (opens course launch gates) |
| state_pmu | state portfolio | desktop | scorecard, tranche, AOP review |

Hierarchy: **SPV (CEO + board) → ITI principal → instructor → student**, with the IMA, employer, curriculum developer and State PMU as parallel actors.

## 4. State machines

- **Plan task** (A): planned → in_progress → blocked → reported_complete (evidence note required) → completed → reviewed | returned. Predecessor chain and forecast date drive the milestone board. Changes to dates or targets go through a **ChangeRequest**: proposed → approved_internal | returned | routed_formal.
- **Launch gate** (A): pending → ready → passed | failed, one per prerequisite (space, staff, course, student) per new offering. The course gate becomes ready when the trade is NCVET-approved.
- **Session attendance** (B): delivery {scheduled, delivered, partial, rescheduled, cancelled} is independent of attendanceState {not_reported, submitted, needs_review, confirmed}; `syncState` saved_on_device → synced. Marks: present | absent | late | excused | roster_issue, with corrections kept.
- **Assessment** (B): planned → conducted → marks_pending → submitted | needs_review (OCR < 0.75 confidence) → confirmed; entries carry source, confidence and review state.
- **Practical observation** (B): demonstrated | developing | needs_re_practice (recheck date + support action) | not_observed.
- **Referral** (C): sent → accepted → contacted → action_agreed → resolved; `shared` records exactly what the student allowed.
- **Opportunity** (D): lead → checking → live (approvedItis) → paused → filled | expired → archived.
- **Application** (D): interested → prepared (consent) → referred → applied → interviewed → offered → joined → follow_up; side exits declined | withdrawn | not_selected. **Evidence level** moves by actor: student → student_reported; coordinator → document_supported; employer → employer_confirmed; IMA → independently_verified | disputed.
- **Employment spell** (D): active → exited | converted | completed; OJT completes when mentor and ITI both sign; follow-ups at month 1 and 3.
- **Milestone** (compliance): pending → submitted → verified | rejected; linked plan tasks move with the IMA decision.
- **Report / AOP**: draft → submitted → ima_reviewed → approved | returned. **Course**: draft → submitted_cstari → ncvet_review → approved.

## 5. Data model (Prisma)

Plan: Cluster → Iti → Offering → OfferingPlan; Trade; Package → AopRecord → PlanTask; LaunchGate; EvidenceRule; Risk; Kpi (targets JSON, coverage, source); ChangeRequest.
Operations: Subject, Batch, TrainerAssignment, Trainee, Session → AttendanceMark, AssessmentPlan → MarkEntry, PracticalTask → PracticalObservation, Visit → Finding, OpsIssue, TrainerAvailability, SupportAction, Machine; LMS CourseModule → ModuleProgress.
Companion: CompanionEvent, Referral, CompanionArtifact.
Industry: Employer → Opportunity → Application → EmploymentSpell → FollowUp; EmployerFeedback.
Compliance: BudgetLine, CivilWork, ProcurementPackage, EscrowDeposit, UtilisationCertificate, Milestone, Report, BoardItem, Grievance.
Platform: User, Notification, ChatThread, ChatMessage, KnowledgeChunk, OtpCode.

## 6. KPI engine

`costWeightedScore(budgetLines, kpis)` = Σ(component weight × physical progress) + outcome block (Σ outcome weight × achievement, where achievement is the fraction of the way from baseline to Year-1 target). Component weights are each Year-1 category's share of planned spend × 0.9; the remaining 0.1 is the outcome block, and only KPIs with a current value and a weight contribute. `trancheReadiness()` evaluates the first- and second-tranche conditions from live rows. `/api/cluster/tranche-readiness/simulate` runs the same maths on hypothetical values for the what-if panel. KPIs without a source stay `null` and are rendered as "—" with their `valueStatus` and `coverage` text (e.g. "2 of 5 ITIs reporting").

## 7. API surface

`/api/auth`, `/api/me`, `/api/lookups` (public), `/api/plan/*` (home, itis/:code/profile, targets, annual, tasks, milestone-board, changes, gates, risks, my-commitments), `/api/ops/*` (my-day, availability, sessions, marks, assessments, practicals, visits, findings, issues, institute-today, cluster-operations, support, students/:id, grievances), `/api/companion/*` (me, event, referrals, artifacts, voice), `/api/placement/*` (employers, opportunities, applications, pipeline, for-my-batches, spells, followups, feedback), `/api/cluster/*` (overview, tranche-readiness, budget, civil, procurement, finance, milestones, reports + pack, board, kpis), `/api/itis/*`, `/api/batches/*`, `/api/lms/*`, `/api/state/scorecard`, `/api/notifications`, `/api/chats`, `/api/ai/*`, `/api/realtime`, `/api/avatar`, `/api/tts`, `/api/whisper`, `/api/ocr`.

Saathi actions (`server/src/llm/catalog.js` ↔ `web/src/nlp/dispatch.js`) and voice canvases (`server/src/voice/tools.js` ↔ `web/src/utils/voiceTools.js`) list every canvas; keep the four in sync when adding one.

## 8. Out of scope for this prototype

Real registry / LOMS / PFMS integration (JSON import stands in), real OCR on mark sheets (simulated with confidence scores; `/api/ocr` exists for photos), real SMS/WhatsApp delivery, multi-tenant isolation (one cluster), production auth.
