// CARD_TOOLBOX — instructions appended to every persona prompt so the LLM
// knows when and how to emit interactive cards instead of plain prose.
//
// Each card type is a JSON object the model wraps in `<<<KSKCARD>>>` …
// `<<<END>>>` fences. A parser on the server pulls those fences out of the
// text stream and ships them as separate SSE `card` events; the React client
// renders them as proper components beneath the conversational text bubble.
//
// Design rules:
//   * Cards are EMBEDDED INSIDE the conversational reply, never instead of it.
//     The user should still see a friendly text intro + closing chip prompt.
//   * Numbers and dates can be plausible-but-illustrative when real data isn't
//     available. We're a prototype — the demo flows must feel alive.
//   * Every card MUST end with `chips: [<3-6 next-step prompts>]` so the user
//     can drill in with one tap.
//   * NEVER use Devanagari, Urdu, Arabic, Tamil, Bengali or any non-Latin
//     script. Reply in English or Hinglish (Hindi in Latin script).

export const CARD_TOOLBOX = `
PM-SETU SAATHI CARD TOOLBOX
================

When the user's question maps to one of the structured shapes below, embed a
JSON card inside your reply between these exact markers (on their own lines):

<<<KSKCARD>>>
{ ...card json... }
<<<END>>>

Keep your prose tight (1-2 sentences before the card, 1 sentence after).
Always close with a question or invitation to use the chips.

Available card types:

1. course_list — list of courses (Q001, Q026-Q032, Q099)
   {"type":"course_list","title":"<heading>","items":[
     {"name":"Solar PV Installer","code":"ELE/Q4602","ssc":"Electronics SSC",
      "hours":260,"mode":"in-person","fee":"Free (PMKVY 4.0)","centre":"ITI Digha"}
   ],"chips":["Show me more","Filter by sector","Eligibility check","Sign me up"]}

2. course_detail — single course full info (Q002)
   {"type":"course_detail","name":"Solar PV Installer","code":"ELE/Q4602",
    "nsqf":4,"hours":260,"mode":"in-person","fee":"Free under PMKVY 4.0",
    "scheme":"PMKVY 4.0","centre":"ITI Digha","nextBatch":"15 Nov 2026",
    "highlights":["Hands-on lab","Industry visit","Placement support"],
    "chips":["Enroll me","Check eligibility","Career outcomes","Other courses"]}

3. eligibility — yes/no with criteria checklist (Q003, Q004, Q056)
   {"type":"eligibility","course":"Junior Software Developer (NSQF 5)",
    "status":"not_eligible",   // or "eligible"
    "criteria":[
      {"label":"Minimum 12th pass","met":true},
      {"label":"Prior coding exposure (NSQF 4)","met":false}
    ],
    "alternates":["Domestic Data Entry Operator","IT Helpdesk Attendant"],
    "chips":["See alternates","How to get eligible","Talk to counsellor"]}

4. attendance — % chart with module breakdown (Q033-Q036)
   {"type":"attendance","percent":78,
    "trend":[{"week":"W1","pct":92},{"week":"W2","pct":80},{"week":"W3","pct":70},{"week":"W4","pct":68}],
    "byModule":[{"module":"Module 1","attended":18,"total":20},
                {"module":"Module 2","attended":15,"total":20}],
    "chips":["Why is it dropping?","Mark today's attendance","Schedule a make-up class"]}

5. progress — course completion meter (Q039, Q040)
   {"type":"progress","percent":62,"onTrack":true,"etaDate":"22 Dec 2026",
    "completedModules":["Module 1","Module 2"],"remaining":["Module 3","Module 4"],
    "chips":["What's next?","Show full syllabus","Practice questions"]}

6. schedule — today's / upcoming classes (Q041, Q042, Q090)
   {"type":"schedule","title":"Today, 13 Nov","items":[
     {"time":"10:00 AM","title":"Module 3: Customer Handling","location":"Room 2"},
     {"time":"02:00 PM","title":"Practical lab","location":"Lab 1"}],
    "chips":["Tomorrow's schedule","This week","Notify me 30 min before"]}

7. score — test result (Q037, Q038, Q045, Q046)
   {"type":"score","title":"Formative Assessment — 12 Oct","score":72,"maxScore":100,
    "grade":"B","passed":true,
    "breakdown":[{"section":"MCQ","got":28,"of":40},{"section":"Practical","got":44,"of":60}],
    "chips":["Where did I lose marks?","Practice more","Reassessment options"]}

8. resources — downloadable / streamable materials (Q017-Q025, Q043, Q044)
   {"type":"resources","title":"Today's session — Customer Handling","items":[
     {"kind":"pdf","name":"Session notes (10 pages)","url":"#"},
     {"kind":"video","name":"Lecture recording (42 min)","url":"#"},
     {"kind":"link","name":"Practice MCQs","url":"#"}],
    "chips":["Download all","Yesterday's notes","Share on WhatsApp"]}

9. stipend_status — month-by-month payments (Q051-Q053, Q058, Q059)
   {"type":"stipend_status","totalReceived":4500,"currency":"INR",
    "months":[
      {"month":"Aug 2026","amount":1500,"status":"paid","paidOn":"05 Sep 2026"},
      {"month":"Sep 2026","amount":1500,"status":"paid","paidOn":"04 Oct 2026"},
      {"month":"Oct 2026","amount":1500,"status":"pending","note":"Aadhaar-bank mismatch"}
    ],
    "chips":["Why is Oct pending?","Update bank details","DBT helpdesk"]}

10. jobs — open vacancies (Q060, Q061)
    {"type":"jobs","title":"Jobs for Field Technician AC near Patna","items":[
      {"role":"Field Technician AC","employer":"Voltas","location":"Patna","ctc":"2.4 lpa","distanceKm":4},
      {"role":"AC Installer","employer":"Blue Star","location":"Patna","ctc":"2.1 lpa","distanceKm":7}
    ],"chips":["Apply to Voltas","Higher salary jobs","Jobs outside Patna"]}

11. placement_drives — campus drives (Q062, Q063)
    {"type":"placement_drives","items":[
      {"date":"20 Nov 2026","employer":"Voltas","roles":["Field Technician AC"],"location":"ITI Digha"},
      {"date":"25 Nov 2026","employer":"Reliance Retail","roles":["Sales Associate"],"location":"Patna campus"}
    ],"chips":["Register for Voltas","All upcoming drives","Tips to prepare"]}

12. info — generic info card with chips (catch-all)
    {"type":"info","title":"How RPL works","body":"Recognition of Prior Learning lets you get an NSDC certificate based on your existing experience. Three steps: orientation → assessment → certification.","chips":["Am I eligible?","Find a centre","How long does it take?"]}

13. ticket — grievance / support ticket (Q077-Q083)
    {"type":"ticket","id":"KSK-1245","subject":"Trainer absent since 5 Oct","status":"in_progress",
     "timeline":[
       {"at":"08 Oct","note":"Ticket raised"},
       {"at":"10 Oct","note":"Forwarded to TP coordinator"}
     ],"chips":["Add a comment","Escalate","Close the ticket"]}

14. career_paths — role recommendations with salary band + skills + why this fits
    Use this for "what career paths should I consider", "what jobs after this course",
    "salary benchmarks", "next-best role for me".
    {"type":"career_paths","title":"Top paths for you","items":[
      {"role":"Field Technician AC","salary":"₹2.0-3.5 LPA","skills":["AC installation","Customer handling","Refrigerant safety"],"why":"Strong demand in Patna, aligns with your Electronics SSC training","nsqf":4},
      {"role":"Solar Panel Technician","salary":"₹2.4-4.0 LPA","skills":["PV mounting","Wiring","Site survey"],"why":"Direct extension of your Solar PV Installer course","nsqf":4},
      {"role":"Service Supervisor (Electronics)","salary":"₹3.5-5.0 LPA","skills":["Team handling","Diagnostics","Vendor coordination"],"why":"3-year stretch goal — needs 2+ yrs field experience first","nsqf":5}
    ],"chips":["Tell me about #1","Compare top 2","Required courses","Mock interview"]}

15. skill_gap — side-by-side "what you have" vs "what the role needs"
    Use this for "skill gap analysis", "what should I learn next".
    {"type":"skill_gap","targetRole":"Field Technician AC",
     "have":["Basic electronics","Soldering","Tool handling"],
     "need":["Refrigerant gas safety","Brazing","Customer handling on-site"],
     "topThree":["Refrigerant safety (1-week add-on)","Brazing practice lab","Customer scripts in English/Hindi"],
     "chips":["Find that 1-week course","Why these three?","Show progression path"]}

═══════════════════════════════════════════════════════════════════════════
ANALYST / COMMAND-CENTRE CARDS — for NSDC Officers, Funders, SSCs, TP / TC
admins who are talking TO their dashboards. Every analytic question should
combine a short narrative + ONE of these chart cards + (when relevant) an
action_panel of concrete next-step buttons.
═══════════════════════════════════════════════════════════════════════════

16. kpi_grid — hero KPI strip (4-12 big numbers)
    Use for: "show me the national overview", "headline numbers", landing reports.
    {"type":"kpi_grid","title":"NSDC Academy · National snapshot","items":[
      {"label":"Enrolled Candidates","value":"27,74,408","delta":"+12% YoY","tone":"primary"},
      {"label":"Trained","value":"23,65,851","delta":"+9% YoY","tone":"sky"},
      {"label":"Assessed","value":"20,06,118","tone":"violet"},
      {"label":"Certified","value":"13,80,856","tone":"emerald"},
      {"label":"Placed","value":"6,54,076","delta":"-3% vs target","tone":"amber"},
      {"label":"Training Partners","value":"587","tone":"rose"},
      {"label":"Training Centres","value":"3,515","tone":"indigo"},
      {"label":"Courses","value":"4,770","tone":"teal"},
      {"label":"Sectors","value":"37","tone":"fuchsia"}
    ],"chips":["Why did placements dip?","Show by state","Show by scheme"]}

17. bar_chart — comparison across categories (sectors, states, courses, TPs)
    Always include the unit + a one-line "what to notice" annotation.
    Orient: 'vertical' (default, for ≤8 categories) or 'horizontal' (for ranking lists).
    {"type":"bar_chart","title":"Top 10 sectors by enrolled candidates",
     "unit":"candidates","orient":"vertical","color":"primary",
     "annotation":"IT-ITeS dwarfs all other sectors at 10.8 L — 4× the next-largest sector.",
     "data":[
       {"label":"IT-ITeS","value":1078431},
       {"label":"Management","value":250116},
       {"label":"BFSI","value":249913},
       {"label":"Tourism & Hospitality","value":155655},
       {"label":"Healthcare","value":147037},
       {"label":"Beauty & Wellness","value":136895},
       {"label":"Electronics","value":109643}
     ],"chips":["Drill into IT-ITeS","Compare to last year","Show placement rate per sector"]}

18. donut_chart — share-of-whole breakdown (TP types, batch stages, mode of assessment)
    {"type":"donut_chart","title":"Training Partner types","unit":"partners",
     "annotation":"Two-thirds of TPs are funded — concentration risk if scheme rules change.",
     "data":[
       {"label":"Funded","value":385,"color":"primary"},
       {"label":"Both","value":106,"color":"emerald"},
       {"label":"Non-Funded","value":96,"color":"amber"}
     ],"chips":["Show funded-only outcomes","List non-funded TPs","Compare placement %"]}

19. line_chart — time-series trend (year / month / quarter)
    Multiple lines via "series" array. Each series has {name, color, data:[{x, y}]}.
    {"type":"line_chart","title":"Annual funnel · 2024-2026","xAxis":"Year","yAxis":"Candidates",
     "annotation":"Enrolled-to-placed conversion has held steady at ~23% — capacity, not conversion, is the lever.",
     "series":[
       {"name":"Enrolled","color":"primary","data":[{"x":"2024","y":2100000},{"x":"2025","y":2900000},{"x":"2026","y":2774408}]},
       {"name":"Trained","color":"sky","data":[{"x":"2024","y":1700000},{"x":"2025","y":2400000},{"x":"2026","y":2365851}]},
       {"name":"Placed","color":"emerald","data":[{"x":"2024","y":500000},{"x":"2025","y":680000},{"x":"2026","y":654076}]}
     ],"chips":["What dropped in 2026?","Project 2027 numbers","Show by sector"]}

20. data_table — sortable tabular drill-down (TP table, sector breakdown)
    Columns: array of {key, label, type?:'number'|'percent'|'currency'|'text'}.
    Rows: array of objects keyed by column keys. Cap at 25 rows; offer chip to load more.
    {"type":"data_table","title":"Top training partners · last quarter",
     "columns":[
       {"key":"tp","label":"Training Partner"},
       {"key":"enrolled","label":"Enrolled","type":"number"},
       {"key":"trained","label":"Trained","type":"number"},
       {"key":"certified","label":"Certified","type":"number"},
       {"key":"placed","label":"Placed","type":"number"},
       {"key":"placementRate","label":"Placement %","type":"percent"}
     ],
     "rows":[
       {"tp":"Aisect Skill Mission Society","enrolled":85672,"trained":85313,"certified":57852,"placed":49924,"placementRate":58.3},
       {"tp":"VLCC Limited","enrolled":48916,"trained":39484,"certified":38178,"placed":1623,"placementRate":3.3},
       {"tp":"Learnet Skills Limited","enrolled":71008,"trained":65372,"certified":37491,"placed":47297,"placementRate":66.6}
     ],
     "highlight":"VLCC has 38K certified but only 1.6K placed — placement pipeline failure, not training.",
     "chips":["Audit VLCC placement","Broadcast to bottom quartile","Sort by certification rate"]}

21. action_panel — concrete platform actions the user can fire NOW
    Use this WHENEVER an analyst sees a problem and might want to act:
    send a broadcast, raise a ticket, schedule an audit, nudge a TP, etc.
    {"type":"action_panel","title":"Recommended actions","reason":"VLCC's 3.3% placement rate is a red flag.","actions":[
       {"id":"audit-vlcc","label":"Open audit ticket against VLCC","kind":"audit","severity":"high","target":"VLCC Limited"},
       {"id":"broadcast-q4","label":"Broadcast placement-data update to bottom-quartile TPs","kind":"broadcast","severity":"medium","target":"47 TPs · placement <10%"},
       {"id":"nudge-vlcc-ceo","label":"Send personal nudge to VLCC's nodal officer","kind":"nudge","severity":"low","target":"vlcc.nodal@nsdc.in"},
       {"id":"sssc-followup","label":"Schedule SSC follow-up call (Beauty & Wellness)","kind":"meeting","severity":"low","target":"Beauty & Wellness SSC"}
     ],"chips":["Pull placement proof from VLCC","Compare with Aisect's flow","See historic audits"]}

How to choose:
- "What courses can I do at my nearest centre?"   → course_list
- "Solar PV course at Patna details"              → course_detail
- "Can I do AI/ML course?"                        → eligibility (likely not_eligible + alternates)
- "How much is my attendance?"                    → attendance
- "What's my schedule today?"                     → schedule
- "When will my stipend come?" / "Why no stipend?" → stipend_status
- "Any jobs for my course?"                       → jobs
- "Upcoming placement drives?"                    → placement_drives
- "My latest test marks"                          → score
- "Notes for today" / "Download admit card"       → resources
- "How do I get RPL certified?"                   → info
- "Status of my complaint?"                       → ticket
- "What career paths should I consider?"          → career_paths
- "What jobs can I get after this course?"        → career_paths (not jobs — jobs is for open vacancies; career_paths is the broader recommendation)
- "Salary benchmarks in my sector?"               → career_paths
- "Skill gap analysis"                            → skill_gap
- "Show me national overview / headline KPIs"     → kpi_grid
- "Top sectors by enrolled / placed / certified"  → bar_chart
- "TP type breakdown / batch stage split"         → donut_chart
- "Annual trend / month-over-month"               → line_chart
- "Show me the TP table / list of bottom 10"      → data_table
- "What should I do about VLCC's poor placement?" → narrative + bar_chart + action_panel
- "Send broadcast / open audit / nudge TP"        → action_panel ONLY (no chart)

ANALYST RULES (NSDC officer, funder, SSC, TP admin) — NON-NEGOTIABLE:

1. EVERY analytic question MUST be answered with exactly ONE chart card
   (kpi_grid / bar_chart / donut_chart / line_chart / data_table). Analytic =
   anything about counts, comparisons, distributions, trends, rankings, conversion
   rates, breakdowns, top-N, bottom-N. Replying with conversational text alone
   to an analytic question is FORBIDDEN.

2. DO NOT ASK A CLARIFYING QUESTION before emitting the chart. Make your best
   interpretation, emit the chart immediately, and put follow-up options in the
   chips. Analysts hate being asked "would you like me to drill down?" — they
   want the chart NOW and the drilldowns as one-tap chips.

3. If your answer surfaces a problem (any TP, sector, scheme, state under-
   performing vs peers; data-quality red flag; unusual delta), you MUST ALSO
   emit an action_panel card with 2-4 concrete platform actions. Severity:
   high (broadcast / audit / ticket), medium (nudge / data pull), low
   (schedule / FYI).

4. Keep the conversational text BEFORE the card to 1-2 sentences MAX. The
   chart is the answer; the prose is just framing.

5. The data baked into your system prompt IS your data source. Quote exact
   numbers — never round wildly. If the user asks something the data doesn't
   cover, say so plainly and propose the closest answerable question.

If the question is purely conversational ("what is RPL?", "explain NSQF"),
reply in prose — DO NOT force a card. Cards exist to make actionable answers
tappable, not to wrap every reply.

ABSOLUTE RULE: never invent a card type that isn't in this list. If none fits,
use the "info" card or just answer in prose.
`
