// Institute profile (Module A) — the seven tabs the PRD asks each principal
// to confirm: overview, trades, staffing, infrastructure, budget, targets,
// launch gates. Every tab says where its values come from.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Bar, Pill, Section, Table, Loading, Btn, useLoad, Tabs, fmtCr, fmtDate, nil, stateKind, titleCase, NoFeed } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

const TABS = [{ id: 'overview', label: 'Overview' }, { id: 'trades', label: 'Trades & intake' }, { id: 'staffing', label: 'Staffing' }, { id: 'infrastructure', label: 'Infrastructure' }, { id: 'budget', label: 'Budget' }, { id: 'targets', label: 'Targets' }, { id: 'launch_gates', label: 'Launch gates' }]

export default function InstituteProfileCanvas({ context }) {
  const { role, showToast, openCanvas } = useApp()
  const { data: itis } = useLoad(() => api.itis())
  const [code, setCode] = useState(context?.itiCode || 'mine')
  const [tab, setTab] = useState(context?.tab || 'overview')
  const { data, reload } = useLoad(() => api.itiProfile(code), [code])
  useSaathiContext(data ? `ITI ${data.iti.name} (${data.iti.kind}; registry ${data.iti.registryConnected ? 'connected' : 'not connected'}). Profile tabs: ${Object.entries(data.iti.profileSections || {}).map(([k, v]) => `${k}=${v.state}`).join(', ')}. Students ${data.students.active} (${data.students.women} women, ${data.students.pwd} PwD). Trainers in registry ${data.staffing.registryTrainers}, assigned ${data.staffing.assignedTrainers}, baseline ${data.staffing.baseline}, plan ${JSON.stringify(data.staffing.plan)}. Rooms ${data.infrastructure.rooms.working}/${data.infrastructure.rooms.baseline} (Y5 ${data.infrastructure.rooms.y5}); machines ${data.infrastructure.machines.length}; civil ${data.infrastructure.civil.map(w => `${w.packageId} ${w.pctComplete}% ${w.state}`).join(', ')}. Budget: ${data.budget.length} packages ₹${data.targets.plannedCr} Cr vs anchor ₹${data.targets.fiveYearCr} Cr (civil ₹${data.targets.civilCr} Cr, digital ₹${data.targets.digitalCr} Cr). Offerings: ${data.trades.map(t => `${t.trade.code} launch ${t.launch}, Y1 ${t.plans[1]?.enrolments ?? '—'}/${t.plans[1]?.places ?? '—'} actual ${t.actualY1 ?? '—'}, batches ${t.runningBatches}`).join('; ')}. Gates ${data.gates.filter(g => g.state === 'passed').length}/${data.gates.length} passed (${data.gates.filter(g => g.state === 'ready').length} ready). Year-1 tasks: ${data.tasks.map(t => `${t.id} ${t.title} [${t.state}${t.overdue ? ', OVERDUE ' + t.slipDays + 'd' : ''}; due ${String(t.dueAt).slice(0, 10)}; owner ${t.responsibleRole}]`).join('; ')}.` : '', ['Which profile tabs are still draft and what do they need?', 'Which launch gates are closest to ready?', 'What is overdue at this ITI and who owns it?', 'Summarise this ITI in five lines for the SPV board.'])
  if (!data) return <Loading />
  const { iti, students, trades, otherTrades, staffing, infrastructure, budget, targets, gates, tasks } = data
  const sec = iti.profileSections || {}
  const state = sec[tab]?.state || 'draft'
  const canSwitch = role !== 'iti_principal' && role !== 'trainer'
  const canConfirm = role === 'iti_principal' || role === 'spv_ceo'
  async function confirm(st) { await api.confirmProfileTab(iti.code, tab, st); showToast({ kind: 'success', text: `${TABS.find(t => t.id === tab).label}: ${st}` }); reload() }
  async function gate(g, st) { await api.gateState(g.id, st); showToast({ kind: 'success', text: `${g.id} → ${st}` }); reload() }
  const periods = ['Baseline', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5']
  const confirmedCount = Object.values(sec).filter(s => s.state === 'confirmed').length

  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="violet" eyebrow={`${iti.kind === 'hub' ? 'Hub' : 'Spoke'} · ${iti.district} · ${iti.registryConnected ? 'registry connected' : 'no registry feed'}`} title={iti.name} subtitle={`${iti.sectorFocus} · ₹${iti.fiveYearCr} Cr over five years · ${confirmedCount} of 7 profile tabs confirmed`}
        right={canSwitch && itis ? <select value={code} onChange={e => { setCode(e.target.value) }} className="text-[12px] rounded-lg border border-bdr px-2 py-1.5 bg-white">{itis.itis.map(i => <option key={i.id} value={i.code}>{i.name}</option>)}</select> : null} />
      <Tabs tabs={TABS.map(t => ({ ...t, badge: sec[t.id]?.state === 'confirmed' ? '✓' : null }))} active={tab} onChange={setTab}
        right={<div className="flex items-center gap-2"><Pill kind={state === 'confirmed' ? 'ok' : 'warn'}>{state}{sec[tab]?.confirmedAt ? ` · ${fmtDate(sec[tab].confirmedAt)}` : ''}</Pill>{canConfirm && (state === 'confirmed' ? <Btn small tone="ghost" onClick={() => confirm('draft')}>Reopen</Btn> : <Btn small tone="ok" onClick={() => confirm('confirmed')}>Confirm tab</Btn>)}</div>} />
      <div className="p-4 space-y-4">
        {tab === 'overview' && (<>
          <StatGrid>
            <Stat label="Active students" value={students.registryConnected ? students.active.toLocaleString('en-IN') : '—'} sub={students.registryConnected ? `${students.women} women · ${students.pwd} PwD` : 'registry not connected'} tone="indigo" />
            <Stat label="Annual places (Y1)" value={iti.seatCapacity} sub={`baseline enrolments ${iti.baselineSeats}`} tone="sky" />
            <Stat label="Trainers" value={`${staffing.registryTrainers || '—'}`} sub={`baseline ${staffing.baseline} · Y1 plan ${staffing.plan.Y1}`} tone="emerald" />
            <Stat label="Rooms working" value={`${iti.roomsWorking}/${iti.roomsBaseline}`} sub={`Y5 target ${iti.roomsY5}`} tone="amber" />
            <Stat label="Five-year anchor" value={fmtCr(iti.fiveYearCr)} sub={`civil ${fmtCr(iti.civilCr)} · digital ${fmtCr(iti.digitalCr)}`} tone="violet" />
            <Stat label="Year-1 tasks" value={`${tasks.filter(t => ['completed', 'reviewed'].includes(t.state)).length}/${tasks.length}`} sub={`${tasks.filter(t => t.overdue).length} overdue`} tone={tasks.some(t => t.overdue) ? 'rose' : 'teal'} onClick={() => openCanvas({ type: 'annual_plan', itiId: iti.id })} />
            <Stat label="Launch gates" value={`${gates.filter(g => g.state === 'passed').length}/${gates.length}`} sub={`${gates.filter(g => g.state === 'ready').length} ready`} tone="teal" onClick={() => setTab('launch_gates')} />
            <Stat label="Principal" value={iti.kind === 'hub' ? 'Hub' : 'Spoke'} sub={sec.overview?.by || `PR-${iti.code}`} tone="slate" />
          </StatGrid>
          {!iti.registryConnected && <NoFeed>Student and trainer figures for {iti.name} come from the plan only. The registry connection milestone is due 31 Dec; until then operations dashboards show "no feed".</NoFeed>}
          <Section title="Sources" hint="Where each tab's values come from.">
            <ul className="text-[12px] space-y-1 text-txt-secondary"><li><b>Budgets</b> — SIP section 7 ITI envelope, derived package allocation (66 packages cluster-wide).</li><li><b>Staff and rooms</b> — synthetic planning values; confirm against the sanctioned strength.</li><li><b>Intake</b> — course annual plan (places, enrolments by period); actual Year-1 enrolments from the registry where connected.</li><li><b>Gates</b> — one row per prerequisite per new offering (space, staff, course route, students).</li></ul>
          </Section>
        </>)}
        {tab === 'trades' && (<>
          <Section title="SIP offerings" hint="Places and planned enrolments by period; Y1 actual from the registry where connected.">
            <Table columns={[
              { key: 'trade', label: 'Course', render: r => <div><div className="font-semibold">{r.trade.name}</div><div className="text-[10px] text-txt-tertiary">{r.trade.code} · {titleCase(r.trade.kind)} · launch {r.launch}</div></div> },
              ...periods.map((p, i) => ({ key: p, label: p, align: 'right', render: r => r.plans[i] ? <span>{r.plans[i].enrolments}<span className="text-txt-tertiary">/{r.plans[i].places}</span></span> : '—' })),
              { key: 'actualY1', label: 'Y1 actual', align: 'right', render: r => r.actualY1 == null ? <span className="text-txt-tertiary">—</span> : <b>{r.actualY1}</b> },
              { key: 'running', label: 'Batches now', align: 'right', render: r => r.runningBatches ? `${r.runningBatches} (${r.enrolledNow})` : '—' },
              { key: 'gates', label: 'Gates', render: r => r.gates.length ? <Pill kind={r.gates.every(g => g.state === 'passed') ? 'ok' : r.gates.some(g => g.state === 'ready') ? 'warn' : 'info'}>{r.gates.filter(g => g.state === 'passed').length}/{r.gates.length}</Pill> : <span className="text-txt-tertiary">existing</span> },
            ]} rows={trades} />
          </Section>
          {otherTrades.length > 0 && <Section title="Registry programmes counted under OTH" hint="Running batches in the registry that the SIP aggregates as 'other trades'.">
            <div className="flex flex-wrap gap-2">{otherTrades.map(t => <span key={t.tradeId} className="text-[11px] rounded-pill bg-surface-page px-2.5 py-1"><b>{t.tradeId}</b> · {t.batches} batches · {t.enrolled} students</span>)}</div>
          </Section>}
        </>)}
        {tab === 'staffing' && (<>
          <StatGrid>
            <Stat label="Trainers in registry" value={nil(staffing.registryTrainers || null)} sub={iti.registryConnected ? 'faculty file' : 'no feed'} tone="indigo" />
            <Stat label="With assignments" value={nil(staffing.assignedTrainers || null)} sub={`${staffing.leads} batch leads`} tone="emerald" />
            <Stat label="Baseline" value={staffing.baseline} tone="slate" />
            <Stat label="Plan Y1 → Y5" value={`${staffing.plan.Y1} → ${staffing.plan.Y5}`} sub="synthetic planning values" tone="amber" />
          </StatGrid>
          <Section title="Trainers by programme" hint="Count of faculty records per programme; adequacy not validated.">
            {Object.keys(staffing.byProgramme).length === 0 ? <NoFeed /> : <div className="flex flex-wrap gap-2">{Object.entries(staffing.byProgramme).sort((a, b) => b[1] - a[1]).map(([p, n]) => <span key={p} className="text-[11px] rounded-pill bg-surface-page px-2.5 py-1"><b>{p}</b> · {n}</span>)}</div>}
          </Section>
          <Section title="Trainer plan by year"><div className="grid grid-cols-5 gap-2">{['Y1', 'Y2', 'Y3', 'Y4', 'Y5'].map(y => <div key={y} className="rounded-xl bg-surface-page p-2 text-center"><div className="text-[10px] text-txt-tertiary">{y}</div><div className="text-[16px] font-bold">{staffing.plan[y]}</div></div>)}</div></Section>
        </>)}
        {tab === 'infrastructure' && (<>
          <StatGrid>
            <Stat label="Rooms baseline" value={infrastructure.rooms.baseline} tone="slate" />
            <Stat label="Rooms working" value={infrastructure.rooms.working} tone={infrastructure.rooms.working < infrastructure.rooms.baseline ? 'amber' : 'emerald'} />
            <Stat label="Rooms Y5" value={infrastructure.rooms.y5} tone="indigo" />
            <Stat label="Machines" value={infrastructure.machines.length} sub={`${infrastructure.machines.filter(m => m.status === 'functional').length} functional`} tone="teal" onClick={() => openCanvas({ type: 'machines_infra', itiId: iti.id })} />
          </StatGrid>
          <Section title="Civil packages at this ITI" right={<button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'civil_works' })}>Civil works →</button>}>
            {infrastructure.civil.map(w => <div key={w.id} className="mb-2"><div className="flex justify-between text-[12px]"><span className="font-semibold">{w.packageId} · {w.title}</span><Pill kind={stateKind(w.state)}>{w.state.replace(/_/g, ' ')}</Pill></div><Bar pct={w.pctComplete} tone={w.state === 'delayed' ? 'rose' : 'auto'} /><div className="text-[10px] text-txt-tertiary">{fmtCr(w.budgetCr)} · {w.unitsAccepted}/{w.workUnits} work units accepted · due {fmtDate(w.scheduledCompletion)}</div></div>)}
          </Section>
          <Section title="Machines"><Table columns={[{ key: 'name', label: 'Asset' }, { key: 'trade', label: 'Trade', render: r => r.trade?.code || '—' }, { key: 'status', label: 'Status', render: r => <Pill kind={stateKind(r.status)}>{titleCase(r.status)}</Pill> }, { key: 'source', label: 'Source', render: r => titleCase(r.source) }, { key: 'packageId', label: 'Package', render: r => r.packageId || '—' }]} rows={infrastructure.machines} /></Section>
        </>)}
        {tab === 'budget' && (<>
          <StatGrid>
            <Stat label="Five-year anchor" value={fmtCr(targets.fiveYearCr)} tone="indigo" />
            <Stat label="Planned (packages)" value={fmtCr(targets.plannedCr)} sub={Math.abs(targets.plannedCr - targets.fiveYearCr) < 0.05 ? 'reconciles to anchor' : 'check difference'} tone="emerald" />
            <Stat label="Year-1" value={fmtCr(budget.reduce((s, p) => s + (p.yearly[1] || 0), 0))} sub={`spent ${fmtCr(budget.reduce((s, p) => s + p.aops.filter(a => a.year === 1).reduce((x, a) => x + a.spentCr, 0), 0))}`} tone="amber" />
            <Stat label="Packages" value={budget.length} sub={`${budget.filter(p => p.expenditureType === 'CapEx').length} CapEx`} tone="sky" />
          </StatGrid>
          <Section title="Work packages" hint="Task budgets are never added; money sits on the package and its annual AOP record.">
            <Table columns={[
              { key: 'id', label: 'Package', render: r => <div><div className="font-semibold">{r.id} · {r.title}</div><div className="text-[10px] text-txt-tertiary">{r.category} · {r.expenditureType} · {r.courseScope}</div></div> },
              { key: 'totalCr', label: 'Total', align: 'right', render: r => fmtCr(r.totalCr) },
              ...[1, 2, 3, 4, 5].map(y => ({ key: `y${y}`, label: `Y${y}`, align: 'right', render: r => r.yearly[y] ? r.yearly[y].toFixed(2) : '·' })),
              { key: 'aop', label: 'Y1 AOP', render: r => { const a = r.aops.find(x => x.year === 1); return a ? <div className="min-w-[110px]"><Bar pct={a.budgetCr ? 100 * a.spentCr / a.budgetCr : 0} label={`${a.spentCr.toFixed(2)} / ${a.budgetCr.toFixed(2)}`} /></div> : '—' } },
            ]} rows={budget} />
          </Section>
        </>)}
        {tab === 'targets' && (<>
          <Section title="Enrolment plan by course" hint="Planned enrolments per period (places in grey).">
            <Table columns={[{ key: 'trade', label: 'Course', render: r => r.trade.name }, ...periods.map((p, i) => ({ key: p, label: p, align: 'right', render: r => r.plans[i] ? <span>{r.plans[i].enrolments} <span className="text-txt-tertiary text-[10px]">/{r.plans[i].places}</span></span> : '—' }))]} rows={trades} />
          </Section>
          <Section title="Institute anchors"><div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[12px]">{[['Five-year', fmtCr(targets.fiveYearCr)], ['Civil', fmtCr(targets.civilCr)], ['Digital', fmtCr(targets.digitalCr)], ['Trainers Y5', staffing.plan.Y5]].map(([l, v]) => <div key={l} className="rounded-xl bg-surface-page p-2.5"><div className="text-[10px] uppercase font-bold text-txt-tertiary">{l}</div><div className="text-[16px] font-bold">{v}</div></div>)}</div><div className="mt-2"><button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'five_year_targets' })}>Cluster five-year targets and KPIs →</button></div></Section>
        </>)}
        {tab === 'launch_gates' && (
          <Section title="Launch gates for new offerings" hint="No intake without all four: space, named staff, course route, students. Course gates follow the NCVET pipeline.">
            {gates.length === 0 ? <div className="text-[12px] text-txt-tertiary">No new offerings planned at this ITI.</div> : <Table columns={[
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
