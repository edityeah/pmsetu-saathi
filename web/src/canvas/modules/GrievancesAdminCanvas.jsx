// Support & grievance — a case queue for the principal (one ITI) and the
// SPV CEO (the cluster). Cases move new → in review → awaiting response →
// resolved; escalation routes a case to the SPV CEO. Record pages open in
// the canvas with a back arrow; the only popup is the create-case form.
import { useState } from 'react'
import { Plus, Download, Search, ChevronRight, X } from 'lucide-react'
import { BarChart, Bar as RBar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from 'recharts'
import FilterBar from './_FilterBar.jsx'
import { DetailPage, DetailCard, LabelGrid } from './_Detail.jsx'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading, Hero, Stat, StatGrid, Section, Table, Tabs, Pill, Btn, Field, inputCls, fmtDate, titleCase } from './_ui.jsx'
import { useSaathiContext } from '../CanvasSaathi.jsx'

const TABS = [{ id: 'overview', label: 'Case overview' }, { id: 'all', label: 'All cases' }, { id: 'escalated', label: 'Escalated' }, { id: 'help', label: 'Knowledge & help' }]
const CATS = { course_access: 'Course access', facility_issue: 'Facility issue', trainer_support: 'Trainer support', financial_barrier: 'Financial barrier', placement_concern: 'Placement concern', safety_concern: 'Safety concern', equipment: 'Equipment', transport: 'Transport' }
const STATUS = { new: { kind: 'info', label: 'New' }, in_review: { kind: 'sky', label: 'In review' }, awaiting_response: { kind: 'warn', label: 'Awaiting response' }, escalated: { kind: 'bad', label: 'Escalated' }, resolved: { kind: 'ok', label: 'Resolved' } }
const PRIO = { high: 'text-rose-600', medium: 'text-amber-600', low: 'text-slate-500' }
const OWNERS = ['Principal', 'Institute Admin', 'Academic Coord.', 'TPO', 'SPV']
const PALETTE = ['#386AF6', '#10B981', '#8B5CF6', '#F59E0B', '#0EA5E9', '#F43F5E', '#14B8A6', '#D946EF']
const tip = { background: 'white', border: '1px solid #CFD8E6', borderRadius: 8, fontSize: 11 }
const Card = ({ title, sub, children, right }) => <div className="rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden h-full flex flex-col"><div className="px-4 py-2.5 bg-gradient-to-r from-surface-page/50 to-white border-b border-bdr-light flex items-start gap-2"><div className="flex-1"><div className="text-[11px] font-bold uppercase tracking-wider text-primary">{title}</div>{sub && <div className="text-[10px] text-txt-tertiary">{sub}</div>}</div>{right}</div><div className="p-4 flex-1">{children}</div></div>
const todayIso = () => new Date().toISOString().slice(0, 10)
const daysAgoIso = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
const Prio = ({ p }) => <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${PRIO[p] || ''}`}><span className="w-1.5 h-1.5 rounded-full bg-current" />{titleCase(p)}</span>

export default function GrievancesAdminCanvas({ context }) {
  const { role, meExtra, showToast } = useApp()
  const f0 = context?.filters || {}
  const [tab, setTab] = useState(TABS.some(t => t.id === context?.tab) ? context.tab : 'overview')
  const [category, setCategory] = useState(f0.category || 'all'), [priority, setPriority] = useState(f0.priority || 'all'), [status, setStatus] = useState(f0.status || 'all'), [source, setSource] = useState('all'), [from, setFrom] = useState(f0.from || daysAgoIso(30)), [to, setTo] = useState(f0.to || todayIso()), [q, setQ] = useState('')
  const [itiId, setItiId] = useState(f0.itiId || f0.scope || 'all')
  const [open, setOpen] = useState(null), [creating, setCreating] = useState(false), [all, setAll] = useState(false)
  const { data: itis } = useLoad(() => role === 'spv_ceo' ? api.itis() : Promise.resolve(null))
  const params = { category, priority, status, source, from, to, q, ...(role === 'spv_ceo' ? { itiId } : {}) }
  const { data: d, reload } = useLoad(() => api.cases(params), [category, priority, status, source, from, to, q, itiId])
  useSaathiContext(d ? `Support and grievance cases (${role === 'spv_ceo' ? 'cluster' : meExtra?.iti?.name || 'my ITI'}): ${d.totals.open} open, ${d.totals.dueSoon} due within 3 days, ${d.totals.overdue} overdue, ${d.totals.escalated} escalated, ${d.totals.resolvedThisMonth} resolved this month. Open by category: ${d.byCategory.map(c => `${CATS[c.category] || c.category} ${c.n}`).join(', ')}. Queue: ${d.grievances.filter(g => g.status !== 'resolved').slice(0, 10).map(g => `${g.code} ${CATS[g.category] || g.category} (${g.priority}, ${STATUS[g.status]?.label}, owner ${g.ownerRole || 'unassigned'}, next: ${g.nextAction || '—'})`).join('; ')}.` : '', ['Which cases are overdue?', 'What is escalated to the SPV?', 'How many cases were resolved within the SLA this month?'])
  if (open) return <CaseRecord id={open} onBack={() => { setOpen(null); reload() }} role={role} />
  const filters = [
    ...(role === 'spv_ceo' ? [{ label: 'ITI', value: itiId, options: [{ id: 'all', label: 'All ITIs' }, ...((itis?.itis || []).map(i => ({ id: i.id, label: i.name })))], onChange: setItiId }] : []),
    { label: 'Case type', value: category, options: [{ id: 'all', label: 'All types' }, ...Object.entries(CATS).map(([id, label]) => ({ id, label }))], onChange: setCategory },
    { label: 'Priority', value: priority, options: [{ id: 'all', label: 'All' }, { id: 'high', label: 'High' }, { id: 'medium', label: 'Medium' }, { id: 'low', label: 'Low' }], onChange: setPriority },
    { label: 'Status', value: status, options: [{ id: 'all', label: 'All' }, { id: 'open', label: 'Open (any)' }, ...Object.entries(STATUS).map(([id, s]) => ({ id, label: s.label }))], onChange: setStatus },
    { label: 'Source', value: source, options: [{ id: 'all', label: 'All' }, { id: 'app', label: 'Raised in app' }, { id: 'offline', label: 'Logged offline' }], onChange: setSource },
    { label: 'From', type: 'date', value: from, onChange: setFrom }, { label: 'To', type: 'date', value: to, onChange: setTo },
  ]
  function exportCsv() {
    if (!d) return
    const csv = [['Case ID', 'Category', 'Title', 'Raised by', 'Role', 'ITI', 'Received', 'Priority', 'Owner', 'Status', 'Next action', 'Due', 'Resolved', 'Source'], ...d.grievances.map(g => [g.code, CATS[g.category] || g.category, g.title || '', g.raisedBy?.name, g.raisedBy?.role, g.iti?.code, String(g.createdAt).slice(0, 10), g.priority, g.ownerRole || '', STATUS[g.status]?.label || g.status, g.nextAction || '', g.dueAt ? String(g.dueAt).slice(0, 10) : '', g.resolvedAt ? String(g.resolvedAt).slice(0, 10) : '', g.source])].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `cases-${from}-${to}.csv`; a.click()
  }
  const queueCols = [
    { key: 'code', label: 'Case ID', render: g => <button className="font-semibold hover:text-primary text-left whitespace-nowrap" onClick={() => setOpen(g.id)}>{g.code || g.id.slice(0, 8)}</button> },
    { key: 'category', label: 'Category', render: g => <div><div className="text-[12px] font-semibold">{CATS[g.category] || titleCase(g.category)}</div><div className="text-[10px] text-txt-tertiary truncate max-w-[220px]">{g.note}</div></div> },
    { key: 'raisedBy', label: 'Raised by', render: g => <span className="text-[11px]">{g.restricted && g.raisedBy?.name === 'Restricted' ? <Pill kind="neutral">Restricted</Pill> : <>{g.raisedBy?.name}<span className="text-txt-tertiary"> ({g.raisedBy?.role === 'trainee' ? 'Student' : titleCase(g.raisedBy?.role)})</span></>}{role === 'spv_ceo' && g.iti ? <span className="block text-[10px] text-txt-tertiary">{g.iti.code}</span> : null}</span> },
    { key: 'createdAt', label: 'Received', render: g => <span className="text-[11px]">{fmtDate(g.createdAt)}</span> },
    { key: 'priority', label: 'Priority', render: g => <Prio p={g.priority} /> },
    { key: 'ownerRole', label: 'Owner', render: g => <span className="text-[11px]">{g.ownerRole || '—'}</span> },
    { key: 'status', label: 'Status', render: g => <Pill kind={STATUS[g.status]?.kind || 'neutral'}>{STATUS[g.status]?.label || titleCase(g.status)}</Pill> },
    { key: 'nextAction', label: 'Next action', render: g => <span className="text-[11px]">{g.status === 'resolved' ? <span className="text-txt-tertiary">Closed {fmtDate(g.resolvedAt)}</span> : <>{g.nextAction || '—'}{g.overdue ? <span className="block text-[10px] text-rose-600 font-bold">Overdue · due {fmtDate(g.dueAt)}</span> : g.dueAt ? <span className="block text-[10px] text-txt-tertiary">due {fmtDate(g.dueAt)}</span> : null}</>}</span> },
    { key: 'open', label: '', align: 'right', render: g => <button onClick={() => setOpen(g.id)} className="p-1 rounded-pill hover:bg-surface-page"><ChevronRight className="w-4 h-4 text-primary" /></button> },
  ]
  const openList = d ? d.grievances.filter(g => g.status !== 'resolved') : []
  const queue = status === 'all' ? openList : d?.grievances || []
  const shown = all ? queue : queue.slice(0, 5)
  const scopeLabel = role === 'spv_ceo' ? 'cluster' : meExtra?.iti?.name || 'my institute'
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="rose" eyebrow="Support and grievance" title={d ? `${d.totals.open} open cases · ${d.totals.escalated} escalated` : 'Support and grievance'} subtitle="Student and staff issues tracked through resolution. Submitter details on restricted cases are shown only to authorised institute staff; no student chat transcripts are available." right={<div className="flex gap-2"><button onClick={exportCsv} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white border border-bdr text-[11px] font-bold text-txt-primary hover:bg-surface-page"><Download className="w-3.5 h-3.5" /> Download list</button><button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-primary text-white text-[11px] font-bold hover:opacity-90"><Plus className="w-3.5 h-3.5" /> Create case</button></div>} />
      <Tabs tabs={TABS.map(t => t.id === 'escalated' && d ? { ...t, badge: d.totals.escalated || null } : t)} active={tab} onChange={setTab} />
      {tab !== 'help' && <FilterBar items={filters} note={d ? `${d.grievances.length} cases · ${scopeLabel}` : ''} />}
      {!d ? <Loading /> : (<>
        {tab === 'overview' && (
          <div className="p-4 space-y-5">
            <div className="flex items-center gap-2 flex-wrap"><label className="relative flex-1 min-w-[200px] max-w-sm"><Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-txt-tertiary" /><input className={`${inputCls} pl-7`} placeholder="Search case ID or text (e.g. ITI-PUS-026)" value={q} onChange={e => setQ(e.target.value)} /></label></div>
            <StatGrid>
              <Stat label="Open cases" value={d.totals.open} sub={`${d.totals.overdue} overdue`} tone={d.totals.overdue ? 'rose' : 'indigo'} onClick={() => { setStatus('open'); setTab('all') }} />
              <Stat label="Due soon" value={d.totals.dueSoon} sub="due within 3 days" tone="amber" onClick={() => { setStatus('open'); setTab('all') }} />
              <Stat label="Escalated" value={d.totals.escalated} sub="with the SPV CEO" tone="rose" onClick={() => setTab('escalated')} />
              <Stat label="Resolved this month" value={d.totals.resolvedThisMonth} sub={`${d.totals.resolved} resolved in range`} tone="emerald" onClick={() => { setStatus('resolved'); setTab('all') }} />
            </StatGrid>
            <Section tone="indigo" title={`Case queue · ${queue.length}`} hint="Open cases, newest first. Tap a case to see its timeline, add a response, escalate or resolve." right={<button className="text-[11px] text-primary font-bold" onClick={() => setCreating(true)}>Log an issue raised offline →</button>}>
              <Table tone="indigo" columns={queueCols} rows={shown} empty="No open cases in this range." />
              {queue.length > 5 && <div className="flex items-center justify-between pt-2 text-[11px] text-txt-tertiary"><span>Showing {shown.length} of {queue.length}</span><button className="text-primary font-bold" onClick={() => setAll(a => !a)}>{all ? 'Show five' : `View more (${queue.length - 5})`} →</button></div>}
            </Section>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-stretch">
              <Card title="Cases by category" sub="open cases" right={<button className="text-[11px] text-primary font-bold" onClick={() => { setStatus('open'); setTab('all') }}>View details →</button>}>
                <div style={{ height: Math.max(200, d.byCategory.length * 30 + 16) }}><ResponsiveContainer><BarChart data={d.byCategory.map(c => ({ ...c, label: CATS[c.category] || titleCase(c.category) }))} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 0 }} barCategoryGap={6}><XAxis type="number" hide allowDecimals={false} /><YAxis type="category" dataKey="label" width={110} fontSize={10} stroke="#7383A5" interval={0} /><Tooltip contentStyle={tip} /><RBar dataKey="n" name="Open cases" radius={[0, 6, 6, 0]} onClick={x => setCategory(category === x.category ? 'all' : x.category)}>{d.byCategory.map((c, i) => <Cell key={c.category} fill={PALETTE[i % PALETTE.length]} opacity={category === 'all' || category === c.category ? 1 : 0.3} />)}<LabelList dataKey="n" position="right" fontSize={10} fill="#1A1F36" /></RBar></BarChart></ResponsiveContainer></div>
              </Card>
              <Card title="Resolution timeliness" sub="weekly: resolved within the SLA vs after it (high 3 days, medium 7, low 14)">
                <div style={{ height: 220 }}><ResponsiveContainer><LineChart data={d.weeks} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis dataKey="label" fontSize={9} stroke="#7383A5" interval={0} /><YAxis fontSize={10} stroke="#7383A5" width={28} allowDecimals={false} /><Tooltip contentStyle={tip} /><Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} /><Line type="monotone" dataKey="withinSla" name="Resolved within SLA" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} /><Line type="monotone" dataKey="overdue" name="Resolved after SLA" stroke="#F43F5E" strokeWidth={2} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div>
              </Card>
            </div>
          </div>
        )}
        {tab === 'all' && (
          <div className="p-4 space-y-5">
            <div className="flex items-center gap-2 flex-wrap"><label className="relative flex-1 min-w-[200px] max-w-sm"><Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-txt-tertiary" /><input className={`${inputCls} pl-7`} placeholder="Search case ID or text" value={q} onChange={e => setQ(e.target.value)} /></label>{(category !== 'all' || priority !== 'all' || status !== 'all' || source !== 'all' || q) && <button className="text-[11px] text-primary font-bold" onClick={() => { setCategory('all'); setPriority('all'); setStatus('all'); setSource('all'); setQ('') }}>Clear filters</button>}</div>
            <Section tone="emerald" title={`All cases · ${d.grievances.length}`} hint="Every case in the date range, newest first."><Table tone="emerald" columns={queueCols} rows={d.grievances} empty="No cases match." /></Section>
          </div>
        )}
        {tab === 'escalated' && (
          <div className="p-4 space-y-5">
            <StatGrid cols={3}>
              <Stat label="Escalated" value={d.totals.escalated} sub="awaiting the SPV CEO" tone="rose" />
              <Stat label="Overdue among them" value={d.grievances.filter(g => g.status === 'escalated' && g.overdue).length} sub="past the SLA date" tone="amber" />
              <Stat label="High priority" value={d.grievances.filter(g => g.status === 'escalated' && g.priority === 'high').length} tone="violet" />
            </StatGrid>
            <Section tone="amber" title="Escalated to the SPV CEO" hint="Cases that need a decision outside the institute."><Table tone="amber" columns={queueCols} rows={d.grievances.filter(g => g.status === 'escalated')} empty="Nothing escalated in this range." /></Section>
          </div>
        )}
      </>)}
      {tab === 'help' && <KnowledgeHelp />}
      {creating && <CreateCasePopup role={role} itis={itis?.itis || []} onClose={() => setCreating(false)} onDone={() => { setCreating(false); reload(); showToast({ kind: 'success', text: 'Case logged and added to the queue.' }) }} />}
    </div>
  )
}

function CaseRecord({ id, onBack, role }) {
  const { showToast } = useApp()
  const { data: d, reload } = useLoad(() => api.caseOne(id), [id])
  const [text, setText] = useState(''), [mode, setMode] = useState(null), [note, setNote] = useState(''), [busy, setBusy] = useState(false)
  useSaathiContext(d ? `Case ${d.grievance.code}: ${CATS[d.grievance.category] || d.grievance.category}, ${d.grievance.priority} priority, ${STATUS[d.grievance.status]?.label}, owner ${d.grievance.ownerRole || 'unassigned'}, next action ${d.grievance.nextAction || '—'}, due ${fmtDate(d.grievance.dueAt)}. Summary: ${d.grievance.note}. Responses: ${d.grievance.responses.map(r => `${fmtDate(r.at)} ${r.by}: ${r.text}`).join(' | ')}` : '', ['What should the next action on this case be?', 'Draft a reply to the submitter.'])
  if (!d) return <Loading />
  const g = d.grievance
  const steps = [['Received', g.createdAt], ['Acknowledged', g.acknowledgedAt], ['Assigned', g.assignedAt], [g.status === 'resolved' ? 'Resolved' : 'Resolution', g.resolvedAt]]
  async function run(fn, ok) { setBusy(true); try { await fn(); showToast({ kind: 'success', text: ok }); setText(''); setNote(''); setMode(null); reload() } catch (e) { showToast({ kind: 'danger', text: e.message }) } finally { setBusy(false) } }
  const canAct = role === 'iti_principal' || role === 'spv_ceo'
  return (
    <DetailPage onBack={onBack} eyebrow={`Case · ${CATS[g.category] || titleCase(g.category)} · ${g.source === 'offline' ? 'logged offline' : 'raised in app'}`} title={g.title || CATS[g.category] || titleCase(g.category)} id={g.code || g.id} sub={`Raised by ${g.raisedBy?.name}${g.raisedBy?.role ? ` (${g.raisedBy.role === 'trainee' ? 'Student' : titleCase(g.raisedBy.role)})` : ''} · received ${fmtDate(g.createdAt)}${g.iti ? ` · ${g.iti.name}` : ''}`} pill={STATUS[g.status] || { kind: 'neutral', label: titleCase(g.status) }}>
      <DetailCard title="Summary" icon="📝">
        <p className="text-[13px] text-txt-primary leading-relaxed">{g.note}</p>
        {g.restricted && <div className="mt-3 rounded-xl bg-surface-page px-3 py-2 text-[11px] text-txt-secondary">Submitter details are shown only to authorised institute staff. No public student chat transcripts are available.</div>}
      </DetailCard>
      <DetailCard title="Case timeline" icon="⏱️">
        <ol className="grid grid-cols-2 sm:grid-cols-4 gap-3">{steps.map(([label, at], i) => <li key={label} className="relative"><div className="flex items-center gap-2"><span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${at ? 'bg-emerald-500 text-white' : 'border-2 border-bdr text-txt-tertiary'}`}>{at ? '✓' : i + 1}</span>{i < 3 && <span className={`hidden sm:block flex-1 h-0.5 ${at && steps[i + 1][1] ? 'bg-emerald-400' : 'bg-bdr-light'}`} />}</div><div className="text-[12px] font-semibold text-txt-primary mt-1.5">{label}</div><div className="text-[10px] text-txt-tertiary">{at ? new Date(at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'pending'}</div></li>)}</ol>
      </DetailCard>
      <DetailCard title="Handling" icon="🧭">
        <LabelGrid items={[['Assigned to', g.ownerRole || 'Unassigned'], ['Priority', titleCase(g.priority)], ['Next action', g.nextAction || '—'], ['Due date', fmtDate(g.dueAt)], ['Escalated', g.escalatedAt ? `${fmtDate(g.escalatedAt)} to the SPV CEO` : 'No'], ['Resolution', g.resolutionNote || '—']]} />
      </DetailCard>
      <DetailCard title="Responses" icon="💬">
        {g.responses.length === 0 ? <div className="text-[12px] text-txt-tertiary">No responses yet.</div> : <ul className="space-y-2.5">{g.responses.map((r, i) => <li key={i} className="text-[12px]"><div className="text-txt-primary">{r.text}</div><div className="text-[10px] text-txt-tertiary">{new Date(r.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {r.by}</div></li>)}</ul>}
        {canAct && g.status !== 'resolved' && (
          <div className="mt-4 space-y-2">
            {mode === null && <div className="flex gap-2 flex-wrap"><Btn onClick={() => setMode('respond')}>Add response</Btn>{role === 'iti_principal' && g.status !== 'escalated' && <Btn tone="ghost" onClick={() => setMode('escalate')}>Escalate to SPV CEO</Btn>}<Btn tone="ok" onClick={() => setMode('resolve')}>Mark resolved</Btn></div>}
            {mode === 'respond' && <form onSubmit={e => { e.preventDefault(); run(() => api.caseRespond(g.id, { text, nextAction: note || undefined }), 'Response added.') }} className="space-y-2"><Field label="Response to the submitter or the team"><textarea className={`${inputCls} min-h-[72px]`} value={text} onChange={e => setText(e.target.value)} required /></Field><Field label="Next action (optional)"><input className={inputCls} value={note} onChange={e => setNote(e.target.value)} placeholder={g.nextAction || 'e.g. Confirm repair timeline'} /></Field><div className="flex gap-2"><Btn type="submit" disabled={busy}>Save response</Btn><Btn tone="ghost" onClick={() => setMode(null)}>Cancel</Btn></div></form>}
            {mode === 'escalate' && <form onSubmit={e => { e.preventDefault(); run(() => api.caseEscalate(g.id, { note }), 'Escalated to the SPV CEO.') }} className="space-y-2"><Field label="Why this needs the SPV CEO"><textarea className={`${inputCls} min-h-[60px]`} value={note} onChange={e => setNote(e.target.value)} placeholder="Decision or budget outside the institute" /></Field><div className="flex gap-2"><Btn type="submit" disabled={busy}>Escalate</Btn><Btn tone="ghost" onClick={() => setMode(null)}>Cancel</Btn></div></form>}
            {mode === 'resolve' && <form onSubmit={e => { e.preventDefault(); run(() => api.grievanceStatus(g.id, { status: 'resolved', resolutionNote: note || 'Resolved.' }), 'Marked resolved.') }} className="space-y-2"><Field label="Resolution note"><textarea className={`${inputCls} min-h-[60px]`} value={note} onChange={e => setNote(e.target.value)} placeholder="What was done and how the submitter was informed" required /></Field><div className="flex gap-2"><Btn type="submit" tone="ok" disabled={busy}>Mark resolved</Btn><Btn tone="ghost" onClick={() => setMode(null)}>Cancel</Btn></div></form>}
          </div>
        )}
      </DetailCard>
    </DetailPage>
  )
}

function KnowledgeHelp() {
  const { data } = useLoad(() => api.companionKb())
  if (!data) return <Loading />
  return (
    <div className="p-4 space-y-5">
      <Section tone="violet" title="Support directory" hint="Who handles which issue at this institute, the channel and the expected response time.">
        <Table tone="violet" columns={[{ key: 'supportType', label: 'Support', render: s => <span className="font-semibold">{s.supportType}</span> }, { key: 'responsibleRole', label: 'Responsible' }, { key: 'contactChannel', label: 'Channel' }, { key: 'issuesHandled', label: 'Issues handled', render: s => <span className="text-[11px]">{s.issuesHandled}</span> }, { key: 'responseTime', label: 'Response time' }, { key: 'status', label: 'Status', render: s => <Pill kind={s.status === 'Active' ? 'ok' : 'neutral'}>{s.status}</Pill> }]} rows={data.support || []} empty="No support contacts recorded for this institute." />
      </Section>
      <Section tone="sky" title="Response rules" hint="How Saathi and staff respond to each kind of signal.">
        <Table tone="sky" columns={[{ key: 'appliesTo', label: 'Applies to', render: r => <span className="font-semibold">{r.appliesTo}</span> }, { key: 'instruction', label: 'Instruction', render: r => <span className="text-[11px]">{r.instruction}</span> }, { key: 'fallback', label: 'If unsure', render: r => <span className="text-[11px]">{r.fallback}</span> }]} rows={(data.rules || []).slice(0, 8)} empty="No rules recorded." />
      </Section>
    </div>
  )
}

function CreateCasePopup({ role, itis, onClose, onDone }) {
  const { showToast } = useApp()
  const [f, setF] = useState({ category: 'facility_issue', title: '', note: '', priority: 'medium', source: 'offline', restricted: false, ownerRole: 'Principal', nextAction: '', itiId: '' })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  async function submit(e) {
    e.preventDefault(); setBusy(true)
    try { await api.raiseGrievance({ category: f.category, title: f.title || undefined, note: f.note, priority: f.priority, source: f.source, restricted: f.restricted, ownerRole: f.ownerRole, nextAction: f.nextAction || undefined, ...(role === 'spv_ceo' && f.itiId ? { itiId: f.itiId } : {}) }); onDone() }
    catch (err) { showToast({ kind: 'danger', text: err.message }) } finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-3" onClick={onClose}>
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white shadow-modal overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-bdr-light flex items-start gap-3"><div className="flex-1"><div className="text-[10px] uppercase tracking-wider font-bold text-primary">Support and grievance</div><div className="text-[15px] font-bold text-txt-primary">Create a case</div><div className="text-[11px] text-txt-secondary">Log an issue raised offline by a student or staff member. It enters the queue as in review with you as owner.</div></div><button type="button" onClick={onClose} className="p-1.5 rounded-pill hover:bg-slate-100"><X className="w-4 h-4 text-txt-secondary" /></button></div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Case type"><select className={inputCls} value={f.category} onChange={e => set('category', e.target.value)}>{Object.entries(CATS).map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select></Field>
          <Field label="Priority"><select className={inputCls} value={f.priority} onChange={e => set('priority', e.target.value)}><option value="high">High · 3-day SLA</option><option value="medium">Medium · 7-day SLA</option><option value="low">Low · 14-day SLA</option></select></Field>
          <Field label="Title" className="sm:col-span-2"><input className={inputCls} value={f.title} onChange={e => set('title', e.target.value)} placeholder="Short name for the case" /></Field>
          <Field label="What was raised" className="sm:col-span-2"><textarea className={`${inputCls} min-h-[72px]`} value={f.note} onChange={e => set('note', e.target.value)} required /></Field>
          <Field label="Owner"><select className={inputCls} value={f.ownerRole} onChange={e => set('ownerRole', e.target.value)}>{OWNERS.map(o => <option key={o}>{o}</option>)}</select></Field>
          <Field label="Source"><select className={inputCls} value={f.source} onChange={e => set('source', e.target.value)}><option value="offline">Logged offline (walk-in, phone, register)</option><option value="app">Raised in the app</option></select></Field>
          <Field label="Next action" className="sm:col-span-2"><input className={inputCls} value={f.nextAction} onChange={e => set('nextAction', e.target.value)} placeholder="e.g. Confirm repair timeline" /></Field>
          {role === 'spv_ceo' && <Field label="ITI" className="sm:col-span-2"><select className={inputCls} value={f.itiId} onChange={e => set('itiId', e.target.value)}><option value="">Cluster-level</option>{itis.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></Field>}
          <label className="sm:col-span-2 flex items-center gap-2 text-[12px] text-txt-secondary"><input type="checkbox" checked={f.restricted} onChange={e => set('restricted', e.target.checked)} /> Restricted: hide the submitter's details from staff outside the institute</label>
        </div>
        <div className="px-4 pb-4 flex justify-end gap-2"><Btn tone="ghost" onClick={onClose}>Cancel</Btn><Btn type="submit" disabled={busy}>{busy ? 'Saving…' : 'Create case'}</Btn></div>
      </form>
    </div>
  )
}
