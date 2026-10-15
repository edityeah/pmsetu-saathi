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

export default r
