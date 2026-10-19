// /api/daily — Section 4, Daily Operations, as the CEO reads it: a day's
// attendance, assessments, infrastructure readiness and upcoming events,
// each with hero numbers, one or two charts and a short record list.
// Coverage before averages; a missing register is a gap, never an absence.
import { Router } from 'express'
import { prisma } from '../db.js'
import { requireAuth } from '../auth/middleware.js'
import { clusterFor, itiFor } from '../lib/scope.js'

const r = Router()
r.use(requireAuth)

const dayUTC = (s) => { const n = s ? new Date(s) : new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())) }
const addDays = (d, n) => new Date(d.getTime() + n * 86400000)
const pct = (a, b) => (b ? Math.round(1000 * a / b) / 10 : null)
const J = (s, d) => { try { return JSON.parse(s) } catch { return d } }
const LAB_NAME = { electrical: 'Electrical workshop', mechanical: 'Fitting workshop', welding: 'Welding shop', machine_shop: 'Machine shop', it: 'Computer lab', electronics: 'Electronics lab', automation: 'Automation lab', hvac: 'HVAC lab', automotive: 'Automotive workshop' }

async function scope(req) {
  const c = await clusterFor(req.user)
  const itis = await prisma.iti.findMany({ where: { clusterId: c.id }, orderBy: [{ kind: 'asc' }, { code: 'asc' }], select: { id: true, code: true, name: true, registryConnected: true } })
  let itiIds = itis.map(i => i.id)
  if (req.user.role === 'iti_principal' || req.user.role === 'trainer') { const i = await itiFor(req.user); itiIds = i ? [i.id] : [] }
  else if (req.query.itiId && req.query.itiId !== 'all') itiIds = [String(req.query.itiId)]
  const trade = req.query.trade && req.query.trade !== 'all' ? String(req.query.trade) : null
  const batchId = req.query.batchId && req.query.batchId !== 'all' ? String(req.query.batchId) : null
  return { c, itis, itiIds, trade, batchId, batchWhere: { itiId: { in: itiIds }, ...(trade ? { tradeId: trade } : {}), ...(batchId ? { id: batchId } : {}) } }
}
const short = n => n.replace('Government ITI ', '')

// ── Attendance for a day ────────────────────────────────────────────────────
async function attendanceDay(sc, requested, time) {
  const base = { batch: sc.batchWhere, delivery: { not: 'cancelled' }, ...(time && time !== 'all' ? { startTime: time } : {}) }
  let date = requested, fallback = false
  let reported = await prisma.session.count({ where: { ...base, date, attendanceState: { not: 'not_reported' } } })
  if (!reported) { const last = await prisma.session.findFirst({ where: { ...base, date: { lt: requested }, attendanceState: { not: 'not_reported' } }, orderBy: { date: 'desc' }, select: { date: true } }); if (last) { date = last.date; fallback = true } }
  const sessions = await prisma.session.findMany({ where: { ...base, date }, select: { id: true, startTime: true, attendanceState: true, presentCount: true, absentCount: true, lateCount: true, batch: { select: { id: true, name: true, itiId: true, tradeId: true } } } })
  const rep = sessions.filter(s => s.attendanceState !== 'not_reported')
  const marks = await prisma.attendanceMark.groupBy({ by: ['status'], where: { sessionId: { in: rep.map(s => s.id) } }, _count: true })
  const m = Object.fromEntries(marks.map(x => [x.status, x._count]))
  const present = (m.present || 0), late = (m.late || 0), absent = (m.absent || 0), excused = (m.excused || 0)
  const expected = present + late + absent + excused
  return { date, fallback, sessions, rep, totals: { scheduled: sessions.length, reported: rep.length, pending: sessions.length - rep.length, coveragePct: pct(rep.length, sessions.length), attendancePct: pct(present + late, expected), attended: present + late, expected, present, late, absent, excused, rosterIssues: m.roster_issue || 0 } }
}

r.get('/attendance', async (req, res, next) => {
  try {
    const sc = await scope(req)
    const requested = dayUTC(req.query.date)
    const time = req.query.time ? String(req.query.time) : 'all'
    const a = await attendanceDay(sc, requested, time)
    const byIti = sc.itis.filter(i => sc.itiIds.includes(i.id)).map(i => {
      const ss = a.sessions.filter(s => s.batch.itiId === i.id), rp = ss.filter(s => s.attendanceState !== 'not_reported')
      const pr = rp.reduce((s, x) => s + (x.presentCount || 0) + (x.lateCount || 0), 0), ab = rp.reduce((s, x) => s + (x.absentCount || 0), 0)
      return { id: i.id, code: i.code, name: short(i.name), scheduled: ss.length, reported: rp.length, coveragePct: pct(rp.length, ss.length), attendancePct: pct(pr, pr + ab), marks: pr + ab }
    })
    // seven working days up to the day, per ITI
    const days = []
    for (let d = addDays(a.date, -10); d <= a.date && days.length < 20; d = addDays(d, 1)) { if (d.getUTCDay() !== 0) days.push(d) }
    const last7 = days.slice(-7)
    const trendRows = await prisma.session.findMany({ where: { batch: sc.batchWhere, date: { gte: last7[0], lte: a.date }, attendanceState: { not: 'not_reported' } }, select: { date: true, presentCount: true, absentCount: true, lateCount: true, batch: { select: { itiId: true, tradeId: true, trade: { select: { name: true } } } } } })
    // One ITI in scope (a principal, or the CEO looking at one institute): one line per trade. Otherwise one line per ITI.
    const singleIti = sc.itiIds.length === 1
    const trendKeys = singleIti
      ? [...new Map(trendRows.map(x => [x.batch.tradeId, { id: x.batch.tradeId, label: x.batch.trade?.name || x.batch.tradeId }])).values()].sort((p, q) => p.label.localeCompare(q.label))
      : sc.itis.filter(x => sc.itiIds.includes(x.id)).map(i => ({ id: i.code, label: short(i.name), itiId: i.id }))
    const trend = last7.map(d => { const row = { date: d, label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }; for (const k of trendKeys) { const rs = trendRows.filter(x => x.date.getTime() === d.getTime() && (singleIti ? x.batch.tradeId === k.id : x.batch.itiId === k.itiId)); const pr = rs.reduce((s, x) => s + (x.presentCount || 0) + (x.lateCount || 0), 0), ab = rs.reduce((s, x) => s + (x.absentCount || 0), 0); row[k.id] = pct(pr, pr + ab) } return row })
    const [trades, batches] = await Promise.all([
      prisma.trade.findMany({ where: { batches: { some: { itiId: { in: sc.itiIds }, state: 'running' } } }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      prisma.batch.findMany({ where: { itiId: { in: sc.itiIds }, state: 'running', ...(sc.trade ? { tradeId: sc.trade } : {}) }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    ])
    const pending = a.sessions.filter(s => s.attendanceState === 'not_reported').map(s => ({ id: s.id, batch: s.batch.name, startTime: s.startTime, itiCode: sc.itis.find(i => i.id === s.batch.itiId)?.code }))
    // Early warning (one ITI in scope): students whose attendance over the last
    // 15 reported days is below 80% (watch) or 70% (high), same thresholds as
    // the batch roster risk flag. Needs at least five marks to count.
    let earlyWarning = null
    if (singleIti) {
      const since = addDays(a.date, -15)
      const marks = await prisma.attendanceMark.findMany({ where: { session: { batch: sc.batchWhere, date: { gte: since, lte: a.date }, attendanceState: { not: 'not_reported' } }, status: { in: ['present', 'late', 'absent'] } }, select: { traineeId: true, status: true } })
      const per = new Map()
      for (const m of marks) { const t = per.get(m.traineeId) || { n: 0, p: 0, ab: 0 }; t.n++; if (m.status === 'absent') t.ab++; else t.p++; per.set(m.traineeId, t) }
      const ids = [...per.keys()].filter(id => per.get(id).n >= 5)
      const trainees = await prisma.trainee.findMany({ where: { id: { in: ids }, status: 'active' }, select: { id: true, name: true, gender: true, batch: { select: { id: true, name: true, tradeId: true, trade: { select: { name: true } } } } } })
      const flagged = trainees.map(t => { const x = per.get(t.id); const p = Math.round(1000 * x.p / x.n) / 10; return { id: t.id, name: t.name, gender: t.gender, tradeId: t.batch?.tradeId, trade: t.batch?.trade?.name || t.batch?.tradeId, batch: t.batch?.name, attendancePct: p, absences: x.ab, marks: x.n, level: p < 70 ? 'high' : 'watch' } }).filter(t => t.attendancePct < 80).sort((p, q) => p.attendancePct - q.attendancePct)
      const byTradeMap = {}
      for (const t of flagged) { const k = byTradeMap[t.tradeId] ||= { id: t.tradeId, name: t.trade, total: 0, male: 0, female: 0, high: 0, watch: 0 }; k.total++; k[t.gender === 'F' ? 'female' : 'male']++; k[t.level]++ }
      earlyWarning = { thresholdPct: 80, highPct: 70, windowDays: 15, studentsWithData: trainees.length, total: flagged.length, high: flagged.filter(t => t.level === 'high').length, watch: flagged.filter(t => t.level === 'watch').length, byGender: { male: flagged.filter(t => t.gender !== 'F').length, female: flagged.filter(t => t.gender === 'F').length }, byTrade: Object.values(byTradeMap).sort((p, q) => q.total - p.total), students: flagged.slice(0, 200) }
    }
    res.json({ requestedDate: requested, date: a.date, fallback: a.fallback, totals: a.totals, byIti, trend, trendBy: singleIti ? 'trade' : 'iti', trendKeys, earlyWarning, itiCodes: sc.itis.filter(i => sc.itiIds.includes(i.id)).map(i => i.code), options: { trades, batches, times: ['09:30', '11:30', '14:00'] }, pending: pending.slice(0, 50), pendingTotal: pending.length })
  } catch (e) { next(e) }
})

// ── Assessments for a day ───────────────────────────────────────────────────
async function assessmentDay(sc, requested, type, status) {
  const base = { batch: sc.batchWhere, ...(type && type !== 'all' ? { type } : {}) }
  let date = requested, fallback = false
  let n = await prisma.assessmentPlan.count({ where: { ...base, date } })
  if (!n) { const near = await prisma.assessmentPlan.findFirst({ where: { ...base, date: { lte: requested } }, orderBy: { date: 'desc' }, select: { date: true } }); if (near) { date = near.date; fallback = true } }
  const plans = await prisma.assessmentPlan.findMany({ where: { ...base, date }, include: { batch: { select: { name: true, itiId: true, tradeId: true, trade: { select: { name: true } } } }, _count: { select: { entries: true } } }, orderBy: { title: 'asc' } })
  const view = p => { const conducted = p.state !== 'planned'; const marks = conducted && p._count.entries > 0 && !['marks_pending', 'conducted'].includes(p.state); return { id: p.id, title: p.title, type: p.type, state: p.state, batch: p.batch.name, itiId: p.batch.itiId, itiCode: sc.itis.find(i => i.id === p.batch.itiId)?.code, trade: p.batch.trade?.name, tradeId: p.batch.tradeId, maxMarks: p.maxMarks, entries: p._count.entries, conducted, marksUploaded: marks, marksStatus: !conducted ? 'not_expected' : marks ? (p.state === 'needs_review' || p.state === 'submitted' ? 'review' : 'uploaded') : 'pending' } }
  let rows = plans.map(view)
  if (status && status !== 'all') rows = rows.filter(x => status === 'scheduled' ? !x.conducted : status === 'conducted' ? x.conducted : status === 'pending' ? x.marksStatus === 'pending' : status === 'review' ? x.marksStatus === 'review' : x.marksStatus === 'uploaded')
  return { date, fallback, rows }
}

r.get('/assessments', async (req, res, next) => {
  try {
    const sc = await scope(req)
    const requested = dayUTC(req.query.date)
    const a = await assessmentDay(sc, requested, req.query.type, req.query.status)
    const t = { scheduled: a.rows.length, conducted: a.rows.filter(x => x.conducted).length, marksUploaded: a.rows.filter(x => x.marksUploaded).length, pending: a.rows.filter(x => x.marksStatus === 'pending').length, review: a.rows.filter(x => x.marksStatus === 'review').length, notConducted: a.rows.filter(x => !x.conducted).length }
    const byIti = sc.itis.filter(i => sc.itiIds.includes(i.id)).map(i => { const rs = a.rows.filter(x => x.itiId === i.id); return { code: i.code, name: short(i.name), scheduled: rs.length, conducted: rs.filter(x => x.conducted).length, marksUploaded: rs.filter(x => x.marksUploaded).length } })
    const byType = ['theory', 'practical', 'viva'].map(k => ({ type: k, scheduled: a.rows.filter(x => x.type === k).length, conducted: a.rows.filter(x => x.type === k && x.conducted).length }))
    // Status by trade for the day (one bar group per trade with assessments).
    const tradeMap = {}
    for (const x of a.rows) { const k = tradeMap[x.tradeId] ||= { id: x.tradeId, name: x.trade, scheduled: 0, conducted: 0, marksUploaded: 0 }; k.scheduled++; if (x.conducted) k.conducted++; if (x.marksUploaded) k.marksUploaded++ }
    const byTrade = Object.values(tradeMap).sort((p, q) => q.scheduled - p.scheduled)
    // Term view by type: every assessment planned for the scope this term, conducted vs still planned.
    const termPlans = await prisma.assessmentPlan.groupBy({ by: ['type', 'state'], where: { batch: sc.batchWhere }, _count: true })
    const termByType = ['theory', 'practical', 'viva'].map(k => { const rs = termPlans.filter(x => x.type === k); const total = rs.reduce((s, x) => s + x._count, 0), planned = rs.filter(x => x.state === 'planned').reduce((s, x) => s + x._count, 0); return { type: k, total, conducted: total - planned, planned } })
    const [trades, batches, upcoming] = await Promise.all([
      prisma.trade.findMany({ where: { batches: { some: { itiId: { in: sc.itiIds }, state: 'running' } } }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      prisma.batch.findMany({ where: { itiId: { in: sc.itiIds }, state: 'running', ...(sc.trade ? { tradeId: sc.trade } : {}) }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      prisma.assessmentPlan.groupBy({ by: ['date'], where: { batch: sc.batchWhere, date: { gt: a.date } }, _count: true, orderBy: { date: 'asc' }, take: 3 }),
    ])
    res.json({ requestedDate: requested, date: a.date, fallback: a.fallback, totals: t, byIti, byType, byTrade, termByType, rows: a.rows, options: { trades, batches }, upcoming: upcoming.map(u => ({ date: u.date, n: u._count })) })
  } catch (e) { next(e) }
})

// ── Infrastructure readiness ───────────────────────────────────────────────
// A workshop per (ITI, trade) from the machine register; five checks from
// the registers that exist: space (civil works), electricity and safety and
// consumables (open operations issues), equipment (machine status).
export async function readiness(sc, date) {
  const [machines, issues, civil, sessions] = await Promise.all([
    prisma.machine.findMany({ where: { itiId: { in: sc.itiIds } }, include: { trade: { select: { code: true, name: true } } } }),
    prisma.opsIssue.findMany({ where: { itiId: { in: sc.itiIds }, state: { not: 'resolved' } }, include: { batch: { select: { tradeId: true } } } }),
    prisma.civilWork.findMany({ where: { itiId: { in: sc.itiIds } } }).then(async ws => { const pk = await prisma.package.findMany({ where: { id: { in: ws.map(w => w.packageId).filter(Boolean) } }, select: { id: true, courseScope: true } }); return ws.map(w => ({ ...w, package: pk.find(p => p.id === w.packageId) || null })) }),
    prisma.session.findMany({ where: { batch: sc.batchWhere, date, delivery: { not: 'cancelled' } }, select: { startTime: true, kind: true, batch: { select: { itiId: true, tradeId: true } } }, orderBy: { startTime: 'asc' } }),
  ])
  const groups = {}
  for (const m of machines) { if (!m.trade) continue; const k = `${m.itiId}|${m.trade.code}`; (groups[k] ||= { itiId: m.itiId, tradeId: m.trade.code, tradeName: m.trade.name, category: m.category, machines: [] }).machines.push(m) }
  // An issue without a batch or machine is matched to a workshop by what its title says.
  const KEY = { LWD: /weld/i, ELE: /wiring|electric/i, FIT: /fitting|bench|vice/i, COP: /computer|\bpc\b/i, LMC: /lathe|machine shop/i, LTR: /turner/i, LEM: /electronic/i, LRA: /refrigerat|ac unit|hvac/i, LMV: /vehicle|engine/i, LDM: /draught|drawing/i, LST: /steno|typing/i, LSM: /sheet metal/i }
  const rows = Object.values(groups).filter(g => g.machines.some(m => ['functional', 'installed', 'non_functional'].includes(m.status))).map(g => {
    const iti = sc.itis.find(i => i.id === g.itiId)
    const machineTrade = x => x.machineId ? machines.find(m => m.id === x.machineId)?.trade?.code : null
    const tradeOfIssue = x => x.batch?.tradeId || machineTrade(x) || Object.keys(KEY).find(k => KEY[k].test(x.title)) || null
    const issuesFor = cat => issues.filter(x => x.itiId === g.itiId && x.category === cat && (tradeOfIssue(x) === g.tradeId || (cat === 'electrical' && !tradeOfIssue(x))))
    const live = g.machines.filter(m => ['functional', 'installed'].includes(m.status)).length, down = g.machines.filter(m => m.status === 'non_functional').length
    const spaceWork = civil.find(w => w.itiId === g.itiId && w.state === 'delayed' && (w.package?.courseScope || '').split(/\s+/).includes(g.tradeId))
    const checks = { space: !spaceWork, electricity: issuesFor('electrical').length === 0 && issuesFor('power').length === 0, safety: issuesFor('safety').length === 0, equipment: down === 0 && live > 0, consumables: issuesFor('consumables').length === 0 }
    const failing = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k)
    const status = live === 0 ? 'unavailable' : (!checks.safety && issuesFor('safety').some(x => x.severity === 'high')) ? 'unavailable' : failing.length ? 'restricted' : 'ready'
    const mine = sessions.filter(s => s.batch.itiId === g.itiId && s.batch.tradeId === g.tradeId)
    const next = mine.find(s => s.kind === 'practical') || mine[0]
    const lastChecked = [...g.machines.map(m => m.lastServiceAt), ...issues.filter(x => x.itiId === g.itiId && tradeOfIssue(x) === g.tradeId).map(x => x.createdAt)].filter(Boolean).sort((a, b) => b - a)[0] || date
    const reasons = failing.map(k => k === 'equipment' ? (live === 0 ? 'no functional machine on the register' : `${down} of ${g.machines.length} machines not functional`) : k === 'space' ? `${spaceWork.title} delayed` : `${issuesFor(k === 'electricity' ? 'electrical' : k)[0]?.title || k + ' issue open'}`)
    return { id: `${g.itiId}-${g.tradeId}`, name: LAB_NAME[g.category] || `${g.tradeName} workshop`, kind: g.category === 'it' ? 'lab' : 'workshop', itiId: g.itiId, itiCode: iti?.code, itiName: short(iti?.name || ''), tradeId: g.tradeId, tradeName: g.tradeName, scheduledUse: next ? `${next.kind === 'practical' ? 'Practical' : 'Theory'} ${next.startTime}` : 'No session scheduled', status, checks, reasons, machines: { total: g.machines.length, functional: live, nonFunctional: down }, lastChecked }
  })
  return rows.sort((a, b) => (a.itiCode || '').localeCompare(b.itiCode || '') || a.name.localeCompare(b.name))
}

r.get('/readiness', async (req, res, next) => {
  try {
    const sc = await scope(req)
    const date = dayUTC(req.query.date)
    let rows = await readiness(sc, date)
    const all = rows
    if (sc.trade) rows = rows.filter(x => x.tradeId === sc.trade)
    if (req.query.kind && req.query.kind !== 'all') rows = rows.filter(x => x.kind === req.query.kind)
    if (req.query.status && req.query.status !== 'all') rows = rows.filter(x => x.status === req.query.status)
    const cnt = s => rows.filter(x => x.status === s).length
    const byIti = sc.itis.filter(i => sc.itiIds.includes(i.id)).map(i => { const rs = rows.filter(x => x.itiId === i.id); return { code: i.code, name: short(i.name), ready: rs.filter(x => x.status === 'ready').length, restricted: rs.filter(x => x.status === 'restricted').length, unavailable: rs.filter(x => x.status === 'unavailable').length, total: rs.length } })
    const components = ['space', 'electricity', 'safety', 'equipment', 'consumables'].map(k => ({ key: k, ok: rows.filter(x => x.checks[k]).length, total: rows.length }))
    const trades = [...new Map(all.map(x => [x.tradeId, { id: x.tradeId, name: x.tradeName }])).values()].sort((a, b) => a.name.localeCompare(b.name))
    res.json({ date, totals: { inScope: rows.length, ready: cnt('ready'), restricted: cnt('restricted'), unavailable: cnt('unavailable') }, byIti, components, rows, options: { trades } })
  } catch (e) { next(e) }
})

// ── Upcoming events ────────────────────────────────────────────────────────
async function events(sc, from, days, kind) {
  const to = addDays(from, days)
  const codes = sc.itis.filter(i => sc.itiIds.includes(i.id)).map(i => i.code)
  const codeOf = id => sc.itis.find(i => i.id === id)?.code || null
  const [assess, milestones, reports, opps, employers, visits] = await Promise.all([
    prisma.assessmentPlan.findMany({ where: { batch: sc.batchWhere, date: { gte: from, lt: to }, state: 'planned' }, include: { batch: { select: { name: true, itiId: true } } }, orderBy: { date: 'asc' } }),
    prisma.milestone.findMany({ where: { clusterId: sc.c.id, dueAt: { gte: from, lt: to }, OR: [{ itiCode: null }, { itiCode: { in: codes } }], state: { in: ['pending', 'submitted'] } }, orderBy: { dueAt: 'asc' } }),
    prisma.report.findMany({ where: { clusterId: sc.c.id, dueAt: { gte: from, lt: to }, submittedAt: null }, orderBy: { dueAt: 'asc' } }),
    prisma.opportunity.findMany({ where: { clusterId: sc.c.id, closingAt: { gte: from, lt: to }, status: { in: ['live', 'checking'] } }, include: { employer: { select: { name: true } } }, orderBy: { closingAt: 'asc' } }),
    prisma.employer.findMany({ where: { clusterId: sc.c.id, nextEngagementAt: { gte: from, lt: to } }, orderBy: { nextEngagementAt: 'asc' } }),
    prisma.visit.findMany({ where: { itiId: { in: sc.itiIds }, date: { gte: from, lt: to } }, orderBy: { date: 'asc' } }).catch(() => []),
  ])
  // Assessments are grouped per ITI and day so one row = one assessment day, not 40 batch rows.
  const byDay = {}
  for (const a of assess) { const k = `${a.batch.itiId}|${a.date.toISOString().slice(0, 10)}|${a.type}`; const g = byDay[k] ||= { id: `ASD-${k}`, date: a.date, kind: 'assessment', title: `${a.title.replace(/ · .*/, '')} (${a.type})`, itiCode: codeOf(a.batch.itiId), n: 0, canvas: 'daily_operations', tab: 'assessment' }; g.n++ }
  let list = [
    ...Object.values(byDay).map(g => ({ ...g, title: `${g.title} · ${g.n} batches` })),
    ...milestones.map(m => ({ id: m.id, date: m.dueAt, kind: 'milestone', title: `IMA milestone due: ${m.title}`, itiCode: m.itiCode, canvas: 'milestones' })),
    ...reports.map(x => ({ id: x.id, date: x.dueAt, kind: 'report', title: `${x.kind} report due · ${x.period}`, itiCode: null, canvas: 'reports' })),
    ...opps.map(o => ({ id: o.id, date: o.closingAt, kind: 'placement', title: `Applications close: ${o.title} (${o.employer.name})`, itiCode: null, canvas: 'employer_register' })),
    ...employers.map(e => ({ id: e.id, date: e.nextEngagementAt, kind: 'employer', title: `Employer engagement: ${e.name}`, itiCode: null, canvas: 'employer_register' })),
    ...visits.map(v => ({ id: v.id, date: v.date, kind: 'visit', title: `Field visit: ${v.workshop}`, itiCode: codeOf(v.itiId), canvas: 'field_visit' })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date))
  if (kind && kind !== 'all') list = list.filter(e => e.kind === kind)
  const byKind = list.reduce((m, e) => { m[e.kind] = (m[e.kind] || 0) + 1; return m }, {})
  const weeks = Math.ceil(days / 7)
  const byWeek = Array.from({ length: weeks }, (_, w) => ({ label: `Wk ${w + 1}`, from: addDays(from, w * 7), count: list.filter(e => { const d = new Date(e.date); return d >= addDays(from, w * 7) && d < addDays(from, (w + 1) * 7) }).length }))
  const byDayCount = {}
  for (const e of list) { const k = new Date(e.date).toISOString().slice(0, 10); byDayCount[k] = (byDayCount[k] || 0) + 1 }
  return { from, to, days, list, byKind, byWeek, byDayCount }
}

r.get('/events', async (req, res, next) => {
  try {
    const sc = await scope(req)
    const from = dayUTC(req.query.from), days = Math.max(1, Math.min(120, Number(req.query.days || 30)))
    const e = await events(sc, from, days, req.query.kind)
    const today = dayUTC()
    const thisWeek = e.list.filter(x => new Date(x.date) < addDays(today, 7)).length
    res.json({ ...e, totals: { total: e.list.length, thisWeek, deadlines: (e.byKind.milestone || 0) + (e.byKind.report || 0), employer: (e.byKind.employer || 0) + (e.byKind.placement || 0), assessmentDays: e.byKind.assessment || 0 }, next: e.list.slice(0, 4) })
  } catch (e) { next(e) }
})

// ── Overview: the four cards and the flow table ────────────────────────────
r.get('/overview', async (req, res, next) => {
  try {
    const sc = await scope(req)
    const requested = dayUTC(req.query.date)
    const [a, as, rd, ev] = await Promise.all([attendanceDay(sc, requested, 'all'), assessmentDay(sc, requested), readiness(sc, requested), events(sc, dayUTC(), 30)])
    const itisIn = sc.itis.filter(i => sc.itiIds.includes(i.id))
    const byIti = itisIn.map(i => {
      const ss = a.sessions.filter(s => s.batch.itiId === i.id), rp = ss.filter(s => s.attendanceState !== 'not_reported')
      const pr = rp.reduce((s, x) => s + (x.presentCount || 0) + (x.lateCount || 0), 0), ab = rp.reduce((s, x) => s + (x.absentCount || 0), 0)
      const ws = rd.filter(x => x.itiId === i.id)
      const nextEv = ev.list.find(e => e.itiCode === i.code) || ev.list.find(e => !e.itiCode)
      return { code: i.code, name: short(i.name), attendancePct: pct(pr, pr + ab), coveragePct: pct(rp.length, ss.length), registers: `${rp.length} of ${ss.length}`, assessments: as.rows.filter(x => x.itiId === i.id).length, assessmentsConducted: as.rows.filter(x => x.itiId === i.id && x.conducted).length, workshopsReady: ws.filter(x => x.status === 'ready').length, workshops: ws.length, nextEvent: nextEv ? { title: nextEv.title, date: nextEv.date } : null }
    })
    res.json({ requestedDate: requested,
      attendance: { date: a.date, fallback: a.fallback, ...a.totals, byIti: byIti.map(i => ({ code: i.code, name: i.name, attendancePct: i.attendancePct })) },
      assessments: { date: as.date, fallback: as.fallback, scheduled: as.rows.length, conducted: as.rows.filter(x => x.conducted).length, marksUploaded: as.rows.filter(x => x.marksUploaded).length },
      readiness: { inScope: rd.length, ready: rd.filter(x => x.status === 'ready').length, restricted: rd.filter(x => x.status === 'restricted').length, unavailable: rd.filter(x => x.status === 'unavailable').length },
      events: { total: ev.list.length, byKind: ev.byKind, next: ev.list.slice(0, 4) },
      byIti })
  } catch (e) { next(e) }
})

export default r
