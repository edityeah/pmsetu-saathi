// AssignTask — the one form the CEO (or a principal) uses to put a task on an
// ITI: Annual Plan, Civil Works and Procurement all open the same box. The
// task hangs off a Year-1 AOP record (so it carries no budget) and the
// principal is notified in-app. `AssignTaskToggle` is the top-left button.
import { useEffect, useState } from 'react'
import { ClipboardList, X } from 'lucide-react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Btn, Field, inputCls } from './_ui.jsx'

const CATEGORIES = ['Civil', 'Equipment', 'Digital', 'Staff', 'Operations', 'Governance', 'Student support', 'Industry']

export function AssignTaskToggle({ open, onToggle, label = 'Assign a task' }) {
  return (
    <button onClick={onToggle} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-[11px] font-bold border transition ${open ? 'bg-primary text-white border-primary' : 'bg-white border-primary/40 text-primary hover:bg-primary-light/40'}`}>
      {open ? <X className="w-3.5 h-3.5" /> : <ClipboardList className="w-3.5 h-3.5" />} {open ? 'Close' : label}
    </button>
  )
}

// defaults: { itiId, category, title, evidence, note }
export default function AssignTaskForm({ defaults = {}, onDone, onCancel, lockIti = false }) {
  const { showToast, role, meExtra } = useApp()
  const [itis, setItis] = useState([])
  const [aops, setAops] = useState([])
  const [busy, setBusy] = useState(false)
  const inDays = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
  const [f, setF] = useState({ itiId: defaults.itiId || (role === 'iti_principal' ? meExtra?.iti?.id : '') || '', category: defaults.category || '', aopId: '', title: defaults.title || '', dueAt: defaults.dueAt || inDays(21), evidence: defaults.evidence || '', acceptance: '', note: defaults.note || '', isMilestone: false })
  useEffect(() => { api.itis().then(r => { const list = r.itis || []; setItis(list); if (!f.itiId && list[0]) setF(x => ({ ...x, itiId: list[0].id })) }).catch(() => {}) }, []) // eslint-disable-line
  useEffect(() => { if (!f.itiId) return; api.planAnnual({ itiId: f.itiId }).then(r => setAops(r.workplan || [])).catch(() => setAops([])) }, [f.itiId])
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const aopOptions = aops.filter(a => !f.category || a.package.category === f.category)
  async function submit(e) {
    e.preventDefault(); setBusy(true)
    try {
      const r = await api.createTask({ title: f.title, itiId: f.itiId, aopId: f.aopId || undefined, category: f.category || undefined, dueAt: f.dueAt, evidence: f.evidence || undefined, acceptance: f.acceptance || undefined, note: f.note || undefined, isMilestone: f.isMilestone })
      const iti = itis.find(i => i.id === f.itiId)
      showToast({ kind: 'success', text: `${r.task.id} assigned to the principal of ${iti?.name || 'the ITI'}; they have been notified.` })
      onDone?.(r.task)
    } catch (err) { showToast({ kind: 'danger', text: err.message }) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="rounded-2xl border border-primary/30 bg-primary-light/30 p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
      <div className="md:col-span-2 text-[12px] font-bold text-txt-primary">Assign a task to an ITI principal</div>
      <Field label="Task"><input className={inputCls} value={f.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Complete the room survey for the CNC lab" required /></Field>
      <Field label="ITI"><select className={inputCls} value={f.itiId} onChange={e => set('itiId', e.target.value)} disabled={lockIti || role === 'iti_principal'}>{itis.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></Field>
      <Field label="Category"><select className={inputCls} value={f.category} onChange={e => { set('category', e.target.value); set('aopId', '') }}><option value="">Any</option>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
      <Field label="Under AOP record (package)"><select className={inputCls} value={f.aopId} onChange={e => set('aopId', e.target.value)}><option value="">Pick automatically</option>{aopOptions.map(a => <option key={a.id} value={a.id}>{a.id} · {a.package.title}</option>)}</select></Field>
      <Field label="Due date"><input type="date" className={inputCls} value={f.dueAt} onChange={e => set('dueAt', e.target.value)} required /></Field>
      <Field label="Evidence expected"><input className={inputCls} value={f.evidence} onChange={e => set('evidence', e.target.value)} placeholder="Photo, signed note, invoice, register extract…" /></Field>
      <Field label="Note to the principal" className="md:col-span-2"><textarea className={inputCls} rows={2} value={f.note} onChange={e => set('note', e.target.value)} placeholder="What exactly is needed and why" /></Field>
      <label className="text-[11px] inline-flex items-center gap-2 md:col-span-2"><input type="checkbox" checked={f.isMilestone} onChange={e => set('isMilestone', e.target.checked)} /> Show on the milestone board</label>
      <div className="md:col-span-2 flex gap-2 justify-end"><Btn small tone="ghost" onClick={onCancel}>Cancel</Btn><Btn small type="submit" disabled={busy || !f.itiId}>{busy ? 'Assigning…' : 'Assign and notify'}</Btn></div>
    </form>
  )
}

// AskStatus — "ask for the current situation": a one-line question routed to
// the ITI principal as a high-priority notification.
export function AskStatusBox({ placeholder = 'What do you want to know?', onSend, onCancel }) {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  async function go(e) { e.preventDefault(); setBusy(true); try { await onSend(q) } finally { setBusy(false) } }
  return (
    <form onSubmit={go} className="mt-2 flex items-center gap-2 flex-wrap">
      <input className={`${inputCls} flex-1 min-w-[200px]`} value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder} required autoFocus />
      <Btn small type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send to principal'}</Btn>
      <Btn small tone="ghost" onClick={onCancel}>Cancel</Btn>
    </form>
  )
}
