// Daily ops (Module B) — equipment, space, consumables, safety, timetable
// and trainer issues. Trainers raise; the principal assigns and resolves.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Pill, Section, Loading, Btn, useLoad, Chips, fmtDate, stateKind, titleCase, Field, inputCls } from './_ui.jsx'
import { Wrench, DoorOpen, Package, ShieldAlert, CalendarClock, UserX, Plus } from 'lucide-react'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

const CATS = [['equipment', Wrench, 'Equipment'], ['space', DoorOpen, 'Space / room'], ['consumables', Package, 'Consumables'], ['safety', ShieldAlert, 'Safety'], ['timetable', CalendarClock, 'Timetable'], ['trainer', UserX, 'Trainer cover']]

export default function DailyOpsCanvas() {
  const { role, showToast, meExtra } = useApp()
  const { data, reload } = useLoad(() => api.issues({}))
  const { data: batches } = useLoad(() => api.batches({}))
  const [filter, setFilter] = useState('open')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', category: 'equipment', severity: 'medium', effect: '', batchId: '' })
  useSaathiContext(data ? brief(data) : '', ['Which issues are blocking practicals?', 'Draft a message to the technical lead about the open high-severity issues.'])
  if (!data) return <Loading />
  const issues = data.issues.filter(i => filter === 'all' || (filter === 'open' ? i.state !== 'resolved' : i.state === filter))
  async function raise(e) { e.preventDefault(); await api.raiseIssue({ ...form, batchId: form.batchId || undefined, effect: form.effect || undefined }); showToast({ kind: 'success', text: 'Issue raised. Principal notified.' }); setCreating(false); setForm({ title: '', category: 'equipment', severity: 'medium', effect: '', batchId: '' }); reload() }
  async function update(i, state) { await api.updateIssue(i.id, { state, resolution: state === 'resolved' ? 'Resolved by ' + (meExtra?.user?.name || role) : undefined }); showToast({ kind: 'success', text: `${i.title}: ${state}` }); reload() }
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="orange" eyebrow="Daily ops" title={`${data.issues.filter(i => i.state !== 'resolved').length} open issues`} subtitle="Small things that stop a class: a machine, a room, consumables, safety, the timetable, a missing trainer. Raise it in 20 seconds; the principal sees who owns it."
        right={<Btn small onClick={() => setCreating(c => !c)}><Plus className="w-3 h-3" /> Raise an issue</Btn>} />
      <div className="p-4 space-y-4">
        <StatGrid>
          <Stat label="Open" value={data.issues.filter(i => i.state === 'open').length} tone="rose" onClick={() => setFilter('open')} />
          <Stat label="Assigned" value={data.issues.filter(i => i.state === 'assigned').length} tone="amber" onClick={() => setFilter('assigned')} />
          <Stat label="High severity" value={data.issues.filter(i => i.state !== 'resolved' && i.severity === 'high').length} tone="rose" />
          <Stat label="Resolved (30d)" value={data.issues.filter(i => i.state === 'resolved').length} tone="emerald" onClick={() => setFilter('resolved')} />
        </StatGrid>
        {creating && (
          <form onSubmit={raise} className="rounded-2xl border border-primary/30 bg-primary-light/30 p-3 space-y-2">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5">{CATS.map(([id, Icon, label]) => <button type="button" key={id} onClick={() => setForm({ ...form, category: id })} className={`rounded-xl border p-2 text-left ${form.category === id ? 'border-primary bg-white' : 'border-bdr-light bg-white/70'}`}><Icon className="w-4 h-4 text-primary" /><div className="text-[10px] font-bold mt-1">{label}</div></button>)}</div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <Field label="What happened" className="md:col-span-2"><input className={inputCls} required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Bench drill #2 chuck jammed" /></Field>
              <Field label="Severity"><select className={inputCls} value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>{['low', 'medium', 'high'].map(s => <option key={s}>{s}</option>)}</select></Field>
              <Field label="Batch affected (optional)"><select className={inputCls} value={form.batchId} onChange={e => setForm({ ...form, batchId: e.target.value })}><option value="">—</option>{(batches?.batches || []).filter(b => b.state === 'running').map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
              <Field label="Effect on teaching" className="md:col-span-4"><input className={inputCls} value={form.effect} onChange={e => setForm({ ...form, effect: e.target.value })} placeholder="e.g. Fitter practicals queue on 3 drills" /></Field>
            </div>
            <div className="flex justify-end gap-2"><Btn small tone="ghost" type="button" onClick={() => setCreating(false)}>Cancel</Btn><Btn small type="submit">Raise</Btn></div>
          </form>
        )}
        <Chips options={[{ id: 'open', label: 'Open + assigned' }, 'assigned', 'resolved', { id: 'all', label: 'All' }]} value={filter} onChange={setFilter} />
        <ul className="space-y-2">{issues.map(i => { const Icon = CATS.find(c => c[0] === i.category)?.[1] || Wrench; return (
          <li key={i.id} className="rounded-2xl border border-bdr-light bg-white shadow-card p-3 flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${i.severity === 'high' ? 'bg-rose-100 text-rose-700' : i.severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}><Icon className="w-4 h-4" /></div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap"><div className="text-[13px] font-bold">{i.title}</div><Pill kind={stateKind(i.state)}>{i.state}</Pill><Pill kind={i.severity === 'high' ? 'bad' : i.severity === 'medium' ? 'warn' : 'neutral'}>{i.severity}</Pill></div>
              <div className="text-[11px] text-txt-secondary mt-0.5">{titleCase(i.category)} · {i.iti.code} · raised by {i.raisedBy.name} · {fmtDate(i.createdAt)}{i.batch ? ` · ${i.batch.name}` : ''}{i.ownerRole ? ` · owner ${i.ownerRole}` : ''}</div>
              {i.effect && <div className="text-[11px] text-txt-primary mt-0.5">Effect: {i.effect}</div>}
              {i.resolution && <div className="text-[11px] text-emerald-700 mt-0.5">Resolved: {i.resolution} · {fmtDate(i.resolvedAt)}</div>}
            </div>
            {(role === 'iti_principal' || role === 'spv_ceo') && i.state !== 'resolved' && <div className="flex flex-col gap-1">{i.state === 'open' && <Btn small tone="ghost" onClick={() => update(i, 'assigned')}>Assign</Btn>}<Btn small tone="ok" onClick={() => update(i, 'resolved')}>Resolve</Btn></div>}
            {role === 'trainer' && i.state !== 'resolved' && <Btn small tone="ghost" onClick={() => update(i, 'resolved')}>Fixed</Btn>}
          </li>) })}{issues.length === 0 && <li className="text-[12px] text-txt-tertiary">Nothing here.</li>}</ul>
      </div>
    </div>
  )
}
