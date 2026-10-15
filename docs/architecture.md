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
- **Budget Analytics (section 1)**: `GET /api/analytics/budget` (year, ITI, work package = package category, releases as-of date) returns AOP allocation vs funds released per ITI and per work package, a cumulative monthly release line and the release history. Releases live in the new `FundRelease` table (seeded one or two tranches per Year-1 AOP record, Aug–Oct 2026; `projectState` completed / in_progress / stopped). The screen's ITI bars and package pie are clickable and re-scope the page; a release row opens a popup with the package, project, date and project status. Download report exports CSV. The Utilisation tab is unchanged and is what the Funds utilised card opens.
- **Daily Operations (section 4)**: `server/src/routes/daily.js` serves `/api/daily/{overview,attendance,assessments,readiness,events}` for a date (attendance and assessments fall back to the latest reported or scheduled day and say so). Readiness derives one workshop per ITI and trade from the machine register with five checks: space (delayed civil work in the trade's scope), electricity, safety and consumables (open operations issues matched by batch, machine or title keyword), equipment (functional machines); ready / restricted / unavailable. Events unions assessment days, IMA milestones, report due dates, opportunity closings, employer engagements and field visits. The screen (`DailyOperationsCanvas.jsx`) shows hero numbers, charts, and five-row lists with View more; the CEO view is read-only.
- **Orchestration (chat, streaming chat, voice)**: one navigation catalog in `server/src/nav/catalog.js` lists every screen + tab per role with the entities it accepts (ITI, trade, gender, date) and example phrasings; the CEO's targets are the six sections (budget_*, institute_*, registry_*, ops_*, placement_analytics, employer_directory, student_voice, grievances, notifications) plus the plan and compliance screens, never the older operations screens. `server/src/nav/interpret.js` classifies a request into a target (model-based with a keyword fallback that also runs without an OpenAI key), resolves the ITI by name or code, builds the canvas context (`type`, `tab`, `itiId`, `itiCode`, `filters`) and reads the live data behind that screen through `server/src/nav/snapshot.js`, which calls the same API routes the dashboards use with the user's own token. `POST /api/ai/message` navigates first and answers data questions from that snapshot; `POST /api/ai/navigate` serves the tools; `/api/ai/stream` and `/api/realtime/session` expose `open_canvas` and `lookup_data` tools (streaming chat emits a `navigate` SSE event, voice resolves through `/api/ai/navigate`) and both prompts carry a live cluster pack (60 s cache) instead of static numbers. `openCanvas` stamps a nonce so re-opening the same canvas with a different tab or ITI re-mounts it.
- **Placement Analytics (section 5)**: `/api/placement/analytics` (filters itiId, trade, type, employerId, asOf) returns live seats, application records, the distinct-person funnel (Eligible → Interested → Prepared → Applied / referred → Interviewed → Offered → Joined, each person once per stage), active joined outcomes by type, the verification ladder (reported / employer-confirmed / independently verified / disputed, not additive), retention checks (D30/D90/D180 coverage and known retention, "not due yet" until the window passes) and an ITI comparison. `/api/placement/employers/:id/profile` returns the employer with a generated description, sites, participating ITIs, trades, linked opportunities, placements and an interaction history. `PlacementPipelineCanvas.jsx` is the analytics page (Download report CSV); `EmployerRegisterCanvas.jsx` is the directory (filters ITI / sector / relationship / trade / search, Download list CSV, five-row list with View more, in-canvas employer record page with a back arrow, Add credible employer as a popup that creates the employer as a lead via `POST /api/placement/employers`, and an Opportunities tab). Seed pass-out cohorts exist for all five ITIs so the funnel has data per ITI.
- **Registry for all five ITIs**: Pusa and Shahdara come from the registry workbook; Narela, Rohini and Okhla are generated by `server/scripts/synth-registry.py` (deterministic, idempotent) into `server/data/delhi/registry.json` (institutes, programmes, batches, faculty, students) and `mapping.json` (batch allocation, batch subjects, trainer assignments, faculty index). The seed treats all five as registry-connected, so sessions, attendance, assessments and companion events exist for every ITI and coverage reads "5 of 5 ITIs reporting".
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
