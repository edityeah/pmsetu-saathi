// /api/analytics — the views the CEO's headline cards open: attendance for a
// day, upcoming events, student registry analytics, enrolment vs sanctioned
// seats, and AOP utilisation. Every view says what it covers; an ITI without
// a registry feed shows as not reporting, never as zero.
import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../auth/middleware.js'
import { clusterFor, itiFor } from '../lib/scope.js'
import { utilisation as utilOf } from '../lib/kpiEngine.js'

const r = Router()
r.use(requireAuth)

const dayUTC = (s) => { const n = s ? new Date(s) : new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())) }
const addDays = (d, n) => new Date(d.getTime() + n * 86400000)
const pct = (a, b) => (b ? Math.round(100 * a / b) : null)
const J = (s, d) => { try { return JSON.parse(s) } catch { return d } }

async function scopeItiIds(req) {
  const c = await clusterFor(req.user)
  if (req.user.role === 'iti_principal' || req.user.role === 'trainer') { const i = await itiFor(req.user); return { c, itiIds: i ? [i.id] : [] } }
  if (req.query.itiId && req.query.itiId !== 'all') return { c, itiIds: [String(req.query.itiId)] }
  const itis = await prisma.iti.findMany({ where: { clusterId: c.id }, select: { id: true } })
  return { c, itiIds: itis.map(i => i.id) }
}

// Attendance for one day across the scope. If the day has no scheduled
// sessions (holiday, future), fall back to the latest day that had some.
r.get('/attendance', async (req, res, next) => {
  try {
    const { c, itiIds } = await scopeItiIds(req)
    const requested = dayUTC(req.query.date)
    let date = requested
    let reportedN = await prisma.session.count({ where: { batch: { itiId: { in: itiIds } }, date, attendanceState: { not: 'not_reported' } } })
    let fallback = false
    if (!reportedN) {
      const last = await prisma.session.findFirst({ where: { batch: { itiId: { in: itiIds } }, date: { lt: requested }, attendanceState: { not: 'not_reported' } }, orderBy: { date: 'desc' }, select: { date: true } })
      if (last) { date = last.date; fallback = true }
    }
    const sessions = await prisma.session.findMany({ where: { batch: { itiId: { in: itiIds } }, date, delivery: { not: 'cancelled' } }, include: { batch: { select: { id: true, name: true, itiId: true, tradeId: true, _count: { select: { trainees: true } } } }, subject: { select: { name: true } }, trainer: { select: { name: true } } }, orderBy: { startTime: 'asc' } })
    const itis = await prisma.iti.findMany({ where: { clusterId: c.id }, orderBy: [{ kind: 'asc' }, { code: 'asc' }], select: { id: true, code: true, name: true, registryConnected: true } })
    const sum = (rows, k) => rows.reduce((s, x) => s + (x[k] || 0), 0)
    const reported = sessions.filter(s => s.attendanceState !== 'not_reported')
    const totals = { scheduled: sessions.length, reported: reported.length, present: sum(reported, 'presentCount'), absent: sum(reported, 'absentCount'), late: sum(reported, 'lateCount') }
    totals.attendancePct = pct(totals.present + totals.late, totals.present + totals.absent + totals.late)
    totals.coveragePct = pct(totals.reported, totals.scheduled)
    const byIti = itis.filter(i => itiIds.includes(i.id)).map(i => {
      const ss = sessions.filter(s => s.batch.itiId === i.id), rp = ss.filter(s => s.attendanceState !== 'not_reported')
      const present = sum(rp, 'presentCount') + sum(rp, 'lateCount'), absent = sum(rp, 'absentCount')
      return { ...i, scheduled: ss.length, reported: rp.length, present, absent, attendancePct: i.registryConnected ? pct(present, present + absent) : null, coveragePct: i.registryConnected ? pct(rp.length, ss.length) : null }
    })
    const byBatch = Object.values(sessions.reduce((m, s) => { const b = m[s.batch.id] ||= { id: s.batch.id, name: s.batch.name, itiId: s.batch.itiId, students: s.batch._count.trainees, scheduled: 0, reported: 0, present: 0, absent: 0 }; b.scheduled++; if (s.attendanceState !== 'not_reported') { b.reported++; b.present += (s.presentCount || 0) + (s.lateCount || 0); b.absent += s.absentCount || 0 } return m }, {})).map(b => ({ ...b, attendancePct: pct(b.present, b.present + b.absent) }))
    const silent = byBatch.filter(b => b.reported < b.scheduled)
    res.json({ cluster: { code: c.code, name: c.name }, requestedDate: requested, date, fallback, fallbackReason: fallback ? 'no attendance reported for the requested day yet' : null, scope: itiIds.length === itis.length ? 'All ITIs' : itis.filter(i => itiIds.includes(i.id)).map(i => i.name).join(', '), coverage: `${itis.filter(i => i.registryConnected && itiIds.includes(i.id)).length} of ${itiIds.length} ITIs reporting`, totals, byIti, byBatch: byBatch.sort((a, b) => (a.attendancePct ?? 101) - (b.attendancePct ?? 101)), silent, sessions: sessions.slice(0, 200).map(s => ({ id: s.id, startTime: s.startTime, batch: s.batch.name, itiId: s.batch.itiId, subject: s.subject?.name, trainer: s.trainer?.name, delivery: s.delivery, attendanceState: s.attendanceState, present: s.presentCount, absent: s.absentCount })) })
  } catch (e) { next(e) }
})

// Upcoming events: everything with a date in the window — assessments,
// IMA milestones due, reports due, opportunity closing dates, employer
// engagements. Status 'scheduled' = not yet done.
r.get('/events', async (req, res, next) => {
  try {
    const { c, itiIds } = await scopeItiIds(req)
    const from = dayUTC(req.query.from), days = Math.max(1, Math.min(120, Number(req.query.days || 30)))
    const to = addDays(from, days)
    const status = String(req.query.status || 'scheduled')
    const itis = await prisma.iti.findMany({ where: { clusterId: c.id }, select: { id: true, code: true, name: true } })
    const codeOf = id => itis.find(i => i.id === id)?.code || null
    const codes = itis.filter(i => itiIds.includes(i.id)).map(i => i.code)
    const [assess, milestones, reports, opps, employers, visits] = await Promise.all([
      prisma.assessmentPlan.findMany({ where: { batch: { itiId: { in: itiIds } }, date: { gte: from, lt: to }, ...(status === 'scheduled' ? { state: 'planned' } : {}) }, include: { batch: { select: { name: true, itiId: true } } }, orderBy: { date: 'asc' } }),
      prisma.milestone.findMany({ where: { clusterId: c.id, dueAt: { gte: from, lt: to }, OR: [{ itiCode: null }, { itiCode: { in: codes } }], ...(status === 'scheduled' ? { state: { in: ['pending', 'submitted'] } } : {}) }, orderBy: { dueAt: 'asc' } }),
      prisma.report.findMany({ where: { clusterId: c.id, dueAt: { gte: from, lt: to }, ...(status === 'scheduled' ? { submittedAt: null } : {}) }, orderBy: { dueAt: 'asc' } }),
      prisma.opportunity.findMany({ where: { clusterId: c.id, closingAt: { gte: from, lt: to }, ...(status === 'scheduled' ? { status: { in: ['live', 'checking'] } } : {}) }, include: { employer: { select: { name: true } } }, orderBy: { closingAt: 'asc' } }),
      prisma.employer.findMany({ where: { clusterId: c.id, nextEngagementAt: { gte: from, lt: to } }, orderBy: { nextEngagementAt: 'asc' } }),
      prisma.visit.findMany({ where: { itiId: { in: itiIds }, date: { gte: from, lt: to } }, orderBy: { date: 'asc' } }).catch(() => []),
    ])
    const events = [
      ...assess.map(a => ({ id: a.id, date: a.date, kind: 'assessment', title: `${a.title} · ${a.batch.name}`, itiCode: codeOf(a.batch.itiId), status: a.state === 'planned' ? 'scheduled' : a.state, canvas: 'assessments' })),
      ...milestones.map(m => ({ id: m.id, date: m.dueAt, kind: 'milestone', title: `IMA milestone due: ${m.title}`, itiCode: m.itiCode, status: m.state === 'pending' || m.state === 'submitted' ? 'scheduled' : m.state, canvas: 'milestones' })),
      ...reports.map(x => ({ id: x.id, date: x.dueAt, kind: 'report', title: `${x.kind} report due · ${x.period}`, itiCode: null, status: x.submittedAt ? 'submitted' : 'scheduled', canvas: 'reports' })),
      ...opps.map(o => ({ id: o.id, date: o.closingAt, kind: 'opportunity', title: `Applications close: ${o.title} (${o.employer.name})`, itiCode: null, status: 'scheduled', canvas: 'employer_register' })),
      ...employers.map(e => ({ id: e.id, date: e.nextEngagementAt, kind: 'employer', title: `Employer engagement: ${e.name}`, itiCode: null, status: 'scheduled', canvas: 'employer_register' })),
      ...visits.map(v => ({ id: v.id, date: v.date, kind: 'visit', title: `Field visit: ${v.workshop}`, itiCode: codeOf(v.itiId), status: v.state, canvas: 'field_visit' })),
    ].sort((a, b) => new Date(a.date) - new Date(b.date))
    const byKind = events.reduce((m, e) => { m[e.kind] = (m[e.kind] || 0) + 1; return m }, {})
    const byWeek = [0, 1, 2, 3].map(w => ({ label: `Week ${w + 1}`, from: addDays(from, w * 7), count: events.filter(e => { const d = new Date(e.date); return d >= addDays(from, w * 7) && d < addDays(from, (w + 1) * 7) }).length })).filter(w => w.from < to)
    res.json({ from, to, days, status, scope: itiIds.length === itis.length ? 'All ITIs' : codes.join(', '), total: events.length, byKind, byWeek, events })
  } catch (e) { next(e) }
})

// Student registry analytics with the filters the card applies.
r.get('/students', async (req, res, next) => {
  try {
    const { c, itiIds } = await scopeItiIds(req)
    const gender = req.query.gender ? String(req.query.gender) : null  // F | M | all
    const status = String(req.query.status || 'active')
    const itis = await prisma.iti.findMany({ where: { clusterId: c.id }, orderBy: [{ kind: 'asc' }, { code: 'asc' }], select: { id: true, code: true, name: true, registryConnected: true, seatCapacity: true } })
    const where = { itiId: { in: itiIds }, ...(status !== 'all' ? { status } : {}) }
    const [base, matching, byItiAll, byItiMatch, byTradeMatch, byYearMatch, pwd] = await Promise.all([
      prisma.trainee.count({ where }),
      prisma.trainee.count({ where: { ...where, ...(gender && gender !== 'all' ? { gender } : {}) } }),
      prisma.trainee.groupBy({ by: ['itiId'], where, _count: true }),
      prisma.trainee.groupBy({ by: ['itiId'], where: { ...where, ...(gender && gender !== 'all' ? { gender } : {}) }, _count: true }),
      prisma.trainee.findMany({ where: { ...where, ...(gender && gender !== 'all' ? { gender } : {}) }, select: { batch: { select: { tradeId: true, trade: { select: { name: true } } } } } }),
      prisma.trainee.groupBy({ by: ['studyYear'], where: { ...where, ...(gender && gender !== 'all' ? { gender } : {}) }, _count: true }),
      prisma.trainee.count({ where: { ...where, ...(gender && gender !== 'all' ? { gender } : {}), pwd: true } }),
    ])
    const trades = {}
    for (const t of byTradeMatch) { const k = t.batch?.trade?.name || 'Unassigned'; trades[k] = (trades[k] || 0) + 1 }
    const byIti = itis.filter(i => itiIds.includes(i.id)).map(i => { const all = byItiAll.find(x => x.itiId === i.id)?._count || 0, m = byItiMatch.find(x => x.itiId === i.id)?._count || 0; return { ...i, all: i.registryConnected ? all : null, matching: i.registryConnected ? m : null, pct: i.registryConnected ? pct(m, all) : null } })
    res.json({ filters: { gender: gender || 'all', status, academicYear: `${c.planYearLabel}` }, coverage: `${itis.filter(i => i.registryConnected && itiIds.includes(i.id)).length} of ${itiIds.length} ITIs reporting`, base, matching, pct: pct(matching, base), pwd, byIti, byTrade: Object.entries(trades).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n).slice(0, 10), byYear: byYearMatch.map(y => ({ year: y.studyYear, n: y._count })).sort((a, b) => a.year - b.year) })
  } catch (e) { next(e) }
})

// Enrolment vs sanctioned seats, per ITI and for the cluster.
r.get('/enrolment', async (req, res, next) => {
  try {
    const { c, itiIds } = await scopeItiIds(req)
    const itis = await prisma.iti.findMany({ where: { clusterId: c.id, id: { in: itiIds } }, orderBy: [{ kind: 'asc' }, { code: 'asc' }], select: { id: true, code: true, name: true, kind: true, registryConnected: true, seatCapacity: true, baselineSeats: true, _count: { select: { trainees: { where: { status: 'active' } } } } } })
    const offerings = await prisma.offeringPlan.findMany({ where: { period: 'Y1', offering: { itiId: { in: itiIds } } }, select: { places: true, enrolments: true, offering: { select: { itiId: true } } } })
    const byIti = itis.map(i => { const pl = offerings.filter(o => o.offering.itiId === i.id); return { ...i, enrolled: i.registryConnected ? i._count.trainees : null, seats: i.seatCapacity, plannedEnrolments: pl.reduce((s, o) => s + (o.enrolments || 0), 0), pct: i.registryConnected ? pct(i._count.trainees, i.seatCapacity) : null } })
    const on = byIti.filter(i => i.registryConnected)
    const totals = { seats: byIti.reduce((s, i) => s + i.seats, 0), connectedSeats: on.reduce((s, i) => s + i.seats, 0), enrolled: on.reduce((s, i) => s + i.enrolled, 0), connected: on.length, itis: byIti.length }
    totals.pct = pct(totals.enrolled, totals.connectedSeats)
    const women = await prisma.trainee.count({ where: { itiId: { in: on.map(i => i.id) }, status: 'active', gender: 'F' } })
    res.json({ filters: { academicYear: c.planYearLabel, scope: itiIds.length === 5 ? 'All 5 ITIs' : byIti.map(i => i.code).join(', ') }, coverage: `${on.length} of ${byIti.length} ITIs reporting`, totals, womenPct: pct(women, totals.enrolled), byIti })
  } catch (e) { next(e) }
})

// AOP utilisation by budget line for a year.
r.get('/utilisation', async (req, res, next) => {
  try {
    const c = await clusterFor(req.user)
    const year = Number(req.query.year || c.currentYear)
    const [lines, ucs] = await Promise.all([
      prisma.budgetLine.findMany({ where: { clusterId: c.id }, orderBy: { budgetCr: 'desc' } }),
      prisma.utilisationCertificate.findMany({ where: { clusterId: c.id }, orderBy: { period: 'asc' } }),
    ])
    const u = utilOf(lines)
    res.json({ filters: { aopYear: `Year ${year}`, scope: 'Cluster' }, cluster: { code: c.code, name: c.name, envelopeY1Cr: c.envelopeY1Cr }, totals: u, lines: lines.map(l => ({ id: l.id, component: l.component, label: l.label, capex: l.capex, budgetCr: l.budgetCr, committedCr: l.committedCr, utilisedCr: l.utilisedCr, utilisedPct: pct(l.utilisedCr, l.budgetCr), committedPct: pct(l.committedCr, l.budgetCr), progressPct: l.progressPct })), ucs })
  } catch (e) { next(e) }
})

// Trainer registry: faculty records per ITI with their assignments and
// today's availability. Only registry-connected ITIs have records.
r.get('/trainers', async (req, res, next) => {
  try {
    const { c, itiIds } = await scopeItiIds(req)
    const itis = await prisma.iti.findMany({ where: { clusterId: c.id }, orderBy: [{ kind: 'asc' }, { code: 'asc' }], select: { id: true, code: true, name: true, registryConnected: true, trainersBaseline: true, trainerPlan: true } })
    const codes = itis.filter(i => itiIds.includes(i.id)).map(i => i.code)
    const programme = req.query.programme ? String(req.query.programme) : null
    const today = dayUTC()
    const [users, assignments, availability] = await Promise.all([
      prisma.user.findMany({ where: { role: 'trainer' }, select: { id: true, name: true, loginId: true, profile: true } }),
      prisma.trainerAssignment.findMany({ where: { batch: { itiId: { in: itiIds } } }, select: { trainerUserId: true, responsibility: true, batch: { select: { name: true, itiId: true, tradeId: true } }, subject: { select: { name: true } } } }),
      prisma.trainerAvailability.findMany({ where: { date: today }, select: { trainerUserId: true, status: true } }),
    ])
    const rows = users.map(u => { const pr = J(u.profile, {}); return { id: u.id, name: u.name, loginId: u.loginId, itiCode: pr.itiCode, programme: pr.programme, designation: pr.designation, joinedAt: pr.joinedAt, gender: pr.gender, facultyCode: pr.facultyCode } })
      .filter(t => codes.includes(t.itiCode) && (!programme || programme === 'all' || t.programme === programme))
      .map(t => { const as = assignments.filter(a => a.trainerUserId === t.id); const av = availability.find(a => a.trainerUserId === t.id); return { ...t, batches: [...new Set(as.map(a => a.batch.name))], subjects: [...new Set(as.map(a => a.subject.name))], lead: as.some(a => a.responsibility.startsWith('Batch lead')), today: av?.status || 'available' } })
    const byIti = itis.filter(i => itiIds.includes(i.id)).map(i => { const tr = rows.filter(t => t.itiCode === i.code); return { ...i, trainerPlan: J(i.trainerPlan, {}), registry: i.registryConnected ? tr.length : null, assigned: i.registryConnected ? tr.filter(t => t.batches.length).length : null, leads: tr.filter(t => t.lead).length, onLeave: tr.filter(t => t.today !== 'available').length } })
    const byProgramme = Object.entries(rows.reduce((m, t) => { m[t.programme || '—'] = (m[t.programme || '—'] || 0) + 1; return m }, {})).map(([code, n]) => ({ code, n })).sort((a, b) => b.n - a.n)
    res.json({ filters: { programme: programme || 'all', scope: itiIds.length === itis.length ? 'All ITIs' : codes.join(', ') }, coverage: `${itis.filter(i => i.registryConnected && itiIds.includes(i.id)).length} of ${itiIds.length} ITIs reporting`, total: rows.length, assigned: rows.filter(t => t.batches.length).length, leads: rows.filter(t => t.lead).length, onLeave: rows.filter(t => t.today !== 'available').length, women: rows.filter(t => t.gender === 'Female').length, byIti, byProgramme, trainers: rows.sort((a, b) => (a.itiCode || '').localeCompare(b.itiCode || '') || a.name.localeCompare(b.name)) })
  } catch (e) { next(e) }
})

// Assessment analytics: plans by state, marks awaiting review, results
// distribution and what is scheduled next.
r.get('/assessments', async (req, res, next) => {
  try {
    const { c, itiIds } = await scopeItiIds(req)
    const today = dayUTC(), in14 = addDays(today, 14), since = addDays(today, -60)
    const itis = await prisma.iti.findMany({ where: { clusterId: c.id }, orderBy: [{ kind: 'asc' }, { code: 'asc' }], select: { id: true, code: true, name: true, registryConnected: true } })
    const [plans, entries] = await Promise.all([
      prisma.assessmentPlan.findMany({ where: { batch: { itiId: { in: itiIds } } }, include: { batch: { select: { name: true, itiId: true, tradeId: true, trade: { select: { name: true } } } }, _count: { select: { entries: true } } }, orderBy: { date: 'asc' } }),
      prisma.markEntry.findMany({ where: { marks: { not: null }, assessment: { batch: { itiId: { in: itiIds } }, date: { gte: since } } }, select: { marks: true, assessment: { select: { maxMarks: true, batch: { select: { itiId: true, tradeId: true } } } } } }),
    ])
    const byState = plans.reduce((m, p) => { m[p.state] = (m[p.state] || 0) + 1; return m }, {})
    const pctOf = e => Math.round(100 * e.marks / (e.assessment.maxMarks || 100))
    const bands = { '< 40%': 0, '40–60%': 0, '60–80%': 0, '> 80%': 0 }
    for (const e of entries) { const v = pctOf(e); bands[v < 40 ? '< 40%' : v < 60 ? '40–60%' : v < 80 ? '60–80%' : '> 80%']++ }
    const avg = arr => arr.length ? Math.round(arr.reduce((s, e) => s + pctOf(e), 0) / arr.length) : null
    const byIti = itis.filter(i => itiIds.includes(i.id)).map(i => { const pl = plans.filter(p => p.batch.itiId === i.id), en = entries.filter(e => e.assessment.batch.itiId === i.id); return { ...i, planned: pl.filter(p => p.state === 'planned').length, conducted: pl.filter(p => p.state !== 'planned').length, toReview: pl.filter(p => ['needs_review', 'submitted'].includes(p.state)).length, marksPending: pl.filter(p => ['marks_pending', 'conducted'].includes(p.state)).length, avgPct: i.registryConnected ? avg(en) : null, entries: en.length } })
    const byTrade = Object.values(entries.reduce((m, e) => { const k = e.assessment.batch.tradeId; const t = m[k] ||= { trade: k, n: 0, sum: 0 }; t.n++; t.sum += pctOf(e); return m }, {})).map(t => ({ trade: t.trade, n: t.n, avgPct: Math.round(t.sum / t.n) })).sort((a, b) => b.n - a.n).slice(0, 10)
    const upcoming = plans.filter(p => p.state === 'planned' && p.date >= today && p.date < in14).slice(0, 40).map(p => ({ id: p.id, date: p.date, title: p.title, type: p.type, batch: p.batch.name, itiCode: itis.find(i => i.id === p.batch.itiId)?.code, maxMarks: p.maxMarks }))
    const review = plans.filter(p => ['needs_review', 'submitted', 'marks_pending', 'conducted'].includes(p.state)).slice(0, 40).map(p => ({ id: p.id, date: p.date, title: p.title, state: p.state, batch: p.batch.name, itiCode: itis.find(i => i.id === p.batch.itiId)?.code, entries: p._count.entries }))
    res.json({ filters: { period: 'last 60 days + next 14', scope: itiIds.length === itis.length ? 'All ITIs' : byIti.map(i => i.code).join(', ') }, coverage: `${itis.filter(i => i.registryConnected && itiIds.includes(i.id)).length} of ${itiIds.length} ITIs reporting`, totals: { plans: plans.length, byState, entries: entries.length, avgPct: avg(entries), passPct: entries.length ? Math.round(100 * entries.filter(e => pctOf(e) >= 40).length / entries.length) : null }, bands: Object.entries(bands).map(([label, n]) => ({ label, n })), byIti, byTrade, upcoming, review })
  } catch (e) { next(e) }
})

// Infrastructure readiness: rooms, machines, civil works and launch gates
// per ITI — what is usable today against what the plan needs.
r.get('/infrastructure', async (req, res, next) => {
  try {
    const { c, itiIds } = await scopeItiIds(req)
    const itis = await prisma.iti.findMany({ where: { clusterId: c.id, id: { in: itiIds } }, orderBy: [{ kind: 'asc' }, { code: 'asc' }], select: { id: true, code: true, name: true, kind: true, registryConnected: true, roomsBaseline: true, roomsWorking: true, roomsY5: true } })
    const [machines, civil, gates] = await Promise.all([
      prisma.machine.findMany({ where: { itiId: { in: itiIds } }, include: { trade: { select: { code: true } } } }),
      prisma.civilWork.findMany({ where: { itiId: { in: itiIds } }, orderBy: { scheduledCompletion: 'asc' } }),
      prisma.launchGate.findMany({ where: { offering: { itiId: { in: itiIds } } }, include: { offering: { select: { itiId: true, tradeId: true, launch: true } } } }),
    ])
    const st = s => machines.filter(m => m.status === s).length
    const mach = { total: machines.length, functional: st('functional') + st('installed'), awaiting: st('awaiting_commissioning'), nonFunctional: st('non_functional'), ordered: st('ordered') }
    const byIti = itis.map(i => { const ms = machines.filter(m => m.itiId === i.id), cw = civil.filter(w => w.itiId === i.id), gs = gates.filter(g => g.offering.itiId === i.id); const bud = cw.reduce((s, w) => s + w.budgetCr, 0); return { ...i, machines: { total: ms.length, functional: ms.filter(m => ['functional', 'installed'].includes(m.status)).length, nonFunctional: ms.filter(m => m.status === 'non_functional').length, awaiting: ms.filter(m => m.status === 'awaiting_commissioning').length, ordered: ms.filter(m => m.status === 'ordered').length }, civil: { works: cw.length, pct: bud ? Math.round(cw.reduce((s, w) => s + w.pctComplete * w.budgetCr, 0) / bud) : null, delayed: cw.filter(w => w.state === 'delayed').length }, gates: { total: gs.length, passed: gs.filter(g => g.state === 'passed').length, ready: gs.filter(g => g.state === 'ready').length } } })
    const nonFunctional = machines.filter(m => m.status === 'non_functional').map(m => ({ id: m.id, name: m.name, itiCode: itis.find(i => i.id === m.itiId)?.code, trade: m.trade?.code, category: m.category, lastServiceAt: m.lastServiceAt }))
    const works = civil.map(w => ({ id: w.id, title: w.title, itiCode: itis.find(i => i.id === w.itiId)?.code, pctComplete: w.pctComplete, state: w.state, scheduledCompletion: w.scheduledCompletion, budgetCr: w.budgetCr }))
    res.json({ filters: { scope: itiIds.length === 5 ? 'All ITIs' : itis.map(i => i.code).join(', ') }, totals: { rooms: { baseline: itis.reduce((s, i) => s + i.roomsBaseline, 0), working: itis.reduce((s, i) => s + i.roomsWorking, 0), y5: itis.reduce((s, i) => s + i.roomsY5, 0) }, machines: mach, civil: { works: civil.length, delayed: civil.filter(w => w.state === 'delayed').length, pct: civil.length ? Math.round(civil.reduce((s, w) => s + w.pctComplete * w.budgetCr, 0) / Math.max(0.001, civil.reduce((s, w) => s + w.budgetCr, 0))) : null }, gates: { total: gates.length, passed: gates.filter(g => g.state === 'passed').length, ready: gates.filter(g => g.state === 'ready').length } }, byIti, nonFunctional, works })
  } catch (e) { next(e) }
})

// Budget analytics: AOP allocation vs funds released, per ITI and per work
// package (category), a cumulative release timeline and the release history.
// Filters: year, ITI, work package (category), releases as of a date.
r.get('/budget', async (req, res, next) => {
  try {
    const c = await clusterFor(req.user)
    const year = Number(req.query.year || c.currentYear)
    let itiId = req.query.itiId && req.query.itiId !== 'all' ? String(req.query.itiId) : null
    if (req.user.role === 'iti_principal' || req.user.role === 'trainer') { const own = await itiFor(req.user); itiId = own?.id || '__none__' }
    const category = req.query.category && req.query.category !== 'all' ? String(req.query.category) : null
    const asOf = req.query.asOf ? new Date(String(req.query.asOf) + 'T23:59:59Z') : new Date()
    const [itis, aops, releasesAll] = await Promise.all([
      prisma.iti.findMany({ where: { clusterId: c.id }, orderBy: [{ kind: 'asc' }, { code: 'asc' }], select: { id: true, code: true, name: true, kind: true } }),
      prisma.aopRecord.findMany({ where: { year, package: { clusterId: c.id } }, include: { package: { select: { id: true, itiId: true, category: true, title: true } } } }),
      prisma.fundRelease.findMany({ where: { clusterId: c.id, year, releasedAt: { lte: asOf } }, include: { package: { select: { category: true, title: true } }, iti: { select: { code: true, name: true } } }, orderBy: { releasedAt: 'desc' } }),
    ])
    const inScope = (itiIdX, cat) => (!itiId || itiIdX === itiId) && (!category || cat === category)
    const aopsIn = aops.filter(a => inScope(a.package.itiId, a.package.category))
    const relIn = releasesAll.filter(r => inScope(r.itiId, r.package.category))
    const sum = (rows, k) => +rows.reduce((s, x) => s + (x[k] || 0), 0).toFixed(3)
    const allocation = sum(aopsIn, 'budgetCr'), released = sum(relIn, 'amountCr')
    const totals = { allocationCr: allocation, releasedCr: released, balanceCr: +(allocation - released).toFixed(3), releasedPct: pct(released, allocation), spentCr: sum(aopsIn, 'spentCr') }
    // By ITI (always all ITIs, category filter applied) so the bar chart can switch the selection.
    const ownOnly = req.user.role === 'iti_principal' || req.user.role === 'trainer'
    const byIti = itis.filter(i => !ownOnly || i.id === itiId).map(i => { const a = aops.filter(x => x.package.itiId === i.id && (!category || x.package.category === category)), r = releasesAll.filter(x => x.itiId === i.id && (!category || x.package.category === category)); const al = sum(a, 'budgetCr'), re = sum(r, 'amountCr'); return { id: i.id, code: i.code, name: i.name, kind: i.kind, allocationCr: al, releasedCr: re, balanceCr: +(al - re).toFixed(3), releasedPct: pct(re, al), spentCr: sum(a, 'spentCr'), selected: itiId === i.id } })
    // By work package (category) within the ITI scope; the category filter only highlights.
    const cats = {}
    for (const a of aops.filter(x => !itiId || x.package.itiId === itiId)) { const k = cats[a.package.category] ||= { category: a.package.category, allocationCr: 0, releasedCr: 0, spentCr: 0, packages: 0 }; k.allocationCr += a.budgetCr; k.spentCr += a.spentCr; k.packages++ }
    for (const r of releasesAll.filter(x => !itiId || x.itiId === itiId)) { const k = cats[r.package.category] ||= { category: r.package.category, allocationCr: 0, releasedCr: 0, spentCr: 0, packages: 0 }; k.releasedCr += r.amountCr }
    const byPackage = Object.values(cats).map(k => ({ ...k, allocationCr: +k.allocationCr.toFixed(3), releasedCr: +k.releasedCr.toFixed(3), spentCr: +k.spentCr.toFixed(3), balanceCr: +(k.allocationCr - k.releasedCr).toFixed(3), releasedPct: pct(k.releasedCr, k.allocationCr), selected: category === k.category })).sort((a, b) => b.allocationCr - a.allocationCr)
    // Cumulative releases by month for the scope.
    const start = new Date(c.scenarioStart || c.licenseStartAt || '2026-08-01')
    const months = []
    for (let i = 0; i < 12; i++) { const m0 = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1)); if (m0 > asOf) break; months.push(m0) }
    let cum = 0
    const timeline = months.map(m0 => { const m1 = new Date(Date.UTC(m0.getUTCFullYear(), m0.getUTCMonth() + 1, 1)); const inM = relIn.filter(r => r.releasedAt >= m0 && r.releasedAt < m1); cum += inM.reduce((s, r) => s + r.amountCr, 0); return { month: m0.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), releasedCr: +inM.reduce((s, r) => s + r.amountCr, 0).toFixed(3), cumulativeCr: +cum.toFixed(3) } })
    const aopById = Object.fromEntries(aops.map(a => [a.id, a]))
    const releases = relIn.map(r => { const a = r.aopId ? aopById[r.aopId] : null; return { id: r.id, releasedAt: r.releasedAt, itiCode: r.iti.code, itiName: r.iti.name, category: r.package.category, packageId: r.packageId, packageTitle: r.package.title, project: r.project, amountCr: r.amountCr, reference: r.reference, note: r.note, projectState: r.projectState, progressPct: a?.progressPct ?? null, aopState: a?.state ?? null, aopBudgetCr: a?.budgetCr ?? null, aopSpentCr: a?.spentCr ?? null, deliverable: a?.deliverable ?? null } })
    res.json({ filters: { year, itiId: itiId || 'all', category: category || 'all', asOf: asOf.toISOString().slice(0, 10) }, cluster: { code: c.code, name: c.name, envelopeY1Cr: c.envelopeY1Cr }, categories: [...new Set(aops.map(a => a.package.category))].sort(), totals, byIti, byPackage, timeline, releases })
  } catch (e) { next(e) }
})

// ── Registry: students and trainers as records ─────────────────────────────
const PAGE = 25
const traineeView = (t, codeOf) => ({ id: t.id, name: t.name, itiId: t.itiId, itiCode: codeOf(t.itiId), batchId: t.batchId, batch: t.batch?.name || null, tradeId: t.batch?.tradeId || null, trade: t.batch?.trade?.name || null, gender: t.gender, status: t.status, studyYear: t.studyYear, pwd: t.pwd })

r.get('/registry/students', async (req, res, next) => {
  try {
    const { c, itiIds } = await scopeItiIds(req)
    const itis = await prisma.iti.findMany({ where: { clusterId: c.id }, orderBy: [{ kind: 'asc' }, { code: 'asc' }], select: { id: true, code: true, name: true, registryConnected: true } })
    const codeOf = id => itis.find(i => i.id === id)?.code || id
    const trade = req.query.trade && req.query.trade !== 'all' ? String(req.query.trade) : null
    const batchId = req.query.batchId && req.query.batchId !== 'all' ? String(req.query.batchId) : null
    const gender = req.query.gender && req.query.gender !== 'all' ? String(req.query.gender) : null
    const status = String(req.query.status || 'active')
    const q = req.query.q ? String(req.query.q).trim() : ''
    const page = Math.max(1, Number(req.query.page || 1))
    const where = { itiId: { in: itiIds }, registryMatched: true, ...(status !== 'all' ? { status } : {}), ...(gender ? { gender } : {}), ...(batchId ? { batchId } : {}), ...(trade ? { batch: { tradeId: trade } } : {}), ...(q ? { OR: [{ name: { contains: q } }, { id: { contains: q } }] } : {}) }
    const [total, rows, all, batches, trades] = await Promise.all([
      prisma.trainee.count({ where }),
      prisma.trainee.findMany({ where, orderBy: [{ itiId: 'asc' }, { id: 'asc' }], skip: (page - 1) * PAGE, take: PAGE, include: { batch: { select: { name: true, tradeId: true, trade: { select: { name: true } } } } } }),
      prisma.trainee.findMany({ where, select: { gender: true, itiId: true, batch: { select: { tradeId: true, trade: { select: { name: true } } } } } }),
      prisma.batch.findMany({ where: { itiId: { in: itiIds }, state: 'running', ...(trade ? { tradeId: trade } : {}) }, orderBy: { name: 'asc' }, select: { id: true, name: true, tradeId: true, itiId: true } }),
      prisma.trade.findMany({ where: { batches: { some: { itiId: { in: itiIds } } } }, orderBy: { name: 'asc' }, select: { id: true, code: true, name: true } }),
    ])
    const byTrade = Object.values(all.reduce((m, t) => { const k = t.batch?.trade?.name || 'Unassigned'; (m[k] ||= { name: k, n: 0 }).n++; return m }, {})).sort((a, b) => b.n - a.n)
    const byIti = itis.filter(i => itiIds.includes(i.id)).map(i => ({ ...i, n: i.registryConnected ? all.filter(t => t.itiId === i.id).length : null }))
    res.json({ coverage: `${itis.filter(i => i.registryConnected && itiIds.includes(i.id)).length} of ${itiIds.length} ITIs reporting`, options: { trades, batches }, total, page, pageSize: PAGE, pages: Math.max(1, Math.ceil(total / PAGE)), gender: { male: all.filter(t => t.gender === 'M').length, female: all.filter(t => t.gender === 'F').length }, byTrade, byIti, rows: rows.map(t => traineeView(t, codeOf)) })
  } catch (e) { next(e) }
})

r.get('/registry/students/:id', async (req, res, next) => {
  try {
    const t = await prisma.trainee.findUnique({ where: { id: req.params.id }, include: { user: { select: { email: true, profile: true, loginId: true } }, iti: { select: { code: true, name: true, district: true } }, batch: { include: { trade: { select: { code: true, name: true, durationValue: true, durationUnit: true } }, lead: { select: { name: true } } } } } })
    if (!t) return res.status(404).json({ error: 'not_found' })
    if (req.user.role === 'iti_principal' || req.user.role === 'trainer') { const i = await itiFor(req.user); if (i && i.id !== t.itiId) return res.status(403).json({ error: 'forbidden' }) }
    const since = addDays(dayUTC(), -15)
    const [marks, entries, apps, spells, artifacts, support] = await Promise.all([
      prisma.attendanceMark.findMany({ where: { traineeId: t.id, session: { date: { gte: since } } }, select: { status: true } }),
      prisma.markEntry.findMany({ where: { traineeId: t.id, marks: { not: null } }, include: { assessment: { select: { title: true, maxMarks: true, date: true } } }, orderBy: { assessment: { date: 'desc' } }, take: 5 }),
      prisma.application.findMany({ where: { traineeId: t.id }, include: { opportunity: { select: { title: true, employer: { select: { name: true } } } } }, orderBy: { lastEventAt: 'desc' }, take: 5 }),
      prisma.employmentSpell.findMany({ where: { traineeId: t.id }, include: { employer: { select: { name: true } } } }),
      prisma.companionArtifact.findMany({ where: { traineeId: t.id }, select: { kind: true, title: true, updatedAt: true, content: true } }),
      prisma.supportAction.findMany({ where: { traineeId: t.id, state: { not: 'closed' } }, select: { reason: true, state: true, dueAt: true } }),
    ])
    const prof = J(t.user?.profile, {})
    const present = marks.filter(m => m.status === 'present' || m.status === 'late').length
    const resume = artifacts.find(a => a.kind === 'resume')
    res.json({ student: { id: t.id, name: t.name, status: t.status, gender: t.gender, dob: t.dob, education: t.education, category: t.category, pwd: t.pwd, pwdType: t.pwdType, district: t.district, phone: t.phone, email: t.user?.email || null, fatherName: prof.father || null, motherName: prof.mother || null, enrolledAt: t.enrolledAt, studyYear: t.studyYear, languagePref: t.languagePref, registryMatched: t.registryMatched, loginId: t.user?.loginId || null },
      iti: t.iti, batch: t.batch ? { id: t.batch.id, name: t.batch.name, startDate: t.batch.startDate, endDate: t.batch.endDate, tenureMonths: t.batch.tenureMonths, lead: t.batch.lead?.name || null, trade: t.batch.trade } : null,
      attendance: { total: marks.length, present, pct: marks.length ? Math.round(100 * present / marks.length) : null },
      marks: entries.map(e => ({ title: e.assessment.title, date: e.assessment.date, marks: e.marks, maxMarks: e.assessment.maxMarks })),
      applications: apps.map(a => ({ id: a.id, title: a.opportunity.title, employer: a.opportunity.employer.name, stage: a.stage, evidenceLevel: a.evidenceLevel })),
      spells: spells.map(x => ({ employer: x.employer.name, type: x.type, role: x.role, startAt: x.startAt, state: x.state })),
      resume: resume ? { title: resume.title, updatedAt: resume.updatedAt, content: J(resume.content, {}) } : null,
      support: support })
  } catch (e) { next(e) }
})

r.get('/registry/trainers', async (req, res, next) => {
  try {
    const { c, itiIds } = await scopeItiIds(req)
    const itis = await prisma.iti.findMany({ where: { clusterId: c.id }, orderBy: [{ kind: 'asc' }, { code: 'asc' }], select: { id: true, code: true, name: true, registryConnected: true } })
    const codes = itis.filter(i => itiIds.includes(i.id)).map(i => i.code)
    const trade = req.query.trade && req.query.trade !== 'all' ? String(req.query.trade) : null
    const load = req.query.load && req.query.load !== 'all' ? String(req.query.load) : null
    const q = req.query.q ? String(req.query.q).trim().toLowerCase() : ''
    const page = Math.max(1, Number(req.query.page || 1))
    const [users, assignments, availability] = await Promise.all([
      prisma.user.findMany({ where: { role: 'trainer' }, select: { id: true, name: true, loginId: true, profile: true } }),
      prisma.trainerAssignment.findMany({ where: { batch: { itiId: { in: itiIds } } }, select: { trainerUserId: true, responsibility: true, batch: { select: { id: true, name: true, tradeId: true } }, subject: { select: { name: true } } } }),
      prisma.trainerAvailability.findMany({ where: { date: dayUTC() }, select: { trainerUserId: true, status: true } }),
    ])
    let rows = users.map(u => { const pr = J(u.profile, {}); const as = assignments.filter(a => a.trainerUserId === u.id); return { id: u.id, name: u.name, loginId: u.loginId, facultyCode: pr.facultyCode, itiCode: pr.itiCode, programme: pr.programme, designation: pr.designation, gender: pr.gender, batches: [...new Set(as.map(a => a.batch.name))], subjects: [...new Set(as.map(a => a.subject.name))], lead: as.some(a => a.responsibility.startsWith('Batch lead')), today: availability.find(a => a.trainerUserId === u.id)?.status || 'available' } })
      .filter(t => codes.includes(t.itiCode)).filter(t => !trade || t.programme === trade).filter(t => !q || t.name.toLowerCase().includes(q) || (t.facultyCode || '').toLowerCase().includes(q))
    if (load) rows = rows.filter(t => load === '4+' ? t.batches.length >= 4 : load === '0' ? t.batches.length === 0 : t.batches.length === Number(load))
    const byTrade = Object.values(rows.reduce((m, t) => { (m[t.programme] ||= { code: t.programme, n: 0 }).n++; return m }, {})).sort((a, b) => b.n - a.n)
    const byLoad = Object.values(rows.reduce((m, t) => { const k = t.batches.length >= 4 ? '4+ batches' : `${t.batches.length} batch${t.batches.length === 1 ? '' : 'es'}`; (m[k] ||= { label: k, n: 0 }).n++; return m }, {})).sort((a, b) => b.n - a.n)
    const byIti = itis.filter(i => itiIds.includes(i.id)).map(i => ({ ...i, n: i.registryConnected ? rows.filter(t => t.itiCode === i.code).length : null }))
    const trades = [...new Set(users.map(u => J(u.profile, {})).filter(p => codes.includes(p.itiCode)).map(p => p.programme).filter(Boolean))].sort()
    const total = rows.length
    rows.sort((a, b) => (a.itiCode || '').localeCompare(b.itiCode || '') || (a.facultyCode || '').localeCompare(b.facultyCode || ''))
    res.json({ coverage: `${itis.filter(i => i.registryConnected && itiIds.includes(i.id)).length} of ${itiIds.length} ITIs reporting`, options: { trades }, total, page, pageSize: PAGE, pages: Math.max(1, Math.ceil(total / PAGE)), byTrade, byLoad, byIti, assignments: rows.reduce((s, t) => s + t.subjects.length * Math.max(1, t.batches.length), 0), rows: rows.slice((page - 1) * PAGE, page * PAGE) })
  } catch (e) { next(e) }
})

r.get('/registry/trainers/:id', async (req, res, next) => {
  try {
    const u = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, name: true, loginId: true, phone: true, email: true, profile: true, role: true } })
    if (!u || u.role !== 'trainer') return res.status(404).json({ error: 'not_found' })
    const pr = J(u.profile, {})
    if (req.user.role === 'iti_principal' || req.user.role === 'trainer') { const i = await itiFor(req.user); if (i && i.code !== pr.itiCode) return res.status(403).json({ error: 'forbidden' }) }
    const today = dayUTC()
    const [iti, assignments, availability, sessions, marksPending, referrals] = await Promise.all([
      prisma.iti.findUnique({ where: { code: pr.itiCode || '__' }, select: { code: true, name: true, district: true } }),
      prisma.trainerAssignment.findMany({ where: { trainerUserId: u.id }, include: { batch: { select: { id: true, name: true, tradeId: true, studyYear: true, _count: { select: { trainees: true } } } }, subject: { select: { name: true, type: true } } } }),
      prisma.trainerAvailability.findUnique({ where: { trainerUserId_date: { trainerUserId: u.id, date: today } } }),
      prisma.session.findMany({ where: { trainerUserId: u.id, date: { gte: addDays(today, -15), lte: today } }, select: { attendanceState: true, delivery: true } }),
      prisma.assessmentPlan.count({ where: { batch: { assignments: { some: { trainerUserId: u.id } } }, state: { in: ['marks_pending', 'conducted'] } } }),
      prisma.referral.count({ where: { toUserId: u.id, state: { in: ['sent', 'accepted', 'contacted'] } } }),
    ])
    const batches = Object.values(assignments.reduce((m, a) => { const b = m[a.batch.id] ||= { id: a.batch.id, name: a.batch.name, tradeId: a.batch.tradeId, studyYear: a.batch.studyYear, students: a.batch._count.trainees, subjects: [], lead: false }; b.subjects.push(a.subject.name); if (a.responsibility.startsWith('Batch lead')) b.lead = true; return m }, {}))
    res.json({ trainer: { id: u.id, name: u.name, loginId: u.loginId, facultyCode: pr.facultyCode, phone: u.phone, email: u.email, designation: pr.designation, programme: pr.programme, joinedAt: pr.joinedAt, gender: pr.gender, today: availability?.status || 'available', todayNote: availability?.note || null }, iti, batches, subjects: [...new Set(assignments.map(a => a.subject.name))], sessions15: { scheduled: sessions.length, reported: sessions.filter(s => s.attendanceState !== 'not_reported').length }, marksPending, referrals })
  } catch (e) { next(e) }
})

// ── Work packages for one ITI (principal budget analytics) ─────────────────
// Each package carries its Year-N AOP record (allocation, spent, progress,
// state), the releases against it and its Year-1 tasks. Status rule:
// delayed = a task past due with no forecast or the AOP record returned;
// at risk = any overdue or blocked task; otherwise on track.
async function workPackageRows(req) {
  const c = await clusterFor(req.user)
  const year = Number(req.query.year || c.currentYear)
  let itiId = req.query.itiId && req.query.itiId !== 'all' ? String(req.query.itiId) : null
  if (req.user.role === 'iti_principal' || req.user.role === 'trainer') { const own = await itiFor(req.user); itiId = own?.id || '__none__' }
  const category = req.query.category && req.query.category !== 'all' ? String(req.query.category) : null
  const today = new Date()
  const [packages, releases, tasks] = await Promise.all([
    prisma.package.findMany({ where: { clusterId: c.id, ...(itiId ? { itiId } : {}), ...(category ? { category } : {}) }, include: { aops: { where: { year } }, iti: { select: { code: true, name: true } } }, orderBy: [{ category: 'asc' }, { id: 'asc' }] }),
    prisma.fundRelease.findMany({ where: { clusterId: c.id, year, ...(itiId ? { itiId } : {}) }, orderBy: { releasedAt: 'desc' } }),
    prisma.planTask.findMany({ where: { clusterId: c.id, ...(itiId ? { itiId } : {}) }, orderBy: { dueAt: 'asc' } }),
  ])
  const rows = packages.map(p => {
    const aop = p.aops[0] || null
    const rel = releases.filter(r => r.packageId === p.id)
    const ts = tasks.filter(t => aop && t.aopId === aop.id)
    const overdue = ts.filter(t => t.dueAt < today && !['completed', 'reviewed'].includes(t.state))
    const blocked = ts.filter(t => t.state === 'blocked')
    const allocationCr = +(aop?.budgetCr || 0).toFixed(3), releasedCr = +rel.reduce((s, r) => s + r.amountCr, 0).toFixed(3), spentCr = +(aop?.spentCr || 0).toFixed(3)
    const status = (aop?.state === 'returned' || overdue.some(t => !t.forecastAt)) ? 'delayed' : (overdue.length || blocked.length) ? 'at_risk' : 'on_track'
    const nextDue = ts.find(t => !['completed', 'reviewed'].includes(t.state))
    return { id: p.id, title: p.title, category: p.category, itiCode: p.iti.code, expenditureType: p.expenditureType, deliverable: aop?.deliverable || p.deliverable || '', allocationCr, releasedCr, spentCr, unspentReleaseCr: +Math.max(0, releasedCr - spentCr).toFixed(3), awaitingReleaseCr: +Math.max(0, allocationCr - releasedCr).toFixed(3), progressPct: aop?.progressPct ?? 0, aopState: aop?.state || 'planned', status, tasks: { total: ts.length, done: ts.filter(t => ['completed', 'reviewed'].includes(t.state)).length, overdue: overdue.length, blocked: blocked.length }, nextDue: nextDue ? { title: nextDue.title, dueAt: nextDue.dueAt, state: nextDue.state } : null, releases: rel.length, lastUpdateAt: ts.map(t => t.lastUpdateAt).filter(Boolean).sort((a, b) => b - a)[0] || rel[0]?.releasedAt || null }
  })
  return { c, year, itiId, packages, releases, tasks, rows }
}

r.get('/work-packages', async (req, res, next) => {
  try {
    const { c, year, itiId, releases, tasks, rows: all } = await workPackageRows(req)
    const status = req.query.status && req.query.status !== 'all' ? String(req.query.status) : null
    const q = req.query.q ? String(req.query.q).toLowerCase() : null
    const rows = all.filter(r => (!status || r.status === status) && (!q || `${r.id} ${r.title} ${r.category}`.toLowerCase().includes(q)))
    const sum = k => +all.reduce((s, r) => s + (r[k] || 0), 0).toFixed(3)
    const totals = { allocationCr: sum('allocationCr'), releasedCr: sum('releasedCr'), spentCr: sum('spentCr'), unspentReleaseCr: sum('unspentReleaseCr'), awaitingReleaseCr: sum('awaitingReleaseCr'), releasedPct: pct(sum('releasedCr'), sum('allocationCr')), utilisedPct: pct(sum('spentCr'), sum('releasedCr')) }
    const cats = {}
    for (const r of all) { const k = cats[r.category] ||= { category: r.category, allocationCr: 0, releasedCr: 0, spentCr: 0, packages: 0 }; k.allocationCr += r.allocationCr; k.releasedCr += r.releasedCr; k.spentCr += r.spentCr; k.packages++ }
    const byCategory = Object.values(cats).map(k => ({ ...k, allocationCr: +k.allocationCr.toFixed(3), releasedCr: +k.releasedCr.toFixed(3), spentCr: +k.spentCr.toFixed(3) })).sort((a, b) => b.allocationCr - a.allocationCr)
    // Cumulative releases by month; utilisation has no monthly source, so it is reported to date only.
    const start = new Date(c.scenarioStart || c.licenseStartAt || '2026-08-01'), today = new Date()
    const months = []
    for (let i = 0; i < 12; i++) { const m0 = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1)); if (m0 > today) break; months.push(m0) }
    let cum = 0
    const timeline = months.map(m0 => { const m1 = new Date(Date.UTC(m0.getUTCFullYear(), m0.getUTCMonth() + 1, 1)); const inM = releases.filter(r => r.releasedAt >= m0 && r.releasedAt < m1); cum += inM.reduce((s, r) => s + r.amountCr, 0); return { month: m0.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), releasedCr: +inM.reduce((s, r) => s + r.amountCr, 0).toFixed(3), cumulativeCr: +cum.toFixed(3) } })
    const m0 = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)), m1 = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1))
    const dueThisMonth = tasks.filter(t => t.dueAt >= m0 && t.dueAt < m1 && !['completed', 'reviewed'].includes(t.state))
    const upcoming = tasks.filter(t => t.dueAt >= today && !['completed', 'reviewed'].includes(t.state)).slice(0, 5)
    const needsReview = { atRisk: all.filter(r => r.status !== 'on_track').length, dueThisMonth: dueThisMonth.length, dueList: (dueThisMonth.length ? dueThisMonth.slice(0, 5) : upcoming).map(t => ({ id: t.id, title: t.title, dueAt: t.dueAt, state: t.state, aopId: t.aopId })), listIsUpcoming: !dueThisMonth.length }
    // Evidence: task evidence packs and release references, newest first.
    const pkgOfAop = Object.fromEntries(all.map(r => [r.id, r]))
    const evidence = [
      ...tasks.filter(t => t.evidenceUrl).map(t => ({ kind: 'task', id: t.id, title: `${t.title} — evidence pack`, packageId: t.aopId?.replace(/^AOP-/, '').replace(/-Y\d+$/, '') || null, at: t.lastUpdateAt || t.dueAt, by: t.updatedByRole || t.responsibleRole, state: t.state, url: t.evidenceUrl, note: t.evidenceNote })),
      ...releases.filter(r => r.reference).map(r => ({ kind: 'release', id: r.id, title: `${r.project} — sanction ${r.reference}`, packageId: r.packageId, at: r.releasedAt, by: 'SPV finance', state: r.projectState, url: null, note: r.note })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at))
    res.json({ filters: { year, itiId: itiId || 'all', status: status || 'all' }, totals, byCategory, timeline, rows, needsReview, evidence, releases: releases.map(r => ({ id: r.id, releasedAt: r.releasedAt, packageId: r.packageId, packageTitle: pkgOfAop[r.packageId]?.title || r.packageId, category: pkgOfAop[r.packageId]?.category || '', project: r.project, amountCr: r.amountCr, reference: r.reference, projectState: r.projectState, note: r.note })), categories: [...new Set(all.map(r => r.category))].sort() })
  } catch (e) { next(e) }
})

r.get('/work-packages/:id', async (req, res, next) => {
  try {
    const { releases, tasks, rows } = await workPackageRows(req)
    const row = rows.find(r => r.id === req.params.id)
    if (!row) return res.status(404).json({ error: 'not_found' })
    const p = await prisma.package.findUnique({ where: { id: row.id }, include: { aops: true } })
    const aop = p.aops.find(a => a.year === Number(req.query.year || 1)) || p.aops[0] || null
    const ts = tasks.filter(t => aop && t.aopId === aop.id)
    const rel = releases.filter(r => r.packageId === p.id)
    const milestones = ts.map(t => ({ id: t.id, title: t.title, state: t.state, dueAt: t.dueAt, forecastAt: t.forecastAt, lastUpdateAt: t.lastUpdateAt, responsibleRole: t.responsibleRole, blockedReason: t.blockedReason, reviewNote: t.reviewNote, acceptance: t.acceptance }))
    const evidence = [
      ...ts.filter(t => t.evidenceUrl).map(t => ({ kind: 'task', title: `${t.title} — ${t.evidence || 'evidence pack'}`, at: t.lastUpdateAt || t.dueAt, by: t.updatedByRole || t.responsibleRole, url: t.evidenceUrl, note: t.evidenceNote })),
      ...rel.filter(r => r.reference).map(r => ({ kind: 'release', title: `Sanction ${r.reference}`, at: r.releasedAt, by: 'SPV finance', url: null, note: r.note })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at))
    const latest = ts.filter(t => t.lastUpdateAt).sort((a, b) => b.lastUpdateAt - a.lastUpdateAt)[0]
    const latestUpdate = latest ? { at: latest.lastUpdateAt, by: latest.updatedByRole, text: latest.state === 'blocked' ? `${latest.title}: blocked — ${latest.blockedReason}` : latest.state === 'returned' ? `${latest.title}: ${latest.reviewNote}` : `${latest.title}: ${latest.state.replace(/_/g, ' ')}${latest.evidenceNote ? ' · ' + latest.evidenceNote : ''}` } : null
    res.json({ package: { id: p.id, title: p.title, category: p.category, expenditureType: p.expenditureType, courseScope: p.courseScope, totalCr: p.totalCr, yearly: JSON.parse(p.yearly || '{}'), deliverable: p.deliverable, sourceStatus: p.sourceStatus }, aop: aop ? { id: aop.id, year: aop.year, budgetCr: aop.budgetCr, spentCr: aop.spentCr, state: aop.state, progressPct: aop.progressPct, deliverable: aop.deliverable, evidenceRule: aop.evidenceRule, accountableRole: aop.accountableRole, start: aop.start, finish: aop.finish } : null, row, releases: rel, milestones, evidence, latestUpdate })
  } catch (e) { next(e) }
})

export default r
