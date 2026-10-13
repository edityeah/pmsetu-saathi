// Assessments (Module B) — calendar of planned tests, marks entry (typed or
// scanned with confidence flags), and principal review of low-confidence /
// submitted entries. A plan moves planned → marks_pending → submitted /
// needs_review → confirmed.
import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Pill, Section, Table, Loading, Btn, useLoad, Tabs, Chips, fmtDate, stateKind, titleCase, Field, inputCls } from './_ui.jsx'
import { ScanLine, Save, Plus } from 'lucide-react'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

export default function AssessmentsCanvas({ context }) {
  const { role, showToast } = useApp()
  const isPrincipal = role === 'iti_principal' || role === 'spv_ceo'
  const [tab, setTab] = useState(context?.tab || (isPrincipal ? 'review' : 'calendar'))
  const { data: list, reload: reloadList } = useLoad(() => api.assessments({}))
  const { data: batches } = useLoad(() => api.batches({}))
  const [planId, setPlanId] = useState(context?.planId || null)
  const { data: plan, reload } = useLoad(() => planId ? api.assessment(planId) : Promise.resolve(null), [planId])
  const [entries, setEntries] = useState({})
  const [scan, setScan] = useState(null)
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ batchId: '', title: 'Unit test', type: 'theory', topic: '', maxMarks: 50, date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) })
  useEffect(() => { if (!plan) return; const e = {}; for (const r of plan.roster) e[r.id] = r.entry ? { marks: r.entry.marks, status: r.entry.status, source: r.entry.source, ocrConfidence: r.entry.ocrConfidence, ocrExtracted: r.entry.ocrExtracted } : { marks: null, status: 'scored', source: 'manual' }; setEntries(e); setScan(null) }, [plan])
  useSaathiContext(list ? brief(list) : '', ['Which marks are waiting for review?', 'Who scored below 40% in the last test?', 'How does the scan confidence rule work?'])
  if (!list) return <Loading />
  const plans = list.plans
  const byState = s => plans.filter(p => p.state === s)
  const reviewable = plans.filter(p => ['needs_review', 'submitted'].includes(p.state))

  async function doScan() { setBusy(true); try { const r = await api.scanAssessment(plan.plan.id); const e = {}; for (const row of r.rows) e[row.traineeId] = { marks: row.marks, status: row.status, source: 'ocr', ocrConfidence: row.ocrConfidence, ocrExtracted: row.ocrExtracted }; setEntries(e); setScan(r); showToast({ kind: 'info', text: r.note }) } finally { setBusy(false) } }
  async function submit() {
    setBusy(true)
    try { const r = await api.submitMarks(plan.plan.id, Object.entries(entries).map(([traineeId, e]) => ({ traineeId, marks: e.status === 'scored' ? (e.marks == null ? null : Number(e.marks)) : null, status: e.marks == null && e.status === 'scored' ? 'not_assessed' : e.status, source: e.source || 'manual', ocrConfidence: e.ocrConfidence ?? undefined, ocrExtracted: e.ocrExtracted ?? undefined }))); showToast({ kind: 'success', text: r.needsReview ? `Submitted · ${r.needsReview} low-confidence rows for the principal to check.` : 'Marks submitted for confirmation.' }); reload(); reloadList() }
    catch (e) { showToast({ kind: 'danger', text: e.message }) } finally { setBusy(false) }
  }
  async function review(decision) { await api.reviewAssessment(plan.plan.id, { decision }); showToast({ kind: 'success', text: decision === 'confirm' ? 'Confirmed.' : 'Returned to trainer.' }); reload(); reloadList() }
  async function create(e) { e.preventDefault(); await api.createAssessment({ ...form, maxMarks: Number(form.maxMarks) }); showToast({ kind: 'success', text: 'Assessment planned.' }); setCreating(false); reloadList() }

  const editable = plan && !isPrincipal && ['planned', 'conducted', 'marks_pending', 'needs_review', 'submitted'].includes(plan.plan.state)
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="violet" eyebrow="Assessments" title={plan ? `${plan.plan.title} · ${plan.plan.batch.name}` : `${byState('marks_pending').length} marks pending · ${reviewable.length} awaiting review`} subtitle={plan ? `${plan.plan.type} · max ${plan.plan.maxMarks} · ${fmtDate(plan.plan.date)} · ${plan.plan.evaluatorName || ''} · state ${plan.plan.state.replace(/_/g, ' ')}` : 'Marks entered by the trainer (typed or scanned) are provisional until the principal confirms. Low-confidence scans are flagged, never auto-accepted.'}
        right={!isPrincipal && <Btn small tone="ghost" onClick={() => setCreating(c => !c)}><Plus className="w-3 h-3" /> Plan a test</Btn>} />
      <Tabs tabs={[{ id: 'calendar', label: 'Calendar', badge: plans.length }, { id: 'enter', label: isPrincipal ? 'Marks' : 'Enter marks', badge: byState('marks_pending').length || null }, { id: 'review', label: 'Review', badge: reviewable.length || null }]} active={tab} onChange={setTab} />
      <div className="p-4 space-y-4">
        {creating && (
          <form onSubmit={create} className="rounded-2xl border border-primary/30 bg-primary-light/30 p-3 grid grid-cols-2 md:grid-cols-5 gap-2">
            <Field label="Batch" className="col-span-2"><select className={inputCls} value={form.batchId} onChange={e => setForm({ ...form, batchId: e.target.value })} required><option value="">Select…</option>{(batches?.batches || []).filter(b => b.state === 'running').map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
            <Field label="Title"><input className={inputCls} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Type"><select className={inputCls} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="theory">theory</option><option value="practical">practical</option></select></Field>
            <Field label="Max marks"><input type="number" className={inputCls} value={form.maxMarks} onChange={e => setForm({ ...form, maxMarks: e.target.value })} /></Field>
            <Field label="Date" className="col-span-2"><input type="date" className={inputCls} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Topic" className="col-span-2"><input className={inputCls} value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} /></Field>
            <div className="flex items-end"><Btn small type="submit">Save</Btn></div>
          </form>
        )}
        {tab === 'calendar' && (
          <Section title="Planned and past assessments">
            <Table columns={[
              { key: 'date', label: 'Date', render: r => fmtDate(r.date) },
              { key: 'title', label: 'Assessment', render: r => <div><div className="font-semibold">{r.title}</div><div className="text-[10px] text-txt-tertiary">{r.batch.name} · {r.subject?.name || r.type} · max {r.maxMarks}</div></div> },
              { key: 'state', label: 'State', render: r => <Pill kind={stateKind(r.state)}>{r.state.replace(/_/g, ' ')}</Pill> },
              { key: 'summary', label: 'Marks', render: r => r.summary.entered ? <span>{r.summary.scored}/{r.batch._count.trainees} scored · avg {r.summary.avg}{r.summary.needsReview ? <span className="text-amber-700 font-bold"> · {r.summary.needsReview} to check</span> : ''}{r.summary.below40 ? <span className="text-rose-700"> · {r.summary.below40} below 40%</span> : ''}</span> : <span className="text-txt-tertiary">—</span> },
              { key: 'act', label: '', align: 'right', render: r => <Btn small tone="ghost" onClick={() => { setPlanId(r.id); setTab(isPrincipal && ['needs_review', 'submitted'].includes(r.state) ? 'review' : 'enter') }}>Open</Btn> },
            ]} rows={[...plans].sort((a, b) => new Date(b.date) - new Date(a.date))} />
          </Section>
        )}
        {(tab === 'enter' || tab === 'review') && (<>
          {!plan && <div className="space-y-2"><div className="text-[12px] text-txt-secondary">{tab === 'review' ? 'Pick a plan awaiting review:' : 'Pick a plan to enter marks:'}</div><Chips options={(tab === 'review' ? reviewable : plans.filter(p => ['planned', 'conducted', 'marks_pending', 'needs_review', 'submitted'].includes(p.state))).slice(0, 12).map(p => ({ id: p.id, label: `${p.title} · ${p.batch.name.split(' · ')[1] || p.batch.name}` }))} value={planId} onChange={setPlanId} /></div>}
          {plan && (
            <Section title={`${plan.roster.length} students`} hint={scan ? scan.note : 'Type marks, or scan the paper sheet. Rows under 0.75 confidence must be checked before submit.'} right={<div className="flex gap-1.5 flex-wrap">{editable && <Btn small tone="ghost" onClick={doScan} disabled={busy}><ScanLine className="w-3.5 h-3.5" /> Scan sheet</Btn>}{editable && <Btn small onClick={submit} disabled={busy}><Save className="w-3.5 h-3.5" /> Submit marks</Btn>}{isPrincipal && ['needs_review', 'submitted'].includes(plan.plan.state) && <><Btn small tone="danger" onClick={() => review('return')}>Return</Btn><Btn small tone="ok" onClick={() => review('confirm')}>Confirm all</Btn></>}<Btn small tone="ghost" onClick={() => setPlanId(null)}>Close</Btn></div>}>
              <Table columns={[
                { key: 'name', label: 'Student', render: r => <div className="font-semibold">{r.name}</div> },
                { key: 'marks', label: `Marks / ${plan.plan.maxMarks}`, render: r => { const e = entries[r.id] || {}; return editable ? <input type="number" min="0" max={plan.plan.maxMarks} value={e.status === 'scored' && e.marks != null ? e.marks : ''} disabled={e.status !== 'scored'} onChange={ev => setEntries(x => ({ ...x, [r.id]: { ...x[r.id], marks: ev.target.value === '' ? null : Number(ev.target.value), source: 'manual', ocrConfidence: undefined } }))} className={`w-20 rounded-lg border px-2 py-1 text-[12px] ${e.ocrConfidence != null && e.ocrConfidence < 0.75 ? 'border-amber-400 bg-amber-50' : 'border-bdr'}`} /> : <b>{e.marks ?? '—'}</b> } },
                { key: 'status', label: 'Status', render: r => { const e = entries[r.id] || {}; return editable ? <select value={e.status || 'scored'} onChange={ev => setEntries(x => ({ ...x, [r.id]: { ...x[r.id], status: ev.target.value } }))} className="text-[11px] rounded-lg border border-bdr px-1.5 py-1 bg-white">{['scored', 'absent', 'not_assessed', 'withheld'].map(s => <option key={s} value={s}>{titleCase(s)}</option>)}</select> : <Pill kind={e.status === 'scored' ? 'ok' : 'neutral'}>{titleCase(e.status || 'scored')}</Pill> } },
                { key: 'source', label: 'Source', render: r => { const e = entries[r.id] || {}; return e.source === 'ocr' ? <span className={`text-[10px] font-bold ${e.ocrConfidence < 0.75 ? 'text-amber-700' : 'text-emerald-700'}`}>OCR {Math.round((e.ocrConfidence || 0) * 100)}%{e.ocrExtracted != null && e.ocrExtracted !== e.marks ? ` (read ${e.ocrExtracted})` : ''}</span> : <span className="text-[10px] text-txt-tertiary">manual</span> } },
                { key: 'review', label: 'Review', render: r => r.entry ? <Pill kind={stateKind(r.entry.reviewState)}>{r.entry.reviewState.replace(/_/g, ' ')}</Pill> : <span className="text-txt-tertiary">—</span> },
              ]} rows={plan.roster} />
            </Section>
          )}
        </>)}
      </div>
    </div>
  )
}
