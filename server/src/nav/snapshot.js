// Live data for the assistants. Everything here is read from the same API
// routes the dashboards call, through an internal HTTP request carrying the
// user's own token, so chat and voice quote exactly what the screen shows.
// `summaryFor` reduces one target's response to a compact object; `livePack`
// is the cluster-wide snapshot stapled into the system prompt.
import { TARGET_BY_ID } from './catalog.js'

const PORT = Number(process.env.PORT || 8787)
const q = (o = {}) => { const p = Object.entries(o).filter(([, v]) => v != null && v !== '' && v !== 'all').map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&'); return p ? `?${p}` : '' }
const r1 = x => x == null ? null : Math.round(x * 10) / 10
const day = d => d ? String(d).slice(0, 10) : null

export async function fetchJson(req, path) {
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`, { headers: { authorization: req.headers.authorization || '' } })
  if (!res.ok) throw new Error(`${path} → ${res.status}`)
  return res.json()
}

// ── Per-target reducers ─────────────────────────────────────────────────────
const R = {
  async budget_overview(req, f) { const d = await fetchJson(req, `/api/analytics/budget${q({ itiId: f.itiId, year: f.year, category: f.category })}`); return { asOf: d.filters?.asOf, category: f.category || null, totals: d.totals, byIti: d.byIti?.map(i => ({ code: i.code, name: i.name, allocationCr: i.allocationCr, releasedCr: i.releasedCr, balanceCr: i.balanceCr, releasedPct: i.releasedPct, spentCr: i.spentCr })), byPackage: d.byPackage?.map(p => ({ category: p.category, allocationCr: p.allocationCr, releasedCr: p.releasedCr, spentCr: p.spentCr, packages: p.packages })) } },
  async budget_release_history(req, f) { const d = await fetchJson(req, `/api/analytics/budget${q({ itiId: f.itiId, year: f.year, category: f.category })}`); return { totals: d.totals, releases: d.releases?.length, latest: d.releases?.slice(0, 8).map(x => ({ date: day(x.releasedAt), iti: x.itiCode, package: x.packageTitle, amountCr: x.amountCr, projectState: x.projectState, progressPct: x.progressPct })) } },
  async budget_utilisation(req, f) { const d = await fetchJson(req, `/api/analytics/utilisation${q({ year: f.year })}`); return { totals: d.totals, lines: d.lines?.map(l => ({ label: l.label, budgetCr: l.budgetCr, committedCr: l.committedCr, utilisedCr: l.utilisedCr, utilisedPct: l.utilisedPct })), ucs: d.ucs?.map(u => ({ period: u.period, amountCr: u.amountCr, state: u.state })) } },
  async institute_overview(req, f) { const d = await fetchJson(req, `/api/plan/itis/${f.itiCode || 'mine'}/profile`); const i = d.iti; return { iti: { code: i.code, name: i.name, kind: i.kind, district: i.district, sectorFocus: i.sectorFocus, fiveYearCr: i.fiveYearCr, registryConnected: i.registryConnected, principal: i.principal?.name }, students: d.students, staffing: { registryTrainers: d.staffing.registryTrainers, baseline: d.staffing.baseline, planY1: d.staffing.plan?.Y1, byProgramme: d.staffing.byProgramme }, rooms: d.infrastructure.rooms, machines: d.infrastructure.machines.length, civilPackages: d.infrastructure.civil.map(w => ({ id: w.packageId, title: w.title, pctComplete: w.pctComplete, state: w.state })), tasks: { total: d.tasks.length, overdue: d.tasks.filter(t => t.overdue).length, completed: d.tasks.filter(t => ['completed', 'reviewed'].includes(t.state)).length }, gates: { total: d.gates.length, passed: d.gates.filter(g => g.state === 'passed').length } } },
  async institute_trades(req, f) { const d = await fetchJson(req, `/api/plan/itis/${f.itiCode || 'mine'}/profile`); return { iti: d.iti.name, coursesOffered: d.trades.length, courses: d.trades.map(t => { const y1 = t.plans?.find(p => p.period === 'Y1'); return { code: t.trade.code, name: t.trade.name, kind: t.trade.kind, nsqfLevel: t.trade.nsqfLevel, duration: `${t.trade.durationValue} ${t.trade.durationUnit}`, launch: t.launch, placesY1: y1?.places, plannedEnrolmentsY1: y1?.enrolments, enrolledNow: t.enrolledNow, runningBatches: t.runningBatches } }), otherTrades: (d.otherTrades || []).length } },
  async institute_facilities(req, f) { const d = await fetchJson(req, `/api/plan/itis/${f.itiCode || 'mine'}/profile`); const m = d.infrastructure.machines; const by = s => m.filter(x => x.status === s).length; return { iti: d.iti.name, rooms: d.infrastructure.rooms, machines: { total: m.length, functional: by('functional'), nonFunctional: by('non_functional'), awaitingCommissioning: by('awaiting_commissioning'), ordered: by('ordered'), obsolete: by('baseline_obsolete') }, notFunctional: m.filter(x => x.status !== 'functional').map(x => ({ name: x.name, trade: x.trade?.code, status: x.status })), civil: d.infrastructure.civil.map(w => ({ id: w.packageId, title: w.title, pctComplete: w.pctComplete, state: w.state, scheduled: day(w.scheduledCompletion) })), facilities: (d.facilities || []).slice(0, 12).map(x => ({ name: x.name, kind: x.kind, status: x.status })) } },
  async institute_staffing(req, f) { const d = await fetchJson(req, `/api/plan/itis/${f.itiCode || 'mine'}/profile`); return { iti: d.iti.name, staffing: d.staffing } },
  async institute_launch_gates(req, f) { const d = await fetchJson(req, `/api/plan/itis/${f.itiCode || 'mine'}/profile`); return { iti: d.iti.name, gates: d.gates.map(g => ({ offering: g.offeringId, launch: g.beforeLaunch, prerequisite: g.prerequisite, state: g.state })) } },
  async registry_students(req, f) { const d = await fetchJson(req, `/api/analytics/registry/students${q({ itiId: f.itiId, trade: f.trade, gender: f.gender })}`); return { coverage: d.coverage, total: d.total, gender: d.gender, byIti: d.byIti?.map(i => ({ code: i.code, name: i.name, n: i.n })), byTrade: d.byTrade?.slice(0, 12), filters: { itiId: f.itiId, trade: f.trade, gender: f.gender } } },
  async registry_trainers(req, f) { const d = await fetchJson(req, `/api/analytics/registry/trainers${q({ itiId: f.itiId, trade: f.trade })}`); return { coverage: d.coverage, total: d.total, trade: f.trade || null, assignments: d.assignments, byIti: d.byIti?.map(i => ({ code: i.code, name: i.name, n: i.n })), byTrade: d.byTrade, byLoad: d.byLoad, trainers: (d.rows || []).slice(0, 12).map(r => ({ name: r.name, iti: r.itiCode, programme: r.programme, batches: r.batches?.length, subjects: r.subjects?.slice(0, 3), today: r.today })) } },
  async ops_overview(req, f) { const d = await fetchJson(req, `/api/daily/overview${q({ itiId: f.itiId, date: f.date })}`); const a = d.attendance; return { date: day(a.date), fallbackToLatestReportedDay: a.fallback, attendance: { attendancePct: a.attendancePct, coveragePct: a.coveragePct, scheduled: a.scheduled, reported: a.reported, pending: a.pending }, assessments: d.assessments, readiness: d.readiness, upcomingEvents: d.events?.total, byIti: d.byIti } },
  async ops_attendance(req, f) { const d = await fetchJson(req, `/api/daily/attendance${q({ itiId: f.itiId, trade: f.trade, date: f.date })}`); return { date: day(d.date), fallbackToLatestReportedDay: d.fallback, totals: d.totals, byIti: d.byIti?.map(i => ({ code: i.code, name: i.name, attendancePct: i.attendancePct, coveragePct: i.coveragePct, scheduled: i.scheduled, reported: i.reported })), trend: d.trend?.map(t => ({ ...t, date: undefined })), pendingRegisters: d.pendingTotal } },
  async ops_assessment(req, f) { const d = await fetchJson(req, `/api/daily/assessments${q({ itiId: f.itiId, trade: f.trade, date: f.date })}`); return { date: day(d.date), fallbackToLatestReportedDay: d.fallback, totals: d.totals, byIti: d.byIti, byType: d.byType, upcoming: d.upcoming?.map(u => ({ date: day(u.date), n: u.n })) } },
  async ops_infrastructure(req, f) { const d = await fetchJson(req, `/api/daily/readiness${q({ itiId: f.itiId, trade: f.trade, date: f.date })}`); return { date: day(d.date), totals: d.totals, byIti: d.byIti, components: d.components, workshops: d.rows.map(x => ({ name: x.name, iti: x.itiCode, trade: x.tradeId, status: x.status, machinesFunctional: `${x.machines?.functional ?? 0} of ${x.machines?.total ?? 0}`, reasons: x.reasons })) } },
  async ops_events(req, f) { const d = await fetchJson(req, `/api/daily/events${q({ itiId: f.itiId })}`); return { from: day(d.from), to: day(d.to), totals: d.totals, byKind: d.byKind, next: d.list?.slice(0, 10).map(e => ({ date: day(e.date), kind: e.kind, title: e.title, iti: e.itiCode })) } },
  async placement_analytics(req, f) { const d = await fetchJson(req, `/api/placement/analytics${q({ itiId: f.itiId, trade: f.trade })}`); return { totals: d.totals, funnel: d.funnel, outcomes: d.outcomes, verification: d.ladder, retention: d.retention, byIti: d.byIti?.map(i => ({ code: i.code, pool: i.pool, applied: i.applied, offered: i.offered, joined: i.joined, women: i.women })) } },
  async employer_directory(req) { const d = await fetchJson(req, '/api/placement/employers'); const e = d.employers || []; return { employers: e.length, activePartners: e.filter(x => x.relationshipStatus === 'active').length, interested: e.filter(x => x.relationshipStatus === 'lead').length, withMou: e.filter(x => x.mouSignedAt).length, liveOpportunities: e.reduce((s, x) => s + (x.live || 0), 0), list: e.slice(0, 25).map(x => ({ name: x.name, sector: x.sector, city: x.city, status: x.relationshipStatus, itis: x.participatingItis, live: x.live, joined: x.joined })) } },
  async student_voice(req, f) { const d = await fetchJson(req, `/api/companion/voice${q({ itiId: f.itiId })}`); return { days: d.days, totals: d.totals, themes: d.themes?.slice(0, 8).map(t => ({ theme: t.theme, students: t.students, direct: t.direct, inferred: t.inferred, recommendation: t.recommendation })), perIti: d.perIti?.map(i => ({ code: i.code, events: i.events, students: i.students })) } },
  async grievances(req, f) { const d = await fetchJson(req, '/api/ops/grievances'); let g = d.grievances || []; if (f.itiId) g = g.filter(x => x.itiId === f.itiId); return { total: g.length, open: g.filter(x => x.status === 'open').length, resolved: g.filter(x => x.status === 'resolved').length, list: g.slice(0, 8).map(x => ({ iti: x.itiId, category: x.category, status: x.status, note: x.note, raised: day(x.createdAt) })) } },
  async notifications(req) { const d = await fetchJson(req, '/api/notifications'); const n = d.notifications || []; return { total: n.length, unread: n.filter(x => !x.readAt).length, list: n.slice(0, 8).map(x => ({ title: x.title, category: x.category, priority: x.priority, message: String(x.message || '').slice(0, 140) })) } },
}

export async function summaryFor(req, targetId, filters = {}) {
  const t = TARGET_BY_ID[targetId]
  if (!t) return null
  const fn = R[targetId]
  if (!fn) return null
  try { return await fn(req, filters) } catch (e) { console.warn('[nav/snapshot]', targetId, e?.message || e); return { error: 'data unavailable' } }
}

// ── Cluster-wide pack for the system prompt (cached 60 s per user) ──────────
const packCache = new Map()
export async function livePack(req) {
  const key = req.user?.id || 'anon'
  const hit = packCache.get(key)
  if (hit && Date.now() - hit.at < 60_000) return hit.text
  const role = req.user?.role
  const parts = []
  const safe = async (label, fn) => { try { const v = await fn(); if (v) parts.push(`${label}: ${JSON.stringify(v)}`) } catch (e) { /* skip */ } }
  const analyst = ['spv_ceo', 'ima_officer', 'state_pmu', 'iti_principal'].includes(role)
  await safe('HEADLINE (home cards)', async () => { const d = await fetchJson(req, '/api/headline'); return d.items?.map(i => ({ label: i.label, value: i.value, note: i.target, hint: i.hint })) })
  if (analyst) {
    await safe('TODAY (daily operations overview)', () => R.ops_overview(req, {}))
    await safe('INFRASTRUCTURE READINESS', async () => { const d = await R.ops_infrastructure(req, {}); return { totals: d.totals, byIti: d.byIti, notReady: d.workshops?.filter(w => w.status !== 'ready') } })
    await safe('BUDGET (Year 1 AOP)', async () => { const d = await R.budget_overview(req, {}); return { totals: d.totals, byIti: d.byIti } })
    await safe('UTILISATION', async () => { const d = await R.budget_utilisation(req, {}); return d.totals })
    await safe('STUDENT REGISTRY', async () => { const d = await R.registry_students(req, {}); return { coverage: d.coverage, total: d.total, gender: d.gender, byIti: d.byIti } })
    await safe('TRAINER REGISTRY', async () => { const d = await R.registry_trainers(req, {}); return { total: d.total, byIti: d.byIti } })
    await safe('PLACEMENT', async () => { const d = await R.placement_analytics(req, {}); return { totals: d.totals, funnel: d.funnel, verification: d.verification, byIti: d.byIti } })
    await safe('EMPLOYERS', async () => { const d = await R.employer_directory(req); return { employers: d.employers, activePartners: d.activePartners, liveOpportunities: d.liveOpportunities } })
    await safe('STUDENT VOICE (30 days)', async () => { const d = await R.student_voice(req, {}); return { totals: d.totals, topThemes: d.themes?.slice(0, 5) } })
    await safe('GRIEVANCES', async () => { const d = await R.grievances(req, {}); return { total: d.total, open: d.open } })
  }
  const text = parts.length ? `LIVE CLUSTER DATA (read from the platform now, ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC). These numbers are what the dashboards show; quote them exactly and never substitute remembered figures. For anything not here, use lookup_data / open_canvas (voice) or say it is not on this snapshot.\n` + parts.join('\n') : ''
  packCache.set(key, { at: Date.now(), text })
  return text
}
