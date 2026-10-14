// Annual plan (Module A) — Workplan (AOP records with their tasks) and
// Calendar (tasks by quarter), filtered by ITI and category. The CEO assigns
// tasks to principals from here (top-left); principals update task state
// with evidence; reviewers accept or return.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Bar, Pill, Section, Table, Loading, Btn, useLoad, Tabs, Chips, fmtCr, fmtDate, stateKind, Field, inputCls } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'
import AssignTaskForm, { AssignTaskToggle, AskStatusBox } from './_AssignTask.jsx'

const TASK_STATES = ['planned', 'in_progress', 'blocked', 'reported_complete', 'completed', 'reviewed', 'returned']

// What the CEO reads on a card: who holds the task and where its evidence is.
export function stageOf(t) {
  if (t.state === 'reviewed' || t.state === 'completed') return { label: 'Done', kind: 'ok' }
  if (t.state === 'reported_complete') return { label: 'Evidence submitted · awaiting review', kind: 'info' }
  if (t.state === 'returned') return { label: 'Evidence returned · resubmit', kind: 'bad' }
  if (t.state === 'blocked') return { label: 'Blocked', kind: 'warn' }
  if (t.overdue) return { label: 'Evidence missing · overdue', kind: 'bad' }
  if (t.state === 'in_progress') return { label: t.evidenceNote ? 'In progress · evidence noted' : 'In progress · evidence awaited', kind: 'info' }
  return { label: 'Assigned · not started', kind: 'neutral' }
}

export function TaskCard({ t, role, onChanged, compact }) {
  const { showToast } = useApp()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [forecast, setForecast] = useState('')
  const [asking, setAsking] = useState(false)
  const stage = stageOf(t)
  const canEdit = role === 'iti_principal' || role === 'trainer' || role === 'spv_ceo'
  const canReview = role === 'spv_ceo' || role === 'ima_officer' || (role === 'iti_principal' && t.reviewerRole?.startsWith('PR-'))
  async function set(state) {
    try { await api.taskUpdate(t.id, { state, evidenceNote: note || undefined, forecastAt: forecast || undefined, blockedReason: state === 'blocked' ? (note || 'Blocked — see note') : undefined }); showToast({ kind: 'success', text: `${t.id} → ${state.replace(/_/g, ' ')}` }); setNote(''); onChanged?.() }
    catch (e) { showToast({ kind: 'danger', text: e.message }) }
  }
  async function review(decision) { await api.taskReview(t.id, { decision, note: note || undefined }); showToast({ kind: 'success', text: decision === 'accept' ? 'Accepted' : 'Returned' }); setNote(''); onChanged?.() }
  return (
    <div className={`rounded-xl border ${t.overdue ? 'border-rose-200 bg-rose-50/30' : t.state === 'blocked' ? 'border-amber-300 bg-amber-50/40' : 'border-bdr-light bg-white'} p-2.5`}>
      <button onClick={() => setOpen(o => !o)} className="w-full text-left">
        <div className="flex items-center gap-2 flex-wrap"><span className="text-[10px] font-bold text-primary">{t.id}</span><Pill kind={stage.kind}>{stage.label}</Pill>{t.overdue && <Pill kind="bad">overdue {t.slipDays}d</Pill>}{t.forecastAt && <span className="text-[10px] text-amber-700 font-bold">forecast {fmtDate(t.forecastAt)}</span>}</div>
        <div className="text-[12px] font-bold text-txt-primary mt-0.5">{t.title}</div>
        <div className="text-[10px] text-txt-secondary">{t.quarter} · due {fmtDate(t.dueAt)} · assigned to {t.responsibleRole.startsWith('PR-') ? `principal (${t.responsibleRole})` : t.responsibleRole} · reviewer {t.reviewerRole}{t.category ? ` · ${t.category}` : ''}{t.predecessorId ? ` · after ${t.predecessorId}` : ''}</div>
        {t.blockedReason && <div className="text-[11px] text-amber-800 mt-1">Blocked: {t.blockedReason}</div>}
        {t.reviewNote && t.state === 'returned' && <div className="text-[11px] text-rose-700 mt-1">Returned: {t.reviewNote}</div>}
      </button>
      {open && !compact && (
        <div className="mt-2 pt-2 border-t border-bdr-light space-y-2 text-[11px]">
          <div><b>Evidence expected:</b> {t.evidence}</div><div><b>Acceptance:</b> {t.acceptance}</div>
          {t.evidenceNote && <div className="rounded-lg bg-surface-page p-2"><b>Evidence note:</b> {t.evidenceNote}{t.lastUpdateAt ? ` · ${fmtDate(t.lastUpdateAt)} by ${t.updatedByRole}` : ''}</div>}
          {(canEdit || canReview) && <textarea value={note} onChange={e => setNote(e.target.value)} placeholder={canReview && t.state === 'reported_complete' ? 'Review note' : 'Evidence note / reason (required to report complete)'} className={inputCls} rows={2} />}
          {canEdit && !['reviewed'].includes(t.state) && (
            <div className="flex gap-1.5 flex-wrap items-center">
              {t.state !== 'in_progress' && t.state !== 'reported_complete' && <Btn small tone="ghost" onClick={() => set('in_progress')}>Start</Btn>}
              {t.state !== 'blocked' && t.state !== 'reported_complete' && <Btn small tone="amber" onClick={() => set('blocked')}>Blocked</Btn>}
              {t.state !== 'reported_complete' && t.state !== 'completed' && <Btn small onClick={() => set('reported_complete')}>Report complete</Btn>}
              <input type="date" value={forecast} onChange={e => setForecast(e.target.value)} className="text-[11px] rounded-lg border border-bdr px-2 py-1 bg-white" title="Forecast date" />
              {forecast && <Btn small tone="ghost" onClick={() => set(t.state === 'planned' ? 'in_progress' : t.state)}>Save forecast</Btn>}
            </div>
          )}
          {canReview && t.state === 'reported_complete' && <div className="flex gap-1.5"><Btn small tone="ok" onClick={() => review('accept')}>Accept</Btn><Btn small tone="danger" onClick={() => review('return')}>Return</Btn></div>}
          {role === 'spv_ceo' && !['reviewed', 'completed'].includes(t.state) && (asking
            ? <AskStatusBox placeholder="What do you want to know about this task?" onCancel={() => setAsking(false)} onSend={async q => { await api.taskAsk(t.id, q); showToast({ kind: 'success', text: 'Sent to the principal.' }); setAsking(false) }} />
            : <button onClick={() => setAsking(true)} className="text-primary font-bold">Ask the principal for the current status →</button>)}
        </div>
      )}
    </div>
  )
}

export default function AnnualPlanCanvas({ context }) {
  const { role, meExtra, openCanvas } = useApp()
  const { data: itis } = useLoad(() => api.itis())
  const [itiId, setItiId] = useState(context?.itiId || (role === 'iti_principal' ? meExtra?.iti?.id : '') || '')
  const [tab, setTab] = useState(context?.tab === 'calendar' ? 'calendar' : 'workplan')
  const [cat, setCat] = useState('all')
  const [assigning, setAssigning] = useState(false)
  const { data, reload } = useLoad(() => api.planAnnual({ itiId: itiId || undefined }), [itiId])
  useSaathiContext(data ? `Annual plan Year ${data.year}: budget ₹${data.totals.budgetCr} Cr, spent ₹${data.totals.spentCr} Cr across ${data.workplan.length} AOP records. Records: ${data.workplan.map(w => `${w.id} ${w.package.title} [${w.package.category}, ${w.package.itiId}] ₹${w.spentCr}/${w.budgetCr} Cr, ${w.state}, owner ${w.accountableRole}, evidence ${w.evidenceRule}; tasks: ${w.tasks.map(t => `${t.id} ${t.title} (${t.state}${t.overdue ? ', OVERDUE' : ''}, due ${String(t.dueAt).slice(0, 10)}, ${t.responsibleRole}→${t.reviewerRole})`).join(', ') || 'none'}`).join(' || ')}. Outcomes: ${data.outcomes.map(o => `${o.code} target ${o.target ?? '—'} now ${o.current ?? '—'}`).join(', ')}.` : '', ['Which tasks are overdue and what evidence do they need?', 'Which AOP records have spent nothing yet?', 'What is due this quarter?', 'Draft a status note on the Year-1 workplan.'])
  if (!data) return <Loading />
  const { cluster, year, outcomes, workplan, calendar, totals } = data
  const cats = [...new Set(workplan.map(w => w.package.category))]
  const wp = workplan.filter(w => cat === 'all' || w.package.category === cat)
  const allTasks = workplan.flatMap(w => w.tasks)
  const inCat = t => cat === 'all' || t.category === cat
  const canAssign = role === 'spv_ceo' || role === 'iti_principal'
  const filters = (
    <div className="flex items-center gap-2 flex-wrap">
      {role !== 'iti_principal' && itis && <select value={itiId} onChange={e => setItiId(e.target.value)} className="text-[12px] rounded-lg border border-bdr px-2 py-1.5 bg-white"><option value="">All ITIs</option>{itis.itis.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select>}
      <select value={cat} onChange={e => setCat(e.target.value)} className="text-[12px] rounded-lg border border-bdr px-2 py-1.5 bg-white"><option value="all">All categories</option>{cats.map(c => <option key={c} value={c}>{c}</option>)}</select>
    </div>
  )
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="emerald" eyebrow={`${cluster.planYearLabel} · Annual Operational Plan`} title={`Year ${year}: ${fmtCr(totals.spentCr)} spent of ${fmtCr(totals.budgetCr)} planned`} subtitle="Each AOP record is one package for one year: budget, accountable role, deliverable, evidence rule. Tasks hang off records and carry no budget of their own."
        right={filters} />
      {canAssign && <div className="px-4 pt-3 flex items-center gap-2 flex-wrap"><AssignTaskToggle open={assigning} onToggle={() => setAssigning(a => !a)} /><span className="text-[11px] text-txt-tertiary">Put a task on an ITI principal; they are notified in-app and it appears in the workplan and calendar.</span></div>}
      <Tabs tabs={[{ id: 'workplan', label: 'Workplan', badge: workplan.length }, { id: 'calendar', label: 'Calendar', badge: allTasks.filter(t => t.overdue).length || null }]} active={tab} onChange={setTab} />
      <div className="p-4 space-y-4">
        {assigning && <AssignTaskForm defaults={{ itiId: itiId || undefined, category: cat !== 'all' ? cat : undefined }} onDone={() => { setAssigning(false); reload() }} onCancel={() => setAssigning(false)} />}
        {tab === 'workplan' && (<>
          <StatGrid>
            <Stat label="AOP records" value={workplan.length} sub={`${cats.length} categories`} tone="indigo" />
            <Stat label="Budget" value={fmtCr(totals.budgetCr)} sub={`spent ${fmtCr(totals.spentCr)}`} tone="emerald" />
            <Stat label="Tasks" value={allTasks.length} sub={`${allTasks.filter(t => ['completed', 'reviewed'].includes(t.state)).length} done`} tone="sky" />
            <Stat label="Overdue / blocked" value={`${allTasks.filter(t => t.overdue).length} / ${allTasks.filter(t => t.state === 'blocked').length}`} tone={allTasks.some(t => t.overdue) ? 'rose' : 'emerald'} onClick={() => openCanvas({ type: 'milestone_board' })} />
          </StatGrid>
          <div className="space-y-3">
            {wp.map(w => (
              <div key={w.id} className="rounded-2xl border border-bdr-light bg-white shadow-card p-3.5">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-[220px]">
                    <div className="flex items-center gap-2 flex-wrap"><span className="text-[10px] font-bold text-primary">{w.id}</span><Pill kind={stateKind(w.state)}>{w.state.replace(/_/g, ' ')}</Pill><Pill kind="neutral">{w.package.category}</Pill><span className="text-[10px] text-txt-tertiary">{w.package.itiId}</span></div>
                    <div className="text-[13px] font-bold text-txt-primary mt-0.5">{w.package.title}</div>
                    <div className="text-[11px] text-txt-secondary mt-0.5">{w.deliverable}</div>
                    <div className="text-[10px] text-txt-tertiary mt-0.5">Accountable {w.accountableRole} · evidence {w.evidenceRule} · {w.start} → {w.finish}</div>
                  </div>
                  <div className="w-full sm:w-[200px]"><Bar pct={w.budgetCr ? 100 * w.spentCr / w.budgetCr : 0} label={`${fmtCr(w.spentCr)} / ${fmtCr(w.budgetCr)}`} /><div className="text-[10px] text-txt-tertiary mt-1">physical progress {w.progressPct}%</div></div>
                </div>
                {w.tasks.length > 0 && <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">{w.tasks.map(t => <TaskCard key={t.id} t={t} role={role} onChanged={reload} />)}</div>}
              </div>
            ))}
          </div>
        </>)}
        {tab === 'calendar' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {calendar.map(q => (
              <div key={q.quarter} className="rounded-2xl bg-surface-page/60 border border-bdr-light p-2">
                <div className="text-[10px] uppercase tracking-wider font-bold text-txt-secondary px-1 mb-2 flex justify-between"><span>{q.quarter} · {{ Q1: 'Aug–Oct', Q2: 'Nov–Jan', Q3: 'Feb–Apr', Q4: 'May–Jul' }[q.quarter]}</span><span>{q.tasks.filter(inCat).length}</span></div>
                <div className="space-y-2">{q.tasks.filter(inCat).map(t => <TaskCard key={t.id} t={t} role={role} onChanged={reload} />)}{q.tasks.filter(inCat).length === 0 && <div className="text-[11px] text-txt-tertiary px-1">Nothing in this category.</div>}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
