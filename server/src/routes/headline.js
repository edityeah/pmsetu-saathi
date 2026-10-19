// /api/headline — the five numbers each role should see before opening any
// module. One fold on the home page. Every item: { key, label, value, unit,
// pct (0–100 for the ring, null when no source), target, hint, tone, canvas }.
// Coverage before averages: a figure with no source is "—", never 0.
import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../auth/middleware.js'
import { clusterFor, itiFor, traineeFor, employerFor, trainerBatchIds } from '../lib/scope.js'
import { trancheReadiness, utilisation } from '../lib/kpiEngine.js'
import { readiness as workshopReadiness } from './daily.js'

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
  const today = todayUTC()
  const [budgetLines, itis, womenAll, activeAll] = await Promise.all([
    prisma.budgetLine.findMany({ where: { clusterId: c.id } }),
    prisma.iti.findMany({ where: { clusterId: c.id }, select: { id: true, code: true, registryConnected: true, seatCapacity: true, _count: { select: { trainees: { where: { status: 'active' } } } } } }),
    prisma.trainee.count({ where: { iti: { clusterId: c.id }, status: 'active', gender: 'F' } }),
    prisma.trainee.count({ where: { iti: { clusterId: c.id }, status: 'active' } }),
  ])
  const on = itis.filter(i => i.registryConnected)
  const cov = `${on.length} of ${itis.length} ITIs reporting`
  // Attendance for today, or the latest day with sessions.
  let date = today, fallback = false
  const repToday = await prisma.session.count({ where: { batch: { iti: { clusterId: c.id } }, date, attendanceState: { not: 'not_reported' } } })
  if (!repToday) { const last = await prisma.session.findFirst({ where: { batch: { iti: { clusterId: c.id } }, date: { lt: today }, attendanceState: { not: 'not_reported' } }, orderBy: { date: 'desc' }, select: { date: true } }); if (last) { date = last.date; fallback = true } }
  const sched = await prisma.session.count({ where: { batch: { iti: { clusterId: c.id } }, date, delivery: { not: 'cancelled' } } })
  const rep = await prisma.session.findMany({ where: { batch: { iti: { clusterId: c.id } }, date, delivery: { not: 'cancelled' }, attendanceState: { not: 'not_reported' } }, select: { presentCount: true, absentCount: true, lateCount: true } })
  const present = rep.reduce((s, x) => s + (x.presentCount || 0) + (x.lateCount || 0), 0), absent = rep.reduce((s, x) => s + (x.absentCount || 0), 0)
  const att = pct(present, present + absent), attCov = pct(rep.length, sched)
  const dateLabel = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  // Seats and enrolment (registry-connected ITIs only).
  const seatsOn = on.reduce((s, i) => s + i.seatCapacity, 0), enrolled = on.reduce((s, i) => s + i._count.trainees, 0)
  // Funds utilised against the Year-1 AOP allocation.
  const u = utilisation(budgetLines)
  // Upcoming events in the next 30 days.
  const to = new Date(today.getTime() + 30 * 86400000)
  const [ev1, ev2, ev3, ev4, ev5] = await Promise.all([
    prisma.assessmentPlan.count({ where: { batch: { iti: { clusterId: c.id } }, date: { gte: today, lt: to }, state: 'planned' } }),
    prisma.milestone.count({ where: { clusterId: c.id, dueAt: { gte: today, lt: to }, state: { in: ['pending', 'submitted'] } } }),
    prisma.report.count({ where: { clusterId: c.id, dueAt: { gte: today, lt: to }, submittedAt: null } }),
    prisma.opportunity.count({ where: { clusterId: c.id, closingAt: { gte: today, lt: to }, status: { in: ['live', 'checking'] } } }),
    prisma.employer.count({ where: { clusterId: c.id, nextEngagementAt: { gte: today, lt: to } } }),
  ])
  const events = ev1 + ev2 + ev3 + ev4 + ev5
  const dateIso = date.toISOString().slice(0, 10)
  return { title: `${c.name} · ${c.planYearLabel}`, items: [
    item({ key: 'attendance', label: 'Attendance today', value: att == null ? '—' : `${att}%`, pct: att, target: fallback ? `latest reported day · ${dateLabel}` : `today · ${dateLabel}`, hint: sched ? `${rep.length} of ${sched} sessions reported · ${cov}` : 'no sessions scheduled', tone: att == null ? 'amber' : att >= 85 ? 'emerald' : 'amber', canvas: 'daily_operations', open: { canvas: 'daily_operations', tab: 'attendance', filters: { date: dateIso, scope: 'all' } } }),
    item({ key: 'women', label: 'Female enrolment', value: num(womenAll), pct: pct(womenAll, activeAll), target: `${pct(womenAll, activeAll) ?? '—'}% of ${num(activeAll)} active students`, hint: cov, tone: 'fuchsia', canvas: 'cluster_registry', open: { canvas: 'cluster_registry', tab: 'students', filters: { gender: 'F', status: 'active', year: 'current' } } }),
    item({ key: 'funds', label: 'Funds utilised', value: `₹${u.utilisedCr} Cr`, pct: u.utilisedPct, target: `${u.utilisedPct}% of ₹${u.budgetCr} Cr approved AOP`, hint: `${u.committedPct}% committed · tranche gate 75%`, tone: 'amber', canvas: 'budget_analytics', open: { canvas: 'budget_analytics', tab: 'utilisation', filters: { year: 1, scope: 'cluster' } } }),
    item({ key: 'events', label: 'Upcoming events', value: num(events), target: 'next 30 days', hint: `${ev1} assessments · ${ev2} IMA milestones · ${ev3} reports · ${ev4 + ev5} employer`, tone: 'sky', canvas: 'daily_operations', open: { canvas: 'daily_operations', tab: 'events', filters: { from: today.toISOString().slice(0, 10), days: 30, status: 'scheduled' } } }),
    item({ key: 'seats', label: 'Enrolment / seat utilisation', value: pct(enrolled, seatsOn) == null ? '—' : `${pct(enrolled, seatsOn)}%`, pct: pct(enrolled, seatsOn), target: `${num(enrolled)} enrolled of ${num(seatsOn)} sanctioned seats`, hint: itis.length - on.length ? `${cov} · ${itis.length - on.length} ITIs not yet connected` : cov, tone: 'indigo', canvas: 'cluster_registry', open: { canvas: 'cluster_registry', tab: 'enrolment', filters: { year: 'current', scope: 'all' } } }),
  ] }
}

async function principal(user) {
  const iti = await itiFor(user)
  if (!iti) return { title: 'No institute linked', items: [] }
  if (!iti.registryConnected) return { title: `${iti.name} · no registry feed yet`, items: [
    item({ key: 'feed', label: 'Registry feed', value: '—', hint: 'attendance, marks and support appear once connected', tone: 'amber', canvas: 'institute_profile' }),
  ] }
  const today = todayUTC()
  const [trainees, women] = await Promise.all([
    prisma.trainee.count({ where: { itiId: iti.id, status: 'active' } }),
    prisma.trainee.count({ where: { itiId: iti.id, status: 'active', gender: 'F' } }),
  ])
  // Attendance for today, or the latest reported day.
  let date = today, fallback = false
  const repToday = await prisma.session.count({ where: { batch: { itiId: iti.id }, date, attendanceState: { not: 'not_reported' } } })
  if (!repToday) { const last = await prisma.session.findFirst({ where: { batch: { itiId: iti.id }, date: { lt: today }, attendanceState: { not: 'not_reported' } }, orderBy: { date: 'desc' }, select: { date: true } }); if (last) { date = last.date; fallback = true } }
  const prev = new Date(date.getTime() - 86400000)
  const attOn = async (d) => { const rep = await prisma.session.findMany({ where: { batch: { itiId: iti.id }, date: d, delivery: { not: 'cancelled' }, attendanceState: { not: 'not_reported' } }, select: { presentCount: true, absentCount: true, lateCount: true } }); const p = rep.reduce((s, x) => s + (x.presentCount || 0) + (x.lateCount || 0), 0), a = rep.reduce((s, x) => s + (x.absentCount || 0), 0); return { pct: p + a ? Math.round(1000 * p / (p + a)) / 10 : null, n: rep.length } }
  const [sched, attT, attP] = await Promise.all([
    prisma.session.count({ where: { batch: { itiId: iti.id }, date, delivery: { not: 'cancelled' } } }), attOn(date), attOn(prev),
  ])
  const dateLabel = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  const delta = attT.pct != null && attP.pct != null ? Math.round(10 * (attT.pct - attP.pct)) / 10 : null
  // Assessments today (or the next scheduled day).
  let aDate = today
  let aSched = await prisma.assessmentPlan.count({ where: { batch: { itiId: iti.id }, date: aDate } })
  if (!aSched) { const nx = await prisma.assessmentPlan.findFirst({ where: { batch: { itiId: iti.id }, date: { gt: today } }, orderBy: { date: 'asc' }, select: { date: true } }); if (nx) { aDate = nx.date; aSched = await prisma.assessmentPlan.count({ where: { batch: { itiId: iti.id }, date: aDate } }) } }
  const aDone = await prisma.assessmentPlan.count({ where: { batch: { itiId: iti.id }, date: aDate, state: { in: ['conducted', 'marks_pending', 'submitted', 'needs_review', 'reviewed', 'published'] } } })
  // Workshop readiness: the same rule as Daily operations · Infrastructure readiness, workshops only.
  const rRows = await workshopReadiness({ itis: [iti], itiIds: [iti.id], batchWhere: { itiId: iti.id } }, today).catch(() => [])
  const workshops = rRows.filter(r => r.kind === 'workshop'), ready = workshops.filter(r => r.status === 'ready').length
  const notReady = workshops.filter(r => r.status !== 'ready')
  // Upcoming events in the next 7 days.
  const to = new Date(today.getTime() + 7 * 86400000)
  const [ev1, ev2, ev3] = await Promise.all([
    prisma.assessmentPlan.findMany({ where: { batch: { itiId: iti.id }, date: { gte: today, lt: to }, state: 'planned' }, select: { date: true }, distinct: ['date'] }).then(r => r.length),
    prisma.milestone.count({ where: { clusterId: iti.clusterId, dueAt: { gte: today, lt: to }, state: { in: ['pending', 'submitted'] } } }),
    prisma.employer.count({ where: { clusterId: iti.clusterId, nextEngagementAt: { gte: today, lt: to } } }),
  ])
  const events = ev1 + ev2 + ev3
  // Placed / joined this scheme year: distinct students with an active spell.
  const spells = await prisma.employmentSpell.findMany({ where: { trainee: { itiId: iti.id }, evidenceLevel: { not: 'disputed' } }, select: { traineeId: true } })
  const joined = new Set(spells.map(s => s.traineeId)).size
  const dateIso = date.toISOString().slice(0, 10), aIso = aDate.toISOString().slice(0, 10)
  return { title: `${iti.name} · ${num(trainees)} students`, items: [
    item({ key: 'attendance', label: 'Attendance today', value: attT.pct == null ? '—' : `${attT.pct}%`, pct: attT.pct, target: fallback ? `latest reported day · ${dateLabel}` : `today · ${dateLabel}`, hint: delta == null ? `${attT.n} of ${sched} registers reported` : `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}% vs previous day · ${attT.n} of ${sched} registers`, tone: attT.pct == null ? 'amber' : attT.pct >= 85 ? 'emerald' : 'amber', canvas: 'daily_operations', open: { canvas: 'daily_operations', tab: 'attendance', filters: { date: dateIso } } }),
    item({ key: 'women', label: 'Female enrolment', value: num(women), pct: pct(women, trainees), target: `${pct(women, trainees) ?? '—'}% of ${num(trainees)} active students`, hint: 'academic year 2026–27', tone: 'fuchsia', canvas: 'my_institute', open: { canvas: 'my_institute', tab: 'students', filters: { gender: 'F', status: 'active', year: 'current' } } }),
    item({ key: 'assessments', label: 'Assessments today', value: num(aSched), target: aDate.getTime() === today.getTime() ? 'scheduled today' : `next · ${aDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`, hint: aSched ? `${aDone} conducted · ${aSched - aDone} to run` : 'none scheduled', tone: 'violet', canvas: 'daily_operations', open: { canvas: 'daily_operations', tab: 'assessment', filters: { date: aIso } } }),
    item({ key: 'readiness', label: 'Workshop readiness', value: workshops.length ? `${ready} / ${workshops.length}` : '—', pct: pct(ready, workshops.length), target: 'workshops ready', hint: notReady.length ? notReady.map(r => `${r.name} ${r.status}`).join(' · ') : 'all checks met', tone: ready === workshops.length ? 'emerald' : 'amber', canvas: 'daily_operations', open: { canvas: 'daily_operations', tab: 'infrastructure', filters: { kind: 'workshop' } } }),
    item({ key: 'events', label: 'Upcoming events', value: num(events), target: 'next 7 days', hint: `${ev1} assessment days · ${ev2} IMA milestones · ${ev3} employer`, tone: 'sky', canvas: 'daily_operations', open: { canvas: 'daily_operations', tab: 'events', filters: { from: today.toISOString().slice(0, 10), days: 7 } } }),
    item({ key: 'placed', label: 'Placed / joined', value: num(joined), target: 'this scheme year', hint: 'distinct students with a reported join', tone: 'emerald', canvas: 'placement_pipeline', open: { canvas: 'placement_pipeline', filters: { stage: 'joined' } } }),
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
