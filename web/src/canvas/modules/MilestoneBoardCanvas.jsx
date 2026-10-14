// Milestone board (Module A) — the exceptions view: overdue, blocked and
// returned tasks with their predecessor chain and forecast slip, IMA
// milestones, and change requests (proposed → approved internally / returned
// / routed for formal approval).
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Pill, Section, Loading, Btn, useLoad, Chips, fmtDate, stateKind, Field, inputCls } from './_ui.jsx'
import { TaskCard } from './AnnualPlanCanvas.jsx'
import { AssignTaskToggle } from './_AssignTask.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

export default function MilestoneBoardCanvas() {
  const { role, showToast, openCanvas } = useApp()
  const { data, reload } = useLoad(() => api.milestoneBoard())
  const [filter, setFilter] = useState('all')
  const [proposing, setProposing] = useState(null)
  const [pickId, setPickId] = useState('')
  const [form, setForm] = useState({ title: '', currentValue: '', proposedValue: '', reason: '', resourceImpact: '', formalApprovalNeeded: false })
  useSaathiContext(data ? `Milestone board: ${data.board.length} items. ${data.board.map(t => `${t.id} ${t.title} [${t.state}${t.overdue ? ', OVERDUE ' + t.slipDays + 'd' : ''}${t.blockedByPredecessor ? ', blocked by predecessor' : ''}; due ${String(t.dueAt).slice(0, 10)}${t.forecastAt ? ', forecast ' + String(t.forecastAt).slice(0, 10) : ''}; ${t.responsibleRole}→${t.reviewerRole}${t.blockedReason ? '; blocked: ' + t.blockedReason : ''}${t.chain.length ? '; depends on ' + t.chain.map(c => c.id + '(' + c.state + ')').join(',') : ''}${t.dependents.length ? '; unlocks ' + t.dependents.map(d => d.id).join(',') : ''}]`).join(' || ')}. IMA milestones: ${data.milestones.map(m => `${m.title} (${m.state}, due ${String(m.dueAt).slice(0, 10)})`).join('; ')}. Change requests: ${data.changes.map(c => `${c.title} [${c.state}] ${c.currentValue} → ${c.proposedValue}; reason ${c.reason}`).join(' || ') || 'none'}.` : '', ['What is blocked and what unblocks it?', 'Should I approve the pending change requests?', 'Which slips affect Year-2 launch gates?', 'Draft a note to the Rohini principal about the room survey.'])
  if (!data) return <Loading />
  const { board, milestones, changes } = data
  const list = board.filter(t => filter === 'all' || (filter === 'overdue' ? t.overdue : filter === 'blocked' ? t.state === 'blocked' || t.blockedByPredecessor : filter === 'review' ? t.state === 'reported_complete' : t.state === filter))
  const pending = changes.filter(c => c.state === 'proposed')
  async function propose(e) {
    e.preventDefault()
    await api.proposeChange({ targetType: 'task', targetId: proposing.id, ...form, affected: proposing.dependents.map(d => d.title) })
    showToast({ kind: 'success', text: 'Change request logged for the CEO.' }); setProposing(null); setForm({ title: '', currentValue: '', proposedValue: '', reason: '', resourceImpact: '', formalApprovalNeeded: false }); reload()
  }
  async function decide(c, decision) { await api.decideChange(c.id, { decision, note: decision === 'returned' ? 'Add the classes affected and the continuation plan.' : undefined }); showToast({ kind: 'success', text: `${c.title}: ${decision.replace(/_/g, ' ')}` }); reload() }
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="rose" eyebrow="Milestone board · exceptions first" title={`${board.filter(t => t.overdue).length} overdue · ${board.filter(t => t.state === 'blocked').length} blocked · ${board.filter(t => t.state === 'returned').length} returned`} subtitle="Milestone tasks with their predecessor chain. A slip here moves everything downstream; a change request records the decision before any date or target is rewritten." />
      <div className="p-4 space-y-4">
        {(role === 'iti_principal' || role === 'spv_ceo') && (
          <div className="flex items-center gap-2 flex-wrap">
            <AssignTaskToggle open={!!proposing} onToggle={() => { if (proposing) { setProposing(null); return } const t = board.find(x => x.id === pickId) || board[0]; if (t) { setProposing(t); setForm(f => ({ ...f, title: `Revise ${t.id}: ${t.title}`, currentValue: `Due ${fmtDate(t.dueAt)}`, proposedValue: t.forecastAt ? `Forecast ${fmtDate(t.forecastAt)}` : '' })) } }} label="Propose a change" />
            {!proposing && <select value={pickId} onChange={e => setPickId(e.target.value)} className="text-[12px] rounded-lg border border-bdr px-2 py-1.5 bg-white max-w-[360px]"><option value="">Pick the task to change…</option>{board.map(t => <option key={t.id} value={t.id}>{t.id} · {t.title}</option>)}</select>}
          </div>
        )}
        <StatGrid>
          <Stat label="Overdue" value={board.filter(t => t.overdue).length} tone="rose" onClick={() => setFilter('overdue')} />
          <Stat label="Blocked (incl. by predecessor)" value={board.filter(t => t.state === 'blocked' || t.blockedByPredecessor).length} tone="amber" onClick={() => setFilter('blocked')} />
          <Stat label="Awaiting review" value={board.filter(t => t.state === 'reported_complete').length} tone="sky" onClick={() => setFilter('review')} />
          <Stat label="Change requests" value={pending.length} sub={`${changes.length} total`} tone="violet" />
        </StatGrid>
        <Chips options={[{ id: 'all', label: `All (${board.length})` }, 'overdue', 'blocked', { id: 'review', label: 'Awaiting review' }, 'returned', 'in_progress', 'planned']} value={filter} onChange={setFilter} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {list.map(t => (
            <div key={t.id} className="space-y-1.5">
              <TaskCard t={t} role={role} onChanged={reload} />
              {(t.chain.length > 0 || t.dependents.length > 0) && (
                <div className="rounded-xl bg-surface-page/70 px-2.5 py-2 text-[10px] text-txt-secondary">
                  {t.chain.length > 0 && <div><b>Depends on:</b> {t.chain.map(c => <span key={c.id} className="inline-flex items-center gap-1 mr-2"><Pill kind={stateKind(c.state)}>{c.state.replace(/_/g, ' ')}</Pill>{c.id}</span>)}{t.blockedByPredecessor && <span className="text-amber-700 font-bold">← not yet accepted</span>}</div>}
                  {t.dependents.length > 0 && <div className="mt-1"><b>Unlocks:</b> {t.dependents.map(d => `${d.id} (${fmtDate(d.dueAt)})`).join(', ')}</div>}
                  {(role === 'iti_principal' || role === 'spv_ceo') && <button onClick={() => { setProposing(t); setForm(f => ({ ...f, title: `Revise ${t.id}: ${t.title}`, currentValue: `Due ${fmtDate(t.dueAt)}`, proposedValue: t.forecastAt ? `Forecast ${fmtDate(t.forecastAt)}` : '' })) }} className="mt-1 text-primary font-bold">Propose a change →</button>}
                </div>
              )}
            </div>
          ))}
          {list.length === 0 && <div className="text-[12px] text-txt-tertiary">Nothing in this filter.</div>}
        </div>
        {proposing && (
          <form onSubmit={propose} className="rounded-2xl border border-primary/30 bg-primary-light/30 p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="md:col-span-2 text-[12px] font-bold">Change request for {proposing.id} · affects {proposing.dependents.length} downstream task(s)</div>
            <Field label="Title"><input className={inputCls} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></Field>
            <Field label="Current value"><input className={inputCls} value={form.currentValue} onChange={e => setForm({ ...form, currentValue: e.target.value })} required /></Field>
            <Field label="Proposed value (date as YYYY-MM-DD if a date)"><input className={inputCls} value={form.proposedValue} onChange={e => setForm({ ...form, proposedValue: e.target.value })} required /></Field>
            <Field label="Resource impact"><input className={inputCls} value={form.resourceImpact} onChange={e => setForm({ ...form, resourceImpact: e.target.value })} placeholder="None within package / needs re-allocation…" /></Field>
            <Field label="Reason" className="md:col-span-2"><textarea className={inputCls} rows={2} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} required /></Field>
            <label className="text-[11px] inline-flex items-center gap-2 md:col-span-2"><input type="checkbox" checked={form.formalApprovalNeeded} onChange={e => setForm({ ...form, formalApprovalNeeded: e.target.checked })} /> Needs formal approval (board / SSC) — the app records, it does not approve</label>
            <div className="md:col-span-2 flex gap-2 justify-end"><Btn small tone="ghost" onClick={() => setProposing(null)}>Cancel</Btn><Btn small type="submit">Log change request</Btn></div>
          </form>
        )}
        <Section title="Change requests" hint="Approved internally = date/forecast updated here; routed formal = recorded, awaiting the body that can approve.">
          {changes.length === 0 ? <div className="text-[12px] text-txt-tertiary">None yet.</div> : <ul className="space-y-2">{changes.map(c => (
            <li key={c.id} className="rounded-xl border border-bdr-light p-2.5 text-[12px]">
              <div className="flex items-center gap-2 flex-wrap"><Pill kind={stateKind(c.state)}>{c.state.replace(/_/g, ' ')}</Pill><b>{c.title}</b><span className="text-[10px] text-txt-tertiary">{c.targetId} · {c.itiCode || 'cluster'} · {c.proposer.name} · {fmtDate(c.createdAt)}</span>{c.formalApprovalNeeded && <Pill kind="violet">formal</Pill>}</div>
              <div className="text-[11px] text-txt-secondary mt-0.5">{c.currentValue} → <b>{c.proposedValue}</b> · {c.reason}{c.resourceImpact ? ` · impact: ${c.resourceImpact}` : ''}</div>
              {c.affected?.length > 0 && <div className="text-[10px] text-txt-tertiary">Affects: {c.affected.join('; ')}</div>}
              {c.decisionNote && <div className="text-[11px] text-rose-700 mt-0.5">Decision: {c.decisionNote}</div>}
              {role === 'spv_ceo' && c.state === 'proposed' && <div className="flex gap-1.5 mt-1.5"><Btn small tone="ok" onClick={() => decide(c, 'approved_internal')}>Approve internally</Btn><Btn small tone="ghost" onClick={() => decide(c, 'routed_formal')}>Route for formal approval</Btn><Btn small tone="danger" onClick={() => decide(c, 'returned')}>Return</Btn></div>}
            </li>))}</ul>}
        </Section>
        <Section title="IMA milestones" hint="Cluster milestones certified by the Independent Monitoring Agency; linked tasks move with them." right={<button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'milestones' })}>Evidence packs →</button>}>
          <ul className="space-y-1 text-[12px]">{milestones.map(m => <li key={m.id} className="flex items-center gap-2"><Pill kind={stateKind(m.state)}>{m.state}</Pill><span className="flex-1 truncate">{m.title}</span><span className="text-[10px] text-txt-tertiary whitespace-nowrap">{m.itiCode || 'cluster'} · due {fmtDate(m.dueAt)}{m.taskId ? ` · ${m.taskId}` : ''}</span></li>)}</ul>
        </Section>
      </div>
    </div>
  )
}
