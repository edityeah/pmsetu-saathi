// PM-SETU Saathi demo seed — Delhi cluster CL-DL-01 (Pusa hub + 4 spokes).
//
// Run: npm run db:seed   (re-run after `python3 scripts/convert-xlsx.py`)
//
// Sources (server/data/delhi/*.json, converted from the three dummy workbooks):
//   plan.json     — SIP: ITIs, courses, offerings, 5-year budget, 66 packages,
//                   330 AOP records, 50 Y1 tasks, 24 launch gates, evidence
//                   rules, risks, 27 KPIs with definitions.
//   registry.json — student registry for Pusa (PUS) and Shahdara (SHA) only:
//                   1,564 students, 109 faculty, 102 batches, 18 programmes.
//   mapping.json  — subjects, batch-subjects, trainer assignments, user access.
//   companion.json — Student Companion knowledge base: course catalogue, role
//                   catalogue + course-role map, interest map, learning topics,
//                   support directory, 12 opportunities, signal taxonomy,
//                   response rules (grounding for the companion LLM).
//
// Scenario clock: registry dates are shifted +1 year so Year 1 of the plan is
// Aug 2026 – Jul 2027 and "today" (Oct 2026) is Year-1 month 3. Narela, Rohini
// and Okhla have no registry feed yet — dashboards show "2 of 5 ITIs reporting"
// rather than zeros, per the PRD's coverage rule.
//
// Everything not in the workbooks (sessions, marks, practicals, visits, issues,
// companion events, employers, opportunities, applications, spells) is
// synthetic and labelled so in the data. No real company names are used.
//
// Demo sign-ins (password Demo@123 · phone OTP 1234):
//   spv_ceo        USR-CEO-DL01        Ravi Prakash Agarwal   9000000001
//   iti_principal  USR-PR-PUS          Shivam Kumar Shukla    9003000001  (Pusa, hub)
//   iti_principal  USR-PR-SHA          Priya Rani Pawar       9003000002  (Shahdara)
//   trainer        USR-SYN-FAC-0001    Rajesh Prakash Joshi   9002000001  (ELE batch lead, Pusa)
//   trainee        LRN-PUS-000006      Anushka Rani Kapoor    9001000006  (ELE Y1, Pusa)
//   trainee (OJT)  LRN-SHA-COP-001     first COPA student at Shahdara (12-month, on OJT)
//   trainee (job)  LRN-PUS-PASS-001    pre-scheme pass-out with a wage spell + follow-up due
//   ima_officer    IMA-DL-001          Dr. Meenakshi Sharma   9000000004
//   employer       EMP-DL-001          Arvind Mehra           9000000005
//   curriculum_dev CMS-DL-001          Shubham Iyer           9000000006
//   state_pmu      PMU-DL-001          Kiran Joshi            9000000007

import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import { prisma } from '../db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA = path.resolve(__dirname, '../../data/delhi')
const load = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'))
const plan = load('plan.json'), registry = load('registry.json'), mapping = load('mapping.json'), kb = load('companion.json')

// ── scenario clock (all dates UTC midnight) ───────────────────────────────
const SCENARIO_START = new Date(Date.UTC(2026, 7, 1)) // 1 Aug 2026 = Y1 month 1
const _n = new Date()
const TODAY = new Date(Date.UTC(_n.getFullYear(), _n.getMonth(), _n.getDate()))
const d = s => new Date(s + 'T00:00:00Z')
const shiftYear = s => { const x = d(s); x.setUTCFullYear(x.getUTCFullYear() + 1); return x }
const monthEnd = n => new Date(Date.UTC(2026, 7 + n, 0)) // due month n → last day of that month
const addDays = (dt, n) => new Date(dt.getTime() + n * 86400000)
const daysAgo = n => addDays(TODAY, -n)
const iso = dt => dt.toISOString().slice(0, 10)
const quarterStart = q => new Date(Date.UTC(2026, 7 + 3 * (q - 1), 1))

// deterministic PRNG so every re-seed produces the same demo
let seedState = 20261013
const rnd = () => { seedState |= 0; seedState = seedState + 0x6D2B79F5 | 0; let t = Math.imul(seedState ^ seedState >>> 15, 1 | seedState); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
const rand = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1))
const pick = arr => arr[Math.floor(rnd() * arr.length)]
const chance = p => rnd() < p
const J = v => JSON.stringify(v)
const phoneOf = s => '9' + String(s).slice(1)

async function createMany(model, rows, chunk = 400) {
  for (let i = 0; i < rows.length; i += chunk) await prisma[model].createMany({ data: rows.slice(i, i + chunk) })
}

async function wipe() {
  const order = [
    'chatMessage', 'chatThread', 'notification', 'otpCode',
    'followUp', 'employmentSpell', 'application', 'opportunity', 'employerFeedback', 'employer',
    'kbCourse', 'kbRole', 'kbInterest', 'kbTopic', 'supportContact', 'signalType', 'responseRule',
    'companionArtifact', 'referral', 'companionEvent',
    'supportAction', 'practicalObservation', 'practicalTask', 'markEntry', 'assessmentPlan', 'attendanceMark', 'session',
    'trainerAvailability', 'finding', 'visit', 'opsIssue', 'trainerAssignment', 'moduleProgress', 'courseModule', 'grievance',
    'trainee', 'batch', 'subject', 'machine', 'civilWork', 'procurementPackage', 'budgetLine', 'escrowDeposit', 'utilisationCertificate',
    'milestone', 'report', 'boardItem', 'changeRequest', 'kpi', 'launchGate', 'offeringPlan', 'offering', 'planTask', 'aopRecord', 'package',
    'evidenceRule', 'risk', 'iti', 'trade', 'cluster', 'user',
  ]
  for (const m of order) await prisma[m].deleteMany()
}

const ITI_META = {
  PUS: { name: 'Government ITI Pusa', district: 'Pusa planning area' },
  SHA: { name: 'Government ITI Shahdara', district: 'Shahdara planning area' },
  NAR: { name: 'Government ITI Narela', district: 'Narela' },
  ROH: { name: 'Government ITI Rohini', district: 'Rohini' },
  OKH: { name: 'Government ITI Okhla', district: 'Okhla' },
}
const TRADE_META = {
  ELE: { sector: 'Electrical' }, FIT: { sector: 'Mechanical' }, COP: { sector: 'IT & office' },
  AUT: { sector: 'Automation & robotics', status: 'approved' }, DRN: { sector: 'Drones', status: 'ncvet_review' },
  WEL: { sector: 'Welding & fabrication', status: 'ncvet_review' }, CNC: { sector: 'Machine shop & quality', status: 'submitted_cstari' },
  ELX: { sector: 'Electronics', status: 'approved' }, HVC: { sector: 'HVAC & building services', status: 'draft' }, OTH: { sector: 'Mixed portfolio' },
  LWD: { sector: 'Welding & fabrication' }, LMC: { sector: 'Mechanical' }, LTR: { sector: 'Mechanical' }, LMV: { sector: 'Automotive' },
  LEM: { sector: 'Electronics' }, LDM: { sector: 'Mechanical design' }, LRA: { sector: 'HVAC & building services' }, LST: { sector: 'Office' }, LSM: { sector: 'Welding & fabrication' },
}
const KIND_MAP = { 'Existing core trade': 'existing_core', 'New specialist programme': 'new_specialist', 'New short-term programme': 'short_term', 'Aggregate portfolio': 'aggregate' }
const CAT_KEY = { Civil: 'civil', Equipment: 'equipment', Digital: 'digital', Staff: 'staff', Faculty: 'faculty', Operations: 'operations', 'Student industry': 'student_industry', Governance: 'governance' }
const KPI_AREA = { K01: 'enrolment', K02: 'enrolment', K03: 'quality', K04: 'placement', K05: 'faculty', K06: 'industry', K07: 'placement', K08: 'infra', K09: 'infra', K10: 'infra', K11: 'inclusion', K12: 'inclusion', K13: 'sustainability', K14: 'sustainability', K15: 'faculty', K16: 'industry', K17: 'industry', K18: 'digital', K19: 'digital', K20: 'quality', K21: 'placement', K22: 'inclusion', K23: 'faculty', K24: 'inclusion', K25: 'inclusion', K26: 'industry', K27: 'digital' }

const FN_M = ['Aman', 'Rahul', 'Sandeep', 'Akash', 'Vikram', 'Rohit', 'Sahil', 'Karan', 'Pawan', 'Suraj', 'Vivek', 'Manoj', 'Deepak', 'Nitin', 'Ankit', 'Arjun', 'Mohit', 'Rajat', 'Sumit', 'Yogesh']
const FN_F = ['Pooja', 'Anita', 'Sunita', 'Rekha', 'Meena', 'Kavita', 'Sneha', 'Neha', 'Asha', 'Geeta', 'Priya', 'Nisha', 'Komal', 'Shalini', 'Ritu', 'Anjali']
const LN = ['Kumar', 'Sharma', 'Yadav', 'Singh', 'Verma', 'Gupta', 'Saini', 'Rawat', 'Tiwari', 'Chauhan', 'Mishra', 'Prajapati', 'Khan', 'Ansari', 'Meena', 'Kashyap']
const synthName = isF => `${pick(isF ? FN_F : FN_M)} ${pick(LN)}`

async function main() {
  console.log('[seed] wiping…')
  await wipe()
  const pw = await bcrypt.hash('Demo@123', 8)

  // ══════════════════════════════════════════════════════════════════════
  // CLUSTER
  // ══════════════════════════════════════════════════════════════════════
  console.log('[seed] cluster…')
  const ov = Object.fromEntries(plan['SIP overview'].map(r => [r.Measure, r.Value]))
  const cluster = await prisma.cluster.create({ data: {
    id: 'CL-DL-01', code: 'CL-DL-01', name: 'Delhi ITI Cluster (Pusa hub)', state: 'Delhi',
    aipName: 'Delhi Industrial Skills Consortium (AIP · synthetic)', academicPartner: 'Hub academic partner (synthetic)',
    spvName: 'Delhi Cluster Skill SPV (Section 8 · synthetic)',
    sipAmountCr: ov['Five-year investment INR crore'], envelopeY1Cr: ov['Y1 initial envelope'],
    sipApprovedAt: d('2026-07-07'), licenseStartAt: SCENARIO_START, scenarioStart: SCENARIO_START, currentYear: 1,
    planYearLabel: 'Y1 · Aug 2026 – Jul 2027',
    sector: 'Automation & robotics · drones · welding · machine shop & CNC · electronics · HVAC',
  } })
  const C = cluster.id

  // ══════════════════════════════════════════════════════════════════════
  // USERS (cluster roles + principals; trainers and trainees come later)
  // ══════════════════════════════════════════════════════════════════════
  console.log('[seed] users…')
  const mk = (data) => prisma.user.create({ data: { passwordHash: pw, language: 'en', ...data } })
  const ceo = await mk({ id: 'U-CEO', role: 'spv_ceo', name: 'Ravi Prakash Agarwal', phone: '9000000001', loginId: 'USR-CEO-DL01',
    profile: J({ clusterId: C, roleCode: 'CEO', designation: 'CEO, Delhi Cluster Skill SPV', scope: 'All 5 ITIs · registry connected for PUS, SHA' }) })
  const ima = await mk({ id: 'U-IMA', role: 'ima_officer', name: 'Dr. Meenakshi Sharma', phone: '9000000004', loginId: 'IMA-DL-001',
    profile: J({ clusterId: C, roleCode: 'IMA', designation: 'Lead Verifier, Independent Monitoring Agency (Delhi, state-appointed)' }) })
  const empUser = await mk({ id: 'U-EMP', role: 'employer', name: 'Arvind Mehra', phone: '9000000005', loginId: 'EMP-DL-001',
    profile: J({ clusterId: C, roleCode: 'EMPLOYER', designation: 'HR & apprenticeship lead, electrical contracting firm (Okhla)' }) })
  const cms = await mk({ id: 'U-CMS', role: 'curriculum_dev', name: 'Shubham Iyer', phone: '9000000006', loginId: 'CMS-DL-001',
    profile: J({ clusterId: C, roleCode: 'SPV-ACADEMIC', designation: 'Curriculum lead, hub academic partner' }) })
  const pmu = await mk({ id: 'U-PMU', role: 'state_pmu', name: 'Kiran Joshi', phone: '9000000007', loginId: 'PMU-DL-001',
    profile: J({ roleCode: 'SPMU', designation: 'Consultant, State PMU · Delhi Training & Technical Education', state: 'Delhi' }) })

  const PRINCIPALS = {
    PUS: { name: 'Shivam Kumar Shukla', phone: '9003000001' }, SHA: { name: 'Priya Rani Pawar', phone: '9003000002' },
    NAR: { name: 'Anil Kumar Verma', phone: '9003000003' }, ROH: { name: 'Sunita Devi Yadav', phone: '9003000004' }, OKH: { name: 'Mohd. Imran Khan', phone: '9003000005' },
  }
  const principals = {}
  for (const [code, p] of Object.entries(PRINCIPALS)) {
    principals[code] = await mk({ id: `U-PR-${code}`, role: 'iti_principal', name: p.name, phone: p.phone, loginId: `USR-PR-${code}`,
      profile: J({ clusterId: C, itiCode: code, roleCode: `PR-${code}`, designation: `Principal, ${ITI_META[code].name}${code === 'PUS' ? ' (Hub)' : ''}` }) })
  }

  // ══════════════════════════════════════════════════════════════════════
  // ITIs, TRADES, OFFERINGS, PLANS
  // ══════════════════════════════════════════════════════════════════════
  console.log('[seed] itis, trades, offerings…')
  const cap = plan['Course annual plan']
  const sumPlan = (code, period, field) => cap.filter(r => r.ITI === code && r.Period === period).reduce((s, r) => s + (r[field] || 0), 0)
  const itis = {}
  for (const row of plan.ITIs) {
    const code = row.ITI, connected = code === 'PUS' || code === 'SHA'
    const sections = {}
    for (const tab of ['overview', 'trades', 'staffing', 'infrastructure', 'budget', 'targets', 'launch_gates']) {
      sections[tab] = connected ? { state: tab === 'infrastructure' && code === 'SHA' ? 'draft' : 'confirmed', confirmedAt: iso(addDays(SCENARIO_START, rand(12, 28))), by: `PR-${code}` } : { state: tab === 'budget' ? 'confirmed' : 'draft', by: `PR-${code}` }
    }
    itis[code] = await prisma.iti.create({ data: {
      id: code, clusterId: C, code, name: ITI_META[code].name, kind: row.Type === 'Hub' ? 'hub' : 'spoke', district: ITI_META[code].district,
      sectorFocus: row['Sector focus'], fiveYearCr: row['Five year anchor INR crore'], civilCr: row['Civil anchor'], digitalCr: row['Digital anchor'],
      seatCapacity: sumPlan(code, 'Y1', 'Annual places'), baselineSeats: sumPlan(code, 'Baseline', 'Annual enrolments'),
      trainersBaseline: row['Baseline trainers'], trainerPlan: J({ Y1: row['Y1 trainers'], Y2: row['Y2 trainers'], Y3: row['Y3 trainers'], Y4: row['Y4 trainers'], Y5: row['Y5 trainers'] }),
      roomsBaseline: row['Baseline rooms'], roomsWorking: row['Working rooms'], roomsY5: row['Y5 rooms'],
      registryConnected: connected, profileSections: J(sections), gradeBaseline: code === 'PUS' ? 'B' : 'C', principalUserId: principals[code].id,
    } })
  }

  // trades: plan courses + registry-only programmes
  const tenureByProg = {}
  for (const b of registry.Batch) tenureByProg[b.Program_Code] = b.Batch_Tenure
  const trades = {}
  for (const c of plan.Courses) {
    const code = c['Course ID']
    trades[code] = await prisma.trade.create({ data: {
      id: code, code, name: c['Course name'], sector: TRADE_META[code]?.sector || 'General', nsqfLevel: code === 'AUT' || code === 'CNC' ? 5 : code === 'DRN' ? 3 : 4,
      kind: KIND_MAP[c.Type] || 'existing_other', durationValue: c.Duration || 0, durationUnit: c['Duration unit'] || 'mixed',
      totalHours: c['Duration unit'] === 'hours' ? c.Duration : (c.Duration || 0) * 100, entryAssumption: c['Entry assumption'], roleDirection: c['Role direction'],
      status: TRADE_META[code]?.status || 'approved',
    } })
  }
  const seenProg = new Set()
  for (const p of registry.Programs) {
    if (trades[p.Program_Code] || seenProg.has(p.Program_Code)) continue
    seenProg.add(p.Program_Code)
    const months = tenureByProg[p.Program_Code] || 24
    trades[p.Program_Code] = await prisma.trade.create({ data: {
      id: p.Program_Code, code: p.Program_Code, name: p.Program_Name, sector: TRADE_META[p.Program_Code]?.sector || 'General', nsqfLevel: 4,
      kind: 'existing_other', durationValue: months, durationUnit: 'months', totalHours: months * 100,
      entryAssumption: 'Existing CTS trade in the registry; counted under the OTH portfolio in the SIP', roleDirection: p.Program_Name, status: 'approved',
    } })
  }

  // offerings + plans
  const offerings = {}
  for (const o of plan.Offerings) {
    offerings[o['Offering ID']] = await prisma.offering.create({ data: { id: o['Offering ID'], itiId: o.ITI, tradeId: o.Course, launch: o.Launch, note: o['Shared resource note'], scope: o.Course === 'OTH' ? 'Aggregate portfolio' : 'Detailed offering' } })
  }
  const alloc = mapping['Course allocation']
  const actualFor = (offId) => alloc.filter(a => a['SIP anchor'] === offId).reduce((s, a) => s + (a['Generated enrolments'] || 0), 0)
  await createMany('offeringPlan', cap.map(r => ({
    offeringId: r['Offering ID'], period: r.Period, places: r['Annual places'] || 0, enrolments: r['Annual enrolments'] || 0, sourceStatus: r['Source status'],
    actualEnrolments: r.Period === 'Y1' && (r.ITI === 'PUS' || r.ITI === 'SHA') ? actualFor(r['Offering ID']) : null,
  })))

  // ══════════════════════════════════════════════════════════════════════
  // PACKAGES, AOP RECORDS, Y1 TASKS, GATES, EVIDENCE RULES, RISKS
  // ══════════════════════════════════════════════════════════════════════
  console.log('[seed] packages, AOPs, tasks, gates, rules, risks…')
  const fy = Object.fromEntries(plan['Five year budget'].map(r => [r['Package ID'], r]))
  for (const p of plan.Packages) {
    const b = fy[p['Package ID']] || {}
    await prisma.package.create({ data: {
      id: p['Package ID'], clusterId: C, itiId: p.ITI, category: p.Category, title: p['Work package'], courseScope: p['Course scope'],
      totalCr: b['Total INR crore'] ?? p['Unit cost INR crore'] * (p.Quantity || 1), yearly: J({ 1: b.Y1, 2: b.Y2, 3: b.Y3, 4: b.Y4, 5: b.Y5 }),
      expenditureType: b['Expenditure type'] || 'CapEx', deliverable: p['Expected deliverable'], sourceStatus: p['Source status'],
    } })
  }
  const aopRows = []
  for (const a of plan['AOP all years']) {
    const y1 = a.Year === 1
    // Y1 month 3: spend ≈ a fifth of the year's budget; nothing spent in later years.
    const spent = y1 ? +(a['Budget INR crore'] * (0.12 + rnd() * 0.18)).toFixed(3) : 0
    aopRows.push({
      id: a['AOP ID'], packageId: a['Package ID'], year: a.Year, budgetCr: a['Budget INR crore'], spentCr: spent, accountableRole: a['Accountable role'],
      deliverable: a['Annual deliverable'], evidenceRule: a['Evidence rule'], start: a.Start, finish: a.Finish,
      state: y1 ? pick(['in_progress', 'in_progress', 'in_progress', 'accepted_internal']) : 'planned', progressPct: y1 ? rand(8, 30) : 0, sourceStatus: a.State,
    })
  }
  await createMany('aopRecord', aopRows)
  const aopIds = new Set(aopRows.map(a => a.id))

  const BLOCK_REASONS = ['Contractor awaiting utility shutdown clearance', 'Specification query from procurement cell unanswered', 'Named instructor not yet released by parent department', 'Registry export from state MIS pending']
  const tasks = []
  for (const t of plan['Y1 tasks']) {
    const m = t['Due month'], dueAt = monthEnd(m)
    const connected = t.ITI === 'PUS' || t.ITI === 'SHA'
    let state, forecastAt = null, blockedReason = null, evidenceNote = null, reviewNote = null, lastUpdateAt = null
    const STORY = { 'TASK-PUS-01': 'reviewed', 'TASK-SHA-01': 'reviewed', 'TASK-NAR-01': 'reported_complete', 'TASK-ROH-01': 'completed', 'TASK-OKH-01': 'returned',
      'TASK-PUS-02': 'reviewed', 'TASK-SHA-02': 'returned', 'TASK-NAR-02': 'in_progress', 'TASK-ROH-02': 'blocked', 'TASK-OKH-02': 'completed',
      'TASK-PUS-03': 'in_progress', 'TASK-PUS-04': 'in_progress', 'TASK-PUS-06': 'completed', 'TASK-SHA-06': 'completed', 'TASK-NAR-06': 'in_progress', 'TASK-ROH-06': 'in_progress', 'TASK-OKH-06': 'in_progress', 'TASK-SHA-04': 'in_progress' }
    if (STORY[t['Task ID']]) state = STORY[t['Task ID']]
    else if (m <= 2) {
      state = pick(connected ? ['reviewed', 'reviewed', 'reviewed', 'completed', 'completed', 'reported_complete', 'returned', 'in_progress'] : ['reviewed', 'completed', 'reported_complete', 'returned', 'in_progress', 'in_progress'])
    } else if (m === 3) {
      state = pick(['in_progress', 'in_progress', 'in_progress', 'blocked', 'reported_complete', 'planned'])
    } else state = chance(0.12) ? 'in_progress' : 'planned'
    if (state === 'blocked') { blockedReason = t.ITI === 'ROH' ? BLOCK_REASONS[0] : pick(BLOCK_REASONS); forecastAt = t.ITI === 'ROH' ? d('2026-11-15') : addDays(dueAt, rand(25, 45)) }
    if (state === 'in_progress' && dueAt < TODAY) forecastAt = addDays(dueAt, rand(15, 40))
    if (['reviewed', 'completed', 'reported_complete'].includes(state)) { evidenceNote = `${t.Evidence} — uploaded by ${t.Responsible}`; lastUpdateAt = addDays(dueAt, -rand(0, 12)) }
    if (state === 'returned') { reviewNote = 'Returned: evidence lacks room/site identifiers and the continuation-of-classes note. Resubmit with the acceptance items.'; lastUpdateAt = addDays(dueAt, 3) }
    if (['in_progress', 'blocked'].includes(state)) lastUpdateAt = daysAgo(rand(1, 9))
    const aopId = aopIds.has(t['AOP ID']) ? t['AOP ID'] : aopRows.find(a => a.year === 1 && a.packageId.includes(t.ITI))?.id
    tasks.push({
      id: t['Task ID'], clusterId: C, itiId: t.ITI, aopId, title: t.Task, quarter: t.Quarter, dueMonth: m, dueAt, forecastAt,
      responsibleRole: t.Responsible, reviewerRole: t.Reviewer, predecessorId: t.Predecessor || null, evidence: t.Evidence, acceptance: t.Acceptance,
      state, blockedReason, evidenceNote, evidenceUrl: evidenceNote ? `/demo/evidence/${t['Task ID']}.pdf` : null, lastUpdateAt, updatedByRole: lastUpdateAt ? t.Responsible : null, reviewNote,
      isMilestone: ['CEO', 'SPV-ME', 'SPV-ACADEMIC'].includes(t.Reviewer) || m <= 2, weightPct: 2,
    })
  }
  await createMany('planTask', tasks)

  await createMany('launchGate', plan['Launch gates'].map((g, i) => ({
    id: g['Gate ID'], offeringId: g['Offering ID'], beforeLaunch: g['Before launch'], prerequisite: g.Prerequisite, evidence: g.Evidence, ownerRole: g.Owner, reviewerRole: g.Reviewer,
    state: g['Offering ID'] === 'OF-SHA-WEL' && /COURSE|STAFF/.test(g['Gate ID']) ? 'ready' : 'pending',
  })))
  await createMany('evidenceRule', plan['Evidence rules'].map(r => ({ id: r['Rule ID'], clusterId: C, workstream: r.Workstream, requiredContent: r['Required content'], workflow: r.Workflow, firstReviewer: r['First reviewer'], escalation: r.Escalation })))
  await createMany('risk', plan['Risks and changes'].map(r => ({ id: r['Risk ID'], clusterId: C, risk: r.Risk, trigger: r.Trigger, response: r.Response, ownerRole: r.Owner, cadence: r.Cadence, decisionRule: r['Decision rule'], state: ['R02', 'R03'].includes(r['Risk ID']) ? 'triggered' : 'open' })))

  // ══════════════════════════════════════════════════════════════════════
  // KPIs (27 from the plan; actuals only where a source exists)
  // ══════════════════════════════════════════════════════════════════════
  console.log('[seed] kpis…')
  const kdef = Object.fromEntries(plan['KPI definitions'].map(r => [r['KPI ID'], r]))
  const studentsPUSSHA = registry.Student.length, womenPUSSHA = registry.Student.filter(s => s.Gender === 'Female').length
  const placesPUSSHA = sumPlan('PUS', 'Y1', 'Annual places') + sumPlan('SHA', 'Y1', 'Annual places')
  const ACTUALS = {
    K01: { current: studentsPUSSHA, coverage: '2 of 5 ITIs reporting (registry-connected)', numerator: studentsPUSSHA, valueStatus: 'Partial: Pusa + Shahdara registry only', weight: 0 },
    K02: { current: +(100 * studentsPUSSHA / placesPUSSHA).toFixed(1), coverage: '2 of 5 ITIs', numerator: studentsPUSSHA, denominator: placesPUSSHA, valueStatus: 'Registry-derived for connected ITIs', weight: 0.12 },
    K03: { current: null, valueStatus: 'No cohort due to finish in Y1', weight: 0.08 },
    K04: { current: null, valueStatus: 'Pending: pre-scheme cohort tracking under way (see pipeline)', weight: 0.14 },
    K05: { current: 18, coverage: 'Faculty training log · 2 of 5 ITIs', valueStatus: 'Synthetic from faculty training events', weight: 0.08 },
    K06: { current: 4, coverage: 'Employer register', valueStatus: 'From employer register (active MoUs)', weight: 0.05 },
    K07: { current: 32, coverage: 'Apprenticeship/OJT spells started', valueStatus: 'From placement pipeline (joined, any evidence level)', weight: 0.08 },
    K08: { current: 14, coverage: 'Cost-weighted across 15 civil packages', valueStatus: 'From civil works register; IMA inspected Pusa', weight: 0.1, verified: true },
    K09: { current: 6, valueStatus: 'From procurement register (installed units / inventory)', weight: 0.1 },
    K11: { current: +(100 * womenPUSSHA / studentsPUSSHA).toFixed(1), coverage: '2 of 5 ITIs', numerator: womenPUSSHA, denominator: studentsPUSSHA, valueStatus: 'Registry-derived for connected ITIs', weight: 0.07 },
    K12: { current: null, valueStatus: 'Registry has no category field — owner named (DIGITAL-LEAD)', weight: 0 },
    K19: { current: 88, coverage: 'Sessions with attendance submitted / scheduled, last 15 working days', valueStatus: 'From operations data (connected ITIs)', weight: 0.05 },
    K21: { current: null, valueStatus: 'No apprenticeship cohort has completed yet', weight: 0.05 },
    K25: { current: 42, valueStatus: 'Synthetic infrastructure checklist', weight: 0.05 },
    K26: { current: 2, valueStatus: 'Baseline carried; no new CSR partnership logged', weight: 0.03 },
  }
  for (const k of plan['KPI plan']) {
    const code = k['KPI ID'], def = kdef[code] || {}, a = ACTUALS[code] || {}
    await prisma.kpi.create({ data: {
      clusterId: C, code, area: KPI_AREA[code] || 'other', name: k.Measure, unit: k.Unit,
      baseline: k['Baseline model'] == null ? null : +(+k['Baseline model']).toFixed(2), baselineText: def['Source baseline'] || null,
      targets: J({ Y1: k.Y1, Y2: k.Y2, Y3: k.Y3, Y4: k.Y4, Y5: k.Y5 }), target: k.Y1 == null ? null : +(+k.Y1).toFixed(2),
      current: a.current ?? null, currentAsOf: a.current != null ? daysAgo(rand(0, 6)) : null, coverage: a.coverage || null, numerator: a.numerator ?? null, denominator: a.denominator ?? null,
      definition: def['Operational definition'], actualSource: def['Actual source'], ownerRole: def.Owner,
      sourceText: `Baseline ${def['Source baseline'] ?? '—'} · Y3 ${def['Source Y3'] ?? '—'} · Y5 ${def['Source Y5'] ?? '—'} (${def.Provenance || 'plan'})`,
      weight: a.weight ?? 0, verified: !!a.verified, direction: 'up', valueStatus: a.valueStatus || k['Value status'],
    } })
  }

  // ══════════════════════════════════════════════════════════════════════
  // COURSE MODULES (LMS) + SUBJECTS
  // ══════════════════════════════════════════════════════════════════════
  console.log('[seed] subjects + modules…')
  const subjectsByProg = {}
  for (const s of mapping.Subjects) (subjectsByProg[s.Programme] ||= []).push(s)
  await createMany('subject', mapping.Subjects.map(s => ({ id: s['Subject ID'], tradeId: s.Programme, name: s['Subject name'], type: s.Type, scope: s['Year 1 topic scope'], studyYear: s['Study year'] || 1 })))

  const modulesByTrade = {}
  for (const t of Object.values(trades)) {
    if (t.kind === 'aggregate') continue
    const subs = subjectsByProg[t.code] || []
    const topic = (type, fallback) => subs.find(s => s.Type === type)?.['Year 1 topic scope'] || fallback
    const lessonsFor = (title, i) => [
      { title: `${title}: safety, tools and workplace rules`, type: 'video', minutes: 30 },
      { title: topic('Theory', `${t.name} theory block ${i}`), type: 'text', minutes: 90 },
      { title: topic('Practical', `${t.name} practical block ${i}`), type: 'practical', minutes: 420 },
      { title: topic('Applied', 'Applied calculation and drawing'), type: 'text', minutes: 60 },
      { title: topic('Common', 'Employability skills: communication, teamwork, digital basics'), type: 'text', minutes: 45 },
      { title: `Module ${i} quick check`, type: 'quiz', minutes: 20 },
    ]
    const list = []
    if (t.kind === 'short_term') {
      list.push(await prisma.courseModule.create({ data: { tradeId: t.id, index: 1, title: `${t.name} — supervised skills module`, kind: 'specific', hours: t.totalHours, credits: Math.round(t.totalHours / 30), status: 'draft', lessons: J(lessonsFor(t.name, 1)), authorId: cms.id } }))
    } else {
      const n = t.durationValue >= 24 ? 5 : 3
      for (let i = 1; i <= n; i++) {
        const core = i <= (n === 5 ? 3 : 2)
        list.push(await prisma.courseModule.create({ data: { tradeId: t.id, index: i, title: `${t.name} — ${core ? 'core' : 'specialist'} module ${i}`, kind: core ? 'core' : 'specific', hours: 240, credits: 8, status: t.status === 'approved' ? 'approved' : i <= 2 ? 'approved' : 'draft', lessons: J(lessonsFor(t.name, i)), authorId: cms.id } }))
      }
      list.push(await prisma.courseModule.create({ data: { tradeId: t.id, index: n + 1, title: 'On-the-Job Training (150 h, mentor-signed)', kind: 'ojt', hours: 150, credits: 5, status: 'approved', lessons: J([{ title: 'OJT logbook — 150 hours with an employer', type: 'practical', minutes: 9000 }]), authorId: cms.id } }))
    }
    modulesByTrade[t.code] = list
  }

  // ══════════════════════════════════════════════════════════════════════
  // FACULTY (trainers), BATCHES, ASSIGNMENTS, STUDENTS
  // ══════════════════════════════════════════════════════════════════════
  console.log('[seed] faculty…')
  const facUsers = registry.Faculty.map(f => ({
    id: `U-FAC-${f.Faculty_Code}`, role: 'trainer', name: f.Faculty_Name, phone: phoneOf(f.Mobile_No), loginId: `USR-${f.Faculty_Code}`, passwordHash: pw, language: 'hi', email: f.Email,
    profile: J({ clusterId: C, itiCode: f.Institute_Code, facultyCode: f.Faculty_Code, programme: f.Program_Code, primaryBatch: f.Batch_Code, designation: `${f.Designation} (${f.Employement_Type}) · ${f.Program_Code} · ${ITI_META[f.Institute_Code].name}`, joinedAt: f.Date_Of_Joining, gender: f.Gender }),
  }))
  await createMany('user', facUsers)
  const facUserId = code => `U-FAC-${code}`

  console.log('[seed] batches + assignments…')
  const ballocByBatch = Object.fromEntries(mapping['Batch allocation'].map(b => [b['Batch ID'], b]))
  const batchRows = registry.Batch.map(b => {
    const al = ballocByBatch[b.Batch_Code] || {}
    return {
      id: b.Batch_Code, name: `${ITI_META[b.Institute_Code].name.replace('Government ITI ', '')} · ${b.Batch_Name}`, itiId: b.Institute_Code, tradeId: b.Program_Code,
      offeringId: al['Offering ID'] && offerings[al['Offering ID']] ? al['Offering ID'] : null, leadUserId: al['Batch lead faculty'] ? facUserId(al['Batch lead faculty']) : null,
      startDate: shiftYear(b.Batch_Start_Date), endDate: shiftYear(b.Batch_End_Date), capacity: b.Intake_Capacity, tenureMonths: b.Batch_Tenure, studyYear: al['Study year'] || 1,
      currentModule: 1, state: 'running', cohortLabel: `Y1 intake · completes ${shiftYear(b.Batch_End_Date).getUTCFullYear()}`,
    }
  })
  // synthetic pre-scheme pass-out batches (for the placement pipeline's wage branch)
  const PRE = [
    { id: 'SYN-PUS-ELE-PRE-B01', iti: 'PUS', trade: 'ELE', n: 24, lead: 'SYN-FAC-0001' },
    { id: 'SYN-PUS-FIT-PRE-B01', iti: 'PUS', trade: 'FIT', n: 20, lead: null },
    { id: 'SYN-SHA-LWD-PRE-B01', iti: 'SHA', trade: 'LWD', n: 20, lead: null },
  ]
  for (const p of PRE) batchRows.push({ id: p.id, name: `${ITI_META[p.iti].name.replace('Government ITI ', '')} · ${p.trade} 2024-26 (pre-scheme)`, itiId: p.iti, tradeId: p.trade, offeringId: null, leadUserId: p.lead ? facUserId(p.lead) : null, startDate: d('2024-08-01'), endDate: d('2026-07-31'), capacity: 24, tenureMonths: 24, studyYear: 2, currentModule: 5, state: 'completed', cohortLabel: 'Pre-scheme cohort 2024-26 · synthetic, not in registry' })
  await createMany('batch', batchRows)

  await createMany('trainerAssignment', mapping['Trainer assignments'].map(a => ({
    id: a['Assignment ID'], trainerUserId: facUserId(a['Faculty ID']), batchId: a['Batch ID'], subjectId: a['Subject ID'], responsibility: a.Responsibility,
    effectiveFrom: shiftYear(a['Effective from']), effectiveTo: a['Effective to'] ? shiftYear(a['Effective to']) : null,
  })))
  const asgByBatch = {}
  for (const a of mapping['Trainer assignments']) (asgByBatch[a['Batch ID']] ||= {})[a['Subject ID']] = facUserId(a['Faculty ID'])
  const subjByBatch = {}
  for (const bs of mapping['Batch subjects']) (subjByBatch[bs['Batch ID']] ||= []).push(bs['Subject ID'])

  console.log('[seed] students…')
  const DEMO_STU = 'SYN-STU-000006'
  const firstCopSHA = registry.Student.find(s => s.Institute_Code === 'SHA' && s.Program_Code === 'COP')?.Student_Code
  const stuUsers = [], traineeRows = []
  for (const s of registry.Student) {
    const name = [s.Student_First_Name, s.Student_Middle_Name, s.Student_Last_Name].filter(Boolean).join(' ')
    const code = s.Student_Code, isDemo = code === DEMO_STU, isOjtDemo = code === firstCopSHA
    stuUsers.push({ id: `U-STU-${code}`, role: 'trainee', name, phone: phoneOf(s.Contact_No), passwordHash: isDemo || isOjtDemo ? pw : null, language: 'hi', email: s.Email_ID,
      loginId: isDemo ? 'LRN-PUS-000006' : isOjtDemo ? 'LRN-SHA-COP-001' : null, aadhaar: isDemo ? '123456789012' : null,
      profile: J({ clusterId: C, itiCode: s.Institute_Code, studentCode: code, programme: s.Program_Code, batchCode: s.Batch_Code, father: s.Father_Name, mother: s.Mother_Name }) })
    traineeRows.push({ id: code, userId: `U-STU-${code}`, name, phone: phoneOf(s.Contact_No), gender: s.Gender === 'Female' ? 'F' : 'M', dob: d(s.Date_Of_Birth), education: s.Highest_Qualification,
      category: null, pwd: s.Disability_Status === 'Yes', pwdType: s.Disability_Status === 'Yes' ? s.Disability_Type : null, district: ITI_META[s.Institute_Code].district,
      itiId: s.Institute_Code, batchId: s.Batch_Code, enrolledAt: shiftYear('2025-08-01'), studyYear: 1, status: 'active', languagePref: 'hi', registryMatched: true })
  }
  // pre-scheme pass-outs (synthetic)
  const passouts = []
  let pssN = 0
  for (const p of PRE) {
    for (let i = 0; i < p.n; i++) {
      pssN++
      const code = `SYN-PSS-${String(pssN).padStart(4, '0')}`, isF = chance(0.2), name = synthName(isF), phone = '9009' + String(100000 + pssN).padStart(6, '0')
      const isDemo = pssN === 1
      stuUsers.push({ id: `U-STU-${code}`, role: 'trainee', name, phone, passwordHash: isDemo ? pw : null, language: 'hi', loginId: isDemo ? 'LRN-PUS-PASS-001' : null,
        profile: J({ clusterId: C, itiCode: p.iti, studentCode: code, programme: p.trade, batchCode: p.id, source: 'Synthetic pre-scheme pass-out; not in registry' }) })
      traineeRows.push({ id: code, userId: `U-STU-${code}`, name, phone, gender: isF ? 'F' : 'M', dob: new Date(Date.UTC(rand(2003, 2006), rand(0, 11), rand(1, 28))), education: pick(['10th', '10th', '12th']), category: null, pwd: false,
        district: ITI_META[p.iti].district, itiId: p.iti, batchId: p.id, enrolledAt: d('2024-08-01'), studyYear: 2, status: 'completed', languagePref: 'hi', registryMatched: false })
      passouts.push({ id: code, userId: `U-STU-${code}`, name, iti: p.iti, trade: p.trade, gender: isF ? 'F' : 'M' })
    }
  }
  await createMany('user', stuUsers)
  await createMany('trainee', traineeRows)
  const traineesByBatch = {}
  for (const t of traineeRows) (traineesByBatch[t.batchId] ||= []).push(t)
  const demoTrainee = traineeRows.find(t => t.id === DEMO_STU)
  const demoBatch = demoTrainee.batchId // SYN-PUS-ELE-Y1-B01
  const demoTrainerId = facUserId('SYN-FAC-0001')

  // module progress for registry students (module 1 under way)
  const progressRows = []
  for (const t of traineeRows) {
    const mods = modulesByTrade[t.batchId.includes('PRE') ? PRE.find(p => p.id === t.batchId).trade : registry.Batch.find(b => b.Batch_Code === t.batchId)?.Program_Code]
    if (!mods) continue
    if (t.status === 'completed') { for (const m of mods) progressRows.push({ traineeId: t.id, moduleId: m.id, pctComplete: 100, hoursLogged: m.hours, lessonsDone: J([0, 1, 2, 3, 4, 5]), lastActivityAt: d('2026-07-20') }); continue }
    const m1 = mods[0], lessons = JSON.parse(m1.lessons), pct = t.id === DEMO_STU ? 50 : rand(10, 60)
    const done = lessons.map((_, i) => i).filter(i => (i + 1) / lessons.length <= pct / 100)
    progressRows.push({ traineeId: t.id, moduleId: m1.id, pctComplete: pct, hoursLogged: Math.round(m1.hours * pct / 100), lessonsDone: J(done), lastActivityAt: daysAgo(rand(0, 7)) })
  }
  await createMany('moduleProgress', progressRows)

  // ══════════════════════════════════════════════════════════════════════
  // SESSIONS + ATTENDANCE (last ~3 working weeks)
  // ══════════════════════════════════════════════════════════════════════
  console.log('[seed] sessions + attendance…')
  const workingDays = []
  for (let dt = d('2026-09-21'); dt <= TODAY; dt = addDays(dt, 1)) { if (dt.getUTCDay() === 0 || iso(dt) === '2026-10-02') continue; workingDays.push(dt) }
  const subjType = Object.fromEntries(mapping.Subjects.map(s => [s['Subject ID'], s.Type]))
  const chronic = new Set(traineeRows.filter(t => t.status === 'active' && chance(0.06)).map(t => t.id))
  const runningBatches = batchRows.filter(b => b.state === 'running')
  const gapBatches = new Set(runningBatches.filter(b => b.itiId === 'SHA').slice(0, 3).map(b => b.id)) // no reports since 8 Oct
  const sessionRows = [], markRows = []
  const absencesByTrainee = {}
  for (const b of runningBatches) {
    const subs = subjByBatch[b.id] || []
    const roster = traineesByBatch[b.id] || []
    workingDays.forEach((date, k) => {
      const subjectId = subs[k % subs.length]
      const trainerUserId = asgByBatch[b.id]?.[subjectId] || b.leadUserId
      const sid = `S-${b.id}-${iso(date)}`
      const isToday = iso(date) === iso(TODAY)
      const startTime = ['09:30', '11:30', '14:00'][k % 3]
      const base = { id: sid, batchId: b.id, subjectId, trainerUserId, date, startTime, room: `${b.itiId}-${subjType[subjectId] === 'Practical' ? 'WS' : 'R'}${(k % 4) + 1}`, kind: subjType[subjectId] === 'Practical' ? 'practical' : 'theory' }
      if (gapBatches.has(b.id) && date >= d('2026-10-08')) { sessionRows.push({ ...base, delivery: 'scheduled', attendanceState: 'not_reported' }); return }
      if (isToday) {
        const early = startTime === '09:30' && b.itiId === 'PUS' && b.id !== demoBatch && chance(0.5)
        if (!early) { sessionRows.push({ ...base, delivery: 'scheduled', attendanceState: 'not_reported' }); return }
      }
      const r = rnd()
      let delivery = 'delivered', deliveryReason = null
      if (r < 0.03) { delivery = 'rescheduled'; deliveryReason = 'Trainer on leave; rescheduled to Saturday slot' }
      else if (r < 0.05) { delivery = 'cancelled'; deliveryReason = pick(['Workshop closed for civil works', 'Equipment fault — compressor down', 'Power outage']) }
      else if (r < 0.065) { delivery = 'partial'; deliveryReason = 'Power cut after 50 minutes' }
      if (delivery === 'rescheduled' || delivery === 'cancelled') { sessionRows.push({ ...base, delivery, deliveryReason, attendanceState: 'not_reported' }); return }
      const recent = date >= daysAgo(2)
      let attendanceState = recent && chance(0.5) ? 'submitted' : 'confirmed'
      const needsReview = chance(0.025)
      if (needsReview) attendanceState = 'needs_review'
      const captureMethod = chance(0.85) ? 'trainer_mobile' : chance(0.9) ? 'offline_sync' : 'camera_assisted'
      let present = 0, absent = 0, late = 0
      roster.forEach((t, idx) => {
        let status
        const pPresent = t.id === DEMO_STU ? 0.95 : chronic.has(t.id) ? 0.5 : 0.92
        if (needsReview && idx === 0) status = 'roster_issue'
        else if (chance(pPresent)) { status = chance(0.04) ? 'late' : 'present' } else status = chance(0.15) ? 'excused' : 'absent'
        if (status === 'present') present++; else if (status === 'late') { late++; present++ } else if (status === 'absent') { absent++; absencesByTrainee[t.id] = (absencesByTrainee[t.id] || 0) + 1 }
        markRows.push({ sessionId: sid, traineeId: t.id, status, reason: status === 'excused' ? pick(['Medical', 'Family function', 'Exam at school board']) : status === 'roster_issue' ? 'Student says they moved to another batch' : null })
      })
      sessionRows.push({ ...base, delivery, deliveryReason, attendanceState, captureMethod, submittedAt: addDays(date, 0), confirmedAt: attendanceState === 'confirmed' ? addDays(date, 1) : null,
        syncState: captureMethod === 'offline_sync' && recent && chance(0.3) ? 'saved_on_device' : 'synced', presentCount: present, absentCount: absent, lateCount: late })
    })
  }
  await createMany('session', sessionRows)
  await createMany('attendanceMark', markRows, 500)

  // ══════════════════════════════════════════════════════════════════════
  // ASSESSMENTS + MARKS, PRACTICALS + OBSERVATIONS
  // ══════════════════════════════════════════════════════════════════════
  console.log('[seed] assessments…')
  const planRows = [], entryRows = []
  const lowResult = {}
  let apN = 0
  const thSubj = b => (subjByBatch[b.id] || []).find(s => subjType[s] === 'Theory'), prSubj = b => (subjByBatch[b.id] || []).find(s => subjType[s] === 'Practical')
  const trainerName = Object.fromEntries(registry.Faculty.map(f => [facUserId(f.Faculty_Code), f.Faculty_Name]))
  for (const b of runningBatches) {
    const roster = traineesByBatch[b.id] || []
    const lead = trainerName[b.leadUserId] || 'Batch lead'
    // 1. unit test 1 — confirmed
    const a1 = `AP-${++apN}`
    planRows.push({ id: a1, batchId: b.id, subjectId: thSubj(b) || null, title: 'Unit test 1 · theory', type: 'theory', topic: 'Safety and fundamentals', maxMarks: 50, date: d('2026-09-26'), evaluatorName: lead, paperVersion: 'v1', state: 'confirmed' })
    for (const t of roster) {
      const absent = chance(0.06)
      const low = chance(0.07)
      const marks = absent ? null : low ? rand(8, 19) : t.id === DEMO_STU ? 41 : rand(20, 48)
      if (low && !absent) lowResult[t.id] = marks
      entryRows.push({ assessmentId: a1, traineeId: t.id, marks, status: absent ? 'absent' : 'scored', source: 'manual', reviewState: 'confirmed' })
    }
    // 2. practical check 1 — PUS confirmed (manual), SHA needs_review (OCR), demo + 2 others marks_pending
    const a2 = `AP-${++apN}`
    const pending = b.id === demoBatch || (b.itiId === 'PUS' && chance(0.04))
    const ocr = b.itiId === 'SHA'
    planRows.push({ id: a2, batchId: b.id, subjectId: prSubj(b) || null, title: 'Practical check 1', type: 'practical', topic: 'First workshop task', maxMarks: 25, date: d('2026-10-07'), evaluatorName: lead, paperVersion: null, state: pending ? 'marks_pending' : ocr ? 'needs_review' : 'confirmed' })
    if (!pending) for (const t of roster) {
      const absent = chance(0.05), marks = absent ? null : rand(9, 25)
      const conf = ocr ? +(0.55 + rnd() * 0.44).toFixed(2) : null
      const lowConf = ocr && conf < 0.75
      entryRows.push({ assessmentId: a2, traineeId: t.id, marks, status: absent ? 'absent' : 'scored', source: ocr ? 'ocr' : 'manual', ocrConfidence: conf, ocrExtracted: ocr && marks != null ? (lowConf ? Math.max(0, marks + pick([-3, 3, -1])) : marks) : null, reviewState: lowConf ? 'needs_review' : ocr ? 'submitted' : 'confirmed' })
    }
    // 3. unit test 2 — planned
    planRows.push({ id: `AP-${++apN}`, batchId: b.id, subjectId: thSubj(b) || null, title: 'Unit test 2 · theory', type: 'theory', topic: 'Measurement and drawing', maxMarks: 50, date: d('2026-10-24'), evaluatorName: lead, paperVersion: null, state: 'planned' })
  }
  await createMany('assessmentPlan', planRows)
  await createMany('markEntry', entryRows, 500)

  console.log('[seed] practicals…')
  const PRACT = {
    ELE: ['Wire a single-phase lighting circuit with switch control', 'Measure voltage, current and resistance safely', 'Identify faults on a domestic distribution board'],
    FIT: ['Mark out and file a flat surface to ±0.2 mm', 'Drill and tap a through hole', 'Assemble a bolted joint to torque'],
    COP: ['Prepare a formatted spreadsheet with formulas', 'Type a business letter at 25 wpm', 'Set up email and share a document'],
    LWD: ['Lay a straight bead with SMAW in flat position', 'Set up and check gas regulator safely', 'Prepare a butt joint'],
    LMC: ['Face and turn a mild-steel bar to size', 'Grind a tool bit to angle', 'Measure with micrometer and vernier'],
  }
  const practRows = [], obsRows = []
  let ptN = 0
  const practByTrade = {}
  for (const t of Object.values(trades)) {
    if (t.kind === 'aggregate') continue
    const titles = PRACT[t.code] || [`${t.name}: safety set-up and tool handling`, `${t.name}: first supervised job`, `${t.name}: measurement and finish check`]
    practByTrade[t.code] = titles.map((title, i) => { const id = `PT-${++ptN}`; practRows.push({ id, tradeId: t.id, title, rubric: J(['Safety and PPE', 'Procedure followed', 'Result within tolerance']), required: i < 2 }); return id })
  }
  await createMany('practicalTask', practRows)
  const obsBatches = runningBatches.filter(b => b.itiId === 'PUS' && ['ELE', 'FIT', 'LWD'].includes(b.tradeId)).slice(0, 12)
  const recheckDue = []
  for (const b of obsBatches) {
    const tasks_ = practByTrade[b.tradeId]
    for (const t of traineesByBatch[b.id] || []) {
      const r = rnd(), result = r < 0.6 ? 'demonstrated' : r < 0.85 ? 'developing' : r < 0.95 ? 'needs_re_practice' : 'not_observed'
      const sc = result === 'demonstrated' ? [2, 2, 2] : result === 'developing' ? [2, 1, 1] : result === 'needs_re_practice' ? [1, 1, 0] : [0, 0, 0]
      const recheckAt = result === 'needs_re_practice' ? addDays(TODAY, rand(-2, 6)) : null
      if (recheckAt) recheckDue.push({ traineeId: t.id, batch: b, recheckAt })
      obsRows.push({ taskId: tasks_[0], traineeId: t.id, observerId: b.leadUserId || demoTrainerId, scores: J({ 'Safety and PPE': sc[0], 'Procedure followed': sc[1], 'Result within tolerance': sc[2] }), result, recheckAt, note: result === 'needs_re_practice' ? 'Re-practise with supervision before next check' : null, observedAt: daysAgo(rand(1, 8)) })
      if (chance(0.4)) obsRows.push({ taskId: tasks_[1], traineeId: t.id, observerId: b.leadUserId || demoTrainerId, scores: J({ 'Safety and PPE': 2, 'Procedure followed': 1, 'Result within tolerance': 1 }), result: 'developing', observedAt: daysAgo(rand(0, 4)) })
    }
  }
  await createMany('practicalObservation', obsRows)

  // ══════════════════════════════════════════════════════════════════════
  // VISITS, FINDINGS, ISSUES, AVAILABILITY, SUPPORT ACTIONS
  // ══════════════════════════════════════════════════════════════════════
  console.log('[seed] visits, issues, support…')
  const CHECK = { 'Machines functional': 'satisfactory', 'PPE in use': 'satisfactory', 'Consumables stocked': 'action_needed', 'Fire exit clear': 'satisfactory', 'Trainer present': 'satisfactory', 'Lesson matches timetable': 'satisfactory' }
  const visits = [
    { iti: 'PUS', workshop: 'Electrician workshop (PUS-WS1)', type: 'routine', by: principals.PUS.id, date: daysAgo(6), checklist: { ...CHECK }, note: 'Wiring boards short by 4; consumables request raised.', findings: [{ item: 'Only 6 of 10 wiring boards usable; 4 need new MCBs', severity: 'medium', owner: 'TECH-PUS', due: 7, state: 'action_assigned', cls: 'ELE Year 1 batches 01–04' }, { item: 'Cable offcuts stock below one week', severity: 'low', owner: 'PR-PUS', due: 5, state: 'closed', closure: 'Stock received 10 Oct' }] },
    { iti: 'PUS', workshop: 'Welding shop (PUS-WS3)', type: 'issue_follow_up', by: principals.PUS.id, date: daysAgo(2), checklist: { ...CHECK, 'Fire exit clear': 'action_needed', 'Consumables stocked': 'satisfactory' }, note: 'Exit partially blocked by delivered steel; cleared during visit.', findings: [{ item: 'Fume extraction fan 2 not running', severity: 'high', owner: 'TECH-PUS', due: 3, state: 'open', cls: 'LWD batches 01–05' }] },
    { iti: 'SHA', workshop: 'Fitter workshop (SHA-WS1)', type: 'routine', by: principals.SHA.id, date: daysAgo(4), checklist: { ...CHECK, 'Machines functional': 'action_needed' }, note: 'Two bench drills awaiting spares.', findings: [{ item: 'Bench drills #2 and #3 non-functional', severity: 'medium', owner: 'TECH-SHA', due: 10, state: 'action_assigned', cls: 'FIT Year 1 batches' }] },
    { iti: 'SHA', workshop: 'Computer lab (SHA-R2)', type: 'ceo_review', by: ceo.id, date: daysAgo(9), checklist: { ...CHECK, 'Consumables stocked': 'n_a' }, note: 'Lab shared by 5 COPA batches; timetable congestion noted.', findings: [{ item: 'Only 18 working PCs for batches of 20', severity: 'medium', owner: 'PR-SHA', due: 14, state: 'open', cls: 'COP batches' }] },
  ]
  for (const v of visits) {
    const row = await prisma.visit.create({ data: { itiId: v.iti, workshop: v.workshop, visitType: v.type, visitorId: v.by, date: v.date, checklist: J(v.checklist), note: v.note, state: 'submitted' } })
    for (const f of v.findings) await prisma.finding.create({ data: { visitId: row.id, item: f.item, severity: f.severity, ownerRole: f.owner, dueAt: addDays(v.date, f.due), state: f.state, closureNote: f.closure || null, affectedClass: f.cls } })
  }
  const issues = [
    ['PUS', null, 'Fume extraction fan 2 not running in welding shop', 'safety', 'high', 'Welding practicals limited to 2 booths', demoTrainerId, 'TECH-PUS', 'assigned', 2],
    ['PUS', demoBatch, 'Only 6 wiring boards usable for a batch of 15', 'equipment', 'medium', 'Students work in threes; practical time halved', demoTrainerId, 'TECH-PUS', 'assigned', 6],
    ['PUS', null, 'Room R3 double-booked on Tuesdays (ELE theory vs COPA)', 'timetable', 'medium', 'One batch loses the 11:30 slot', demoTrainerId, 'PR-PUS', 'open', 1],
    ['SHA', null, 'Bench drills #2 and #3 awaiting chuck spares', 'equipment', 'medium', 'Fitter practicals queue on 3 drills', facUserId('SYN-FAC-0080'), 'TECH-SHA', 'open', 4],
    ['SHA', null, 'Electrode stock finished; next delivery not scheduled', 'consumables', 'high', 'Welding practicals paused since 9 Oct', facUserId('SYN-FAC-0090'), 'PR-SHA', 'open', 4],
    ['PUS', null, 'Compressor tripping in machine shop', 'equipment', 'low', 'Intermittent; AMC call logged', facUserId('SYN-FAC-0030'), 'TECH-PUS', 'resolved', 12],
    ['SHA', null, 'Substitute needed: instructor on medical leave till 20 Oct', 'trainer', 'medium', '2 LWD batches without named trainer', facUserId('SYN-FAC-0095'), 'PR-SHA', 'assigned', 3],
  ]
  for (const [iti, batchId, title, category, severity, effect, raisedById, ownerRole, state, ago] of issues) {
    await prisma.opsIssue.create({ data: { itiId: iti, batchId, title, category, severity, effect, raisedById, ownerRole, state, resolution: state === 'resolved' ? 'AMC technician replaced pressure switch' : null, createdAt: daysAgo(ago), resolvedAt: state === 'resolved' ? daysAgo(ago - 3) : null } })
  }
  const availRows = []
  for (const code of ['SYN-FAC-0012', 'SYN-FAC-0027', 'SYN-FAC-0041', 'SYN-FAC-0095']) availRows.push({ trainerUserId: facUserId(code), date: TODAY, status: 'leave', note: code === 'SYN-FAC-0095' ? 'Medical leave till 20 Oct' : 'Casual leave' })
  availRows.push({ trainerUserId: facUserId('SYN-FAC-0003'), date: TODAY, status: 'late', note: 'Reaching by 11:00' })
  availRows.push({ trainerUserId: demoTrainerId, date: TODAY, status: 'available' })
  await createMany('trainerAvailability', availRows)

  const supportRows = []
  const batchOf = Object.fromEntries(traineeRows.map(t => [t.id, t.batchId]))
  const leadOf = Object.fromEntries(batchRows.map(b => [b.id, b.leadUserId]))
  const itiOfTrainee = Object.fromEntries(traineeRows.map(t => [t.id, t.itiId]))
  const topAbsent = ['PUS', 'SHA'].flatMap(code => Object.entries(absencesByTrainee).filter(([tid, n]) => n >= 4 && itiOfTrainee[tid] === code).sort((a, b) => b[1] - a[1]).slice(0, 15))
  topAbsent.forEach(([tid, n]) => supportRows.push({ traineeId: tid, reason: 'repeated_absence', detail: `${n} absences in the last 3 weeks`, ownerUserId: leadOf[batchOf[tid]], nextAction: pick(['Call guardian', 'Counselling session with batch lead', 'Check travel cost barrier (see Student Voice)']), dueAt: addDays(TODAY, rand(1, 5)), state: pick(['open', 'open', 'in_progress']), createdAt: daysAgo(rand(1, 6)) }))
  ;['PUS', 'SHA'].flatMap(code => Object.entries(lowResult).filter(([tid]) => itiOfTrainee[tid] === code).slice(0, 8)).forEach(([tid, m]) => supportRows.push({ traineeId: tid, reason: 'low_result', detail: `Unit test 1: ${m}/50`, ownerUserId: leadOf[batchOf[tid]], nextAction: 'Remedial session before unit test 2', dueAt: d('2026-10-22'), state: pick(['open', 'in_progress', 'closed']), outcome: null, createdAt: daysAgo(rand(5, 12)) }))
  recheckDue.slice(0, 10).forEach(r => supportRows.push({ traineeId: r.traineeId, reason: 'recheck_due', detail: 'Practical task needs re-practice; recheck scheduled', ownerUserId: r.batch.leadUserId, nextAction: 'Supervised re-practice then recheck', dueAt: r.recheckAt, state: 'open', createdAt: daysAgo(3) }))
  for (const s of supportRows) if (s.state === 'closed') { s.outcome = 'Attended remedial session; retest booked'; s.closedAt = daysAgo(1) }
  await createMany('supportAction', supportRows)

  // ══════════════════════════════════════════════════════════════════════
  // MACHINES, CIVIL, PROCUREMENT, BUDGET LINES, ESCROW, UCs
  // ══════════════════════════════════════════════════════════════════════
  console.log('[seed] machines, civil, procurement, finance…')
  const MACH = {
    PUS: [['ELE', 'Domestic wiring boards ×10', 'electrical', 'functional', 'baseline'], ['ELE', 'Motor control trainer panel', 'electrical', 'non_functional', 'baseline'], ['FIT', 'Bench vices ×20', 'mechanical', 'functional', 'baseline'], ['FIT', 'Pillar drill ×3', 'mechanical', 'functional', 'baseline'], ['LWD', 'SMAW welding booths ×6', 'welding', 'functional', 'baseline'], ['LWD', 'Fume extraction units ×2', 'welding', 'non_functional', 'baseline'], ['LMC', 'Centre lathe ×6', 'machine_shop', 'functional', 'baseline'], ['COP', 'Computer lab — 40 PCs', 'it', 'functional', 'baseline'], ['AUT', 'PLC + pneumatics trainer (specialist lab)', 'automation', 'ordered', 'sip'], ['AUT', 'Six-axis training robot cell', 'automation', 'awaiting_commissioning', 'sip'], [null, 'Smart classroom kit ×4 (WP-PUS digital)', 'digital', 'installed', 'sip']],
    SHA: [['ELE', 'Domestic wiring boards ×8', 'electrical', 'functional', 'baseline'], ['FIT', 'Bench drills ×3', 'mechanical', 'non_functional', 'baseline'], ['LWD', 'SMAW welding booths ×4', 'welding', 'functional', 'baseline'], ['LSM', 'Sheet-metal shear and bending machine', 'fabrication', 'functional', 'baseline'], ['COP', 'Computer lab — 18 working of 24', 'it', 'functional', 'baseline'], ['WEL', 'GMAW/GTAW advanced welding cell', 'welding', 'ordered', 'sip'], [null, 'Smart classroom kit ×2', 'digital', 'installed', 'sip']],
    NAR: [['FIT', 'Bench vices ×16', 'mechanical', 'functional', 'baseline'], ['ELE', 'Wiring boards ×6', 'electrical', 'functional', 'baseline'], ['CNC', 'CNC trainer lathe (feeder)', 'machine_shop', 'ordered', 'sip'], ['CNC', 'CMM / quality inspection bench', 'machine_shop', 'ordered', 'sip']],
    ROH: [['ELE', 'Wiring boards ×6', 'electrical', 'functional', 'baseline'], ['COP', 'Computer lab — 20 PCs', 'it', 'functional', 'baseline'], ['ELX', 'SMD rework & test bench ×6', 'electronics', 'ordered', 'sip'], [null, 'Smart classroom kit ×2', 'digital', 'ordered', 'sip']],
    OKH: [['ELE', 'Wiring boards ×8', 'electrical', 'functional', 'baseline'], ['FIT', 'Pillar drill ×2', 'mechanical', 'functional', 'baseline'], ['HVC', 'Split AC and VRF training rig', 'hvac', 'ordered', 'sip'], ['HVC', 'Refrigerant recovery unit', 'hvac', 'ordered', 'sip']],
  }
  for (const [code, rows] of Object.entries(MACH)) for (const [tc, name, category, status, source] of rows) {
    await prisma.machine.create({ data: { itiId: code, tradeId: tc && trades[tc] ? tc : null, name, category, status, source, packageId: source === 'sip' ? `WP-${code}-0${category === 'digital' ? 7 : 4}` : null, installedAt: status === 'functional' || status === 'installed' ? daysAgo(rand(20, 400)) : null, lastServiceAt: status === 'functional' ? daysAgo(rand(5, 60)) : null } })
  }
  // civil works = the three civil packages per ITI
  const CIVIL_PROG = { PUS: [28, 5, 15], SHA: [22, 0, 10], NAR: [18, 0, 8], ROH: [12, 0, 5], OKH: [20, 0, 10] }
  for (const p of plan.Packages.filter(p => p.Category === 'Civil')) {
    const idx = Number(p['Package ID'].slice(-2)) - 1, pct = CIVIL_PROG[p.ITI][idx] ?? 0
    const design = idx === 1 ? (p.ITI === 'PUS' ? 'design_review' : 'planned') : 'in_progress'
    const delayed = p.ITI === 'ROH' && idx === 0
    await prisma.civilWork.create({ data: { itiId: p.ITI, packageId: p['Package ID'], title: p['Work package'], budgetCr: fy[p['Package ID']]?.['Total INR crore'] || 0, workUnits: 100, unitsAccepted: Math.round(pct * 0.8), pctComplete: pct,
      designApprovedAt: pct > 0 ? addDays(SCENARIO_START, rand(20, 45)) : null, startedAt: pct > 0 ? addDays(SCENARIO_START, rand(40, 60)) : null,
      scheduledCompletion: idx === 1 ? d('2028-03-31') : d('2027-07-31'), imaInspectedAt: p.ITI === 'PUS' && idx === 0 ? daysAgo(5) : null,
      state: delayed ? 'delayed' : pct > 0 ? 'in_progress' : design, contractor: pct > 0 ? pick(['PWD-empanelled contractor (synthetic)', 'Cluster EPC agency (synthetic)']) : null } })
  }
  for (const p of plan.Packages.filter(p => (p.Category === 'Equipment' || p.Category === 'Digital') && (fy[p['Package ID']]?.Y1 || 0) > 0)) {
    const digital = p.Category === 'Digital', core = /ELE|FIT|COP/.test(p['Course scope'] || '')
    const state = digital ? 'awarded' : core ? pick(['tendered', 'planned', 'awarded']) : 'planned'
    await prisma.procurementPackage.create({ data: { clusterId: C, code: p['Package ID'], packageId: p['Package ID'], title: p['Work package'], category: digital ? 'digital' : 'equipment', budgetCr: fy[p['Package ID']]?.['Total INR crore'] || 0,
      inventoryUnits: p.Quantity || 1, unitsInstalled: digital && p.ITI === 'PUS' ? 1 : 0, state, awardedTo: state === 'awarded' ? (digital ? 'Cluster digital platform vendor (synthetic)' : 'L1 bidder via GeM (synthetic)') : null,
      tenderedAt: state !== 'planned' ? addDays(SCENARIO_START, rand(35, 60)) : null, awardedAt: state === 'awarded' ? daysAgo(rand(3, 20)) : null, forItiCodes: J([p.ITI]) } })
  }
  // Year-1 budget lines by category (aggregated from the 5-year budget)
  const catY1 = {}
  for (const r of plan['Five year budget']) { const k = CAT_KEY[r.Category]; if (!k) continue; catY1[k] ||= { label: r.Category, budget: 0 }; catY1[k].budget += r.Y1 || 0 }
  const UTIL = { civil: [0.22, 30], equipment: [0.08, 12], digital: [0.35, 45], staff: [0.25, 28], faculty: [0.2, 24], operations: [0.24, 26], student_industry: [0.15, 20], governance: [0.3, 34] }
  const totalY1 = Object.values(catY1).reduce((s, c) => s + c.budget, 0)
  for (const [k, c] of Object.entries(catY1)) {
    const [u, prog] = UTIL[k]
    await prisma.budgetLine.create({ data: { clusterId: C, year: 1, component: k, label: c.label === 'Student industry' ? 'Student & industry services' : c.label, capex: ['civil', 'equipment', 'digital'].includes(k), budgetCr: +c.budget.toFixed(3), committedCr: +(c.budget * (u + 0.15)).toFixed(3), utilisedCr: +(c.budget * u).toFixed(3), progressPct: prog, kpiWeight: +(0.9 * c.budget / totalY1).toFixed(4) } })
  }
  const adv = ov['Y1 initial envelope'], y2 = ov['Y2 spending'] / 2
  for (const [year, tranche, source, amount, due, dep, state] of [
    [1, 'advance', 'centre', +(adv * 0.5).toFixed(2), d('2026-07-31'), d('2026-08-04'), 'deposited'], [1, 'advance', 'state', +(adv * 0.33).toFixed(2), d('2026-07-31'), d('2026-08-12'), 'deposited'], [1, 'advance', 'industry', +(adv * 0.17).toFixed(2), d('2026-07-31'), d('2026-07-28'), 'deposited'],
    [2, 'first', 'centre', +(y2 * 0.5).toFixed(2), d('2027-07-15'), null, 'pending'], [2, 'first', 'state', +(y2 * 0.33).toFixed(2), d('2027-07-15'), null, 'pending'], [2, 'first', 'industry', +(y2 * 0.17).toFixed(2), d('2027-07-15'), null, 'pending'],
  ]) await prisma.escrowDeposit.create({ data: { clusterId: C, year, tranche, source, amountCr: amount, dueAt: due, depositedAt: dep, state } })
  await prisma.utilisationCertificate.create({ data: { clusterId: C, period: 'FY26-27 Q2 (Aug–Sep)', amountCr: 2.1, caCertified: true, submittedAt: d('2026-10-05'), acceptedAt: d('2026-10-10'), pfmsMatched: true, state: 'accepted' } })
  await prisma.utilisationCertificate.create({ data: { clusterId: C, period: 'FY26-27 Q3 (Oct–Dec)', amountCr: 4.0, caCertified: false, state: 'draft' } })

  // ══════════════════════════════════════════════════════════════════════
  // MILESTONES (IMA), REPORTS, BOARD, CHANGE REQUESTS
  // ══════════════════════════════════════════════════════════════════════
  console.log('[seed] milestones, reports, board, changes…')
  const taskById = Object.fromEntries(tasks.map(t => [t.id, t]))
  const ms = [
    ['SPV incorporated as Section 8 company', 'governance', null, null, d('2026-08-10'), d('2026-08-06'), d('2026-08-12'), 'verified', 4],
    ['Escrow opened; Year-1 advance ₹21.3 Cr deposited (50/33/17)', 'finance', null, null, d('2026-08-15'), d('2026-08-13'), d('2026-08-18'), 'verified', 4],
    ['Year-1 AOP approved by the State Steering Committee', 'report', null, null, d('2026-08-31'), d('2026-08-22'), d('2026-08-29'), 'verified', 6],
    ['Baseline and profile sign-off — Pusa', 'governance', 'PUS', 'TASK-PUS-01', monthEnd(1), d('2026-08-28'), d('2026-09-04'), 'verified', 4],
    ['Baseline and profile sign-off — Shahdara', 'governance', 'SHA', 'TASK-SHA-01', monthEnd(1), d('2026-09-01'), d('2026-09-06'), 'verified', 4],
    ['Baseline and profile sign-off — Narela, Rohini, Okhla', 'governance', null, null, monthEnd(1), d('2026-09-20'), null, 'submitted', 4],
    ['Room survey and work specifications — Pusa', 'civil', 'PUS', 'TASK-PUS-02', monthEnd(2), d('2026-09-27'), d('2026-10-03'), 'verified', 6],
    ['Digital platform live for attendance + assessment (Pusa, Shahdara)', 'digital', null, null, monthEnd(2), d('2026-09-22'), d('2026-09-30'), 'verified', 8],
    ['Registry connection for Narela, Rohini, Okhla', 'digital', null, null, d('2026-12-31'), null, null, 'pending', 6],
    ['Equipment list frozen and handed to procurement — Pusa', 'equipment', 'PUS', 'TASK-PUS-03', monthEnd(4), null, null, 'pending', 8],
    ['Quarterly report FY26-27 Q2 submitted via IMA', 'report', null, null, d('2026-10-15'), d('2026-10-09'), null, 'submitted', 6],
    ['Faculty immersion batch 1 (24 instructors, 2 days each)', 'faculty', null, null, d('2026-10-31'), d('2026-10-11'), null, 'submitted', 6],
    ['Ten active employer MoUs on the register', 'student_industry', null, null, d('2027-01-31'), null, null, 'pending', 6],
    ['Enabling civil works: 40% of frozen work units accepted cluster-wide', 'civil', null, null, d('2027-07-31'), null, null, 'pending', 12],
    ['Launch gates passed for Advanced Welding at Shahdara (Y2 Q2)', 'course', 'SHA', null, d('2027-10-31'), null, null, 'pending', 8],
    ['Rohini enabling works — recovery plan accepted', 'civil', 'ROH', 'TASK-ROH-02', monthEnd(2), d('2026-10-01'), null, 'rejected', 4],
  ]
  for (const [title, kind, itiCode, taskId, dueAt, submittedAt, verifiedAt, state, weightPct] of ms) {
    await prisma.milestone.create({ data: { clusterId: C, title, kind, itiCode, taskId, dueAt, forecastAt: taskById[taskId]?.forecastAt || null, submittedAt, verifiedAt, state, weightPct,
      evidenceUrl: submittedAt ? `/demo/evidence/${(taskId || title).slice(0, 24).replace(/\W+/g, '_')}.pdf` : null, evidenceNote: submittedAt ? 'Evidence pack per the workstream rule (location, work unit, measured completion, inspection).' : null,
      verifiedByUserId: verifiedAt ? ima.id : null, rejectNote: state === 'rejected' ? 'Revised forecast lacks the list of classes affected; principal to confirm (R02 decision rule).' : null } })
  }
  for (const [kind, period, dueAt, submittedAt, imaReviewedAt, sscApprovedAt, state] of [
    ['aop', 'FY26-27 Annual Operational Plan (Y1)', d('2026-08-31'), d('2026-08-22'), d('2026-08-26'), d('2026-08-29'), 'approved'],
    ['quarterly', 'FY26-27 Q2 (Aug–Sep)', d('2026-10-15'), d('2026-10-09'), null, null, 'submitted'],
    ['quarterly', 'FY26-27 Q3 (Oct–Dec)', d('2027-01-15'), null, null, null, 'draft'],
    ['aop', 'FY27-28 Annual Operational Plan (Y2)', d('2027-01-31'), null, null, null, 'draft'],
    ['annual', 'FY26-27 Annual consolidated report', d('2027-04-30'), null, null, null, 'draft'],
  ]) await prisma.report.create({ data: { clusterId: C, kind, period, dueAt, submittedAt, imaReviewedAt, sscApprovedAt, state } })
  for (const [title, kind, needs, amountCr, meetingDate, state] of [
    ['Appointment of statutory auditor (FY26-27)', 'reserved', 'centre+state', null, d('2026-09-12'), 'approved'],
    ['Award of cluster digital platform contract (WP-PUS-07 + spokes)', 'reserved', 'state', 2.4, d('2026-09-25'), 'approved'],
    ['Bring forward Shahdara welding cell order from Y2 to Y1 Q4 (within package)', 'reserved', 'centre+state', 1.1, d('2026-11-14'), 'pending'],
    ['Hire 6 contractual instructors for AUT/ELX launches', 'delegated', 'ceo', 0.45, null, 'approved'],
    ['MoU template for employer register (apprenticeship + OJT)', 'delegated', 'board', null, d('2026-11-14'), 'pending'],
    ['FY27-28 AOP (Y2 need ₹68.3 Cr) — draft for board review', 'delegated', 'board', 68.33, d('2026-12-12'), 'pending'],
  ]) await prisma.boardItem.create({ data: { clusterId: C, title, kind, needs, amountCr, meetingDate, state } })
  await prisma.changeRequest.create({ data: { clusterId: C, itiCode: 'SHA', targetType: 'task', targetId: 'TASK-SHA-03', title: 'Move equipment list hand-off from month 4 to month 5', currentValue: 'Due month 4 (Nov 2026)', proposedValue: 'Due month 5 (Dec 2026)', reason: 'Room survey returned once; specifications need the revised room list first.', resourceImpact: 'None within package; procurement award slips 3 weeks.', affected: J(['Equipment list frozen — Shahdara', 'WP-SHA-04 Y1 deliverable']), proposerUserId: principals.SHA.id, state: 'proposed', formalApprovalNeeded: false, createdAt: daysAgo(2) } })
  await prisma.changeRequest.create({ data: { clusterId: C, itiCode: 'ROH', targetType: 'task', targetId: 'TASK-ROH-02', title: 'Revised forecast for Rohini room survey', currentValue: 'Due 30 Sep 2026', proposedValue: 'Forecast 15 Nov 2026', reason: 'Contractor awaiting utility shutdown clearance.', resourceImpact: 'No budget change; classes continue in existing rooms.', affected: J(['Rohini enabling works milestone']), proposerUserId: principals.ROH.id, state: 'returned', decisionNote: 'Return: list the classes affected and confirm continuation plan (R02).', decidedAt: daysAgo(1), createdAt: daysAgo(4) } })

  // ══════════════════════════════════════════════════════════════════════
  // MODULE D — EMPLOYERS, OPPORTUNITIES, APPLICATIONS, SPELLS
  // ══════════════════════════════════════════════════════════════════════
  console.log('[seed] employers, opportunities, applications…')
  const EMP = [
    ['EMP-DL-01', 'Electrical contracting firm (Okhla Phase II)', 'Electrical', 'Okhla', 'active', d('2026-09-02'), ['PUS', 'SHA', 'OKH'], 'Arvind Mehra', 20, 30, empUser.id],
    ['EMP-DL-02', 'Fabrication and sheet-metal unit (Shahdara industrial area)', 'Fabrication', 'Shahdara', 'active', d('2026-09-10'), ['SHA', 'PUS'], 'S. Rana', 10, 15, null],
    ['EMP-DL-03', 'Precision machine shop (Narela industrial area)', 'Machine shop', 'Narela', 'active', d('2026-09-18'), ['PUS', 'NAR'], 'K. Bhatia', 8, 12, null],
    ['EMP-DL-04', 'IT-enabled services back office (Pusa Road)', 'IT & office', 'Central Delhi', 'active', d('2026-09-25'), ['PUS', 'SHA'], 'N. Kaur', 20, 10, null],
    ['EMP-DL-05', 'HVAC service partner (South Delhi)', 'HVAC', 'Saket', 'lead', null, ['OKH'], 'R. Thomas', 0, 0, null],
    ['EMP-DL-06', 'Automotive service network (Delhi NCR)', 'Automotive', 'Mayapuri', 'lead', null, ['PUS'], 'D. Malik', 0, 0, null],
    ['EMP-DL-07', 'Facilities management company (Delhi NCR)', 'Building services', 'Gurugram', 'paused', d('2026-08-30'), ['PUS', 'ROH'], 'P. Nair', 0, 25, null],
    ['EMP-DL-08', 'Electronics assembly unit (Rohini)', 'Electronics', 'Rohini', 'lead', null, ['ROH'], 'M. Jain', 0, 0, null],
  ]
  const employers = {}
  for (const [code, name, sector, city, rel, mou, itiCodes, contact, ojt, hires, adminUserId] of EMP) {
    employers[code] = await prisma.employer.create({ data: { clusterId: C, code, name, sector, city, sites: J([city]), relationshipOwnerRole: 'SPV-IEPC', relationshipStatus: rel, participatingItis: J(itiCodes), mouSignedAt: mou, mouRef: mou ? `MOU/${code}/2026` : null, contactName: contact, contactChannel: 'phone', lastInteractionAt: daysAgo(rand(1, 20)), nextEngagementAt: addDays(TODAY, rand(3, 30)), ojtSlots: ojt, hiringCommitment: hires, adminUserId } })
  }
  await prisma.user.update({ where: { id: empUser.id }, data: { profile: J({ clusterId: C, employerId: employers['EMP-DL-01'].id, roleCode: 'EMPLOYER', designation: 'HR & apprenticeship lead, electrical contracting firm (Okhla)' }) } })
  // Employers named in the Student Companion KB (synthetic names as supplied)
  const kbRoles = kb['Role Catalogue']
  const kbEmp = {}
  for (const o of kb.Opportunities) {
    if (kbEmp[o.Employer_Name]) continue
    const code = `EMP-KB-${String(Object.keys(kbEmp).length + 1).padStart(2, '0')}`
    const sector = kbRoles.find(r => r.Program_Code === o.Program_Code)?.Sector || 'Industry'
    kbEmp[o.Employer_Name] = await prisma.employer.create({ data: { clusterId: C, code, name: o.Employer_Name, sector, city: o.Work_Location, sites: J([o.Work_Location]), relationshipOwnerRole: 'SPV-IEPC', relationshipStatus: 'active', participatingItis: J(['PUS', 'SHA']), mouSignedAt: d('2026-09-20'), mouRef: `MOU/${code}/2026`, contactName: 'Placement contact', contactChannel: 'email', lastInteractionAt: d(o.Last_Checked_Date), nextEngagementAt: addDays(TODAY, rand(5, 25)), ojtSlots: 0, hiringCommitment: o.Openings, adminUserId: null } })
  }
  const OPP = [
    ['EMP-DL-01', 'Apprentice electrician (NAPS)', 'apprenticeship', ['ELE'], 'Okhla Phase II', 12, null, null, 9000, 'ELE pass-out or final-year; 10th pass', 'Aadhaar, ITI marksheet, bank passbook', 'Trade test + interview', 'Day shift; site travel paid', d('2026-11-15'), d('2026-12-01'), 'live', ['PUS', 'SHA', 'OKH']],
    ['EMP-DL-01', 'Electrician (wage) — site maintenance', 'wage', ['ELE'], 'Okhla / Noida sites', 6, 13000, 15000, null, 'ELE pass-out; 1 yr experience preferred', 'Aadhaar, marksheet', 'Interview', 'Rotational shifts', d('2026-10-31'), d('2026-11-10'), 'live', ['PUS', 'SHA']],
    ['EMP-DL-02', 'Welder / fabricator (wage)', 'wage', ['LWD', 'WEL', 'LSM'], 'Shahdara industrial area', 8, 12500, 14500, null, 'Welder pass-out; SMAW trade test', 'Aadhaar, marksheet', 'Trade test', 'Day shift', d('2026-10-25'), d('2026-11-01'), 'live', ['SHA', 'PUS']],
    ['EMP-DL-03', 'Machine shop apprentice', 'apprenticeship', ['FIT', 'LMC', 'LTR'], 'Narela', 6, null, null, 8500, 'Fitter/Machinist/Turner pass-out', 'Aadhaar, marksheet', 'Interview + measurement test', 'Day shift; bus from Narela ITI', d('2026-11-20'), d('2026-12-15'), 'live', ['PUS', 'NAR']],
    ['EMP-DL-04', 'OJT — office operations (COPA)', 'ojt', ['COP'], 'Pusa Road', 20, null, null, 3000, 'Current COPA students (12-month)', 'ITI letter', 'Placement cell nomination', 'Half-day, 3 days/week', null, d('2026-09-15'), 'live', ['PUS', 'SHA']],
    ['EMP-DL-04', 'Data entry operator (wage)', 'wage', ['COP', 'LST'], 'Pusa Road', 5, 12000, 13500, null, 'COPA/Steno pass-out; typing 30 wpm', 'Aadhaar, marksheet', 'Typing test', 'Day shift', d('2026-11-05'), d('2026-11-20'), 'checking', ['PUS', 'SHA']],
    ['EMP-DL-05', 'HVAC technician apprentice', 'apprenticeship', ['LRA', 'HVC', 'ELE'], 'South Delhi', 10, null, null, 9000, 'RAC/Electrician pass-out', 'Aadhaar, marksheet', 'Interview', 'Field work; two-wheeler preferred', null, null, 'lead', []],
    ['EMP-DL-06', 'Service technician trainee', 'apprenticeship', ['LMV'], 'Mayapuri', 6, null, null, 8000, 'MMV pass-out', 'Aadhaar, marksheet, licence', 'Interview', 'Day shift', null, null, 'lead', []],
    ['EMP-DL-07', 'Building services technician (wage)', 'wage', ['ELE', 'LRA'], 'Gurugram', 10, 14000, 16000, null, 'ELE/RAC pass-out', 'Aadhaar, marksheet', 'Interview', 'Rotational shifts; transport provided', d('2026-09-30'), d('2026-10-15'), 'paused', ['PUS', 'ROH']],
    ['EMP-DL-02', 'Sheet-metal helper (wage)', 'wage', ['LSM', 'FIT'], 'Shahdara', 4, 11000, 12000, null, 'Sheet Metal / Fitter pass-out', 'Aadhaar', 'Trade test', 'Day shift', d('2026-09-20'), d('2026-10-01'), 'filled', ['SHA']],
    ['EMP-DL-08', 'Electronics assembly operator', 'wage', ['LEM', 'ELX'], 'Rohini', 15, 12000, 13000, null, 'Electronics Mechanic pass-out', 'Aadhaar, marksheet', 'Dexterity test', 'Two shifts', null, null, 'lead', []],
    ['EMP-DL-03', 'CNC operator (wage) — Y2 pipeline', 'wage', ['CNC', 'LMC'], 'Narela', 4, 15000, 17000, null, 'CNC specialist programme graduates (from Y3)', 'Marksheet', 'Trade test', 'Day shift', null, null, 'archived', []],
  ]
  const opps = []
  const KEEP = new Set(['OJT — office operations (COPA)', 'Data entry operator (wage)', 'Building services technician (wage)', 'Sheet-metal helper (wage)', 'CNC operator (wage) — Y2 pipeline'])
  for (const [emp, title, type, tradeCodes, location, openings, wmin, wmax, stipend, eligibility, documents, process, shiftTravel, closingAt, startAt, status, approvedItis] of OPP.filter(o => KEEP.has(o[1]))) {
    opps.push(await prisma.opportunity.create({ data: { clusterId: C, employerId: employers[emp].id, title, type, tradeCodes: J(tradeCodes), location, openings, filled: 0, wageMin: wmin, wageMax: wmax, wagePeriod: wmin ? 'month' : null, stipend, eligibility, documents, process, shiftTravel, closingAt, startAt, source: 'Employer conversation (SPV-IEPC)', lastCheckedAt: daysAgo(rand(0, 12)), status, ownerRole: 'SPV-IEPC', approvedItis: J(approvedItis) } }))
  }
  // The 12 KB opportunities (Student Companion workbook) — the live set students see.
  const money = txt => (String(txt || '').match(/\d[\d,]*/g) || []).map(x => Number(x.replace(/,/g, '')))
  for (const o of kb.Opportunities) {
    const [lo, hi] = money(o.Illustrative_Wage_or_Stipend), wage = /per month/.test(o.Illustrative_Wage_or_Stipend)
    opps.push(await prisma.opportunity.create({ data: { id: o.Opportunity_ID, clusterId: C, employerId: kbEmp[o.Employer_Name].id, title: o.Role_Name, type: o.Outcome_Type === 'Apprenticeship' ? 'apprenticeship' : 'wage', tradeCodes: J([o.Program_Code]), location: o.Work_Location, openings: o.Openings, filled: 0,
      wageMin: wage ? lo : null, wageMax: wage ? hi : null, wagePeriod: wage ? 'month' : null, stipend: wage ? null : lo, eligibility: o.Eligibility, requiredSkills: o.Required_Skills, documents: o.Required_Documents, process: o.Outcome_Type === 'Apprenticeship' ? 'Institute referral → employer interview' : 'Résumé → assessment → interview', shiftTravel: o.Work_Location,
      closingAt: d(o.Expiry_Date), startAt: null, source: `${o.Source_Treatment} · companion KB`, lastCheckedAt: d(o.Last_Checked_Date), status: o.Status === 'Open' ? 'live' : 'expired', ownerRole: 'SPV-IEPC', approvedItis: J(['PUS', 'SHA']) } }))
  }
  const oppByTitle = Object.fromEntries(opps.map(o => [o.title, o]))
  const EV = ['student_reported', 'student_reported', 'document_supported', 'document_supported', 'employer_confirmed', 'employer_confirmed', 'independently_verified', 'student_reported']
  const STAGES = ['interested', 'interested', 'prepared', 'prepared', 'referred', 'referred', 'referred', 'applied', 'applied', 'interviewed', 'interviewed', 'interviewed', 'offered', 'offered', 'joined', 'joined', 'joined', 'joined', 'joined', 'joined', 'follow_up', 'follow_up', 'not_selected', 'declined']
  const wageFor = tr => tr === 'ELE' ? ['Electrical Technician Apprentice', 'Electrical Technician Apprentice', 'Building services technician (wage)'] : tr === 'FIT' ? ['Fitter Trainee', 'Fitter Trainee', 'Sheet-metal helper (wage)'] : ['Welder Apprentice']
  const appRows = [], spellRows = [], followRows = []
  let joinedN = 0
  passouts.forEach((p, i) => {
    const stage = i === 0 ? 'joined' : STAGES[i % STAGES.length], o = i === 0 ? oppByTitle['Building services technician (wage)'] : oppByTitle[pick(wageFor(p.trade))]
    const ev = ['joined', 'follow_up'].includes(stage) ? EV[joinedN % EV.length] : stage === 'offered' ? 'document_supported' : ['interviewed', 'applied', 'referred'].includes(stage) ? 'student_reported' : 'none'
    const t0 = i === 0 ? daysAgo(58) : daysAgo(rand(20, 60))
    const timeline = [{ at: iso(t0), actor: 'student', event: 'Expressed interest via companion', source: 'companion' }]
    if (['prepared', 'referred', 'applied', 'interviewed', 'offered', 'joined', 'follow_up', 'not_selected', 'declined'].includes(stage)) timeline.push({ at: iso(addDays(t0, 3)), actor: 'trainer', event: 'Résumé reviewed; checklist ready', source: 'trainer' })
    if (['referred', 'applied', 'interviewed', 'offered', 'joined', 'follow_up', 'not_selected'].includes(stage)) timeline.push({ at: iso(addDays(t0, 6)), actor: 'coordinator', event: `Referred to ${o.title} with consent`, source: 'SPV-IEPC' })
    if (['interviewed', 'offered', 'joined', 'follow_up', 'not_selected'].includes(stage)) timeline.push({ at: iso(addDays(t0, 12)), actor: 'employer', event: 'Interview held', source: 'employer' })
    if (['offered', 'joined', 'follow_up'].includes(stage)) timeline.push({ at: iso(addDays(t0, 15)), actor: 'student', event: 'Offer reported', source: 'student' })
    if (['joined', 'follow_up'].includes(stage)) timeline.push({ at: iso(addDays(t0, 20)), actor: ev === 'employer_confirmed' || ev === 'independently_verified' ? 'employer' : 'student', event: `Joined (${ev.replace(/_/g, ' ')})`, source: ev })
    const offerWage = o.wageMin ? rand(o.wageMin, o.wageMax) : null
    const disputed = stage === 'follow_up' && i % 5 === 0
    appRows.push({ id: `APP-${String(i + 1).padStart(4, '0')}`, traineeId: p.id, opportunityId: o.id, stage, interest: stage === 'declined' ? 'not_interested' : 'interested', preparation: stage === 'interested' ? null : 'Résumé reviewed · checklist ready',
      consentSharedAt: stage === 'interested' ? null : addDays(t0, 3), referredAt: timeline.length > 2 ? addDays(t0, 6) : null, appliedAt: timeline.length > 2 ? addDays(t0, 7) : null, applicationRef: timeline.length > 2 ? `REF-${o.id.slice(-4).toUpperCase()}-${i + 1}` : null,
      interviewAt: timeline.length > 3 ? addDays(t0, 12) : null, interviewOutcome: timeline.length > 3 ? (stage === 'interviewed' ? 'pending' : 'feedback_received') : null, offerAt: timeline.length > 4 ? addDays(t0, 15) : null, offerWage: timeline.length > 4 ? offerWage : null, offerSource: timeline.length > 4 ? 'student' : null,
      joinedAt: timeline.length > 5 ? addDays(t0, 20) : null, evidenceLevel: disputed ? 'disputed' : ev, evidenceNote: disputed ? 'Student says joining was deferred; employer record shows joined. Coordinator to resolve.' : ev === 'independently_verified' ? 'IMA sampled: employer HR + attendance register seen' : null,
      ownerRole: 'SPV-IEPC', nextAction: stage === 'interested' ? 'Résumé review with trainer' : stage === 'prepared' ? 'Ask consent and refer' : stage === 'referred' ? 'Confirm application lodged' : stage === 'applied' ? 'Chase interview date' : stage === 'interviewed' ? 'Collect employer feedback' : stage === 'offered' ? 'Confirm joining date' : stage === 'joined' ? 'Month-1 follow-up' : stage === 'follow_up' ? 'Month-3 follow-up' : null,
      dueAt: ['not_selected', 'declined'].includes(stage) ? null : addDays(TODAY, rand(-3, 10)), lastEventAt: addDays(t0, Math.min(20, 3 * timeline.length)), timeline: J(timeline) })
    if (['joined', 'follow_up'].includes(stage)) {
      joinedN++
      const spellId = `SP-${String(joinedN).padStart(3, '0')}`
      spellRows.push({ id: spellId, traineeId: p.id, applicationId: `APP-${String(i + 1).padStart(4, '0')}`, employerId: o.employerId, type: o.type, role: o.title.replace(/ \(.*\)/, ''), startAt: addDays(t0, 20), wage: offerWage, wagePeriod: 'month', stipend: o.stipend, evidenceLevel: disputed ? 'disputed' : ev, state: 'active' })
      const answered = i !== 0 && addDays(t0, 50) <= TODAY
      followRows.push({ spellId, dueAt: addDays(t0, 50), respondedAt: answered ? addDays(t0, 51) : null, status: answered ? pick(['working', 'working', 'working', 'changed', 'unknown']) : null, respondent: answered ? 'student' : null, attempts: answered ? 1 : 0 })
      followRows.push({ spellId, dueAt: addDays(t0, 110), attempts: 0 })
    }
  })
  // OJT for current COPA students (12-month batches) at Pusa and Shahdara
  const ojtOpp = oppByTitle['OJT — office operations (COPA)']
  const copStudents = [...traineeRows.filter(t => t.status === 'active' && t.itiId === 'PUS' && t.batchId.includes('-COP-')).slice(0, 12), ...traineeRows.filter(t => t.status === 'active' && t.itiId === 'SHA' && t.batchId.includes('-COP-')).slice(0, 8)]
  copStudents.forEach((t, i) => {
    const started = daysAgo(rand(10, 25))
    appRows.push({ id: `APP-OJT-${String(i + 1).padStart(3, '0')}`, traineeId: t.id, opportunityId: ojtOpp.id, stage: 'joined', interest: 'interested', preparation: 'Placement cell nomination', consentSharedAt: addDays(started, -5), referredAt: addDays(started, -4), joinedAt: started, evidenceLevel: i % 3 === 0 ? 'employer_confirmed' : 'document_supported', ownerRole: 'PR-' + t.itiId, nextAction: 'Mentor sign-off at 75 h', dueAt: addDays(TODAY, 10), lastEventAt: started, timeline: J([{ at: iso(addDays(started, -4)), actor: 'coordinator', event: 'Nominated for OJT', source: 'placement_cell' }, { at: iso(started), actor: 'employer', event: 'Started OJT', source: 'employer' }]) })
    const spellId = `SP-OJT-${String(i + 1).padStart(3, '0')}`
    spellRows.push({ id: spellId, traineeId: t.id, applicationId: `APP-OJT-${String(i + 1).padStart(3, '0')}`, employerId: ojtOpp.employerId, type: 'ojt', role: 'Office operations trainee', startAt: started, stipend: 3000, mentorName: 'N. Kaur (site mentor)', hoursTarget: 150, hoursLogged: rand(24, 96), logbook: J([{ date: iso(addDays(started, 1)), hours: 4, task: 'Data entry and file indexing', traineeNote: 'Learned the ticketing sheet' }, { date: iso(addDays(started, 3)), hours: 4, task: 'Formatted monthly report' }]), evidenceLevel: 'document_supported', state: 'active' })
  })
  // demo trainee: interested → prepared in the apprenticeship
  appRows.push({ id: 'APP-DEMO-001', traineeId: DEMO_STU, opportunityId: oppByTitle['Electrical Technician Apprentice'].id, stage: 'interested', interest: 'interested', preparation: null, ownerRole: 'SPV-IEPC', nextAction: 'Résumé review with trainer', dueAt: addDays(TODAY, 4), lastEventAt: daysAgo(1), timeline: J([{ at: iso(daysAgo(1)), actor: 'student', event: 'Expressed interest via companion', source: 'companion' }]) })
  await createMany('application', appRows)
  await createMany('employmentSpell', spellRows)
  await createMany('followUp', followRows)
  for (const [emp, kind, text, ago, quotable] of [
    ['EMP-DL-01', 'interviewed', 'Candidates read single-line diagrams well; weak on conduit bending and site safety paperwork.', 9, true],
    ['EMP-DL-02', 'demand', 'Need 8 more SMAW welders by January if the Shahdara order book holds; GMAW skills would raise the wage band.', 15, true],
    ['EMP-DL-03', 'joined', 'Apprentices punctual; measurement with micrometer needs practice before they can do first-off inspection.', 6, false],
    ['EMP-DL-04', 'joined', 'OJT trainees handle data entry; want more exposure to spreadsheets and email etiquette.', 4, true],
    ['EMP-DL-07', 'demand', 'Hiring paused till Q4 pending client contract renewal.', 20, false],
  ]) await prisma.employerFeedback.create({ data: { employerId: employers[emp].id, kind, text, date: daysAgo(ago), quotable, roleTag: 'SPV-IEPC' } })

  // ══════════════════════════════════════════════════════════════════════
  // MODULE C — COMPANION EVENTS, REFERRALS, ARTIFACTS
  // ══════════════════════════════════════════════════════════════════════
  console.log('[seed] companion knowledge base…')
  await createMany('kbCourse', kb['Course Catalogue'].map(c => ({ id: c.Course_Record_ID, itiCode: c.Institute_Code, programCode: c.Program_Code, courseName: c.Course_Name, durationMonths: c.Duration_Months, studyYear: c.Study_Year, y1Capacity: c.Y1_Capacity, y1Enrolment: c.Y1_Enrolment, entryQualification: c.Entry_Qualification, practicalFocus: c.Practical_Focus, sampleProject: c.Sample_Project, commonTools: c.Common_Tools, jobFamily: c.Job_Family, fitPrompt: c.Prospective_Fit_Prompt, sourceTreatment: c.Source_Treatment })))
  const mapByRole = Object.fromEntries(kb['Course Role Map'].map(m => [m.Role_ID, m]))
  await createMany('kbRole', kb['Role Catalogue'].map(r => { const m = mapByRole[r.Role_ID] || {}; return { id: r.Role_ID, programCode: r.Program_Code, roleName: r.Role_Name, sector: r.Sector, summary: r.Role_Summary, tasksSkills: r.Typical_Tasks_and_Technical_Skills, workplaceSkills: r.Workplace_Skills, typicalWorkplace: r.Typical_Workplace, entryPathway: r.Entry_Pathway, progression: r.Progression_Example, mapId: m.Map_ID || null, skillsToBuild: m.Skills_to_Build || null, evidenceProject: m.Evidence_Project || null, recommendationNote: m.Recommendation_Note || null } }))
  await createMany('kbInterest', kb['Interest Map'].map(i => ({ id: i.Interest_ID, statement: i.Student_Statement, tag: i.Interest_Tag, suggestedProgram: i.Suggested_Program, whyFit: i.Why_It_May_Fit, clarifyingQuestion: i.Clarifying_Question, alternativeProgram: i.Alternative_Program || null })))
  await createMany('kbTopic', kb['Learning Topics'].map(t => ({ id: t.Topic_ID, programCode: t.Program_Code, subjectArea: t.Subject_Area, topic: t.Topic, conceptSummary: t.Concept_Summary, commonDoubt: t.Common_Student_Doubt, practicePrompt: t.Practice_Prompt, safetyLevel: t.Safety_Level, escalationRule: t.Escalation_Rule })))
  await createMany('supportContact', kb['Support Directory'].map(x => ({ id: x.Support_ID, itiCode: x.Institute_Code, supportType: x.Support_Type, responsibleRole: x.Responsible_Role, contactChannel: x.Contact_Channel, issuesHandled: x.Issues_Handled, consentAction: x.Student_Consent_Action, responseTime: x.Expected_Response_Time, status: x.Status })))
  await createMany('signalType', kb['Signal Taxonomy'].map(x => ({ code: x.Signal_Code, eventGroup: x.Event_Group, trigger: x.Trigger, sourceMethod: x.Source_Method, dashboardLabel: x.Dashboard_Label, verificationState: x.Verification_State, sensitive: String(x.Sensitive), aggregationRule: x.Aggregation_Rule })))
  await createMany('responseRule', kb['Response Rules'].map(x => ({ id: x.Rule_ID, appliesTo: x.Applies_To, instruction: x.Instruction, requiredContext: x.Required_Context, answerStructure: x.Answer_Structure, fallback: x.Fallback, eventToWrite: x.Event_to_Write || null })))
  const SIG = { travel_cost: 'SIG-BARRIER-TRAVEL', timetable: 'SIG-BARRIER-TIME', devices: 'SIG-BARRIER-DEVICE', family: 'SIG-BARRIER-FAMILY', cost: 'SIG-BARRIER-COST', course_interest: 'SIG-COURSE-VIEW', learning_need: 'SIG-DOUBT-TOPIC', support_request: 'SIG-SUPPORT-REQ' }
  const sigFor = (theme, source) => theme === 'aspiration' ? (source === 'direct' ? 'SIG-ROLE-STATED' : 'SIG-ROLE-INFERRED') : (SIG[theme] || null)
  console.log('[seed] companion…')
  const THEMES = [
    ['barrier', 'travel_cost', 'Bus fare to the ITI is ₹60 a day — can I get a pass?', 'bus_fare', 0.18, 'Check DTC student pass; ITI can issue bonafide letter'],
    ['barrier', 'timetable', 'Practical class clashes with my part-time shift', 'shift_clash', 0.12, 'Raise with batch lead; afternoon practical slot possible'],
    ['barrier', 'devices', 'No data pack to watch lesson videos at home', 'data_pack', 0.1, 'Download lessons on ITI Wi-Fi; offline mode'],
    ['barrier', 'facilities', 'Washroom near workshop is locked most days', 'washroom', 0.1, 'Logged for principal (accessibility & sanitation package)'],
    ['barrier', 'family', 'Family wants me to start earning now', 'earn_now', 0.05, 'Share stipend-bearing apprenticeship options'],
    ['barrier', 'cost', 'Tool kit cost is hard this month', 'tool_kit', 0.05, 'Institute tool-kit loan scheme'],
    ['explore', 'course_interest', 'Can I move to the automation programme when it starts?', 'switch_course', 0.12, 'AUT launches Y2 Q3 at Pusa; bridge assessment'],
    ['career', 'aspiration', 'I want an apprenticeship at a metro depot', 'apprenticeship', 0.1, 'Match to NAPS openings; prepare résumé'],
    ['career', 'aspiration', 'I want to open my own electrical shop later', 'self_employment', 0.05, 'Note for counsellor; licence pathway'],
    ['doubt', 'learning_need', 'Did not understand three-phase circuits', 'theory_gap', 0.08, 'Refer to trainer with lesson reference'],
    ['practice', 'learning_need', 'Need more practice time on the welding booth', 'practice_time', 0.05, 'Trainer to allot supervised slot'],
  ]
  const weighted = []
  for (const t of THEMES) for (let i = 0; i < Math.round(t[4] * 100); i++) weighted.push(t)
  const evRows = []
  const connectedStudents = traineeRows.filter(t => t.status === 'active' && (t.itiId === 'PUS' || t.itiId === 'SHA'))
  for (let i = 0; i < 170; i++) {
    const t = pick(connectedStudents), th = pick(weighted), inferred = chance(0.3)
    evRows.push({ traineeId: t.id, itiId: t.itiId, stage: th[0], topic: th[2], theme: th[1], subtheme: th[3], source: inferred ? 'inferred' : 'direct', confidence: inferred ? +(0.55 + rnd() * 0.35).toFixed(2) : 1, language: chance(0.8) ? 'hi' : 'en', recommendation: th[5], createdAt: daysAgo(rand(0, 30)) })
  }
  for (let i = 0; i < 8; i++) { const th = pick(THEMES.filter(x => x[0] === 'explore' || x[0] === 'career')); evRows.push({ guestKey: `guest-${i + 1}`, itiId: pick(['PUS', 'SHA']), stage: th[0], topic: th[2], theme: th[1], subtheme: th[3], source: 'direct', confidence: 1, language: 'hi', recommendation: th[5], createdAt: daysAgo(rand(0, 20)) }) }
  evRows.push({ traineeId: DEMO_STU, itiId: 'PUS', stage: 'doubt', topic: 'Did not understand three-phase circuits', theme: 'learning_need', subtheme: 'theory_gap', source: 'direct', confidence: 1, language: 'hi', recommendation: 'Refer to trainer with lesson reference', createdAt: daysAgo(2) })
  evRows.push({ traineeId: DEMO_STU, itiId: 'PUS', stage: 'career', topic: 'I want an apprenticeship at a metro depot', theme: 'aspiration', subtheme: 'apprenticeship', source: 'direct', confidence: 1, language: 'hi', recommendation: 'Match to NAPS openings; prepare résumé', createdAt: daysAgo(5) })
  evRows.push({ traineeId: DEMO_STU, itiId: 'PUS', stage: 'barrier', topic: 'Bus fare to the ITI is ₹60 a day — can I get a pass?', theme: 'travel_cost', subtheme: 'bus_fare', source: 'inferred', confidence: 0.72, language: 'hi', recommendation: 'Check DTC student pass', createdAt: daysAgo(9) })
  await createMany('companionEvent', evRows.map(e => ({ ...e, signalCode: sigFor(e.theme, e.source) })))
  const REF = [
    [DEMO_STU, 'doubt', 'Three-phase circuits: star vs delta connection not clear after lesson 2', 'trainer', demoTrainerId, 'accepted', 'Will cover again in Thursday theory slot with the demo board.', 2],
    [pick(connectedStudents).id, 'support', 'Travel cost making it hard to attend practical days', 'principal', principals.PUS.id, 'contacted', null, 4],
    [pick(connectedStudents).id, 'counselling', 'Family pressure to leave course and earn', 'counsellor', null, 'sent', null, 1],
    [pick(connectedStudents.filter(t => t.itiId === 'SHA')).id, 'doubt', 'Gas regulator setting sequence', 'trainer', facUserId('SYN-FAC-0090'), 'resolved', 'Demonstrated at the booth; student practised twice.', 7],
    [passouts[1].id, 'mock_interview', 'Wants a mock interview before the Okhla electrician interview', 'trainer', demoTrainerId, 'action_agreed', 'Mock interview Friday 3 pm.', 3],
    [pick(connectedStudents).id, 'registry_correction', 'Name spelt wrong in registry (Kashyap, not Kasyap)', 'principal', principals.PUS.id, 'sent', null, 1],
  ]
  for (const [traineeId, kind, summary, toRole, toUserId, state, response, ago] of REF) await prisma.referral.create({ data: { traineeId, kind, summary, shared: J({ attendance: 'last 15 days', lastAssessment: 'Unit test 1', note: summary }), toRole, toUserId, state, response, createdAt: daysAgo(ago) } })
  for (const [kind, title, content] of [
    ['profile', 'What I know about myself', { education: '10th', interests: ['Electrical work', 'Metro / rail'], constraints: ['Travel cost', 'Shares phone with sibling'], strengths: ['Attendance 95%', 'Unit test 41/50'] }],
    ['career_plan', 'My plan', { goal: 'Apprentice electrician (metro or contractor)', steps: [{ step: 'Finish module 1 and pass unit test 2', due: '2026-10-24', done: false }, { step: 'Résumé review with trainer', due: '2026-10-17', done: false }, { step: 'Apply to NAPS apprenticeship (Okhla)', due: '2026-11-10', done: false }] }],
    ['resume', 'Résumé (draft)', { name: 'Anushka Rani Kapoor', course: 'Electrician (CTS), Govt ITI Pusa, Y1', skills: ['Single-phase wiring', 'Multimeter use', 'Safety and PPE'], languages: ['Hindi', 'English (basic)'] }],
    ['application_checklist', 'Apprentice electrician — checklist', { items: [{ item: 'Aadhaar', done: true }, { item: 'ITI bonafide letter', done: false }, { item: 'Bank passbook', done: true }, { item: 'Résumé', done: false }] }],
  ]) await prisma.companionArtifact.create({ data: { traineeId: DEMO_STU, kind, title, content: J(content) } })

  // ══════════════════════════════════════════════════════════════════════
  // GRIEVANCES + NOTIFICATIONS
  // ══════════════════════════════════════════════════════════════════════
  console.log('[seed] grievances + notifications…')
  for (const [uid, iti, category, note, status, ago] of [
    [`U-STU-${DEMO_STU}`, 'PUS', 'equipment', 'Only six wiring boards work; we practise in groups of three.', 'investigating', 5],
    [`U-STU-${connectedStudents[40].id}`, 'PUS', 'facilities', 'Washroom near the electrician workshop stays locked.', 'open', 3],
    [`U-STU-${connectedStudents.find(t => t.itiId === 'SHA').id}`, 'SHA', 'trainer_absent', 'Welding theory cancelled three times this fortnight.', 'open', 2],
    [`U-STU-${passouts[3].id}`, 'PUS', 'placement', 'Was told I joined the Okhla site but joining was deferred; please correct the record.', 'open', 6],
  ]) await prisma.grievance.create({ data: { raisedByUserId: uid, itiId: iti, category, note, status, createdAt: daysAgo(ago) } })

  const note = data => prisma.notification.create({ data })
  await note({ type: 'reminder', title: 'Year-2 first tranche: 3 conditions tracked', category: 'tranche', priority: 'high', targetUserId: ceo.id, message: 'Utilisation 20% of the ₹21.3 Cr advance (needs 75%), cost-weighted KPI score below the 80% gate, FY27-28 AOP not yet drafted. 9 months to go.', action: J({ label: 'Open tranche readiness', type: 'OPEN_TRANCHE_READINESS' }) })
  await note({ type: 'system', title: 'Rohini room-survey milestone returned by IMA', category: 'milestone', priority: 'high', targetUserId: ceo.id, message: 'Revised forecast lacks the list of classes affected (R02 decision rule). Principal Rohini to resubmit.', action: J({ label: 'Open milestone board', type: 'OPEN_MILESTONE_BOARD' }) })
  await note({ type: 'system', title: '3 ITIs not yet registry-connected', category: 'coverage', priority: 'normal', targetUserId: ceo.id, message: 'Narela, Rohini and Okhla operations dashboards show "no feed". Registry connection milestone due 31 Dec.', action: J({ label: 'Cluster operations', type: 'OPEN_CLUSTER_OPERATIONS' }) })
  await note({ type: 'system', title: 'Change request from Shahdara', category: 'plan', priority: 'normal', targetUserId: ceo.id, message: 'Priya Rani Pawar proposes moving the equipment-list hand-off from month 4 to month 5.', action: J({ label: 'Review', type: 'OPEN_MILESTONE_BOARD' }) })
  await note({ type: 'system', title: '3 classes without attendance since 8 Oct', category: 'attendance', priority: 'high', targetUserId: principals.SHA.id, message: 'Three batches at Shahdara have no attendance reports for four working days. Check trainer availability and device sync.', action: J({ label: 'Institute today', type: 'OPEN_INSTITUTE_TODAY' }) })
  await note({ type: 'system', title: 'Practical check 1: OCR marks need review', category: 'assessment', priority: 'normal', targetUserId: principals.SHA.id, message: 'Low-confidence OCR entries across COPA and Welder batches await confirmation.', action: J({ label: 'Review marks', type: 'OPEN_ASSESSMENTS' }) })
  await note({ type: 'system', title: 'Fume extraction fan 2 not running', category: 'safety', priority: 'high', targetUserId: principals.PUS.id, message: 'Raised by Rajesh Prakash Joshi after the welding-shop visit. Welding practicals limited to 2 booths.', action: J({ label: 'Daily ops', type: 'OPEN_DAILY_OPS' }) })
  await note({ type: 'reminder', title: "Today's attendance: ELE Year 1 Batch 01 at 09:30", category: 'attendance', priority: 'normal', targetUserId: demoTrainerId, message: 'Theory session in PUS-R1. Submit attendance from your phone; it syncs when online.', action: J({ label: 'Mark attendance', type: 'OPEN_ATTENDANCE_MARK' }) })
  await note({ type: 'reminder', title: 'Practical check 1 marks pending', category: 'assessment', priority: 'normal', targetUserId: demoTrainerId, message: 'Scan the paper sheet or enter marks for 15 students.', action: J({ label: 'Enter marks', type: 'OPEN_ASSESSMENTS' }) })
  await note({ type: 'system', title: 'New referral: three-phase circuits doubt', category: 'companion', priority: 'normal', targetUserId: demoTrainerId, message: 'Anushka Rani Kapoor asked for help via the companion. Accept to see what she shared.', action: J({ label: 'Open', type: 'OPEN_SUPPORT_QUEUE' }) })
  await note({ type: 'reminder', title: 'Unit test 2 on 24 Oct', category: 'learning', priority: 'normal', targetUserId: `U-STU-${DEMO_STU}`, message: 'Measurement and drawing. Finish module 1 lessons 4–5 and the quick check first.', action: J({ label: 'My plan', type: 'OPEN_MY_PLAN' }) })
  await note({ type: 'reminder', title: 'Résumé review with your trainer', category: 'placement', priority: 'normal', targetUserId: `U-STU-${DEMO_STU}`, message: 'For the apprentice electrician opening at Okhla. Your checklist still needs the bonafide letter and résumé.', action: J({ label: 'Applications', type: 'OPEN_APPLICATIONS' }) })
  await note({ type: 'reminder', title: 'Month-1 check-in: still at the Okhla site?', category: 'follow_up', priority: 'normal', targetUserId: `U-STU-${passouts[0].id}`, message: 'One tap tells your ITI how the job is going. It counts for the cluster placement figure.', action: J({ label: 'Check in', type: 'OPEN_ON_JOB_BUDDY' }) })
  await note({ type: 'system', title: '4 milestones awaiting your verification', category: 'milestone', priority: 'high', targetUserId: ima.id, message: 'Baseline sign-off (NAR/ROH/OKH), Q2 quarterly report, faculty immersion batch 1. Pusa civil inspection done 8 Oct.', action: J({ label: 'Verification queue', type: 'OPEN_VERIFICATION_QUEUE' }) })
  await note({ type: 'reminder', title: '2 joiners to confirm', category: 'placement', priority: 'high', targetUserId: empUser.id, message: 'Students report joining your Okhla site. Confirm so the record moves to employer-confirmed.', action: J({ label: 'Confirm hires', type: 'OPEN_CONFIRM_HIRE' }) })
  await note({ type: 'system', title: 'Advanced Welding — NCVET query received', category: 'curriculum', priority: 'normal', targetUserId: cms.id, message: 'Three observations on module 3 learning outcomes. Response due in 10 days; Shahdara launch gate COURSE depends on it.', action: J({ label: 'NCVET pipeline', type: 'OPEN_NCVET_PIPELINE' }) })
  await note({ type: 'broadcast', title: 'MSDE scorecard: Delhi cluster', category: 'scheme_announcement', priority: 'normal', targetRoles: J(['state_pmu', 'spv_ceo']), message: 'State-wise utilisation scorecards publish from Q3. Delhi cluster: Year-1 advance received, 2 of 5 ITIs reporting operations data.' })

  console.log('\n[seed] done.')
  const counts = {}
  for (const m of ['user', 'iti', 'trade', 'offering', 'package', 'aopRecord', 'planTask', 'launchGate', 'kpi', 'batch', 'trainee', 'subject', 'trainerAssignment', 'session', 'attendanceMark', 'assessmentPlan', 'markEntry', 'practicalObservation', 'supportAction', 'companionEvent', 'kbCourse', 'kbRole', 'kbTopic', 'supportContact', 'signalType', 'responseRule', 'employer', 'opportunity', 'application', 'employmentSpell', 'milestone', 'civilWork', 'procurementPackage']) counts[m] = await prisma[m].count()
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(20)} ${v}`)
}

main()
  .catch(e => { console.error('[seed] failed:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
