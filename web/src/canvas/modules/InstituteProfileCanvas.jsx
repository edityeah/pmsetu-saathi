// Institute profile (Module A) — the seven tabs the PRD asks each principal
// to confirm: overview, trades, staffing, infrastructure, budget, targets,
// launch gates. Every tab says where its values come from.
import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Bar, Pill, Section, Table, Loading, Btn, useLoad, Tabs, fmtCr, fmtDate, nil, stateKind, titleCase, NoFeed, inputCls } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'
import { DetailPage, DetailCard, LabelGrid } from './_Detail.jsx'

const r1 = v => (v == null || v === '' ? v : Math.round(Number(v) * 10) / 10)
const TABS_ALL = [{ id: 'overview', label: 'Overview' }, { id: 'trades', label: 'Trade offerings' }, { id: 'infrastructure', label: 'Facilities and labs' }, { id: 'staffing', label: 'Staffing' }, { id: 'budget', label: 'Budget' }, { id: 'targets', label: 'Targets' }, { id: 'launch_gates', label: 'Launch gates' }]
const TABS_CEO = TABS_ALL.slice(0, 3)
const STATUS = { in_use: { kind: 'ok', label: 'In use' }, partly_down: { kind: 'warn', label: 'Partly down' }, being_set_up: { kind: 'info', label: 'Being set up' }, ready: { kind: 'ok', label: 'Ready' }, under_construction: { kind: 'info', label: 'Under construction' }, delayed: { kind: 'bad', label: 'Delayed' } }
const KIND = { workshop: 'Workshop', lab: 'Lab', space: 'Space' }

export default function InstituteProfileCanvas({ context }) {
  const { role, showToast, openCanvas } = useApp()
  const { data: itis } = useLoad(() => api.itis())
  const [code, setCode] = useState(context?.itiCode || 'mine')
  const [tab, setTab] = useState(context?.tab || 'overview')
  const [course, setCourse] = useState(null)
  const [facility, setFacility] = useState(null)
  const [facilityPick, setFacilityPick] = useState(null)
  const { data, reload } = useLoad(() => api.itiProfile(code), [code])
  useSaathiContext(data ? `ITI ${data.iti.name} (${data.iti.kind}; registry ${data.iti.registryConnected ? 'connected' : 'not connected'}). Profile tabs: ${Object.entries(data.iti.profileSections || {}).map(([k, v]) => `${k}=${v.state}`).join(', ')}. Students ${data.students.active} (${data.students.women} women, ${data.students.pwd} PwD). Trainers in registry ${data.staffing.registryTrainers}, assigned ${data.staffing.assignedTrainers}, baseline ${data.staffing.baseline}, plan ${JSON.stringify(data.staffing.plan)}. Rooms ${data.infrastructure.rooms.working}/${data.infrastructure.rooms.baseline} (Y5 ${data.infrastructure.rooms.y5}); machines ${data.infrastructure.machines.length}; civil ${data.infrastructure.civil.map(w => `${w.packageId} ${w.pctComplete}% ${w.state}`).join(', ')}. Budget: ${data.budget.length} packages ₹${data.targets.plannedCr} Cr vs anchor ₹${data.targets.fiveYearCr} Cr (civil ₹${data.targets.civilCr} Cr, digital ₹${data.targets.digitalCr} Cr). Offerings: ${data.trades.map(t => `${t.trade.code} launch ${t.launch}, Y1 ${t.plans[1]?.enrolments ?? '—'}/${t.plans[1]?.places ?? '—'} actual ${t.actualY1 ?? '—'}, batches ${t.runningBatches}`).join('; ')}. Gates ${data.gates.filter(g => g.state === 'passed').length}/${data.gates.length} passed (${data.gates.filter(g => g.state === 'ready').length} ready). Year-1 tasks: ${data.tasks.map(t => `${t.id} ${t.title} [${t.state}${t.overdue ? ', OVERDUE ' + t.slipDays + 'd' : ''}; due ${String(t.dueAt).slice(0, 10)}; owner ${t.responsibleRole}]`).join('; ')}.` : '', ['Which profile tabs are still draft and what do they need?', 'Which launch gates are closest to ready?', 'What is overdue at this ITI and who owns it?', 'Summarise this ITI in five lines for the SPV board.'])
  if (!data) return <Loading />
  const { iti, students, trades, otherTrades, staffing, infrastructure, budget, targets, gates, tasks, facilities = [], kb = {}, contacts = {} } = data
  const TABS = role === 'spv_ceo' ? TABS_CEO : TABS_ALL
  const openFacilityFor = code => { const f = facilities.find(x => x.linkedTrades.includes(code) && x.kind !== 'space') || facilities.find(x => x.linkedTrades.includes(code)); setCourse(null); setTab('infrastructure'); if (f) setFacility(f) }
  const openCoursesFor = f => { setFacility(null); setTab('trades'); setFacilityPick(f) }
  const sec = iti.profileSections || {}
  const state = sec[tab]?.state || 'draft'
  const canSwitch = role !== 'iti_principal' && role !== 'trainer'
  const canConfirm = role === 'iti_principal' || role === 'spv_ceo'
  async function confirm(st) { await api.confirmProfileTab(iti.code, tab, st); showToast({ kind: 'success', text: `${TABS.find(t => t.id === tab).label}: ${st}` }); reload() }
  async function gate(g, st) { await api.gateState(g.id, st); showToast({ kind: 'success', text: `${g.id} → ${st}` }); reload() }
  const periods = ['Baseline', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5']
  const confirmedCount = Object.values(sec).filter(s => s.state === 'confirmed').length
  const y1 = tr => tr.plans[1]

  if (course) return <CourseDetail t={course} kb={kb[course.trade.code]} facility={facilities.find(f => f.linkedTrades.includes(course.trade.code) && f.kind !== 'space')} iti={iti} periods={periods} onBack={() => setCourse(null)} onBatches={() => openCanvas({ type: 'batches', itiId: iti.id })} onWorkshop={() => openFacilityFor(course.trade.code)} />
  if (facility) return <FacilityDetail f={facility} trades={trades} iti={iti} onBack={() => setFacility(null)} onCourses={() => openCoursesFor(facility)} onMachines={() => openCanvas({ type: 'machines_infra', itiId: iti.id })} />
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="violet" eyebrow={`${iti.kind === 'hub' ? 'Hub' : 'Spoke'} · ${iti.district} · ${iti.registryConnected ? 'registry connected' : 'no registry feed'}`} title={iti.name} subtitle={`${iti.sectorFocus} · ₹${iti.fiveYearCr} Cr over five years · ${confirmedCount} of 7 profile tabs confirmed`}
        right={canSwitch && itis ? <select value={code} onChange={e => { setCode(e.target.value) }} className="text-[12px] rounded-lg border border-bdr px-2 py-1.5 bg-white">{itis.itis.map(i => <option key={i.id} value={i.code}>{i.name}</option>)}</select> : null} />
      <Tabs tabs={TABS.map(t => ({ ...t, badge: sec[t.id]?.state === 'confirmed' ? '✓' : null }))} active={tab} onChange={setTab}
        right={<div className="flex items-center gap-2"><Pill kind={state === 'confirmed' ? 'ok' : 'warn'}>{state}{sec[tab]?.confirmedAt ? ` · ${fmtDate(sec[tab].confirmedAt)}` : ''}</Pill>{canConfirm && (state === 'confirmed' ? <Btn small tone="ghost" onClick={() => confirm('draft')}>Reopen</Btn> : <Btn small tone="ok" onClick={() => confirm('confirmed')}>Confirm tab</Btn>)}</div>} />
      <div className="p-4 space-y-4">
        {tab === 'overview' && role === 'spv_ceo' && (<>
          <Section tone="indigo" title="About this institute">
            <p className="text-[12px] text-txt-secondary mb-3">{iti.kind === 'hub' ? 'The hub institute of the cluster: it hosts the shared specialist labs, coordinates with the four spokes and carries the largest Year-1 programme.' : 'A spoke institute of the cluster: it runs its own core trades and draws on the hub for specialist labs and shared services.'}{iti.sectorFocus ? ` Sector focus: ${iti.sectorFocus}.` : ''}</p>
            <LabelGrid items={[['Institute type', iti.kind === 'hub' ? 'Hub ITI' : 'Spoke ITI'], ['Location', `${iti.district}, Delhi`], ['Institute code', iti.code], ['Cluster role', iti.kind === 'hub' ? 'Shared training and technical support' : 'Core trades; hub for specialist labs'], ['Registry', iti.registryConnected ? 'Connected' : 'Not yet connected'], ['Operating context', `Year 1 of the five-year plan · ₹${iti.fiveYearCr} Cr`]]} />
          </Section>
          <StatGrid>
            <Stat label="Active students" value={students.registryConnected ? students.active.toLocaleString('en-IN') : '—'} sub={students.registryConnected ? `${students.women} women · ${students.pwd} PwD · open roster` : 'registry not connected'} tone="indigo" onClick={() => openCanvas({ type: 'batches', itiId: iti.id })} />
            <Stat label="Annual places (Y1)" value={iti.seatCapacity} sub={`baseline enrolments ${iti.baselineSeats}`} tone="sky" onClick={() => setTab('trades')} />
            <Stat label="Trainers" value={`${staffing.registryTrainers || '—'}`} sub={`baseline ${staffing.baseline} · Y1 plan ${staffing.plan.Y1}`} tone="emerald" onClick={() => openCanvas({ type: 'cluster_registry', tab: 'trainers', filters: { scope: iti.id } })} />
            <Stat label="Year-1 tasks" value={`${tasks.filter(t => ['completed', 'reviewed'].includes(t.state)).length}/${tasks.length}`} sub={`${tasks.filter(t => t.overdue).length} overdue`} tone={tasks.some(t => t.overdue) ? 'rose' : 'teal'} onClick={() => openCanvas({ type: 'annual_plan', itiId: iti.id })} />
          </StatGrid>
          <Section tone="emerald" title="Campus & access" right={<button className="text-[11px] text-primary font-bold" onClick={() => setTab('infrastructure')}>Explore facilities and labs →</button>}>
            <LabelGrid items={[['Teaching spaces', `${iti.roomsWorking} of ${iti.roomsBaseline} rooms working · Year-5 target ${iti.roomsY5}`], ['Workshops and labs', `${facilities.filter(f => f.kind !== 'space' && f.status !== 'being_set_up').length} in use · ${facilities.filter(f => f.status === 'being_set_up').length} being set up`], ['Shared facilities', facilities.filter(f => /Shared/.test(f.sharing)).map(f => f.name).slice(0, 3).join(', ') || '—'], ['Works on campus', `${facilities.filter(f => f.kind === 'space').length} civil packages · ${infrastructure.civil.filter(w => w.state === 'delayed').length} delayed`], ['Machines', `${infrastructure.machines.filter(m => ['functional', 'installed'].includes(m.status)).length} of ${infrastructure.machines.length} functional`], ['Access', 'Accessibility, sanitation and safety works in progress']]} />
          </Section>
          <Section tone="amber" title="Leadership & contacts" right={<button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'cluster_registry', tab: 'trainers', filters: { scope: iti.id } })}>Open linked staff records →</button>}>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
              {[contacts.principal, contacts.placement].filter(Boolean).map(c => <li key={c.role} className="flex items-center gap-3"><span className="w-9 h-9 rounded-full bg-primary-light text-primary-dark font-bold flex items-center justify-center text-[12px]">{c.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</span><div className="min-w-0"><div className="font-bold text-txt-primary truncate">{c.name}</div><div className="text-[10px] text-txt-tertiary">{c.role}{c.phone ? ` · ${c.phone}` : ''}</div></div></li>)}
            </ul>
          </Section>
          <Section tone="violet" title="Connected sections" hint="Each opens already scoped to this institute.">
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 text-[12px]">
              {[['Students & trainers', () => openCanvas({ type: 'cluster_registry', tab: 'students', filters: { scope: iti.id } })], ['Daily operations', () => openCanvas({ type: 'daily_operations', tab: 'attendance', filters: { scope: iti.id } })], ['Employer & placement view', () => openCanvas({ type: 'placement_pipeline', itiId: iti.id })], ['AOP allocation & releases', () => openCanvas({ type: 'budget_analytics', tab: 'overview', filters: { itiId: iti.id } })]].map(([l, fn]) => <li key={l} className="border-b border-bdr-light"><button onClick={fn} className="w-full flex items-center justify-between py-2 text-left hover:text-primary"><span className="font-semibold">{l}</span><span className="text-primary">→</span></button></li>)}
            </ul>
          </Section>
        </>)}
        {tab === 'overview' && role !== 'spv_ceo' && (<>
          <StatGrid>
            <Stat label="Active students" value={students.registryConnected ? students.active.toLocaleString('en-IN') : '—'} sub={students.registryConnected ? `${students.women} women · ${students.pwd} PwD · open roster` : 'registry not connected'} tone="indigo" onClick={() => openCanvas({ type: 'batches', itiId: iti.id })} />
            <Stat label="Annual places (Y1)" value={iti.seatCapacity} sub={`baseline enrolments ${iti.baselineSeats}`} tone="sky" />
            <Stat label="Trainers" value={`${staffing.registryTrainers || '—'}`} sub={`baseline ${staffing.baseline} · Y1 plan ${staffing.plan.Y1} · registry`} tone="emerald" onClick={() => setTab('staffing')} />
            <Stat label="Rooms working" value={`${iti.roomsWorking}/${iti.roomsBaseline}`} sub={`Y5 target ${iti.roomsY5}`} tone="amber" />
            <Stat label="Annual budget (Y1)" value={fmtCr(budget.reduce((s, p) => s + (p.yearly[1] || 0), 0))} sub={`of ${fmtCr(iti.fiveYearCr)} over five years · open AOP`} tone="violet" onClick={() => openCanvas({ type: 'annual_plan', itiId: iti.id })} />
            <Stat label="Year-1 tasks" value={`${tasks.filter(t => ['completed', 'reviewed'].includes(t.state)).length}/${tasks.length}`} sub={`${tasks.filter(t => t.overdue).length} overdue`} tone={tasks.some(t => t.overdue) ? 'rose' : 'teal'} onClick={() => openCanvas({ type: 'annual_plan', itiId: iti.id })} />
            <Stat label="Launch gates" value={`${gates.filter(g => g.state === 'passed').length}/${gates.length}`} sub={`${gates.filter(g => g.state === 'ready').length} ready`} tone="teal" onClick={() => setTab('launch_gates')} />
            <Stat label="Principal" value={iti.principal?.name || '—'} sub={`${iti.kind === 'hub' ? 'Hub' : 'Spoke'} · PR-${iti.code}`} tone="slate" />
          </StatGrid>
          {!iti.registryConnected && <NoFeed>Student and trainer figures for {iti.name} come from the plan only. The registry connection milestone is due 31 Dec; until then operations dashboards show "no feed".</NoFeed>}
          <Section tone="sky" title="Sources" hint="Where each tab's values come from.">
            <ul className="text-[12px] space-y-1 text-txt-secondary"><li><b>Budgets</b> — SIP section 7 ITI envelope, derived package allocation (66 packages cluster-wide).</li><li><b>Staff and rooms</b> — planning values; confirm against the sanctioned strength.</li><li><b>Intake</b> — course annual plan (places, enrolments by period); actual Year-1 enrolments from the registry where connected.</li><li><b>Gates</b> — one row per prerequisite per new offering (space, staff, course route, students).</li></ul>
          </Section>
        </>)}
        {tab === 'trades' && <TradeOfferings trades={trades} otherTrades={otherTrades} kb={kb} facilities={facilities} iti={iti} periods={periods} facilityPick={facilityPick} onClearPick={() => setFacilityPick(null)} onOpen={setCourse} />}
        {tab === 'staffing' && (<>
          <StatGrid>
            <Stat label="Trainers in registry" value={nil(staffing.registryTrainers || null)} sub={iti.registryConnected ? 'faculty file' : 'no feed'} tone="indigo" />
            <Stat label="With assignments" value={nil(staffing.assignedTrainers || null)} sub={`${staffing.leads} batch leads`} tone="emerald" />
            <Stat label="Baseline" value={staffing.baseline} tone="slate" />
            <Stat label="Plan Y1 → Y5" value={`${staffing.plan.Y1} → ${staffing.plan.Y5}`} sub="planning values" tone="amber" />
          </StatGrid>
          <Section tone="rose" title="Trainers by programme" hint="Count of faculty records per programme; adequacy not validated.">
            {Object.keys(staffing.byProgramme).length === 0 ? <NoFeed /> : <div className="flex flex-wrap gap-2">{Object.entries(staffing.byProgramme).sort((a, b) => b[1] - a[1]).map(([p, n]) => <span key={p} className="text-[11px] rounded-pill bg-surface-page px-2.5 py-1"><b>{p}</b> · {n}</span>)}</div>}
          </Section>
          <Section tone="teal" title="Trainer plan by year"><div className="grid grid-cols-5 gap-2">{['Y1', 'Y2', 'Y3', 'Y4', 'Y5'].map(y => <div key={y} className="rounded-xl bg-surface-page p-2 text-center"><div className="text-[10px] text-txt-tertiary">{y}</div><div className="text-[16px] font-bold">{staffing.plan[y]}</div></div>)}</div></Section>
        </>)}
        {tab === 'infrastructure' && <FacilitiesDirectory facilities={facilities} iti={iti} infrastructure={infrastructure} onOpen={setFacility} openCanvas={openCanvas} />}
        {tab === 'budget' && (<>
          <StatGrid>
            <Stat label="Five-year anchor" value={fmtCr(targets.fiveYearCr)} tone="indigo" />
            <Stat label="Planned (packages)" value={fmtCr(targets.plannedCr)} sub={Math.abs(targets.plannedCr - targets.fiveYearCr) < 0.05 ? 'reconciles to anchor' : 'check difference'} tone="emerald" />
            <Stat label="Year-1" value={fmtCr(budget.reduce((s, p) => s + (p.yearly[1] || 0), 0))} sub={`spent ${fmtCr(budget.reduce((s, p) => s + p.aops.filter(a => a.year === 1).reduce((x, a) => x + a.spentCr, 0), 0))}`} tone="amber" />
            <Stat label="Packages" value={budget.length} sub={`${budget.filter(p => p.expenditureType === 'CapEx').length} CapEx`} tone="sky" />
          </StatGrid>
          <Section tone="fuchsia" title="Work packages" hint="Task budgets are never added; money sits on the package and its annual AOP record.">
            <Table tone="fuchsia" columns={[
              { key: 'id', label: 'Package', render: r => <div><div className="font-semibold">{r.id} · {r.title}</div><div className="text-[10px] text-txt-tertiary">{r.category} · {r.expenditureType} · {r.courseScope}</div></div> },
              { key: 'totalCr', label: 'Total', align: 'right', render: r => fmtCr(r.totalCr) },
              ...[1, 2, 3, 4, 5].map(y => ({ key: `y${y}`, label: `Y${y}`, align: 'right', render: r => r.yearly[y] ? r.yearly[y].toFixed(2) : '·' })),
              { key: 'aop', label: 'Y1 AOP', render: r => { const a = r.aops.find(x => x.year === 1); return a ? <div className="min-w-[110px]"><Bar pct={a.budgetCr ? 100 * a.spentCr / a.budgetCr : 0} label={`${a.spentCr.toFixed(2)} / ${a.budgetCr.toFixed(2)}`} /></div> : '—' } },
            ]} rows={budget} />
          </Section>
        </>)}
        {tab === 'targets' && (<>
          <Section tone="indigo" title="KPI targets the institute contributes to" hint="Cluster KPI plan: baseline and yearly targets; 'now' only where a source exists.">
            <Table tone="indigo" columns={[
              { key: 'code', label: 'KPI', render: r => <div><div className="font-semibold">{r.code} · {r.name}</div><div className="text-[10px] text-txt-tertiary">{r.unit}{r.ownerRole ? ` · owner ${r.ownerRole}` : ''}</div></div> },
              { key: 'baseline', label: 'Baseline', align: 'right', render: r => r1(r.baseline) ?? '—' },
              ...['Y1', 'Y2', 'Y3', 'Y4', 'Y5'].map(y => ({ key: y, label: y, align: 'right', render: r => r1(r.targets?.[y]) ?? '—' })),
              { key: 'current', label: 'Now', align: 'right', render: r => r.current == null ? <span className="text-txt-tertiary">—</span> : <b>{r1(r.current)}</b> },
            ]} rows={(data.kpis || []).filter(k => ['K01', 'K02', 'K03', 'K04', 'K05', 'K06', 'K07', 'K08', 'K09', 'K11'].includes(k.code))} />
          </Section>
          <Section tone="emerald" title="Institute anchors"><div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[12px]">{[['Five-year', fmtCr(targets.fiveYearCr)], ['Civil', fmtCr(targets.civilCr)], ['Digital', fmtCr(targets.digitalCr)], ['Trainers Y5', staffing.plan.Y5]].map(([l, v]) => <div key={l} className="rounded-xl bg-surface-page p-2.5"><div className="text-[10px] uppercase font-bold text-txt-tertiary">{l}</div><div className="text-[16px] font-bold">{v}</div></div>)}</div></Section>
          <Section tone="amber" title="Enrolment plan by course" hint="Planned enrolments per period (places in grey).">
            <Table tone="amber" columns={[{ key: 'trade', label: 'Course', render: r => r.trade.name }, ...periods.map((p, i) => ({ key: p, label: p, align: 'right', render: r => r.plans[i] ? <span>{r.plans[i].enrolments} <span className="text-txt-tertiary text-[10px]">/{r.plans[i].places}</span></span> : '—' }))]} rows={trades} />
          </Section>
        </>)}
        {tab === 'launch_gates' && (
          <Section tone="violet" title="Launch gates for new offerings" hint="No intake without all four: space, named staff, course route, students. Course gates follow the NCVET pipeline.">
            {gates.length === 0 ? <div className="text-[12px] text-txt-tertiary">No new offerings planned at this ITI.</div> : <Table tone="violet" columns={[
              { key: 'id', label: 'Gate', render: r => <div><div className="font-semibold">{r.offering.tradeId} · {r.prerequisite}</div><div className="text-[10px] text-txt-tertiary">{r.id} · before {r.beforeLaunch} · owner {r.ownerRole} · reviewer {r.reviewerRole}</div></div> },
              { key: 'evidence', label: 'Evidence', render: r => <span className="text-[11px]">{r.evidence}</span> },
              { key: 'state', label: 'State', render: r => <Pill kind={r.state === 'passed' ? 'ok' : r.state === 'ready' ? 'warn' : r.state === 'failed' ? 'bad' : 'info'}>{r.state}</Pill> },
              { key: 'act', label: '', align: 'right', render: r => canConfirm ? <div className="flex gap-1 justify-end">{r.state !== 'ready' && r.state !== 'passed' && <Btn small tone="ghost" onClick={() => gate(r, 'ready')}>Ready</Btn>}{r.state === 'ready' && <Btn small tone="ok" onClick={() => gate(r, 'passed')}>Pass</Btn>}</div> : null },
            ]} rows={gates} />}
          </Section>
        )}
      </div>
    </div>
  )
}

const KIND_LABEL = { existing_core: 'Long-term trade', new_specialist: 'New specialist programme', short_term: 'Short-term programme', aggregate: 'Portfolio' }
const offered = t => /Existing/i.test(t.launch || '')

export function TradeOfferings({ trades, otherTrades, kb, facilities, iti, periods, facilityPick, onClearPick, onOpen }) {
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('all')
  const [status, setStatus] = useState('all')
  const list = trades.filter(t => t.trade.kind !== 'aggregate')
    .filter(t => !facilityPick || facilityPick.linkedTrades.includes(t.trade.code))
    .filter(t => kind === 'all' || t.trade.kind === kind)
    .filter(t => status === 'all' || (status === 'offered' ? offered(t) : !offered(t)))
    .filter(t => !q || `${t.trade.name} ${t.trade.code}`.toLowerCase().includes(q.toLowerCase()))
  const planned = trades.filter(t => t.trade.kind !== 'aggregate' && !offered(t))
  return (
    <div className="space-y-4">
      {facilityPick && <div className="rounded-xl bg-primary-light/40 border border-primary/20 px-3 py-2 text-[12px] flex items-center gap-2"><span>Courses linked to <b>{facilityPick.name}</b></span><button className="ml-auto text-primary font-bold" onClick={onClearPick}>Show all courses</button></div>}
      <Section tone="sky" title="Trade offerings" hint="Programme details and linked training spaces. Tap a course for its profile.">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <label className="relative"><Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-txt-tertiary" /><input className={`${inputCls} pl-7 w-[200px]`} placeholder="Search courses" value={q} onChange={e => setQ(e.target.value)} /></label>
          <select className={inputCls + ' w-auto'} value={kind} onChange={e => setKind(e.target.value)}><option value="all">Programme type: All</option><option value="existing_core">Long-term trades</option><option value="new_specialist">New specialist</option><option value="short_term">Short-term</option></select>
          <select className={inputCls + ' w-auto'} value={status} onChange={e => setStatus(e.target.value)}><option value="all">Status: All</option><option value="offered">Offered</option><option value="planned">Planned</option></select>
        </div>
        <Table tone="sky" columns={[
          { key: 'name', label: 'Course', render: r => <button className="text-left hover:text-primary" onClick={() => onOpen(r)}><div className="font-semibold">{r.trade.name}</div><div className="text-[10px] text-txt-tertiary">Code: {r.trade.code} · NSQF {r.trade.nsqfLevel}</div></button> },
          { key: 'kind', label: 'Type', render: r => KIND_LABEL[r.trade.kind] || titleCase(r.trade.kind) },
          { key: 'status', label: 'Status', render: r => offered(r) ? <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Offered · Year-1 intake</span> : <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Planned · launch {r.launch}</span> },
          { key: 'y1', label: 'Y1 enrol / places', align: 'right', render: r => r.plans[1] ? `${r.plans[1].enrolments} / ${r.plans[1].places}` : '—' },
          { key: 'batches', label: 'Batches now', align: 'right', render: r => r.runningBatches ? `${r.runningBatches} (${r.enrolledNow})` : '—' },
          { key: 'open', label: '', align: 'right', render: r => <Btn small tone="ghost" onClick={() => onOpen(r)}>View details</Btn> },
        ]} rows={list} empty="No courses match." />
      </Section>
      {planned.length > 0 && !facilityPick && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5">
          <div className="text-[12px] font-bold text-txt-primary mb-1.5">Planned programmes</div>
          <ul className="space-y-1 text-[12px]">{planned.map(t => <li key={t.id} className="flex items-center gap-2 flex-wrap"><b>{t.trade.name}</b><Pill kind="warn">{KIND_LABEL[t.trade.kind]}</Pill><span className="text-txt-secondary">Launch {t.launch} · not open for Year-1 admission</span><button className="ml-auto text-primary font-bold" onClick={() => onOpen(t)}>View programme reference →</button></li>)}</ul>
        </div>
      )}
      {otherTrades.length > 0 && <Section tone="rose" title="Registry programmes counted under OTH" hint="Running batches in the registry that the SIP aggregates as 'other trades'."><div className="flex flex-wrap gap-2">{otherTrades.map(t => <span key={t.tradeId} className="text-[11px] rounded-pill bg-surface-page px-2.5 py-1"><b>{t.tradeId}</b> · {t.batches} batches · {t.enrolled} students</span>)}</div></Section>}
    </div>
  )
}

export function CourseDetail({ t, kb, facility, iti, periods, onBack, onBatches, onWorkshop }) {
  const tr = t.trade
  const dur = tr.durationUnit === 'hours' ? `${tr.durationValue} hours` : `${tr.durationValue} ${tr.durationUnit}`
  const isOffered = offered(t)
  return (
    <DetailPage onBack={onBack} eyebrow={`Course profile · ${iti.name}`} title={tr.name} id={`Course code · ${tr.code}`} sub={`${KIND_LABEL[tr.kind] || titleCase(tr.kind)} · NSQF level ${tr.nsqfLevel}`} pill={isOffered ? { kind: 'ok', label: 'Offered · Year-1 intake' } : { kind: 'warn', label: `Planned · ${t.launch}` }}>
      <DetailCard title="Course profile" icon="📘">
        <LabelGrid cols={2} items={[['Duration', dur], ['Total hours', tr.totalHours ? tr.totalHours.toLocaleString('en-IN') : '—'], ['Entry requirement', kb?.entryQualification || tr.entryAssumption || '—'], ['Practical focus', kb?.practicalFocus || tr.roleDirection || '—'], ['Sample project', kb?.sampleProject || '—'], ['Common tools', kb?.commonTools || '—'], ['Job family', kb?.jobFamily || tr.roleDirection || '—'], ['Fits a student who', kb?.fitPrompt || '—']]} />
      </DetailCard>
      <DetailCard title="Places and intake" icon="🎓">
        <Table tone="rose" columns={[{ key: 'period', label: 'Period' }, { key: 'places', label: 'Places', align: 'right' }, { key: 'enrolments', label: 'Planned enrolments', align: 'right' }, { key: 'actual', label: 'Actual', align: 'right', render: r => r.actual == null ? <span className="text-txt-tertiary">—</span> : <b className="text-emerald-700">{r.actual}</b> }]} rows={periods.map((p, i) => t.plans[i] ? { period: p, places: t.plans[i].places, enrolments: t.plans[i].enrolments, actual: p === 'Y1' ? t.actualY1 : null } : null).filter(Boolean)} />
        <div className="text-[12px] mt-3"><span className="text-txt-tertiary">Batches now: </span><b>{t.runningBatches ? `${t.runningBatches} batches · ${t.enrolledNow} students` : 'none running'}</b></div>
      </DetailCard>
      <DetailCard title="Training space" icon="🏭">
        <LabelGrid cols={2} items={[['Linked facility', facility ? facility.name : 'to be set up'], ['Facility status', facility ? (STATUS[facility.status]?.label || facility.status) : '—'], ['Space note', t.note || '—'], ['Launch gates', t.gates?.length ? `${t.gates.filter(g => g.state === 'passed').length} of ${t.gates.length} passed${t.gates.some(g => g.state === 'ready') ? ` · ${t.gates.filter(g => g.state === 'ready').length} ready` : ''}` : 'none required']]} />
      </DetailCard>
      <div className="flex gap-2 flex-wrap">{facility && <Btn tone="ghost" onClick={onWorkshop}>Open linked workshop</Btn>}{t.runningBatches > 0 && <Btn onClick={onBatches}>View batches in registry</Btn>}</div>
    </DetailPage>
  )
}

export function FacilitiesDirectory({ facilities, iti, infrastructure, onOpen, openCanvas }) {
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('all')
  const [sharing, setSharing] = useState('all')
  const list = facilities.filter(f => kind === 'all' || f.kind === kind).filter(f => sharing === 'all' || (sharing === 'shared' ? /Shared|shared/.test(f.sharing) : !/Shared|shared/.test(f.sharing))).filter(f => !q || `${f.name} ${f.purpose} ${f.linkedTrades.join(' ')}`.toLowerCase().includes(q.toLowerCase()))
  const down = infrastructure.machines.filter(m => m.status === 'non_functional').length
  return (
    <div className="space-y-4">
      <StatGrid>
        <Stat label="Workshops and labs" value={facilities.filter(f => f.kind !== 'space').length} sub={`${facilities.filter(f => f.kind !== 'space' && f.status === 'being_set_up').length} being set up`} tone="indigo" />
        <Stat label="Rooms working" value={`${iti.roomsWorking}/${iti.roomsBaseline}`} sub={`Year-5 target ${iti.roomsY5}`} tone={iti.roomsWorking < iti.roomsBaseline ? 'amber' : 'emerald'} />
        <Stat label="Machines functional" value={`${infrastructure.machines.filter(m => ['functional', 'installed'].includes(m.status)).length}/${infrastructure.machines.length}`} sub={down ? `${down} not functional` : 'all working'} tone={down ? 'rose' : 'emerald'} onClick={() => openCanvas({ type: 'machines_infra', itiId: iti.id })} />
        <Stat label="Works on campus" value={facilities.filter(f => f.kind === 'space').length} sub={`${facilities.filter(f => f.status === 'delayed').length} delayed`} tone="amber" onClick={() => openCanvas({ type: 'civil_works', itiId: iti.id })} />
      </StatGrid>
      <Section tone="teal" title="Facility directory" hint="Workshops, labs and spaces, with the courses that use them. Tap a facility for its details.">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <label className="relative"><Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-txt-tertiary" /><input className={`${inputCls} pl-7 w-[200px]`} placeholder="Search facilities" value={q} onChange={e => setQ(e.target.value)} /></label>
          <select className={inputCls + ' w-auto'} value={kind} onChange={e => setKind(e.target.value)}><option value="all">Facility type: All</option><option value="workshop">Workshops</option><option value="lab">Labs</option><option value="space">Spaces and works</option></select>
          <select className={inputCls + ' w-auto'} value={sharing} onChange={e => setSharing(e.target.value)}><option value="all">Sharing: All</option><option value="shared">Shared</option><option value="institute">Institute only</option></select>
        </div>
        <Table tone="teal" columns={[
          { key: 'name', label: 'Facility', render: r => <button className="text-left hover:text-primary" onClick={() => onOpen(r)}><div className="font-semibold">{r.name}</div><div className="text-[10px] text-txt-tertiary">{KIND[r.kind]} · {r.location}</div></button> },
          { key: 'purpose', label: 'Purpose', render: r => <span className="text-[11px]">{r.purpose}</span> },
          { key: 'trades', label: 'Courses', render: r => <span className="text-[11px]">{r.linkedTrades.length ? r.linkedTrades.join(', ') : '—'}</span> },
          { key: 'status', label: 'Status', render: r => <Pill kind={STATUS[r.status]?.kind || 'neutral'}>{STATUS[r.status]?.label || r.status}</Pill> },
          { key: 'open', label: '', align: 'right', render: r => <Btn small tone="ghost" onClick={() => onOpen(r)}>Details</Btn> },
        ]} rows={list} empty="No facilities match." />
      </Section>
    </div>
  )
}

export function FacilityDetail({ f, trades, iti, onBack, onCourses, onMachines }) {
  const st = STATUS[f.status] || { kind: 'neutral', label: f.status }
  const courseNames = f.linkedTrades.map(c => trades.find(t => t.trade.code === c)?.trade.name || c)
  return (
    <DetailPage onBack={onBack} eyebrow={`${KIND[f.kind]} · ${iti.name}`} title={f.name} id={f.packageId ? `Package · ${f.packageId}` : `Facility · ${f.id}`} sub={`${f.location} · ${f.sharing}`} pill={st}>
      <DetailCard title="Purpose and use" icon="🧭">
        <LabelGrid cols={2} items={[['Purpose', f.purpose], ['Relevant for', courseNames.length ? courseNames.join(', ') : 'All courses'], ['Shared access', f.sharing], ['Location', f.location], ...(f.budgetCr != null ? [['Package value', fmtCr(f.budgetCr)]] : []), ...(f.procurementState ? [['Procurement', titleCase(f.procurementState)]] : []), ...(f.scheduledCompletion ? [['Scheduled completion', fmtDate(f.scheduledCompletion)]] : [])]} />
        {f.progressPct != null && f.kind !== 'workshop' && <div className="mt-3"><Bar pct={f.progressPct} label={`${f.progressPct}% ${f.kind === 'space' ? 'built' : 'set up'}`} tone={f.status === 'delayed' ? 'rose' : 'auto'} /></div>}
      </DetailCard>
      <DetailCard title="Equipment" icon="⚙️">
        {f.machines ? (<>
          <div className="text-[12px] mb-2 font-semibold">{f.machines.functional} of {f.machines.total} functional{f.machines.nonFunctional ? <span className="text-rose-700"> · {f.machines.nonFunctional} not functional</span> : ''}{f.machines.awaiting ? ` · ${f.machines.awaiting} awaiting commissioning` : ''}{f.machines.ordered ? ` · ${f.machines.ordered} ordered` : ''}</div>
          <Table tone="teal" columns={[{ key: 'name', label: 'Machine', render: r => <span className={r.status === 'non_functional' ? 'text-rose-700 font-semibold' : 'font-semibold'}>{r.name}</span> }, { key: 'status', label: 'Status', render: r => <Pill kind={r.status === 'non_functional' ? 'bad' : ['functional', 'installed'].includes(r.status) ? 'ok' : 'info'}>{titleCase(r.status)}</Pill> }]} rows={f.machines.items} />
        </>) : <div className="text-[12px] text-txt-secondary">Equipment arrives with the package; machines appear on the register once commissioned.</div>}
      </DetailCard>
      <div className="flex gap-2 flex-wrap">{f.machines && <Btn tone="ghost" onClick={onMachines}>Open machine register</Btn>}{f.linkedTrades.length > 0 && <Btn onClick={onCourses}>View linked courses</Btn>}</div>
    </DetailPage>
  )
}

