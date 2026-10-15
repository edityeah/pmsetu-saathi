// Cluster Registry — section 3. Kept minimal: a landing with the two
// registries as hero numbers, a Student registry and a Trainer registry
// (filters, one chart each, paginated records), and a record page for any
// student or trainer with a back arrow. Enrolment analytics stays as the
// view the seat-utilisation headline card opens.
import { useState } from 'react'
import { Download, Search, ChevronRight } from 'lucide-react'
import BarChartCard from '../../components/cards/BarChartCard.jsx'
import DonutChartCard from '../../components/cards/DonutChartCard.jsx'
import FilterBar from './_FilterBar.jsx'
import { DetailPage, DetailCard, LabelGrid } from './_Detail.jsx'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading, Hero, Stat, StatGrid, Bar, Section, Table, Tabs, Pill, Btn, fmtPct, fmtNum, fmtDate, NoFeed, inputCls, stateKind, titleCase } from './_ui.jsx'
import { useSaathiContext } from '../CanvasSaathi.jsx'

const TABS = [{ id: 'overview', label: 'Students & trainers' }, { id: 'students', label: 'Student registry' }, { id: 'trainers', label: 'Trainer registry' }, { id: 'enrolment', label: 'Enrolment analytics' }]
const sel = inputCls + ' w-auto'

export default function ClusterRegistryCanvas({ context }) {
  const { role, openCanvas } = useApp()
  const f0 = context?.filters || {}
  const [tab, setTab] = useState(context?.tab || 'overview')
  const [scope, setScope] = useState(f0.scope || 'all')
  const [student, setStudent] = useState(null)
  const [trainer, setTrainer] = useState(null)
  const { data: itis } = useLoad(() => api.itis())
  const scopeOpts = [{ id: 'all', label: 'All reporting ITIs' }, ...((itis?.itis || []).map(i => ({ id: i.id, label: i.name })))]
  const canSwitch = role !== 'iti_principal' && role !== 'trainer'

  if (student) return <StudentRecord id={student} onBack={() => setStudent(null)} openCanvas={openCanvas} />
  if (trainer) return <TrainerRecord id={trainer} onBack={() => setTrainer(null)} openCanvas={openCanvas} />

  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="violet" eyebrow="Cluster registry" title={tab === 'overview' ? 'Students & trainers' : tab === 'students' ? 'Student registry' : tab === 'trainers' ? 'Trainer registry' : 'Enrolment against sanctioned seats'} subtitle={tab === 'overview' ? 'People, courses, batches and teaching assignments across reporting ITIs.' : tab === 'students' ? 'Enrolled learners mapped to institutes, trades and batches. Tap a student for the record.' : tab === 'trainers' ? 'Staff mapped to trades, batches and subject responsibilities. Tap a trainer for the record.' : 'Enrolled students as a share of sanctioned seats, per ITI and for the cluster.'} />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'overview' && <Overview scope={scope} setScope={setScope} scopeOpts={scopeOpts} canSwitch={canSwitch} onStudents={() => setTab('students')} onTrainers={() => setTab('trainers')} />}
      {tab === 'students' && <Students scope={scope} setScope={setScope} scopeOpts={scopeOpts} canSwitch={canSwitch} f0={f0} onOpen={setStudent} />}
      {tab === 'trainers' && <Trainers scope={scope} setScope={setScope} scopeOpts={scopeOpts} canSwitch={canSwitch} onOpen={setTrainer} />}
      {tab === 'enrolment' && <Enrolment scope={scope} setScope={setScope} scopeOpts={scopeOpts} canSwitch={canSwitch} openCanvas={openCanvas} />}
    </div>
  )
}

// ── Landing: two registries, hero numbers, by-ITI bars ─────────────────────
function Overview({ scope, setScope, scopeOpts, canSwitch, onStudents, onTrainers }) {
  const st = useLoad(() => api.registryStudents({ itiId: scope === 'all' ? undefined : scope }), [scope])
  const tr = useLoad(() => api.registryTrainers({ itiId: scope === 'all' ? undefined : scope }), [scope])
  const s = st.data, t = tr.data
  useSaathiContext(s && t ? `Cluster registry: ${s.total} active students across ${s.options.batches.length} batches (${s.byIti.map(i => `${i.code} ${i.n ?? 'no feed'}`).join(', ')}); ${t.total} trainers, ${t.assignments} subject assignments (${t.byIti.map(i => `${i.code} ${i.n ?? 'no feed'}`).join(', ')}). ${s.coverage}.` : '', ['How many students are mapped to Shahdara?', 'Which trainers hold four batches?'])
  const maxS = s ? Math.max(1, ...s.byIti.map(i => i.n || 0)) : 1, maxT = t ? Math.max(1, ...t.byIti.map(i => i.n || 0)) : 1
  return (<>
    <FilterBar items={canSwitch ? [{ label: 'ITI', value: scope, options: scopeOpts, onChange: setScope }, { label: 'Academic year', value: 'Year 1' }] : [{ label: 'Academic year', value: 'Year 1' }]} note={s ? s.coverage : ''} />
    {!s || !t ? <Loading /> : (
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RegistryCard icon="🎓" title="Student registry" desc="Enrolled learners through ITI, trade and batch mappings." a={[fmtNum(s.total), 'active students']} b={[fmtNum(s.options.batches.length), 'mapped batches']} line={s.byIti.filter(i => i.n != null).map(i => `${i.name.replace('Government ITI ', '')} ${fmtNum(i.n)}`).join(' · ')} rows={s.byIti} max={maxS} color="bg-primary" cta="Open student registry" onOpen={onStudents} />
          <RegistryCard icon="👩‍🏫" title="Trainer registry" desc="Staff, subject assignments and batch responsibilities." a={[fmtNum(t.total), 'active trainers']} b={[fmtNum(t.assignments), 'subject assignments']} line={t.byIti.filter(i => i.n != null).map(i => `${i.name.replace('Government ITI ', '')} ${fmtNum(i.n)}`).join(' · ')} rows={t.byIti} max={maxT} color="bg-emerald-500" cta="Open trainer registry" onOpen={onTrainers} />
        </div>
        <Section title="How the registry is connected" hint="CEO: cluster view · Principal: own ITI and add records">
          <div className="flex items-stretch gap-2 flex-wrap text-[12px]">
            {[['🏫', 'Institute', 'Pusa, Shahdara and other cluster ITIs'], ['📘', 'Trade', 'Trades offered at each ITI'], ['👥', 'Batch', 'Batches within trades · trainers hold subject assignments'], ['🎓', 'Students', 'Enrolled learners in each batch']].map(([ic, k, v], i, arr) => (
              <div key={k} className="flex items-center gap-2 flex-1 min-w-[180px]">
                <div className="flex-1 rounded-xl bg-surface-page border border-bdr-light p-2.5 flex items-center gap-2"><span className="text-[18px]" aria-hidden>{ic}</span><div><div className="font-bold text-txt-primary">{k}</div><div className="text-[10px] text-txt-tertiary">{v}</div></div></div>
                {i < arr.length - 1 && <span className="text-primary font-bold">→</span>}
              </div>
            ))}
          </div>
        </Section>
        {s.byIti.some(i => i.n == null) && <NoFeed>{s.byIti.filter(i => i.n == null).map(i => i.name.replace('Government ITI ', '')).join(', ')}: no detailed roster feed yet. Their students and trainers appear once the registry is connected.</NoFeed>}
      </div>
    )}
  </>)
}

function RegistryCard({ icon, title, desc, a, b, line, rows, max, color, cta, onOpen }) {
  return (
    <button onClick={onOpen} className="text-left rounded-2xl border border-bdr-light bg-white shadow-card p-4 hover:shadow-modal transition">
      <div className="flex items-start gap-3"><span className="w-12 h-12 rounded-2xl bg-primary-light text-[22px] flex items-center justify-center" aria-hidden>{icon}</span><div className="min-w-0"><div className="text-[15px] font-bold text-txt-primary">{title}</div><div className="text-[12px] text-txt-secondary">{desc}</div></div></div>
      <div className="grid grid-cols-2 gap-3 mt-3">{[a, b].map(([v, l]) => <div key={l}><div className="text-[24px] font-bold text-txt-primary leading-tight tabular-nums">{v}</div><div className="text-[11px] text-txt-secondary">{l}</div></div>)}</div>
      <div className="text-[11px] text-txt-secondary mt-1.5">{line}</div>
      <div className="mt-3 border-t border-bdr-light pt-3"><div className="text-[11px] font-bold text-txt-primary mb-1.5">{title.split(' ')[0]}s by ITI</div><div className="space-y-1.5">{rows.filter(r => r.n != null).map(r => <div key={r.code} className="flex items-center gap-2 text-[11px]"><span className="w-16 text-txt-secondary">{r.name.replace('Government ITI ', '')}</span><div className="flex-1 h-3 rounded bg-surface-page overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${Math.round(100 * r.n / max)}%` }} /></div><span className="w-12 text-right tabular-nums font-semibold">{fmtNum(r.n)}</span></div>)}</div></div>
      <div className="mt-3 text-[11px] text-primary font-bold">{cta} →</div>
    </button>
  )
}

// ── Student registry ──────────────────────────────────────────────────────
function Students({ scope, setScope, scopeOpts, canSwitch, f0, onOpen }) {
  const [trade, setTrade] = useState('all'), [batch, setBatch] = useState('all'), [gender, setGender] = useState(f0.gender || 'all'), [status, setStatus] = useState(f0.status || 'active'), [q, setQ] = useState(''), [page, setPage] = useState(1)
  const params = { itiId: scope === 'all' ? undefined : scope, trade, batchId: batch, gender, status, q: q || undefined, page }
  const { data: d } = useLoad(() => api.registryStudents(params), [scope, trade, batch, gender, status, q, page])
  useSaathiContext(d ? `Student registry (${d.coverage}; filters trade ${trade}, batch ${batch}, gender ${gender}, status ${status}): ${d.total} students; by trade ${d.byTrade.map(t => `${t.name} ${t.n}`).join(', ')}; ${d.gender.male} male, ${d.gender.female} female.` : '', ['Show female students in Shahdara', 'Which trade has the most students?'])
  const set = fn => v => { fn(v); setPage(1) }
  function exportCsv() { if (!d) return; api.registryStudents({ ...params, page: 1 }).then(() => { const rows = [['Student ID', 'Name', 'ITI', 'Trade', 'Batch', 'Gender', 'Status'], ...d.rows.map(r => [r.id, r.name, r.itiCode, r.trade, r.batch, r.gender, r.status])]; download(rows, `students-${scope}-${trade}-${gender}.csv`) }) }
  return (<>
    <FilterBar items={[...(canSwitch ? [{ label: 'ITI', value: scope, options: scopeOpts, onChange: set(setScope) }] : []), { label: 'Trade', value: trade, options: [{ id: 'all', label: 'All trades' }, ...((d?.options.trades || []).map(t => ({ id: t.id, label: t.name })))], onChange: set(setTrade) }, { label: 'Batch', value: batch, options: [{ id: 'all', label: 'All batches' }, ...((d?.options.batches || []).map(b => ({ id: b.id, label: b.name })))], onChange: set(setBatch) }, { label: 'Gender', value: gender, options: [{ id: 'all', label: 'All' }, { id: 'F', label: 'Female' }, { id: 'M', label: 'Male' }], onChange: set(setGender) }, { label: 'Status', value: status, options: [{ id: 'active', label: 'Active' }, { id: 'all', label: 'All' }], onChange: set(setStatus) }]} note={d ? d.coverage : ''} />
    <div className="px-4 pt-3 flex items-center gap-2 flex-wrap">
      <label className="relative flex-1 min-w-[200px] max-w-sm"><Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-txt-tertiary" /><input className={`${inputCls} pl-7`} placeholder="Name or student ID" value={q} onChange={e => { setQ(e.target.value); setPage(1) }} /></label>
      {(trade !== 'all' || batch !== 'all' || gender !== 'all' || q) && <button className="text-[11px] text-primary font-bold" onClick={() => { setTrade('all'); setBatch('all'); setGender('all'); setQ(''); setPage(1) }}>Clear filters</button>}
      <button onClick={exportCsv} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white border border-bdr text-[11px] font-bold text-txt-primary hover:bg-surface-page"><Download className="w-3.5 h-3.5" /> Export filtered list</button>
    </div>
    {!d ? <Loading /> : (
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BarChartCard card={{ title: 'Students by trade', unit: 'students', orient: 'horizontal', data: d.byTrade.slice(0, 10).map(t => ({ label: t.name.slice(0, 24), value: t.n, color: 'primary' })) }} />
          <DonutChartCard card={{ title: `Gender composition · ${fmtNum(d.total)} students`, unit: 'students', data: [{ label: 'Male', value: d.gender.male, color: 'primary' }, { label: 'Female', value: d.gender.female, color: 'teal' }] }} />
        </div>
        <Section title="Student records" hint={`Showing ${d.total ? (d.page - 1) * d.pageSize + 1 : 0}–${Math.min(d.total, d.page * d.pageSize)} of ${fmtNum(d.total)}`}>
          <Table columns={[
            { key: 'name', label: 'Student', render: r => <button className="text-left hover:text-primary" onClick={() => onOpen(r.id)}><div className="font-semibold">{r.name}</div><div className="text-[10px] text-txt-tertiary font-mono">{r.id}</div></button> },
            { key: 'itiCode', label: 'ITI' }, { key: 'trade', label: 'Trade', render: r => r.trade || '—' }, { key: 'batch', label: 'Batch', render: r => <span className="text-[11px]">{r.batch || '—'}</span> },
            { key: 'status', label: 'Status', render: r => <Pill kind={r.status === 'active' ? 'ok' : 'neutral'}>{titleCase(r.status)}</Pill> },
            { key: 'open', label: '', align: 'right', render: r => <button onClick={() => onOpen(r.id)} className="p-1 rounded-pill hover:bg-surface-page"><ChevronRight className="w-4 h-4 text-primary" /></button> },
          ]} rows={d.rows} empty="No students match." />
          <Pager page={d.page} pages={d.pages} onPage={setPage} />
        </Section>
      </div>
    )}
  </>)
}

// ── Trainer registry ──────────────────────────────────────────────────────
function Trainers({ scope, setScope, scopeOpts, canSwitch, onOpen }) {
  const [trade, setTrade] = useState('all'), [load, setLoad] = useState('all'), [q, setQ] = useState(''), [page, setPage] = useState(1)
  const params = { itiId: scope === 'all' ? undefined : scope, trade, load, q: q || undefined, page }
  const { data: d } = useLoad(() => api.registryTrainers(params), [scope, trade, load, q, page])
  useSaathiContext(d ? `Trainer registry (${d.coverage}; trade ${trade}, load ${load}): ${d.total} trainers, ${d.assignments} subject assignments; by trade ${d.byTrade.map(t => `${t.code} ${t.n}`).join(', ')}; load ${d.byLoad.map(l => `${l.label} ${l.n}`).join(', ')}.` : '', ['Which trainers are mapped to Electrician batches in Pusa?', 'Who holds the most batches?'])
  const set = fn => v => { fn(v); setPage(1) }
  function exportCsv() { if (!d) return; download([['Faculty code', 'Name', 'ITI', 'Programme', 'Batches', 'Subjects', 'Today'], ...d.rows.map(r => [r.facultyCode, r.name, r.itiCode, r.programme, r.batches.join('; '), r.subjects.join('; '), r.today])], `trainers-${scope}-${trade}.csv`) }
  return (<>
    <FilterBar items={[...(canSwitch ? [{ label: 'ITI', value: scope, options: scopeOpts, onChange: set(setScope) }] : []), { label: 'Trade', value: trade, options: [{ id: 'all', label: 'All trades' }, ...((d?.options.trades || []).map(t => ({ id: t, label: t })))], onChange: set(setTrade) }, { label: 'Teaching load', value: load, options: [{ id: 'all', label: 'All' }, { id: '4+', label: '4+ batches' }, { id: '3', label: '3 batches' }, { id: '2', label: '2 batches' }, { id: '1', label: '1 batch' }, { id: '0', label: 'None assigned' }], onChange: set(setLoad) }, { label: 'Status', value: 'Active' }]} note={d ? d.coverage : ''} />
    <div className="px-4 pt-3 flex items-center gap-2 flex-wrap">
      <label className="relative flex-1 min-w-[200px] max-w-sm"><Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-txt-tertiary" /><input className={`${inputCls} pl-7`} placeholder="Trainer name or ID" value={q} onChange={e => { setQ(e.target.value); setPage(1) }} /></label>
      {(trade !== 'all' || load !== 'all' || q) && <button className="text-[11px] text-primary font-bold" onClick={() => { setTrade('all'); setLoad('all'); setQ(''); setPage(1) }}>Clear filters</button>}
      <button onClick={exportCsv} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white border border-bdr text-[11px] font-bold text-txt-primary hover:bg-surface-page"><Download className="w-3.5 h-3.5" /> Export filtered list</button>
    </div>
    {!d ? <Loading /> : (
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BarChartCard card={{ title: 'Trainers by trade', unit: 'trainers', orient: 'horizontal', data: d.byTrade.slice(0, 10).map(t => ({ label: t.code, value: t.n, color: 'primary' })) }} />
          <DonutChartCard card={{ title: `Mapped batch load · ${fmtNum(d.total)} trainers`, unit: 'trainers', annotation: 'Load counts mapped batches, not teaching hours or staffing adequacy.', data: d.byLoad.map((l, i) => ({ label: l.label, value: l.n, color: ['primary', 'sky', 'teal', 'amber', 'rose'][i % 5] })) }} />
        </div>
        <Section title="Trainer records" hint={`Showing ${d.total ? (d.page - 1) * d.pageSize + 1 : 0}–${Math.min(d.total, d.page * d.pageSize)} of ${fmtNum(d.total)}`}>
          <Table columns={[
            { key: 'name', label: 'Trainer', render: r => <button className="text-left hover:text-primary" onClick={() => onOpen(r.id)}><div className="font-semibold">{r.name}</div><div className="text-[10px] text-txt-tertiary font-mono">ID: {r.facultyCode}</div></button> },
            { key: 'itiCode', label: 'ITI' }, { key: 'programme', label: 'Trade' },
            { key: 'batches', label: 'Mapped batches', align: 'right', render: r => r.batches.length }, { key: 'subjects', label: 'Subject assignments', align: 'right', render: r => r.subjects.length },
            { key: 'today', label: 'Today', render: r => <Pill kind={r.today === 'available' ? 'ok' : 'warn'}>{titleCase(r.today)}</Pill> },
            { key: 'open', label: '', align: 'right', render: r => <button onClick={() => onOpen(r.id)} className="p-1 rounded-pill hover:bg-surface-page"><ChevronRight className="w-4 h-4 text-primary" /></button> },
          ]} rows={d.rows} empty="No trainers match." />
          <Pager page={d.page} pages={d.pages} onPage={setPage} />
        </Section>
      </div>
    )}
  </>)
}

// ── Enrolment analytics (the seat-utilisation card's view) ─────────────────
function Enrolment({ scope, setScope, scopeOpts, canSwitch, openCanvas }) {
  const { data: e } = useLoad(() => api.enrolmentAnalytics({ itiId: scope === 'all' ? undefined : scope }), [scope])
  useSaathiContext(e ? `Enrolment vs sanctioned seats (${e.coverage}): ${e.totals.enrolled} of ${e.totals.connectedSeats} connected seats (${e.totals.pct}%); total sanctioned ${e.totals.seats}; by ITI ${e.byIti.map(i => `${i.code} ${i.enrolled ?? 'no feed'}/${i.seats}`).join(', ')}.` : '', ['Which ITI has the most empty seats?'])
  return (<>
    <FilterBar items={[{ label: 'Academic year', value: e?.filters?.academicYear || 'Current year' }, ...(canSwitch ? [{ label: 'Scope', value: scope, options: scopeOpts, onChange: setScope }] : [])]} note={e ? e.coverage : ''} />
    {!e ? <Loading /> : (
      <div className="p-4 space-y-4">
        <StatGrid>
          <Stat label="Seat utilisation" value={fmtPct(e.totals.pct)} sub={`${fmtNum(e.totals.enrolled)} enrolled of ${fmtNum(e.totals.connectedSeats)} seats (connected ITIs)`} tone={e.totals.pct >= 70 ? 'emerald' : 'amber'} />
          <Stat label="Sanctioned seats" value={fmtNum(e.totals.seats)} sub={`across ${e.totals.itis} ITIs`} tone="indigo" />
          <Stat label="Empty seats (connected)" value={fmtNum(e.totals.connectedSeats - e.totals.enrolled)} sub="not yet filled" tone="rose" />
          <Stat label="Women" value={fmtPct(e.womenPct)} sub="of enrolled" tone="fuchsia" />
        </StatGrid>
        {e.totals.connected < e.totals.itis && <NoFeed>{e.byIti.filter(i => !i.registryConnected).map(i => i.name.replace('Government ITI ', '')).join(', ')}: no registry feed yet, so their enrolment is not available (not zero). Their {fmtNum(e.totals.seats - e.totals.connectedSeats)} seats are excluded from the percentage.</NoFeed>}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BarChartCard card={{ title: 'Seat utilisation by ITI', unit: '% of sanctioned seats', data: e.byIti.filter(i => i.registryConnected).map(i => ({ label: i.code, value: i.pct || 0, color: (i.pct || 0) >= 70 ? 'emerald' : 'amber' })) }} />
          <DonutChartCard card={{ title: 'Sanctioned seats by ITI', unit: 'seats', data: e.byIti.map(i => ({ label: i.code, value: i.seats })) }} />
        </div>
        <Section title="By ITI" hint="Planned Year-1 enrolments from the SIP alongside the registry count.">
          <Table columns={[
            { key: 'name', label: 'ITI', render: r => <div><div className="font-semibold">{r.name}</div><div className="text-[10px] text-txt-tertiary">{r.kind} · {r.registryConnected ? 'registry connected' : 'no feed'}</div></div> },
            { key: 'seats', label: 'Sanctioned seats', align: 'right', render: r => fmtNum(r.seats) }, { key: 'plannedEnrolments', label: 'Planned Y1', align: 'right', render: r => fmtNum(r.plannedEnrolments) },
            { key: 'enrolled', label: 'Enrolled', align: 'right', render: r => r.registryConnected ? fmtNum(r.enrolled) : <Pill kind="warn">no feed</Pill> },
            { key: 'pct', label: 'Utilisation', render: r => r.registryConnected ? <div className="min-w-[120px]"><Bar pct={r.pct || 0} label={fmtPct(r.pct)} tone="auto" /></div> : '—' },
            { key: 'open', label: '', align: 'right', render: r => <button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'institute_profile', itiCode: r.code })}>Open ITI →</button> },
          ]} rows={e.byIti} />
        </Section>
      </div>
    )}
  </>)
}

// ── Record pages ──────────────────────────────────────────────────────────
function StudentRecord({ id, onBack, openCanvas }) {
  const { data: d } = useLoad(() => api.registryStudent(id), [id])
  useSaathiContext(d ? `Student record: ${d.student.name} (${d.student.id}), ${d.iti.name}, ${d.batch?.trade?.name || '—'} ${d.batch?.name || ''}, year ${d.student.studyYear}, status ${d.student.status}; attendance ${d.attendance.pct ?? '—'}% over 15 days; ${d.applications.length} applications; support open ${d.support.length}.` : '', ['Summarise this student for the principal.'])
  if (!d) return <Loading />
  const s = d.student
  const age = s.dob ? Math.floor((Date.now() - new Date(s.dob)) / (365.25 * 86400000)) : null
  return (
    <DetailPage onBack={onBack} eyebrow={`Student record · ${d.iti.name}`} title={s.name} id={`Student ID · ${s.id}`} sub={`${d.batch?.trade?.name || 'No course'} · ${d.batch?.name || 'no batch'}`} pill={{ kind: s.status === 'active' ? 'ok' : 'neutral', label: titleCase(s.status) }}>
      <DetailCard title="Identity" icon="🪪">
        <LabelGrid items={[['Date of birth', s.dob ? `${fmtDate(s.dob)}${age != null ? ` · ${age} yrs` : ''}` : '—'], ['Gender', s.gender === 'F' ? 'Female' : 'Male'], ["Father's name", s.fatherName || '—'], ["Mother's name", s.motherName || '—'], ['Highest qualification', s.education || '—'], ['PwD', s.pwd ? (s.pwdType || 'Yes') : 'No'], ['Registry match', s.registryMatched ? 'Matched' : 'Not in registry']]} />
      </DetailCard>
      <DetailCard title="Contact" icon="📞">
        <LabelGrid items={[['Phone', s.phone || '—'], ['Email', s.email || '—'], ['District', s.district ? `${s.district}, Delhi` : '—'], ['Preferred language', s.languagePref === 'hi' ? 'Hindi' : s.languagePref || '—']]} />
      </DetailCard>
      <DetailCard title="Course and batch" icon="📘">
        <LabelGrid items={[['Course', d.batch?.trade ? `${d.batch.trade.name} (${d.batch.trade.code})` : '—'], ['Duration', d.batch?.trade ? `${d.batch.trade.durationValue} ${d.batch.trade.durationUnit}` : '—'], ['Batch', d.batch?.name || '—'], ['Batch lead', d.batch?.lead || '—'], ['Joining date', fmtDate(s.enrolledAt)], ['Study year', `Year ${s.studyYear}`], ['Batch runs', d.batch ? `${fmtDate(d.batch.startDate)} → ${fmtDate(d.batch.endDate)}` : '—'], ['Institute', d.iti.name]]} />
      </DetailCard>
      <DetailCard title="Attendance and marks" icon="🗓️">
        <div className="text-[12px] mb-2"><span className="text-txt-tertiary">Last 15 days: </span><b>{d.attendance.pct == null ? 'no sessions recorded' : `${d.attendance.pct}% present (${d.attendance.present} of ${d.attendance.total} sessions)`}</b></div>
        <Table columns={[{ key: 'title', label: 'Assessment' }, { key: 'date', label: 'Date', render: r => fmtDate(r.date) }, { key: 'marks', label: 'Marks', align: 'right', render: r => `${r.marks} / ${r.maxMarks}` }]} rows={d.marks} empty="No marks entered yet." />
      </DetailCard>
      <DetailCard title="Résumé and placements" icon="🤝">
        <LabelGrid items={[['Résumé', d.resume ? `Attached · ${d.resume.title} · updated ${fmtDate(d.resume.updatedAt)}` : 'Not attached'], ['Applications', d.applications.length ? d.applications.map(a => `${a.title} (${a.employer}) · ${a.stage.replace(/_/g, ' ')}`).join('; ') : 'None'], ['Work spells', d.spells.length ? d.spells.map(x => `${x.role} at ${x.employer} · ${x.type} · ${x.state}`).join('; ') : 'None'], ['Support open', d.support.length ? d.support.map(x => `${titleCase(x.reason)} (${x.state})`).join('; ') : 'None']]} />
        {d.resume?.content?.skills && <div className="text-[11px] text-txt-secondary mt-2">Skills on résumé: {[].concat(d.resume.content.skills).join(', ')}</div>}
      </DetailCard>
      <div className="flex gap-2 flex-wrap"><Btn tone="ghost" onClick={() => openCanvas({ type: 'batches', itiId: d.iti.code, batchId: d.batch?.id })}>Open batch roster</Btn>{d.applications.length > 0 && <Btn onClick={() => openCanvas({ type: 'placement_pipeline', itiId: d.iti.code })}>Open placement pipeline</Btn>}</div>
    </DetailPage>
  )
}

function TrainerRecord({ id, onBack, openCanvas }) {
  const { data: d } = useLoad(() => api.registryTrainer(id), [id])
  useSaathiContext(d ? `Trainer record: ${d.trainer.name} (${d.trainer.facultyCode}), ${d.iti?.name}, ${d.trainer.designation}; ${d.batches.length} batches, subjects ${d.subjects.join(', ')}; last 15 days ${d.sessions15.reported} of ${d.sessions15.scheduled} sessions reported; marks pending ${d.marksPending}; today ${d.trainer.today}.` : '', ['Which batches does this trainer hold?'])
  if (!d) return <Loading />
  const t = d.trainer
  return (
    <DetailPage onBack={onBack} eyebrow={`Trainer record · ${d.iti?.name || ''}`} title={t.name} id={`Faculty ID · ${t.facultyCode || t.loginId}`} sub={t.designation || t.programme} pill={{ kind: t.today === 'available' ? 'ok' : 'warn', label: t.today === 'available' ? 'Available today' : titleCase(t.today) + ' today' }}>
      <DetailCard title="Profile" icon="🪪">
        <LabelGrid items={[['Programme', t.programme || '—'], ['Designation', t.designation || '—'], ['Joined on', t.joinedAt ? fmtDate(t.joinedAt) : '—'], ['Gender', t.gender || '—'], ['Institute', d.iti?.name || '—'], ['Login ID', t.loginId || '—']]} />
      </DetailCard>
      <DetailCard title="Contact" icon="📞">
        <LabelGrid items={[['Phone', t.phone || '—'], ['Email', t.email || '—'], ['District', d.iti?.district ? `${d.iti.district}, Delhi` : '—'], ['Availability today', t.todayNote ? `${titleCase(t.today)} · ${t.todayNote}` : titleCase(t.today)]]} />
      </DetailCard>
      <DetailCard title="Batches and subjects" icon="📚">
        <Table columns={[{ key: 'name', label: 'Batch', render: r => <div><div className="font-semibold">{r.name}{r.lead ? <Pill kind="info">lead</Pill> : null}</div><div className="text-[10px] text-txt-tertiary">{r.tradeId} · year {r.studyYear} · {r.students} students</div></div> }, { key: 'subjects', label: 'Subjects', render: r => <span className="text-[11px]">{r.subjects.join(', ')}</span> }]} rows={d.batches} empty="No batch assignments." />
      </DetailCard>
      <DetailCard title="Last 15 days" icon="🗓️">
        <LabelGrid items={[['Sessions reported', `${d.sessions15.reported} of ${d.sessions15.scheduled}`], ['Marks pending', String(d.marksPending)], ['Referrals open', String(d.referrals)]]} />
      </DetailCard>
      <div className="flex gap-2 flex-wrap">{d.batches[0] && <Btn tone="ghost" onClick={() => openCanvas({ type: 'batches', itiId: d.iti?.code, batchId: d.batches[0].id })}>Open batch roster</Btn>}</div>
    </DetailPage>
  )
}

function Pager({ page, pages, onPage }) {
  if (pages <= 1) return null
  const around = [...new Set([1, page - 1, page, page + 1, pages].filter(p => p >= 1 && p <= pages))].sort((a, b) => a - b)
  return (
    <div className="flex items-center justify-end gap-1 pt-3 text-[11px]">
      <Btn small tone="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Btn>
      {around.map((p, i) => <span key={p} className="flex items-center gap-1">{i > 0 && around[i - 1] !== p - 1 && <span className="text-txt-tertiary px-1">…</span>}<button onClick={() => onPage(p)} className={`w-7 h-7 rounded-lg font-bold ${p === page ? 'bg-primary text-white' : 'hover:bg-surface-page text-txt-secondary'}`}>{p}</button></span>)}
      <Btn small tone="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Btn>
    </div>
  )
}

function download(rows, name) {
  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = name; a.click()
}
