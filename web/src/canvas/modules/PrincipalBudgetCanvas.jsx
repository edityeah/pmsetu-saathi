// Budget analytics for a principal — one ITI's AOP: allocation, releases,
// utilisation and the work packages behind them. Tabs: Overview, Work
// packages (with in-canvas record pages), Releases and utilisation, Evidence.
import { useState } from 'react'
import { Download, ChevronRight, Search } from 'lucide-react'
import { LineChart, Line, BarChart, Bar as RBar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell, LabelList } from 'recharts'
import FilterBar from './_FilterBar.jsx'
import { DetailPage, DetailCard, LabelGrid } from './_Detail.jsx'
import { ReleaseTable } from './BudgetAnalyticsCanvas.jsx'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading, Hero, Stat, StatGrid, Section, Table, Tabs, Pill, Bar, Btn, inputCls, fmtDate, fmtCr, fmtPct, titleCase } from './_ui.jsx'
import { useSaathiContext } from '../CanvasSaathi.jsx'

const TABS = [{ id: 'overview', label: 'Overview' }, { id: 'packages', label: 'Work packages' }, { id: 'releases', label: 'Releases and utilisation' }, { id: 'evidence', label: 'Evidence' }]
const STATUS = { on_track: { kind: 'ok', label: 'On track' }, at_risk: { kind: 'warn', label: 'At risk' }, delayed: { kind: 'bad', label: 'Delayed' } }
const TASK = { planned: 'neutral', in_progress: 'info', blocked: 'bad', reported_complete: 'warn', completed: 'ok', reviewed: 'ok', returned: 'bad' }
const PALETTE = ['#386AF6', '#10B981', '#F59E0B', '#8B5CF6', '#0EA5E9', '#F43F5E', '#14B8A6', '#D946EF']
const tip = { background: 'white', border: '1px solid #CFD8E6', borderRadius: 8, fontSize: 11 }
const Card = ({ title, sub, children, right }) => <div className="rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden h-full flex flex-col"><div className="px-4 py-2.5 bg-gradient-to-r from-surface-page/50 to-white border-b border-bdr-light flex items-start gap-2"><div className="flex-1"><div className="text-[11px] font-bold uppercase tracking-wider text-primary">{title}</div>{sub && <div className="text-[10px] text-txt-tertiary">{sub}</div>}</div>{right}</div><div className="p-4 flex-1">{children}</div></div>
const tabOf = t => ['packages', 'releases', 'evidence'].includes(t) ? t : ['history', 'utilisation'].includes(t) ? 'releases' : 'overview'

export default function PrincipalBudgetCanvas({ context }) {
  const { meExtra } = useApp()
  const iti = meExtra?.iti
  const f0 = context?.filters || {}
  const [tab, setTab] = useState(tabOf(context?.tab))
  const [year, setYear] = useState(String(f0.year || 1)), [category, setCategory] = useState(f0.category || 'all'), [status, setStatus] = useState(f0.status || 'all'), [q, setQ] = useState('')
  const [open, setOpen] = useState(null)
  const { data: d } = useLoad(() => api.workPackages({ year, category, status, q }), [year, category, status, q])
  useSaathiContext(d ? `Budget analytics for ${iti?.name || 'my ITI'} (Year ${year}): allocation ₹${d.totals.allocationCr} Cr, released ₹${d.totals.releasedCr} Cr (${d.totals.releasedPct}%), utilised ₹${d.totals.spentCr} Cr, unspent release ₹${d.totals.unspentReleaseCr} Cr, awaiting release ₹${d.totals.awaitingReleaseCr} Cr. Work packages: ${d.rows.map(r => `${r.title} (${r.category}) ₹${r.allocationCr} Cr allocated, ₹${r.releasedCr} Cr released, ₹${r.spentCr} Cr utilised, ${r.progressPct}% physical, ${STATUS[r.status].label}`).join('; ')}. Needs review: ${d.needsReview.atRisk} packages at risk, ${d.needsReview.dueThisMonth} milestones due this month.` : '', ['Which work packages are at risk and why?', 'How much of the released money is unspent?', 'What is due this month?'])
  if (open) return <WorkPackageRecord id={open} year={year} onBack={() => setOpen(null)} />
  const filters = [{ label: 'Year', value: year, options: [{ id: '1', label: 'Year 1 · AOP 2026–27' }], onChange: setYear }, { label: 'Work area', value: category, options: [{ id: 'all', label: 'All work areas' }, ...((d?.categories || []).map(c => ({ id: c, label: c })))], onChange: setCategory }, { label: 'Status', value: status, options: [{ id: 'all', label: 'All statuses' }, { id: 'on_track', label: 'On track' }, { id: 'at_risk', label: 'At risk' }, { id: 'delayed', label: 'Delayed' }], onChange: setStatus }]
  function exportCsv() {
    if (!d) return
    const rows = [['Work package', 'Work area', 'AOP allocation (Cr)', 'Released (Cr)', 'Utilised (Cr)', 'Unspent release (Cr)', 'Physical progress %', 'Status'], ...d.rows.map(r => [r.title, r.category, r.allocationCr, r.releasedCr, r.spentCr, r.unspentReleaseCr, r.progressPct, STATUS[r.status].label]), [], ['Release date', 'Work package', 'Project', 'Amount (Cr)', 'Reference', 'Project state'], ...d.releases.map(r => [String(r.releasedAt).slice(0, 10), r.packageTitle, r.project, r.amountCr, r.reference || '', r.projectState])]
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `budget-${iti?.code || 'iti'}-year-${year}.csv`; a.click()
  }
  const t = d?.totals
  const pkgTable = (rows, hint) => <Table columns={[
    { key: 'title', label: 'Work package', render: r => <button className="text-left hover:text-primary" onClick={() => setOpen(r.id)}><div className="font-semibold">{r.title}</div><div className="text-[10px] text-txt-tertiary">{r.id} · {r.category} · {r.expenditureType}</div></button> },
    { key: 'allocationCr', label: 'AOP allocation', align: 'right', render: r => fmtCr(r.allocationCr) },
    { key: 'releasedCr', label: 'Released', align: 'right', render: r => fmtCr(r.releasedCr) },
    { key: 'spentCr', label: 'Utilised', align: 'right', render: r => fmtCr(r.spentCr) },
    { key: 'progressPct', label: 'Physical progress', render: r => <div className="min-w-[120px]"><Bar pct={r.progressPct} label={`${r.progressPct}%`} tone="auto" /></div> },
    { key: 'status', label: 'Status', render: r => <Pill kind={STATUS[r.status].kind}>{STATUS[r.status].label}</Pill> },
    { key: 'open', label: '', align: 'right', render: r => <button onClick={() => setOpen(r.id)} className="p-1 rounded-pill hover:bg-surface-page"><ChevronRight className="w-4 h-4 text-primary" /></button> },
  ]} rows={rows} empty={hint || 'No work packages match.'} />
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="amber" eyebrow={`Budget analytics · ${iti?.name || 'my institute'}`} title={t ? `Year ${year}: ${fmtCr(t.releasedCr)} released of ${fmtCr(t.allocationCr)} allocated` : 'Budget analytics'} subtitle="Released is money moved to the institute against its AOP allocation. Utilised is what the institute has spent and certified; the two are never the same number." right={<button onClick={exportCsv} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white border border-bdr text-[11px] font-bold text-txt-primary hover:bg-surface-page"><Download className="w-3.5 h-3.5" /> Download report</button>} />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      <FilterBar items={filters} note={d ? `${d.rows.length} work packages · data as of ${fmtDate(new Date())}` : ''} />
      {!d ? <Loading /> : (<>
        {tab === 'overview' && (
          <div className="p-4 space-y-5">
            <StatGrid>
              <Stat label="AOP allocation" value={fmtCr(t.allocationCr)} sub={`${d.rows.length} work packages`} tone="indigo" />
              <Stat label="Released" value={fmtCr(t.releasedCr)} sub={`${fmtPct(t.releasedPct)} of allocation`} tone="emerald" />
              <Stat label="Utilised" value={fmtCr(t.spentCr)} sub={`${fmtPct(t.utilisedPct)} of released`} tone="sky" />
              <Stat label="Unspent release" value={fmtCr(t.unspentReleaseCr)} sub="released, not yet utilised" tone="amber" />
            </StatGrid>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-bdr-light bg-surface-page/60 px-4 py-3 flex items-center justify-between"><div><div className="text-[10px] uppercase tracking-wider font-bold text-txt-tertiary">Awaiting release</div><div className="text-[12px] text-txt-secondary">allocated, not yet released</div></div><div className="text-[20px] font-bold text-primary">{fmtCr(t.awaitingReleaseCr)}</div></div>
              <div className="rounded-2xl border border-bdr-light bg-surface-page/60 px-4 py-3 flex items-center justify-between"><div><div className="text-[10px] uppercase tracking-wider font-bold text-txt-tertiary">Released but unspent</div><div className="text-[12px] text-txt-secondary">to be utilised and certified</div></div><div className="text-[20px] font-bold text-amber-700">{fmtCr(t.unspentReleaseCr)}</div></div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-stretch">
              <div className="xl:col-span-3"><Card title="Cumulative releases and utilisation" sub="Releases by month from the sanction register; utilisation has no monthly source, so it is shown to date." right={<button className="text-[11px] text-primary font-bold" onClick={() => setTab('releases')}>Open details →</button>}>
                <div style={{ height: 240 }}><ResponsiveContainer><LineChart data={d.timeline} margin={{ top: 12, right: 24, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis dataKey="month" fontSize={10} stroke="#7383A5" /><YAxis fontSize={10} stroke="#7383A5" width={44} tickFormatter={v => `₹${v}`} /><Tooltip contentStyle={tip} formatter={(v, n) => [`₹${v} Cr`, n]} /><Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} /><Line type="monotone" dataKey="cumulativeCr" name="Cumulative released" stroke="#386AF6" strokeWidth={2} dot={{ r: 3 }} /><Line type="monotone" dataKey="releasedCr" name="Released in month" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4 3" dot={false} /><ReferenceLine y={t.spentCr} stroke="#10B981" strokeDasharray="5 4" label={{ value: `Utilised to date ₹${t.spentCr} Cr`, position: 'insideTopRight', fontSize: 10, fill: '#047857' }} /></LineChart></ResponsiveContainer></div>
              </Card></div>
              <div className="xl:col-span-2"><Card title="Allocation by work area" sub="₹ Cr allocated in this AOP year" right={<button className="text-[11px] text-primary font-bold" onClick={() => setTab('packages')}>Open details →</button>}>
                <div style={{ height: Math.max(240, d.byCategory.length * 30 + 20) }}><ResponsiveContainer><BarChart data={d.byCategory} layout="vertical" margin={{ top: 4, right: 56, left: 8, bottom: 0 }} barCategoryGap={6}><XAxis type="number" hide /><YAxis type="category" dataKey="category" width={104} fontSize={10} stroke="#7383A5" interval={0} /><Tooltip contentStyle={tip} formatter={(v) => [`₹${v} Cr`, 'Allocated']} /><RBar dataKey="allocationCr" radius={[0, 6, 6, 0]} onClick={(x) => setCategory(category === x.category ? 'all' : x.category)}>{d.byCategory.map((c, i) => <Cell key={c.category} fill={PALETTE[i % PALETTE.length]} opacity={category === 'all' || category === c.category ? 1 : 0.3} />)}<LabelList dataKey="allocationCr" position="right" fontSize={10} fill="#1A1F36" formatter={v => `₹${v} Cr`} /></RBar></BarChart></ResponsiveContainer></div>
              </Card></div>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-stretch">
              <div className="xl:col-span-3"><Section title="Work packages" hint={`Showing ${Math.min(5, d.rows.length)} of ${d.rows.length}. Tap a package for its record.`} right={d.rows.length > 5 ? <button className="text-[11px] text-primary font-bold" onClick={() => setTab('packages')}>View all {d.rows.length} →</button> : null}>{pkgTable(d.rows.slice(0, 5))}</Section></div>
              <div className="xl:col-span-2"><Card title="Needs review" sub="Status rule: delayed = a task past due with no forecast or the AOP record returned; at risk = any overdue or blocked task.">
                <div className="space-y-3">
                  <button onClick={() => { setStatus('at_risk'); setTab('packages') }} className="w-full flex items-center gap-3 rounded-xl bg-rose-50 px-3 py-2.5 text-left"><span className="text-[22px] font-bold text-rose-600 w-10">{d.needsReview.atRisk}</span><span className="text-[12px] text-txt-secondary">work packages at risk or delayed</span></button>
                  <div className="w-full flex items-center gap-3 rounded-xl bg-amber-50 px-3 py-2.5"><span className="text-[22px] font-bold text-amber-700 w-10">{d.needsReview.dueThisMonth}</span><span className="text-[12px] text-txt-secondary">milestones due this month</span></div>
                  {d.needsReview.dueList.length > 0 && <div className="text-[10px] uppercase tracking-wider font-bold text-txt-tertiary pt-1">{d.needsReview.listIsUpcoming ? 'Next milestones due' : 'Due this month'}</div>}
                  {d.needsReview.dueList.length > 0 && <ul className="text-[11px] space-y-1.5">{d.needsReview.dueList.map(x => <li key={x.id} className="flex items-start gap-2"><Pill kind={TASK[x.state] || 'neutral'}>{titleCase(x.state)}</Pill><span className="flex-1 text-txt-secondary">{x.title}</span><span className="text-txt-tertiary whitespace-nowrap">{fmtDate(x.dueAt)}</span></li>)}</ul>}
                </div>
              </Card></div>
            </div>
          </div>
        )}
        {tab === 'packages' && (
          <div className="p-4 space-y-5">
            <div className="flex items-center gap-2 flex-wrap"><label className="relative flex-1 min-w-[200px] max-w-sm"><Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-txt-tertiary" /><input className={`${inputCls} pl-7`} placeholder="Search work packages" value={q} onChange={e => setQ(e.target.value)} /></label>{(category !== 'all' || status !== 'all' || q) && <button className="text-[11px] text-primary font-bold" onClick={() => { setCategory('all'); setStatus('all'); setQ('') }}>Clear filters</button>}</div>
            <StatGrid>
              <Stat label="Work packages" value={d.rows.length} sub={`${d.rows.filter(r => r.status === 'on_track').length} on track`} tone="indigo" />
              <Stat label="At risk" value={d.rows.filter(r => r.status === 'at_risk').length} sub="overdue or blocked task" tone="amber" />
              <Stat label="Delayed" value={d.rows.filter(r => r.status === 'delayed').length} sub="no forecast or returned" tone="rose" />
              <Stat label="Average physical progress" value={d.rows.length ? `${Math.round(d.rows.reduce((s, r) => s + r.progressPct, 0) / d.rows.length)}%` : '—'} sub="AOP records" tone="sky" />
            </StatGrid>
            <Section title="Work packages" hint="Money sits on the package and its AOP record; tasks carry no budget.">{pkgTable(d.rows)}</Section>
          </div>
        )}
        {tab === 'releases' && (
          <div className="p-4 space-y-5">
            <StatGrid>
              <Stat label="Releases" value={d.releases.length} sub="sanctions this year" tone="indigo" />
              <Stat label="Released" value={fmtCr(t.releasedCr)} sub={`of ${fmtCr(t.allocationCr)} allocated`} tone="emerald" />
              <Stat label="Utilised" value={fmtCr(t.spentCr)} sub={`${fmtPct(t.utilisedPct)} of released`} tone="sky" />
              <Stat label="Projects in progress" value={d.releases.filter(r => r.projectState === 'in_progress').length} sub={`${d.releases.filter(r => r.projectState === 'completed').length} completed`} tone="amber" />
            </StatGrid>
            <Section title="Released and utilised by work area" hint="Utilisation is the institute's certified spend against each area.">
              <Table columns={[{ key: 'category', label: 'Work area', render: r => <span className="font-semibold">{r.category}</span> }, { key: 'allocationCr', label: 'Allocated', align: 'right', render: r => fmtCr(r.allocationCr) }, { key: 'releasedCr', label: 'Released', align: 'right', render: r => fmtCr(r.releasedCr) }, { key: 'spentCr', label: 'Utilised', align: 'right', render: r => fmtCr(r.spentCr) }, { key: 'u', label: 'Utilised of released', render: r => <div className="min-w-[120px]"><Bar pct={r.releasedCr ? 100 * r.spentCr / r.releasedCr : 0} label={fmtPct(r.releasedCr ? 100 * r.spentCr / r.releasedCr : null)} tone="auto" /></div> }]} rows={d.byCategory} />
            </Section>
            <Section title={`Release history · ${d.releases.length}`} hint="Every release this year, newest first. Tap a release to open the work package it funded.">
              <ReleaseTable rows={d.releases.map(r => ({ ...r, itiCode: iti?.code, category: r.category }))} onPick={r => setOpen(r.packageId)} />
            </Section>
          </div>
        )}
        {tab === 'evidence' && (
          <div className="p-4 space-y-5">
            <StatGrid>
              <Stat label="Evidence items" value={d.evidence.length} sub="task packs and sanctions" tone="indigo" />
              <Stat label="Task evidence packs" value={d.evidence.filter(e => e.kind === 'task').length} sub="uploaded by the institute" tone="emerald" />
              <Stat label="Sanction references" value={d.evidence.filter(e => e.kind === 'release').length} sub="PFMS references" tone="sky" />
              <Stat label="Returned by reviewer" value={d.evidence.filter(e => e.state === 'returned').length} sub="needs resubmission" tone={d.evidence.some(e => e.state === 'returned') ? 'rose' : 'emerald'} />
            </StatGrid>
            <Section title="Evidence" hint="Documents behind the physical and financial progress, newest first.">
              <Table columns={[{ key: 'at', label: 'Date', render: e => fmtDate(e.at) }, { key: 'title', label: 'Document', render: e => <div><div className="font-semibold">{e.title}</div>{e.note && <div className="text-[10px] text-txt-tertiary">{e.note}</div>}</div> }, { key: 'packageId', label: 'Work package', render: e => <button className="text-[11px] text-primary font-bold" onClick={() => e.packageId && setOpen(e.packageId)}>{d.rows.find(r => r.id === e.packageId)?.title || e.packageId || '—'}</button> }, { key: 'by', label: 'By' }, { key: 'state', label: 'State', render: e => <Pill kind={TASK[e.state] || (e.state === 'completed' ? 'ok' : 'info')}>{titleCase(e.state)}</Pill> }]} rows={d.evidence} empty="No evidence uploaded yet." />
            </Section>
          </div>
        )}
      </>)}
    </div>
  )
}

function WorkPackageRecord({ id, year, onBack }) {
  const { data: d } = useLoad(() => api.workPackage(id, { year }), [id, year])
  useSaathiContext(d ? `Work package ${d.package.title} (${d.package.category}): allocation ₹${d.row.allocationCr} Cr, released ₹${d.row.releasedCr} Cr, utilised ₹${d.row.spentCr} Cr, physical ${d.row.progressPct}%, ${STATUS[d.row.status].label}. Deliverable: ${d.aop?.deliverable}. Milestones: ${d.milestones.map(m => `${m.title} ${titleCase(m.state)} due ${fmtDate(m.dueAt)}`).join('; ')}. Latest: ${d.latestUpdate?.text || 'none'}.` : '', ['What is blocking this package?', 'Which evidence is still missing?'])
  if (!d) return <Loading />
  const { package: p, aop, row } = d
  return (
    <DetailPage onBack={onBack} eyebrow={`Work package · ${p.category} · ${p.expenditureType}`} title={p.title} id={p.id} sub={aop ? `AOP record ${aop.id} · ${aop.start} → ${aop.finish} · accountable ${aop.accountableRole}` : 'No AOP record this year'} pill={STATUS[row.status]}>
      <DetailCard title="Purpose" icon="🎯">
        <p className="text-[13px] text-txt-primary leading-relaxed mb-3">{aop?.deliverable || p.deliverable || '—'}</p>
        <LabelGrid items={[['Evidence rule', aop?.evidenceRule || '—'], ['Course scope', p.courseScope || 'Institute-wide'], ['Five-year total', fmtCr(p.totalCr)], ['Phasing', Object.entries(p.yearly || {}).map(([y, v]) => `Y${y} ${v}`).join(' · ') || '—'], ['AOP state', titleCase(aop?.state || 'planned')], ['Source', p.sourceStatus || '—']]} />
      </DetailCard>
      <StatGrid>
        <Stat label="AOP allocation" value={fmtCr(row.allocationCr)} tone="indigo" />
        <Stat label="Released" value={fmtCr(row.releasedCr)} sub={`${row.releases} releases`} tone="emerald" />
        <Stat label="Utilised" value={fmtCr(row.spentCr)} sub={`physical ${row.progressPct}%`} tone="sky" />
        <Stat label="Unspent release" value={fmtCr(row.unspentReleaseCr)} sub={`awaiting release ${fmtCr(row.awaitingReleaseCr)}`} tone="amber" />
      </StatGrid>
      <DetailCard title="Physical milestones" icon="🧭">
        {d.milestones.length === 0 ? <div className="text-[12px] text-txt-tertiary">No Year-1 tasks are linked to this package.</div> : <ol className="space-y-2.5">{d.milestones.map(m => { const done = ['completed', 'reviewed'].includes(m.state); return <li key={m.id} className="flex items-start gap-3 text-[12px]"><span className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${done ? 'bg-emerald-500' : m.state === 'blocked' || m.state === 'returned' ? 'bg-rose-500' : m.state === 'planned' ? 'bg-slate-300' : 'bg-primary'}`} /><div className="flex-1 min-w-0"><div className="font-semibold text-txt-primary">{m.title}</div><div className="text-[10px] text-txt-tertiary">{m.id} · owner {m.responsibleRole}{m.blockedReason ? ` · blocked: ${m.blockedReason}` : ''}{m.reviewNote ? ` · ${m.reviewNote}` : ''}</div></div><Pill kind={TASK[m.state] || 'neutral'}>{titleCase(m.state)}</Pill><span className="text-[11px] text-txt-tertiary whitespace-nowrap w-24 text-right">{fmtDate(m.forecastAt || m.dueAt)}</span></li> })}</ol>}
      </DetailCard>
      <DetailCard title="Releases against this package" icon="🏦">
        <Table columns={[{ key: 'releasedAt', label: 'Date', render: r => fmtDate(r.releasedAt) }, { key: 'project', label: 'Project' }, { key: 'amountCr', label: 'Amount', align: 'right', render: r => fmtCr(r.amountCr) }, { key: 'reference', label: 'Reference', render: r => r.reference || '—' }, { key: 'projectState', label: 'Project', render: r => <Pill kind={r.projectState === 'completed' ? 'ok' : r.projectState === 'stopped' ? 'bad' : 'info'}>{titleCase(r.projectState)}</Pill> }]} rows={d.releases} empty="Nothing released yet." />
      </DetailCard>
      <DetailCard title="Evidence" icon="📎">
        <Table columns={[{ key: 'title', label: 'Document', render: e => <div><div className="font-semibold">{e.title}</div>{e.note && <div className="text-[10px] text-txt-tertiary">{e.note}</div>}</div> }, { key: 'at', label: 'Date', render: e => fmtDate(e.at) }, { key: 'by', label: 'By' }]} rows={d.evidence} empty="No evidence uploaded yet." />
      </DetailCard>
      <DetailCard title="Latest update" icon="🗒️">
        {d.latestUpdate ? <div className="text-[13px] text-txt-primary">{d.latestUpdate.text}<div className="text-[10px] text-txt-tertiary mt-1">{fmtDate(d.latestUpdate.at)} · {d.latestUpdate.by}</div></div> : <div className="text-[12px] text-txt-tertiary">No updates recorded yet.</div>}
      </DetailCard>
    </DetailPage>
  )
}
