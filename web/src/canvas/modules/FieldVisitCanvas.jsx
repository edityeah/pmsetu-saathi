// Field visit (Module B) — a workshop checklist completed on site, with
// findings that get an owner, a due date and the class affected.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Pill, Section, Table, Loading, Btn, useLoad, fmtDate, stateKind, titleCase, Field, inputCls } from './_ui.jsx'
import { Plus, Trash2 } from 'lucide-react'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

const CHECK = ['Machines functional', 'PPE in use', 'Consumables stocked', 'Fire exit clear', 'Trainer present', 'Lesson matches timetable', 'Electrical safety', 'Housekeeping (5S)']

export default function FieldVisitCanvas() {
  const { role, showToast, meExtra } = useApp()
  const { data, reload } = useLoad(() => api.visits({}))
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ workshop: '', visitType: 'routine', note: '', checklist: Object.fromEntries(CHECK.map(c => [c, 'satisfactory'])), findings: [] })
  useSaathiContext(data ? brief(data) : '', ['Which findings are overdue?', 'Draft the closure note for the highest-severity finding.'])
  if (!data) return <Loading />
  const { visits, openFindings } = data
  async function submit(e) { e.preventDefault(); await api.createVisit(form); showToast({ kind: 'success', text: `Visit recorded with ${form.findings.length} finding(s).` }); setCreating(false); setForm({ workshop: '', visitType: 'routine', note: '', checklist: Object.fromEntries(CHECK.map(c => [c, 'satisfactory'])), findings: [] }); reload() }
  async function close(f) { await api.closeFinding(f.id, 'Closed after follow-up visit.'); showToast({ kind: 'success', text: 'Finding closed.' }); reload() }
  const itiCode = meExtra?.iti?.code || 'PUS'
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="teal" eyebrow="Field visit" title={`${openFindings.length} open findings · ${visits.length} visits`} subtitle="Walk the workshop with the checklist; anything 'action needed' becomes a finding with an owner and due date."
        right={(role === 'iti_principal' || role === 'spv_ceo' || role === 'ima_officer') && <Btn small onClick={() => setCreating(c => !c)}><Plus className="w-3 h-3" /> New visit</Btn>} />
      <div className="p-4 space-y-4">
        <StatGrid>
          <Stat label="Open findings" value={openFindings.length} sub={`${openFindings.filter(f => f.severity === 'high').length} high`} tone={openFindings.some(f => f.severity === 'high') ? 'rose' : 'amber'} />
          <Stat label="Overdue" value={openFindings.filter(f => f.dueAt && new Date(f.dueAt) < new Date()).length} tone="rose" />
          <Stat label="Visits (30d)" value={visits.filter(v => new Date(v.date) > new Date(Date.now() - 30 * 86400000)).length} tone="indigo" />
          <Stat label="Workshops covered" value={new Set(visits.map(v => v.workshop)).size} tone="sky" />
        </StatGrid>
        {creating && (
          <form onSubmit={submit} className="rounded-2xl border border-primary/30 bg-primary-light/30 p-3 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Field label="Workshop / room"><input className={inputCls} required value={form.workshop} onChange={e => setForm({ ...form, workshop: e.target.value })} placeholder={`e.g. Electrician workshop (${itiCode}-WS1)`} /></Field>
              <Field label="Visit type"><select className={inputCls} value={form.visitType} onChange={e => setForm({ ...form, visitType: e.target.value })}><option value="routine">Routine</option><option value="issue_follow_up">Issue follow-up</option><option value="ceo_review">CEO review</option></select></Field>
              <Field label="Note"><input className={inputCls} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">{CHECK.map(c => <div key={c} className="flex items-center gap-2 text-[12px] rounded-xl bg-white border border-bdr-light px-2.5 py-1.5"><span className="flex-1">{c}</span><div className="flex rounded-pill bg-surface-page p-0.5">{[['satisfactory', 'OK', 'bg-emerald-500'], ['action_needed', 'Action', 'bg-rose-500'], ['n_a', 'N/A', 'bg-slate-400']].map(([v, l, bg]) => <button type="button" key={v} onClick={() => setForm(f => ({ ...f, checklist: { ...f.checklist, [c]: v } }))} className={`px-2 h-6 rounded-pill text-[10px] font-bold ${form.checklist[c] === v ? `${bg} text-white` : 'text-txt-tertiary'}`}>{l}</button>)}</div></div>)}</div>
            <div>
              <div className="flex items-center justify-between"><div className="text-[11px] font-bold text-txt-secondary">Findings</div><Btn small tone="ghost" type="button" onClick={() => setForm(f => ({ ...f, findings: [...f.findings, { item: '', severity: 'medium', ownerRole: `TECH-${itiCode}`, dueDays: 7, affectedClass: '' }] }))}><Plus className="w-3 h-3" /> Finding</Btn></div>
              {form.findings.map((f, i) => <div key={i} className="mt-1.5 grid grid-cols-2 md:grid-cols-6 gap-1.5 items-center"><input className={`${inputCls} md:col-span-2`} placeholder="What needs action" value={f.item} onChange={e => setForm(x => ({ ...x, findings: x.findings.map((y, k) => k === i ? { ...y, item: e.target.value } : y) }))} required /><select className={inputCls} value={f.severity} onChange={e => setForm(x => ({ ...x, findings: x.findings.map((y, k) => k === i ? { ...y, severity: e.target.value } : y) }))}>{['low', 'medium', 'high'].map(s => <option key={s}>{s}</option>)}</select><input className={inputCls} placeholder="Owner role" value={f.ownerRole} onChange={e => setForm(x => ({ ...x, findings: x.findings.map((y, k) => k === i ? { ...y, ownerRole: e.target.value } : y) }))} /><input className={inputCls} placeholder="Class affected" value={f.affectedClass} onChange={e => setForm(x => ({ ...x, findings: x.findings.map((y, k) => k === i ? { ...y, affectedClass: e.target.value } : y) }))} /><div className="flex items-center gap-1"><input type="number" className={inputCls} value={f.dueDays} onChange={e => setForm(x => ({ ...x, findings: x.findings.map((y, k) => k === i ? { ...y, dueDays: Number(e.target.value) } : y) }))} /><span className="text-[10px]">days</span><button type="button" onClick={() => setForm(x => ({ ...x, findings: x.findings.filter((_, k) => k !== i) }))} className="p-1 text-txt-tertiary hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button></div></div>)}
            </div>
            <div className="flex justify-end gap-2"><Btn small tone="ghost" type="button" onClick={() => setCreating(false)}>Cancel</Btn><Btn small type="submit">Submit visit</Btn></div>
          </form>
        )}
        <Section tone="indigo" title="Open findings" hint="Owner and due date set at the visit; closure needs a note.">
          <Table tone="indigo" columns={[
            { key: 'item', label: 'Finding', render: r => <div><div className="font-semibold">{r.item}</div><div className="text-[10px] text-txt-tertiary">{r.workshop} · {r.iti.code}{r.affectedClass ? ` · affects ${r.affectedClass}` : ''}</div></div> },
            { key: 'severity', label: 'Severity', render: r => <Pill kind={r.severity === 'high' ? 'bad' : r.severity === 'medium' ? 'warn' : 'neutral'}>{r.severity}</Pill> },
            { key: 'ownerRole', label: 'Owner' },
            { key: 'dueAt', label: 'Due', render: r => <span className={r.dueAt && new Date(r.dueAt) < new Date() ? 'text-rose-700 font-bold' : ''}>{fmtDate(r.dueAt)}</span> },
            { key: 'state', label: 'State', render: r => <Pill kind={stateKind(r.state)}>{r.state.replace(/_/g, ' ')}</Pill> },
            { key: 'act', label: '', align: 'right', render: r => (role === 'iti_principal' || role === 'spv_ceo' || role === 'trainer') ? <Btn small tone="ghost" onClick={() => close(r)}>Close</Btn> : null },
          ]} rows={openFindings} empty="No open findings." />
        </Section>
        <Section tone="emerald" title="Visit log">
          <ul className="space-y-2">{visits.map(v => <li key={v.id} className="rounded-xl border border-bdr-light p-2.5 text-[12px]"><div className="flex items-center gap-2 flex-wrap"><b>{v.workshop}</b><Pill kind="neutral">{titleCase(v.visitType)}</Pill><span className="text-[10px] text-txt-tertiary">{v.iti.code} · {fmtDate(v.date)} · {v.visitor.name}</span></div><div className="mt-1 flex flex-wrap gap-1">{Object.entries(v.checklist).map(([k, s]) => <span key={k} className={`text-[9px] px-1.5 py-0.5 rounded ${s === 'satisfactory' ? 'bg-emerald-50 text-emerald-700' : s === 'action_needed' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>{k}</span>)}</div>{v.note && <div className="text-[11px] text-txt-secondary mt-1">{v.note}</div>}<div className="text-[10px] text-txt-tertiary mt-1">{v.findings.length} finding(s) · {v.findings.filter(f => f.state === 'closed').length} closed</div></li>)}</ul>
        </Section>
      </div>
    </div>
  )
}
