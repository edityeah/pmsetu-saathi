# PM-SETU Saathi — cluster transformation platform (prototype)

The ConveGenius technical-partner stack for an Anchor Industry Partner's SPV under **PM-SETU** (Pradhan Mantri Skilling and Employability Transformation through Upgraded ITIs). Built on the KSK (Kaushal Samiksha Kendra) prototype architecture: one Saathi orchestrator, role-scoped apps, a canvas per workflow, maker-checker verification on every outcome.

**Core thesis:** an SPV's money (Years 2–5 tranches) is released only against evidence the Independent Monitoring Agency accepts — 75% utilisation, an approved AOP, and ≥80% of KPIs scored cost-weighted. Saathi collects that evidence at the source (student, instructor, ITI, employer), rolls it up to the SPV CEO, and emits what the IMA, SSC and NPMU ask for.

## The four PRD modules

The product requirements document shapes the CEO, principal, instructor and student screens. The other four personas (IMA, industry partner, curriculum developer, State PMU) keep their original compliance screens.

| Module | What it does | Screens |
|---|---|---|
| **A · SIP & Annual Plan Tracker** | Five-year plan to Year-1 tasks: 66 work packages, 330 annual AOP records, 50 Year-1 tasks with states and predecessor chains, 24 launch gates, risks with decision rules, change requests before any target moves | Cluster Home, Institute Profile (7 tabs to confirm), Five-Year Targets, Annual Plan (outcomes / workplan / calendar), Milestone Board, My Commitments |
| **B · Institute Operations** | Session-level attendance (five marks, delivery status kept separate, offline-safe, principal confirms), assessments (typed or scanned marks with confidence flags, review), rubric practicals, field visits with findings, daily ops issues, support queue | Trainer's Day, Attendance, Assessments, Practical Bot, Field Visit, Daily Ops, Institute Today, Cluster Operations, Support Queue, Student 360 |
| **C · Student Companion + Student Voice** | What the companion knows about the student (and what they can correct), their plan, applications, help from the institute with explicit sharing, job prep; themes aggregated for principals and the CEO with direct and inferred signals kept apart | What I Know, My Plan, My Applications, Help from Institute, Job Prep, Student Voice (+ My Course, Doubt Solver, Career Counsellor, Choose a Course) |
| **D · Industry & Placement** | Employer register by role (no brand names), opportunity lifecycle (lead → checking → live → paused → filled / expired → archived), a person-level pipeline with evidence levels (student-reported → document-supported → employer-confirmed → independently verified; disputed), employment spells and follow-ups | Placement Pipeline, Employer Register, Placement for my batches, Opportunities, Report Offer / Joining, Confirm Hires, OJT Tracker / Logbook, On-Job Buddy, Joined Records |

Design rules carried through every screen: **coverage before averages** (2 of 5 ITIs feed the registry; the rest show "no feed", never zero), **nothing counts until submitted and confirmed**, **tasks carry no budget** (money sits on the package and its AOP record), **a placement is a person with an evidence level**, and **source text from the plan is kept verbatim** next to derived values.

## Demo scenario

**Delhi ITI Cluster CL-DL-01** — hub Government ITI Pusa (automation & robotics, drones) with spokes Shahdara (advanced welding), Narela (machine shop / CNC), Rohini (electronics) and Okhla (HVAC). SIP ₹213 Cr (civil 36, digital 18.3, equipment 67.7, recurring 91); Year-1 envelope ₹21.3 Cr against ₹21.08 Cr planned. Year 1 runs Aug 2026 – Jul 2027; the demo clock sits in month 3.

The Student Companion is grounded in the companion knowledge-base workbook (course catalogue, role catalogue, interest map, learning topics, support directory, 12 opportunities, signal taxonomy, response rules); the **Companion KB** screen shows principals and the CEO exactly what the companion is allowed to say.

Only Pusa and Shahdara are registry-connected: 1,564 students, 109 faculty, 102 batches, 48 subjects, 408 trainer assignments from the dummy registry and mapping workbooks (dates shifted one year to line up with the plan). Everything else — sessions, marks, practicals, visits, companion signals, employers, opportunities, applications — is synthetic and labelled so. Employers are described by role; no real company names.

## Repository layout

```
pmsetu-app/
├── web/      # Vite + React 18 + Tailwind — pages, canvases (web/src/canvas/modules), role config (web/src/roles)
├── server/   # Node 20+ + Express + Prisma (SQLite) + OpenAI — routes, kpiEngine (server/src/lib), seed, RAG knowledge
│   ├── data/delhi/        # plan.json, registry.json, mapping.json, companion.json (converted from the four workbooks)
│   └── scripts/convert-xlsx.py   # re-run when the workbooks change (needs python3 + openpyxl)
└── docs/     # architecture, PRD mapping, demo credentials
```

## Quick start

Requires Node 20+. (If Node is not on PATH, the repo's sibling folder `../.tools/node/bin` holds a portable Node 22.)

```bash
# Backend (terminal 1)
cd server
npm install
cp .env.example .env            # add OPENAI_API_KEY for Saathi chat/voice (UI works without it)
npm run db:push                 # creates server/data/pmsetu.db
npm run db:seed                 # Delhi cluster from data/delhi/*.json + synthetic operations (~2 s)
npm run dev                     # Express on :8787

# Frontend (terminal 2)
cd web
npm install
npm run dev                     # Vite on :5173
```

Open http://localhost:5173 → language → **Sign in by role** (credentials pre-filled) or phone OTP `1234`.

To refresh the data from the workbooks: drop the four `.xlsx` files in `~/Downloads` (or pass a folder), run `python3 server/scripts/convert-xlsx.py`, then `npm run db:seed`.

Optional: `npm run rag:ingest` in `server/` embeds the PM-SETU knowledge base (`server/data/knowledge/*.md`) so Saathi answers scheme questions with citations.

## Demo credentials

See [`docs/demo-credentials.md`](docs/demo-credentials.md). Password for every role is `Demo@123`.

## Suggested demo path (12 minutes)

1. **SPV CEO** → Cluster Home (envelope vs plan, 2 of 5 ITIs reporting) → Milestone Board (Rohini room survey blocked; approve Shahdara's change request) → Cluster Operations → Placement Pipeline (evidence levels).
2. **ITI Principal (Pusa)** → Institute Today (three Shahdara-style silent classes appear at Shahdara; Pusa shows reviews pending) → Assessments → Review (confirm OCR marks) → Institute Profile (confirm the infrastructure tab) → Student Voice.
3. **Instructor** → My Day (mark availability) → Attendance (submit today's 09:30 register offline, then sync) → Assessments → Enter marks (scan the practical sheet, fix the low-confidence rows) → Practical Bot → Support Queue (accept the referral).
4. **Student** → What I Know → Doubt Solver (Ask my trainer) → Opportunities (express interest) → My Applications → Job Prep.
5. **Industry Partner** → Confirm Hires (confirm a student-reported joiner) → back on the CEO's Joined Records it is now employer-confirmed.
6. **IMA Verifier** → Verification Queue → KPI Audit (values with coverage) → Placement Sampling (mark one independently verified).
7. **State PMU** → State Scorecard.

## Deploy

Live at **https://pmsetu-saathi.onrender.com**. Render, one Blueprint: a Node web service (Express serves `/api/*` and the built SPA) plus a managed Postgres database, both declared in `render.yaml`. Step by step in [`docs/DEPLOY_RENDER.md`](docs/DEPLOY_RENDER.md): push to GitHub → New Blueprint → set `OPENAI_API_KEY` → `POST /api/admin/seed` once with the generated `ADMIN_TOKEN`. Local development stays on SQLite; the Postgres schema is derived from `schema.prisma` at build time.
