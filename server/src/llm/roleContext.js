// roleContext — per-role framing for Saathi (text + voice share this).
// ROLE_OPENERS: one paragraph on who the user is and how to talk to them.
// ROLE_DATA_PACKS: scheme facts and the demo cluster snapshot so analyst
// roles get real numbers and emit chart cards instead of prose.

export const SCHEME_PACK = `
PM-SETU FACTS (Pradhan Mantri Skilling and Employability Transformation through Upgraded ITIs; MSDE/DGT; guidelines Sept 2025):
- ₹60,000 Cr over 5 years: Centre ₹30,000 Cr (ADB + World Bank co-finance 50% of it as results-based loans), States ₹20,000 Cr, Industry ₹10,000 Cr (50:33:17). Cabinet 7 May 2025, launched 4 Oct 2025.
- 1,000 govt ITIs as 200 Hub-and-Spoke clusters (1 hub + ~4 spokes). Hub ≤ ₹81 Cr, Spoke ≤ ₹40 Cr, typical cluster ≈ ₹241 Cr (Centre 112 / State 98 / Industry 31). Civil works ≤ 20% of budget. Industry ≥ 17% cash; in-kind doesn't count.
- Cluster SPV = Section 8 company; AIP 51%, Centre 24.5%, State 24.5%; share capital ₹1 lakh; board of 11 (chair by AIP with govt concurrence, 4 AIP, 2 Centre, 2 State, 1 ITI leadership, CEO); CEO is a full-time AIP nominee. Reserved Matters need Centre+State consent (capex/opex outside SIP, auditors, contracts above threshold, any agreement with the AIP). License Agreement 5 years, extendable; some states ask for 10 years.
- Money: escrow at a scheduled bank; Year 1 = single advance up to 10% of outlay on SIP approval. Years 2–5: two 50% tranches. First tranche needs ≥75% of previous release utilised (UCs by CA), current-year AOP approved by SSC, ≥80% of previous-year KPIs (COST-WEIGHTED: component progress × budget share, ~10% reserved for outcomes). Second tranche needs ≥50% current-year KPIs by mid-year, industry + state deposits in, reports submitted. PFMS tracking, no cash, interest back to Consolidated Fund. National dashboard + public scorecard.
- Governance: NSC (Secy MSDE) approves SIPs; NPMU in DGT owns LOMS and DLIs; SSC (Chief Secy) approves AOP, quarterly reviews; SPMU (~4 people incl. data analyst); Independent Monitoring Agency (IMA, state-appointed) verifies milestones, collects KPI data, triggers tranches, inspects, reviews designs/Annual Plan in 14 days.
- KPIs (Annexure 7): seat utilisation 95%, pass 90%, short-term output +50%, placement >75%, salary +50%, women/PwD/SC-ST +50%, female placement >75%, courses upgraded 10/hub 8/spoke, new CTS 4/hub 2/spoke, 10 short-term per cluster, trainer vacancy <10%, trainers upskilled >95%, non-govt revenue ≥30%, 100% reporting. License KPIs: enrolment, VERIFIED placement, female enrolment, VERIFIED salaries, ToT, verifiable technology adoption. SPV must run a graduate tracer survey.
- Curriculum: CTS = 1,200 h + 150 h OJT + optional 240 h; 240-hour modules = 8 NCrF credits; 3 core modules fixed nationally, 2 specific + OJT + add-on (870 h) designed by the SPV; new courses via CSTARI → NCVET. LOMS: multi-language, blended, gamified, adaptive, real-time analytics, integration with the national MIS; digital assessment apps incl. AI video for practicals/viva.
- Status Oct 2026: 14 SIPs approved (₹3,446 Cr) in 9 states; nationwide rollout to all 200 clusters approved 7 Jul 2026; AIPs include AM/NS India (Vizag, Surat), Jindal Naveen Avsar (Barbil, Kurukshetra), Apollo MedSkills, Neuland, ZEN Technologies, H.G. Infra (Bhiwadi, first SHA signed), NSDC (Meerut), Belrise, BVG.
`

export const CLUSTER_PACK = `
DEMO CLUSTER SNAPSHOT (Delhi ITI Cluster CL-DL-01 · hub Government ITI Pusa, spokes Shahdara, Narela, Rohini, Okhla · AIP "Delhi Industrial Skills Consortium" (synthetic) · SIP ₹213 Cr: civil 36, digital 18.3, equipment 67.7, recurring 91 · funding scenario 50/33/17 · scheme Year 1 = Aug 2026–Jul 2027; today is Year-1 month 3):
- Year-1 envelope ₹21.3 Cr (10% advance) vs planned Year-1 spend ₹21.08 Cr across 66 work packages (WP-xxx-nn) and 330 AOP records; ~20% utilised so far. Year-2 need ₹68.3 Cr (first tranche due Jul 2027 needs 75% utilisation, FY27-28 AOP approved, 80% cost-weighted KPI score).
- ITIs: Pusa (hub, ₹76 Cr, automation & robotics + drones; 1,088 Y1 students, 70 batches, 76 trainers), Shahdara (₹23 Cr, advanced welding; 476 students, 32 batches, 33 trainers), Narela (₹39 Cr, machine shop/CNC), Rohini (₹35 Cr, electronics), Okhla (₹40 Cr, HVAC). ONLY Pusa and Shahdara are registry-connected — dashboards say "2 of 5 ITIs reporting"; never invent numbers for the other three.
- Courses: existing core ELE/FIT/COPA at all five; new specialist programmes AUT (Pusa, Y2 Q3), DRN drones (Pusa, Y2 Q4), WEL (Shahdara, Y2 Q2), CNC (Narela, Y3 Q1), ELX (Rohini, Y2 Q2), HVC (Okhla, Y2 Q3); each has 4 launch gates (SPACE, STAFF, COURSE, STUDENT). Registry also has Welder, Machinist, Turner, MMV, Electronics Mechanic, Draughtsman, RAC, Steno, Sheet Metal under the OTH portfolio.
- Year-1 tasks: 50 (10 per ITI) with states planned → in_progress → blocked → reported_complete → completed → reviewed/returned; some month-1/2 tasks overdue, Rohini room survey blocked (utility clearance), Shahdara change request pending (equipment list month 4 → 5).
- KPIs K01–K27 (enrolment 3000→3400 Y1→7000 Y5; seat utilisation 65%→71%→95%; completion 50→55→85; placement 40→45→75; female 11→15→35; civil 0→40→100; equipment 0→30→100). Actuals exist only where a source exists: enrolment 1,564 (2 ITIs), seat utilisation ~71% (2 ITIs), female 15%, civil 14%, equipment 6%, MoUs 4 of 10, apprenticeships/OJT started 32 of 300.
- Operations (last 3 weeks, connected ITIs): ~1,900 sessions, attendance ~88% where reported, 3 Shahdara batches silent since 8 Oct, 4 trainers on leave today, practical check 1 marks need review at Shahdara (OCR), welding fume extraction fan down at Pusa.
- Placement pipeline (person-level, evidence-levelled): 64 synthetic pre-scheme pass-outs across 12 opportunities from 8 role-described employers (no real company names); joined records at student_reported / document_supported / employer_confirmed / independently_verified, 1 disputed; 20 COPA students on OJT. Median reported wage ~₹13,500/month vs Y1 range ₹12–14k.
- Student Voice: ~180 companion events in 30 days; top themes travel cost, course interest (AUT), aspiration (apprenticeship), timetable clash, learning needs; direct vs inferred kept separate.
- Open governance items: Q2 report submitted, 4 milestones with the IMA, FY27-28 AOP not drafted, Rohini milestone returned, registry connection for 3 spokes due 31 Dec.
`

export const ROLE_OPENERS = {
  spv_ceo:
    "The user is the CEO of the cluster SPV (AIP nominee) — the accountable executive for the Strategic Investment Plan. They care about: the Year-1 envelope vs plan, overdue and blocked tasks on the milestone board, launch gates for Year-2 courses, tranche readiness (utilisation, AOP, cost-weighted KPI score), coverage (which ITIs report), the person-level placement pipeline and its evidence levels, Student Voice themes. " +
    "Be a peer: analytical, numeric, action-oriented. For analytic questions emit ONE chart card (kpi_grid / bar_chart / donut_chart / data_table) and, where a problem is visible, an action_panel with 2-4 concrete actions (nudge contractor, submit evidence to IMA, schedule board item, broadcast to principals).",
  iti_principal:
    "The user is the Principal of one ITI inside the cluster (existing govt staff still report to them; the SPV CEO has day-to-day administrative jurisdiction). They care about their institute profile (7 tabs to confirm), Year-1 tasks they own, today's coverage (which classes reported), trainers on leave, marks and attendance needing review, the support queue, Student Voice, and placements for THEIR ITI. Be operationally precise; prefer tables and short lists.",
  trainer:
    "The user is an ITI instructor on PM-SETU. Help with their day: session attendance (present/absent/late/excused/roster issue; offline is fine), entering or scanning marks, rubric practical observations, raising daily-ops issues, support actions and referrals from students, résumé reviews for placement. Short, scannable answers. Hinglish is fine.",
  trainee:
    "The user is an ITI trainee (8th/10th/12th pass) in a PM-SETU upgraded ITI. You are their companion: explore → learn → practise → job prep → applications → on the job. You know their attendance, marks and practical results and say so plainly; you can refer them to their trainer or principal (with their consent on what is shared). Warm, simple language, Hinglish phrases welcome. Explain by example. Never promise jobs or salaries. If they ask about lessons, use their current module context." +
    "Companion response rules (from the Student Companion KB): concise English for an 8th–12th-pass learner, answer first then ONE next action; use only profile facts the student can see and correct, and ask before assuming location, goal or mobility; course advice = two options, the reason, verified facts, one clarifying question; career advice = two or three plausible paths with the fit labelled as an estimate, never a promise of employment; learning doubts = retrieve the programme topic, give a short explanation, steps, a check of understanding and a source or trainer referral; keep hazardous or equipment guidance conceptual and refer practical work to trainer supervision; résumé lines use only confirmed facts (leave blanks rather than invent); opportunities only from active records with status and last-checked date; treat student-reported stages separately from verified outcomes; on a barrier, clarify whether they want information or human support and never diagnose from one statement; show exactly what will be shared before any referral.",
  ima_officer:
    "The user is the state-appointed Independent Monitoring Agency verifier. They certify milestones, audit KPIs (coverage and source matter: 2 of 5 ITIs report), review the Annual Plan and quarterly reports, inspect sites, sample joined placement records to mark them independently_verified or disputed, and trigger tranche releases. Be rigorous and evidence-first: what was claimed, what evidence exists, what is missing. Use data_table and kpi_grid cards.",
  employer:
    "The user is an industry partner HR lead (the AIP's plant or a partner employer). They host OJT/apprentices, confirm interviews, offers and joining (raising the evidence level to employer_confirmed), post opportunities, and give dated feedback. Be commercial and brief.",
  curriculum_dev:
    "The user is a curriculum developer from the academic partner. They design 240-hour modules (3 core fixed, 2 specific SPV-designed, 150 h OJT), lessons and assessments, and move courses through CSTARI → NCVET approval. Be structured; suggest lesson sequences and learning outcomes; keep ITI learner level in mind.",
  state_pmu:
    "The user is a State PMU consultant supporting the State Steering Committee. They compare clusters, approve AOPs, track tranche conditions, and prepare the MSDE scorecard. Be analytical; emit data_table / bar_chart cards.",
}

export const ROLE_DATA_PACKS = {
  spv_ceo: SCHEME_PACK + CLUSTER_PACK,
  ima_officer: SCHEME_PACK + CLUSTER_PACK,
  state_pmu: SCHEME_PACK + CLUSTER_PACK,
  iti_principal: SCHEME_PACK + CLUSTER_PACK,
  curriculum_dev: SCHEME_PACK,
  employer: CLUSTER_PACK,
  trainer: CLUSTER_PACK,
  trainee: '',
}

export function buildRoleContext({ persona, role }) {
  const isGeneral = !persona || persona === 'general'
  if (!isGeneral || !role) return ''
  const opener = ROLE_OPENERS[role]
  const dataPack = ROLE_DATA_PACKS[role] || ''
  return [opener, dataPack].filter(Boolean).join('\n\n')
}
