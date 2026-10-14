// /api/headline — the five numbers each role should see before opening any
// module. One fold on the home page. Every item: { key, label, value, unit,
// pct (0–100 for the ring, null when no source), target, hint, tone, canvas }.
// Coverage before averages: a figure with no source is "—", never 0.
import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../auth/middleware.js'
import { clusterFor, itiFor, traineeFor, employerFor, trainerBatchIds } from '../lib/scope.js'
import { trancheReadiness } from '../lib/kpiEngine.js'

const r = Router()
r.use(requireAuth)

const todayUTC = () => { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())) }
const daysAgo = n => new Date(todayUTC().getTime() - n * 86400000)
const J = (s, d) => { try { return JSON.parse(s) } catch { return d } }
const pct = (a, b) => (b ? Math.round(100 * a / b) : null)
const num = n => n == null ? '—' : Number(n).toLocaleString('en-IN')
const item = (o) => ({ pct: null, target: null, hint: '', tone: 'indigo', unit: '', ...o })

async function ceo(user) {
  const c = await clusterFor(user)
  const [budgetLines, kpis, reports, deposits, ucs, milestones, itis, overdue, total] = await Promise.all([
    prisma.budgetLine.findMany({ where: { clusterId: c.id } }), prisma.kpi.findMany({ where: { clusterId: c.id } }),
    prisma.report.findMany({ where: { clusterId: c.id } }), prisma.escrowDeposit.findMany({ where: { clusterId: c.id } }),
    prisma.utilisationCertificate.findMany({ where: { clusterId: c.id } }), prisma.milestone.findMany({ where: { clusterId: c.id } }),
    prisma.iti.findMany({ where: { clusterId: c.id }, select: { registryConnected: true } }),
    prisma.planTask.count({ where: { clusterId: c.id, dueAt: { lt: new Date() }, state: { notIn: ['completed', 'reviewed'] } } }),
    prisma.planTask.count({ where: { clusterId: c.id } }),
  ])
  const rd = trancheReadiness({ budgetLines, kpis, reports, deposits, ucs, milestones, year: c.currentYear })
  const k = code => kpis.find(x => x.code === code)
  const cov = `${itis.filter(i => i.registryConnected).length} of ${itis.length} ITIs reporting`
  const kpiItem = (code, label, tone, canvas, unit = '') => {
    const x = k(code); const t = x?.target ?? J(x?.targets, {})[`Y${c.currentYear}`]
    return item({ key: code, label, value: x?.current == null ? '—' : `${num(x.current)}${unit}`, pct: x?.current == null || !t ? null : Math.min(100, Math.round(100 * x.current / t)), target: t != null ? `Y${c.currentYear} target ${num(Math.round(t * 10) / 10)}${unit}` : null, hint: x?.current == null ? 'no source yet' : (x.coverage || cov), tone, canvas })
  }
  return { title: `${c.name} · Year ${c.currentYear}, month ${Math.max(1, Math.min(12, Math.floor((Date.now() - new Date(c.scenarioStart || c.licenseStartAt).getTime()) / (30.4 * 86400000)) + 1))}`, items: [
    kpiItem('K01', 'Annual enrolment', 'indigo', 'five_year_targets'),
    kpiItem('K02', 'Seat utilisation', 'sky', 'iti_dashboard', '%'),
    kpiItem('K11', 'Female enrolment', 'fuchsia', 'five_year_targets', '%'),
    item({ key: 'util', label: 'Funds utilised', value: `${rd.utilisation.utilisedPct}%`, pct: Math.min(100, Math.round(100 * rd.utilisation.utilisedPct / 75)), target: 'tranche gate 75%', hint: `₹${rd.utilisation.utilisedCr} Cr of ₹${rd.utilisation.budgetCr} Cr · ${rd.utilisation.committedPct}% committed`, tone: 'amber', canvas: 'tranche_readiness' }),
    item({ key: 'score', label: 'KPI score', value: `${rd.score.score}%`, pct: Math.min(100, Math.round(100 * rd.score.score / 80)), target: 'tranche gate 80%', hint: `cost-weighted · ${overdue} of ${total} tasks overdue`, tone: rd.score.score >= 80 ? 'emerald' : 'rose', canvas: 'tranche_readiness' }),
  ] }
}

async function principal(user) {
  const iti = await itiFor(user)
  if (!iti) return { title: 'No institute linked', items: [] }
  if (!iti.registryConnected) return { title: `${iti.name} · no registry feed yet`, items: [
    item({ key: 'feed', label: 'Registry feed', value: '—', hint: 'attendance, marks and support appear once connected', tone: 'amber', canvas: 'institute_profile' }),
  ] }
  const today = todayUTC(), since = daysAgo(15)
  const [trainees, women, sched, rep, sessions, needsReview, marksReview, supportOpen, overdue] = await Promise.all([
    prisma.trainee.count({ where: { itiId: iti.id, status: 'active' } }),
    prisma.trainee.count({ where: { itiId: iti.id, status: 'active', gender: 'F' } }),
    prisma.session.count({ where: { batch: { itiId: iti.id }, date: { gte: since, lte: today }, delivery: { notIn: ['cancelled'] } } }),
    prisma.session.count({ where: { batch: { itiId: iti.id }, date: { gte: since, lte: today }, attendanceState: { not: 'not_reported' } } }),
    prisma.session.findMany({ where: { batch: { itiId: iti.id }, date: { gte: since, lte: today }, attendanceState: { not: 'not_reported' } }, select: { presentCount: true, absentCount: true } }),
    prisma.session.count({ where: { batch: { itiId: iti.id }, attendanceState: 'needs_review' } }),
    prisma.assessmentPlan.count({ where: { batch: { itiId: iti.id }, state: { in: ['needs_review', 'submitted'] } } }),
    prisma.supportAction.count({ where: { trainee: { itiId: iti.id }, state: { not: 'closed' } } }),
    prisma.planTask.count({ where: { itiId: iti.id, dueAt: { lt: new Date() }, state: { notIn: ['completed', 'reviewed'] } } }),
  ])
  const present = sessions.reduce((s, x) => s + (x.presentCount || 0), 0), absent = sessions.reduce((s, x) => s + (x.absentCount || 0), 0)
  const att = pct(present, present + absent), cov = pct(rep, sched)
  return { title: `${iti.name} · ${num(trainees)} students`, items: [
    item({ key: 'cov', label: 'Coverage (15 days)', value: cov == null ? '—' : `${cov}%`, pct: cov, target: 'aim 90%+', hint: `${rep} of ${sched} sessions reported`, tone: cov >= 90 ? 'emerald' : 'amber', canvas: 'institute_today' }),
    item({ key: 'att', label: 'Attendance', value: att == null ? '—' : `${att}%`, pct: att, target: 'reported sessions only', hint: `${num(present)} present · ${num(absent)} absent`, tone: att >= 85 ? 'emerald' : 'amber', canvas: 'attendance_bot' }),
    item({ key: 'women', label: 'Women enrolled', value: `${pct(women, trainees) ?? '—'}%`, pct: pct(women, trainees), target: 'cluster target 15%', hint: `${num(women)} of ${num(trainees)} active students`, tone: 'fuchsia', canvas: 'batches' }),
    item({ key: 'review', label: 'Waiting for you', value: num(needsReview + marksReview), hint: `${needsReview} attendance · ${marksReview} mark sheets`, tone: needsReview + marksReview ? 'violet' : 'emerald', canvas: 'assessments' }),
    item({ key: 'support', label: 'Support queue', value: num(supportOpen), hint: `${overdue} Year-1 tasks overdue`, tone: supportOpen ? 'rose' : 'emerald', canvas: 'support_queue' }),
  ] }
}

async function trainer(user) {
  const batchIds = await trainerBatchIds(user)
  const today = todayUTC(), since = daysAgo(15)
  const [sessionsToday, reportedToday, pending, marks, students, sessions, referrals] = await Promise.all([
    prisma.session.count({ where: { date: today, OR: [{ trainerUserId: user.id }, { batchId: { in: batchIds }, trainerUserId: null }] } }),
    prisma.session.count({ where: { date: today, trainerUserId: user.id, attendanceState: { not: 'not_reported' } } }),
    prisma.session.count({ where: { trainerUserId: user.id, date: { lt: today, gte: daysAgo(10) }, attendanceState: 'not_reported', delivery: { in: ['scheduled', 'delivered', 'partial'] } } }),
    prisma.assessmentPlan.count({ where: { batchId: { in: batchIds }, state: { in: ['marks_pending', 'conducted'] } } }),
    prisma.trainee.count({ where: { batchId: { in: batchIds }, status: 'active' } }),
    prisma.session.findMany({ where: { batchId: { in: batchIds }, date: { gte: since, lte: today }, attendanceState: { not: 'not_reported' } }, select: { presentCount: true, absentCount: true } }),
    prisma.referral.count({ where: { toUserId: user.id, state: { in: ['sent', 'accepted', 'contacted'] } } }),
  ])
  const present = sessions.reduce((s, x) => s + (x.presentCount || 0), 0), absent = sessions.reduce((s, x) => s + (x.absentCount || 0), 0)
  const att = pct(present, present + absent)
  return { title: `${batchIds.length} batches · ${num(students)} students`, items: [
    item({ key: 'today', label: 'Sessions today', value: `${reportedToday}/${sessionsToday}`, pct: pct(reportedToday, sessionsToday), target: 'attendance submitted', hint: sessionsToday ? `${sessionsToday - reportedToday} still to report` : 'no sessions today', tone: 'indigo', canvas: 'trainer_my_day' }),
    item({ key: 'pending', label: 'Attendance pending', value: num(pending), hint: 'past sessions without a register', tone: pending ? 'amber' : 'emerald', canvas: 'attendance_bot' }),
    item({ key: 'att', label: 'My batches attendance', value: att == null ? '—' : `${att}%`, pct: att, target: 'last 15 days', hint: `${num(present)} present · ${num(absent)} absent`, tone: att >= 85 ? 'emerald' : 'amber', canvas: 'batches' }),
    item({ key: 'marks', label: 'Marks to enter', value: num(marks), hint: 'assessments conducted, marks pending', tone: marks ? 'violet' : 'emerald', canvas: 'assessments' }),
    item({ key: 'ref', label: 'Referrals to me', value: num(referrals), hint: 'students referred by the companion', tone: referrals ? 'rose' : 'emerald', canvas: 'support_queue' }),
  ] }
}

async function trainee(user) {
  const t = await traineeFor(user)
  if (!t) return { title: 'No student record', items: [] }
  const since = daysAgo(15)
  const [marks, progress, apps, spells, support] = await Promise.all([
    prisma.attendanceMark.findMany({ where: { traineeId: t.id, session: { date: { gte: since } } }, select: { status: true } }),
    prisma.moduleProgress.findMany({ where: { traineeId: t.id }, include: { module: { select: { title: true, hours: true } } } }),
    prisma.application.findMany({ where: { traineeId: t.id }, select: { stage: true } }),
    prisma.employmentSpell.findMany({ where: { traineeId: t.id, state: 'active' }, select: { hoursLogged: true, hoursTarget: true, type: true } }),
    prisma.supportAction.count({ where: { traineeId: t.id, state: { not: 'closed' } } }),
  ])
  const present = marks.filter(m => m.status === 'present' || m.status === 'late').length
  const att = pct(present, marks.length)
  const cur = progress.sort((a, b) => (b.lastActivityAt?.getTime() || 0) - (a.lastActivityAt?.getTime() || 0))[0]
  const active = apps.filter(a => !['declined', 'withdrawn', 'not_selected'].includes(a.stage)).length
  const spell = spells[0]
  return { title: t.name, items: [
    item({ key: 'att', label: 'My attendance', value: att == null ? '—' : `${att}%`, pct: att, target: 'last 15 days', hint: `${present} of ${marks.length} sessions`, tone: att >= 85 ? 'emerald' : 'amber', canvas: 'what_i_know' }),
    item({ key: 'module', label: 'Current module', value: cur ? `${cur.pctComplete}%` : '—', pct: cur?.pctComplete ?? null, target: cur?.module?.title || null, hint: cur ? `${cur.hoursLogged} of ${cur.module.hours} hours` : 'no module started', tone: 'indigo', canvas: 'my_plan' }),
    item({ key: 'apps', label: 'My applications', value: num(active), hint: `${apps.filter(a => ['joined', 'follow_up'].includes(a.stage)).length} joined`, tone: 'violet', canvas: 'applications' }),
    item({ key: 'ojt', label: spell ? (spell.type === 'ojt' ? 'OJT hours' : 'Work hours') : 'OJT', value: spell ? `${spell.hoursLogged}` : '—', pct: spell ? pct(spell.hoursLogged, spell.hoursTarget) : null, target: spell?.hoursTarget ? `of ${spell.hoursTarget} h` : null, hint: spell ? 'logged so far' : 'no placement yet', tone: 'teal', canvas: 'ojt_logbook' }),
    item({ key: 'help', label: 'Help in progress', value: num(support), hint: 'support actions open for you', tone: support ? 'rose' : 'emerald', canvas: 'help_from_institute' }),
  ] }
}

async function ima(user) {
  const c = await clusterFor(user)
  const [budgetLines, kpis, reports, deposits, ucs, milestones] = await Promise.all([
    prisma.budgetLine.findMany({ where: { clusterId: c.id } }), prisma.kpi.findMany({ where: { clusterId: c.id } }),
    prisma.report.findMany({ where: { clusterId: c.id } }), prisma.escrowDeposit.findMany({ where: { clusterId: c.id } }),
    prisma.utilisationCertificate.findMany({ where: { clusterId: c.id } }), prisma.milestone.findMany({ where: { clusterId: c.id } }),
  ])
  const rd = trancheReadiness({ budgetLines, kpis, reports, deposits, ucs, milestones, year: c.currentYear })
  const by = s => milestones.filter(m => m.state === s).length
  const verifiedPlacements = await prisma.application.count({ where: { stage: { in: ['joined', 'follow_up'] }, evidenceLevel: { in: ['employer_confirmed', 'independently_verified'] }, trainee: { iti: { clusterId: c.id } } } })
  return { title: `${c.name} · verification`, items: [
    item({ key: 'await', label: 'Awaiting verification', value: num(by('submitted')), hint: 'evidence packs submitted', tone: by('submitted') ? 'amber' : 'emerald', canvas: 'milestones' }),
    item({ key: 'verified', label: 'Milestones verified', value: `${by('verified')}/${milestones.length}`, pct: pct(by('verified'), milestones.length), target: `${by('rejected')} returned`, hint: 'certified by the IMA', tone: 'emerald', canvas: 'milestones' }),
    item({ key: 'score', label: 'KPI score', value: `${rd.score.score}%`, pct: Math.min(100, Math.round(100 * rd.score.score / 80)), target: 'gate 80%', hint: 'cost-weighted', tone: rd.score.score >= 80 ? 'emerald' : 'rose', canvas: 'tranche_readiness' }),
    item({ key: 'util', label: 'Funds utilised', value: `${rd.utilisation.utilisedPct}%`, pct: Math.min(100, Math.round(100 * rd.utilisation.utilisedPct / 75)), target: 'gate 75%', hint: `${ucs.filter(u => u.state === 'accepted').length} UCs accepted`, tone: 'amber', canvas: 'finance_escrow' }),
    item({ key: 'placed', label: 'Verified placements', value: num(verifiedPlacements), hint: 'employer-confirmed or better', tone: 'violet', canvas: 'placement_pipeline' }),
  ] }
}

async function employer(user) {
  const e = await employerFor(user)
  if (!e) return { title: 'No employer linked', items: [] }
  const [opps, open, apps, toConfirm, spells, hoursDue] = await Promise.all([
    prisma.opportunity.findMany({ where: { employerId: e.id }, select: { openings: true, filled: true, status: true } }),
    prisma.opportunity.count({ where: { employerId: e.id, status: 'live' } }),
    prisma.application.count({ where: { opportunity: { employerId: e.id }, stage: { in: ['referred', 'applied', 'interviewed', 'offered'] } } }),
    prisma.application.count({ where: { opportunity: { employerId: e.id }, stage: { in: ['joined', 'follow_up'] }, evidenceLevel: { in: ['none', 'student_reported', 'document_supported'] } } }),
    prisma.employmentSpell.count({ where: { employerId: e.id, state: 'active' } }),
    prisma.employmentSpell.count({ where: { employerId: e.id, state: 'active', mentorSignedAt: null, hoursLogged: { gt: 0 } } }),
  ])
  const openings = opps.filter(o => o.status === 'live').reduce((s, o) => s + o.openings, 0), filled = opps.filter(o => o.status === 'live').reduce((s, o) => s + o.filled, 0)
  return { title: e.name, items: [
    item({ key: 'open', label: 'Open opportunities', value: num(open), hint: `${filled} of ${openings} openings filled`, pct: pct(filled, openings), target: 'openings filled', tone: 'indigo', canvas: 'post_opening' }),
    item({ key: 'pipeline', label: 'Candidates in process', value: num(apps), hint: 'referred, applied, interviewed or offered', tone: 'sky', canvas: 'placements' }),
    item({ key: 'confirm', label: 'Hires to confirm', value: num(toConfirm), hint: 'joined, not yet employer-confirmed', tone: toConfirm ? 'amber' : 'emerald', canvas: 'confirm_hire' }),
    item({ key: 'ojt', label: 'On OJT with us', value: num(spells), hint: 'active spells', tone: 'teal', canvas: 'ojt_tracker' }),
    item({ key: 'sign', label: 'Logbooks to sign', value: num(hoursDue), hint: 'hours logged, mentor sign-off pending', tone: hoursDue ? 'rose' : 'emerald', canvas: 'ojt_tracker' }),
  ] }
}

async function curriculum(user) {
  const [trades, mods, approved, draft, enrolled] = await Promise.all([
    prisma.trade.count(), prisma.courseModule.count(), prisma.courseModule.count({ where: { status: 'approved' } }), prisma.courseModule.count({ where: { status: 'draft' } }),
    prisma.moduleProgress.count(),
  ])
  const lessons = await prisma.courseModule.findMany({ select: { lessons: true } })
  const withLessons = lessons.filter(m => J(m.lessons, []).length > 0).length
  return { title: `${trades} courses · ${mods} modules`, items: [
    item({ key: 'approved', label: 'Modules approved', value: `${approved}/${mods}`, pct: pct(approved, mods), target: `${draft} in draft`, hint: '240-hour modules', tone: 'emerald', canvas: 'course_builder' }),
    item({ key: 'lessons', label: 'With lesson plans', value: `${withLessons}/${mods}`, pct: pct(withLessons, mods), target: 'modules with lessons', hint: `${mods - withLessons} still empty`, tone: 'indigo', canvas: 'module_plan' }),
    item({ key: 'trades', label: 'Courses', value: num(trades), hint: 'in the cluster catalogue', tone: 'sky', canvas: 'course_builder' }),
    item({ key: 'learners', label: 'Learner-module records', value: num(enrolled), hint: 'students progressing through modules', tone: 'violet', canvas: 'course_builder' }),
  ] }
}

async function statePmu(user) {
  const clusters = await prisma.cluster.findMany()
  let placed = 0, active = 0, overdue = 0, scores = []
  for (const c of clusters) {
    const [budgetLines, kpis, reports, deposits, ucs, milestones, p, a, o] = await Promise.all([
      prisma.budgetLine.findMany({ where: { clusterId: c.id } }), prisma.kpi.findMany({ where: { clusterId: c.id } }),
      prisma.report.findMany({ where: { clusterId: c.id } }), prisma.escrowDeposit.findMany({ where: { clusterId: c.id } }),
      prisma.utilisationCertificate.findMany({ where: { clusterId: c.id } }), prisma.milestone.findMany({ where: { clusterId: c.id } }),
      prisma.application.count({ where: { stage: { in: ['joined', 'follow_up'] }, evidenceLevel: { in: ['employer_confirmed', 'independently_verified'] }, trainee: { iti: { clusterId: c.id } } } }),
      prisma.trainee.count({ where: { iti: { clusterId: c.id }, status: 'active' } }),
      prisma.planTask.count({ where: { clusterId: c.id, dueAt: { lt: new Date() }, state: { notIn: ['completed', 'reviewed'] } } }),
    ])
    const rd = trancheReadiness({ budgetLines, kpis, reports, deposits, ucs, milestones, year: c.currentYear })
    scores.push({ score: rd.score.score, util: rd.utilisation.utilisedPct }); placed += p; active += a; overdue += o
  }
  const avg = k => scores.length ? Math.round(scores.reduce((s, x) => s + x[k], 0) / scores.length) : null
  return { title: `Delhi · ${clusters.length} operational cluster${clusters.length === 1 ? '' : 's'} · 2 in pipeline`, items: [
    item({ key: 'clusters', label: 'Clusters live', value: num(clusters.length), hint: 'AOP running', tone: 'indigo', canvas: 'state_scorecard' }),
    item({ key: 'students', label: 'Active students', value: num(active), hint: 'registry-connected ITIs only', tone: 'sky', canvas: 'state_scorecard' }),
    item({ key: 'score', label: 'KPI score', value: avg('score') == null ? '—' : `${avg('score')}%`, pct: avg('score') == null ? null : Math.min(100, Math.round(100 * avg('score') / 80)), target: 'gate 80%', hint: 'across live clusters', tone: 'rose', canvas: 'state_scorecard' }),
    item({ key: 'util', label: 'Funds utilised', value: avg('util') == null ? '—' : `${avg('util')}%`, pct: avg('util') == null ? null : Math.min(100, Math.round(100 * avg('util') / 75)), target: 'gate 75%', hint: 'certified utilisation', tone: 'amber', canvas: 'state_scorecard' }),
    item({ key: 'placed', label: 'Verified placements', value: num(placed), hint: `${overdue} tasks overdue statewide`, tone: 'violet', canvas: 'state_scorecard' }),
  ] }
}

const BY_ROLE = { spv_ceo: ceo, iti_principal: principal, trainer, trainee, ima_officer: ima, employer, curriculum_dev: curriculum, state_pmu: statePmu }

r.get('/', async (req, res, next) => {
  try {
    const fn = BY_ROLE[req.user.role]
    if (!fn) return res.json({ title: '', items: [] })
    res.json(await fn(req.user))
  } catch (e) { next(e) }
})

export default r
