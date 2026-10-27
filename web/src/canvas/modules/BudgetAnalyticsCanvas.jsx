// Budget Analytics — section 1. Two views:
//   Allocations & releases: the AOP allocation, what has been released to
//   the ITIs and the balance; a clickable bar chart per ITI that re-scopes
//   the work-package analytics; a cumulative release line; a work-package
//   pie where the selected package stays bright and the rest dim; and the
//   release history, each row opening a popup with the project behind it.
//   Utilisation: what the CA has certified against each line (the view the
//   "Funds utilised" headline card opens).
// Same PM-SETU Saathi design as every other screen; Download report exports CSV.
import { useRef, useState } from 'react'
import { Download, X } from 'lucide-react'
import { BarChart, Bar as RBar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import BarChartCard from '../../components/cards/BarChartCard.jsx'
import FilterBar from './_FilterBar.jsx'
import PrincipalBudgetCanvas from './PrincipalBudgetCanvas.jsx'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading, Hero, Stat, StatGrid, Bar, Section, Table, Tabs, Pill, Btn, fmtCr, fmtDate, fmtPct } from './_ui.jsx'
import { useSaathiContext } from '../CanvasSaathi.jsx'

const TABS = [{ id: 'overview', label: 'Allocations & releases' }, { id: 'history', label: 'Release history' }, { id: 'utilisation', label: 'Utilisation' }]
const PALETTE = ['#386AF6', '#F59E0B', '#10B981', '#8B5CF6', '#0EA5E9', '#F43F5E', '#14B8A6', '#D946EF', '#6366F1', '#84CC16']
const STATE = { completed: { kind: 'ok', label: 'Completed' }, in_progress: { kind: 'info', label: 'In progress' }, stopped: { kind: 'bad', label: 'Stopped' } }
const todayIso = () => new Date().toISOString().slice(0, 10)
const card = 'rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden'
const head = 'px-4 py-2.5 bg-gradient-to-r from-surface-page/50 to-white border-b border-bdr-light'
const tip = { background: 'white', border: '1px solid #CFD8E6', borderRadius: 8, fontSize: 11 }

export default function BudgetAnalyticsCanvas({ context }) {
  const { role } = useApp()
  if (role === 'iti_principal') return <PrincipalBudgetCanvas context={context} />
  return <ClusterBudget context={context} />
}

function ClusterBudget({ context }) {
  const { openCanvas, role, meExtra } = useApp()
  const canSwitch = role !== 'iti_principal' && role !== 'trainer'
  const ownIti = !canSwitch ? meExtra?.iti : null
  const f0 = context?.filters || {}
  const [tab, setTabRaw] = useState(['utilisation', 'history'].includes(context?.tab) ? context.tab : 'overview')
  const scrollRef = useRef(null)
  const setTab = t => { setTabRaw(t); scrollRef.current?.scrollTo({ top: 0 }) }
  const [year, setYear] = useState(String(f0.year || 1))
  const [itiId, setItiId] = useState(ownIti?.id || f0.itiId || 'all')
  const [category, setCategory] = useState(f0.category || 'all')
  const [asOf, setAsOf] = useState(f0.asOf || todayIso())
  const [release, setRelease] = useState(null)
  const { data: itis } = useLoad(() => api.itis())
  const { data } = useLoad(() => tab !== 'utilisation' ? api.budgetAnalytics({ year, itiId, category, asOf }) : Promise.resolve(null), [tab, year, itiId, category, asOf])
  const { data: util } = useLoad(() => tab === 'utilisation' ? api.aopUtilisation({ year }) : Promise.resolve(null), [tab, year])
  const scopeName = itiId === 'all' ? 'Cluster' : (itis?.itis?.find(i => i.id === itiId)?.name || itiId)
  useSaathiContext(data ? `Budget analytics (Year ${year}, ${scopeName}, package ${category}, as of ${asOf}): allocation ₹${data.totals.allocationCr} Cr, released ₹${data.totals.releasedCr} Cr (${data.totals.releasedPct}%), balance ₹${data.totals.balanceCr} Cr, utilised ₹${data.totals.spentCr} Cr. By ITI: ${data.byIti.map(i => `${i.code} ₹${i.releasedCr}/${i.allocationCr} Cr`).join(', ')}. By work package: ${data.byPackage.map(p => `${p.category} ₹${p.releasedCr}/${p.allocationCr} Cr`).join(', ')}. Releases: ${data.releases.length}; stopped projects: ${data.releases.filter(r => r.projectState === 'stopped').map(r => r.project).join('; ') || 'none'}.` : util ? `AOP utilisation: ${JSON.stringify(util.totals)}` : '', ['How much has Pusa received against its allocation?', 'Which work package has the largest balance to release?', 'Which released projects are stopped?'])

  function exportCsv() {
    if (!data) return
    const rows = [['Section', 'Item', 'Allocation (Cr)', 'Released (Cr)', 'Balance (Cr)', 'Released %'],
      ...data.byIti.map(i => ['ITI', i.name, i.allocationCr, i.releasedCr, i.balanceCr, i.releasedPct ?? '']),
      ...data.byPackage.map(p => ['Work package', p.category, p.allocationCr, p.releasedCr, p.balanceCr, p.releasedPct ?? '']),
      [], ['Release', 'Date', 'ITI', 'Work package', 'Project', 'Amount (Cr)', 'Reference', 'Project state'],
      ...data.releases.map(r => ['Release', r.releasedAt.slice(0, 10), r.itiCode, r.category, r.project, r.amountCr, r.reference || '', r.projectState])]
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `budget-analytics-year-${year}-${itiId}-${asOf}.csv`; a.click()
  }
  const exportBtn = <button onClick={exportCsv} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white border border-bdr text-[11px] font-bold text-txt-primary hover:bg-surface-page"><Download className="w-3.5 h-3.5" /> Download report</button>

  const itiOpts = [{ id: 'all', label: 'All ITIs' }, ...((itis?.itis || []).map(i => ({ id: i.id, label: i.name })))]
  const catOpts = [{ id: 'all', label: 'All work packages' }, ...((data?.categories || []).map(c => ({ id: c, label: c })))]

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <Hero tone="amber" eyebrow="Budget analytics" title={tab === 'overview' ? (data ? `Year ${year}: ${fmtCr(data.totals.releasedCr)} released of ${fmtCr(data.totals.allocationCr)} allocated` : 'AOP allocations and funds released') : (util ? `Year ${year}: ${fmtCr(util.totals.utilisedCr)} utilised of ${fmtCr(util.totals.budgetCr)} approved` : 'Utilisation')} subtitle={tab === 'overview' ? 'Released is money moved to the ITIs against their AOP allocation. It is not spent; utilisation is certified separately.' : 'Utilisation is what the Chartered Accountant has certified against each line; committed is contracted but not yet paid.'} right={exportBtn} />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'overview' && (<>
        <FilterBar items={[{ label: 'Year', value: year, options: [{ id: '1', label: 'Year 1' }], onChange: setYear }, ...(canSwitch ? [{ label: 'ITI', value: itiId, options: itiOpts, onChange: setItiId }] : []), { label: 'Work package', value: category, options: catOpts, onChange: setCategory }, { label: 'Releases as of', type: 'date', value: asOf, onChange: setAsOf }]} note={data ? `${data.releases.length} releases` : ''} />
        {!data ? <Loading /> : (
          <div className="p-4 space-y-4">
            <StatGrid>
              <Stat label="Total AOP allocation" value={fmtCr(data.totals.allocationCr)} sub={`${scopeName}${category !== 'all' ? ' · ' + category : ''}`} tone="indigo" />
              <Stat label="Released to ITIs" value={fmtCr(data.totals.releasedCr)} sub={`as of ${fmtDate(asOf)}`} tone="emerald" />
              <Stat label="Balance remaining" value={fmtCr(data.totals.balanceCr)} sub="allocated, not yet released" tone="amber" />
              <Stat label="Released / allocated" value={fmtPct(data.totals.releasedPct)} sub={`utilised so far ${fmtCr(data.totals.spentCr)}`} tone="sky" onClick={() => setTab('utilisation')} />
            </StatGrid>

            <Section tone="indigo" title="Institute allocations & releases" hint="Tap an ITI's bars to scope the work-package analytics below to that institute; tap again for the whole cluster." right={itiId !== 'all' ? <button className="text-[11px] text-primary font-bold" onClick={() => setItiId('all')}>Show cluster →</button> : null}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ItiBars rows={data.byIti} selected={itiId} onPick={id => setItiId(itiId === id ? 'all' : id)} />
                <ReleaseLine timeline={data.timeline} scope={scopeName} />
              </div>
            </Section>

            <Section tone="emerald" title={`Cluster-level analytics by work package · ${scopeName}`} hint="Allocation by work package. Pick a package above or tap a slice: it stays bright, the rest dim, and the totals re-scope." right={category !== 'all' ? <button className="text-[11px] text-primary font-bold" onClick={() => setCategory('all')}>All packages →</button> : null}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <PackagePie rows={data.byPackage} selected={category} onPick={c => setCategory(category === c ? 'all' : c)} />
                <Table tone="emerald" columns={[
                  { key: 'category', label: 'Work package', render: r => <button className={`text-left ${r.selected ? 'text-primary font-bold' : 'font-semibold'}`} onClick={() => setCategory(category === r.category ? 'all' : r.category)}>{r.category}<span className="block text-[10px] font-normal text-txt-tertiary">{r.packages} packages</span></button> },
                  { key: 'allocationCr', label: 'Allocated', align: 'right', render: r => fmtCr(r.allocationCr) },
                  { key: 'releasedCr', label: 'Released', align: 'right', render: r => fmtCr(r.releasedCr) },
                  { key: 'releasedPct', label: 'Released %', render: r => <div className="min-w-[100px]"><Bar pct={r.releasedPct || 0} label={fmtPct(r.releasedPct)} tone="auto" /></div> },
                ]} rows={data.byPackage} />
              </div>
            </Section>

            <Section tone="amber" title="Latest releases" hint="The five most recent releases in this scope. Tap a release for the project behind it." right={data.releases.length > 5 ? <button className="text-[11px] text-primary font-bold" onClick={() => setTab('history')}>View all {data.releases.length} →</button> : null}>
              <ReleaseTable rows={data.releases.slice(0, 5)} onPick={setRelease} />
            </Section>
          </div>
        )}
      </>)}

      {tab === 'history' && (<>
        <FilterBar items={[{ label: 'Year', value: year, options: [{ id: '1', label: 'Year 1' }], onChange: setYear }, ...(canSwitch ? [{ label: 'ITI', value: itiId, options: itiOpts, onChange: setItiId }] : []), { label: 'Work package', value: category, options: catOpts, onChange: setCategory }, { label: 'Releases as of', type: 'date', value: asOf, onChange: setAsOf }]} note={data ? `${data.releases.length} releases · ${fmtCr(data.totals.releasedCr)}` : ''} />
        {!data ? <Loading /> : (
          <div className="p-4 space-y-4">
            <StatGrid>
              <Stat label="Releases" value={data.releases.length} sub={`as of ${fmtDate(asOf)}`} tone="indigo" />
              <Stat label="Released" value={fmtCr(data.totals.releasedCr)} sub={`of ${fmtCr(data.totals.allocationCr)} allocated`} tone="emerald" />
              <Stat label="Projects in progress" value={data.releases.filter(r => r.projectState === 'in_progress').length} sub={`${data.releases.filter(r => r.projectState === 'completed').length} completed`} tone="sky" />
              <Stat label="Projects stopped" value={data.releases.filter(r => r.projectState === 'stopped').length} sub="funded, work blocked" tone={data.releases.some(r => r.projectState === 'stopped') ? 'rose' : 'emerald'} />
            </StatGrid>
            <Section tone="violet" title={`Release history · ${data.releases.length}`} hint="Every release in this scope, newest first. Tap a release to see the work package, the project it funded, the date and where the project stands.">
              <ReleaseTable rows={data.releases} onPick={setRelease} />
            </Section>
          </div>
        )}
      </>)}

      {tab === 'utilisation' && (<>
        <FilterBar items={[{ label: 'AOP year', value: year, options: [{ id: '1', label: 'Year 1' }], onChange: setYear }, { label: 'Scope', value: ownIti ? ownIti.name : 'Cluster' }]} />
        {!util ? <Loading /> : (
          <div className="p-4 space-y-4">
            <StatGrid>
              <Stat label="Approved allocation" value={fmtCr(util.totals.budgetCr)} sub={`envelope ${fmtCr(util.cluster.envelopeY1Cr)}`} tone="indigo" />
              <Stat label="Utilised" value={`${util.totals.utilisedPct}%`} sub={fmtCr(util.totals.utilisedCr)} tone={util.totals.utilisedPct >= 75 ? 'emerald' : 'amber'} />
              <Stat label="Committed" value={`${util.totals.committedPct}%`} sub={fmtCr(util.totals.committedCr)} tone="sky" />
              <Stat label="Headroom to 75% gate" value={`${Math.max(0, 75 - util.totals.utilisedPct)} pts`} sub={`₹${Math.max(0, +(0.75 * util.totals.budgetCr - util.totals.utilisedCr).toFixed(2))} Cr more to certify`} tone="rose" />
            </StatGrid>
            <BarChartCard card={{ title: 'Utilised against allocation by line (₹ Cr)', unit: '₹ Cr', orient: 'horizontal', annotation: `Utilised ₹${util.totals.utilisedCr} Cr of ₹${util.totals.budgetCr} Cr (${util.totals.utilisedPct}%); committed ${util.totals.committedPct}%. The Year-2 first tranche needs 75% utilised and certified.`, data: util.lines.map(l => ({ label: l.label.split(' (')[0], value: l.utilisedCr, color: l.utilisedPct >= 50 ? 'emerald' : l.utilisedPct >= 25 ? 'amber' : 'rose' })) }} />
            <Section tone="sky" title="Allocation, committed and utilised by line" hint="Physical progress is the component's own measure (works complete, units installed, hires made).">
              <Table tone="sky" columns={[
                { key: 'label', label: 'Line', render: r => <div><div className="font-semibold">{r.label}</div><Pill kind={r.capex ? 'info' : 'neutral'}>{r.capex ? 'capex' : 'opex'}</Pill></div> },
                { key: 'budgetCr', label: 'Allocation', align: 'right', render: r => fmtCr(r.budgetCr) },
                { key: 'committedCr', label: 'Committed', align: 'right', render: r => fmtCr(r.committedCr) },
                { key: 'utilisedCr', label: 'Utilised', align: 'right', render: r => fmtCr(r.utilisedCr) },
                { key: 'utilisedPct', label: 'Utilised %', render: r => <div className="min-w-[120px]"><Bar pct={r.utilisedPct} label={`${r.utilisedPct}%`} tone="auto" /></div> },
                { key: 'progressPct', label: 'Physical', align: 'right', render: r => `${r.progressPct}%` },
              ]} rows={util.lines} />
            </Section>
            <Section tone="rose" title="Utilisation certificates" hint="Certified by the SPV head of finance and a CA; accepted by the SPMU.">
              <Table tone="rose" columns={[{ key: 'period', label: 'Period' }, { key: 'amountCr', label: 'Amount', align: 'right', render: r => fmtCr(r.amountCr) }, { key: 'submittedAt', label: 'Submitted', render: r => fmtDate(r.submittedAt) }, { key: 'state', label: 'State', render: r => <Pill kind={r.state === 'accepted' ? 'ok' : 'warn'}>{r.state}</Pill> }, { key: 'pfms', label: 'PFMS', render: r => r.pfmsMatched ? 'matched' : 'pending' }]} rows={util.ucs} empty="No certificates yet." />
            </Section>
          </div>
        )}
      </>)}

      {release && <ReleasePopup r={release} onClose={() => setRelease(null)} onOpenIti={() => { setRelease(null); openCanvas({ type: 'institute_profile', itiCode: release.itiCode, tab: 'budget' }) }} />}
    </div>
  )
}

export function ReleaseTable({ rows, onPick }) {
  return (
    <Table tone="rose" columns={[
      { key: 'releasedAt', label: 'Date', render: r => <b>{fmtDate(r.releasedAt)}</b> },
      { key: 'itiCode', label: 'ITI' },
      { key: 'project', label: 'Work package · project', render: r => <button className="text-left hover:text-primary" onClick={() => onPick(r)}><div className="font-semibold">{r.category}</div><div className="text-[10px] text-txt-tertiary">{r.packageTitle}</div></button> },
      { key: 'amountCr', label: 'Amount', align: 'right', render: r => fmtCr(r.amountCr) },
      { key: 'projectState', label: 'Project', render: r => <Pill kind={STATE[r.projectState]?.kind || 'neutral'}>{STATE[r.projectState]?.label || r.projectState}</Pill> },
      { key: 'open', label: '', align: 'right', render: r => <Btn small tone="ghost" onClick={() => onPick(r)}>Details</Btn> },
    ]} rows={rows} empty="No releases in this scope." />
  )
}

// Grouped bars per ITI: allocation vs released. Click = select that ITI.
function ItiBars({ rows, selected, onPick }) {
  const data = rows.map(r => ({ ...r, label: r.code }))
  return (
    <div className={card}>
      <div className={head}><div className="text-[11px] font-bold uppercase tracking-wider text-primary">Allocation vs released by ITI</div><div className="text-[10px] text-txt-tertiary">₹ Cr · tap an ITI</div></div>
      <div className="p-3" style={{ height: 260 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }} onClick={e => { const l = e?.activeLabel; const row = rows.find(r => r.code === l); if (row) onPick(row.id) }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis dataKey="label" fontSize={11} stroke="#7383A5" />
            <YAxis fontSize={10} stroke="#7383A5" width={40} />
            <Tooltip formatter={v => `₹${Number(v).toFixed(2)} Cr`} contentStyle={tip} cursor={{ fill: 'rgba(56,106,246,0.06)' }} />
            <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
            <RBar dataKey="allocationCr" name="Allocated" radius={[4, 4, 0, 0]} cursor="pointer" onClick={d => onPick(d.id)}>{data.map(d => <Cell key={d.id} fill="#386AF6" fillOpacity={selected === 'all' || selected === d.id ? 1 : 0.25} />)}</RBar>
            <RBar dataKey="releasedCr" name="Released" radius={[4, 4, 0, 0]} cursor="pointer" onClick={d => onPick(d.id)}>{data.map(d => <Cell key={d.id} fill="#10B981" fillOpacity={selected === 'all' || selected === d.id ? 1 : 0.25} />)}</RBar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// Cumulative releases by month for the current scope.
function ReleaseLine({ timeline, scope }) {
  return (
    <div className={card}>
      <div className={head}><div className="text-[11px] font-bold uppercase tracking-wider text-primary">Releases over time · {scope}</div><div className="text-[10px] text-txt-tertiary">₹ Cr, cumulative by month</div></div>
      <div className="p-3" style={{ height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={timeline} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
            <XAxis dataKey="month" fontSize={11} stroke="#7383A5" />
            <YAxis fontSize={10} stroke="#7383A5" width={40} />
            <Tooltip formatter={(v, n) => [`₹${Number(v).toFixed(2)} Cr`, n]} contentStyle={tip} />
            <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
            <Line type="monotone" dataKey="cumulativeCr" name="Cumulative released" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="releasedCr" name="Released in month" stroke="#386AF6" strokeWidth={1.5} strokeDasharray="4 3" dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// Allocation by work package. Selected slice bright, the others dim.
function PackagePie({ rows, selected, onPick }) {
  const total = rows.reduce((s, r) => s + r.allocationCr, 0)
  return (
    <div className={card}>
      <div className={head}><div className="text-[11px] font-bold uppercase tracking-wider text-primary">Allocation by work package</div><div className="text-[10px] text-txt-tertiary">₹ Cr · tap a slice</div></div>
      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
        <div style={{ height: 240 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={rows} dataKey="allocationCr" nameKey="category" innerRadius={55} outerRadius={100} paddingAngle={2} onClick={d => onPick(d.category)} cursor="pointer">
                {rows.map((r, i) => <Cell key={r.category} fill={PALETTE[i % PALETTE.length]} fillOpacity={selected === 'all' || selected === r.category ? 1 : 0.18} stroke={selected === r.category ? '#1A1F36' : 'white'} strokeWidth={selected === r.category ? 2 : 1} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [`₹${Number(v).toFixed(2)} Cr`, n]} contentStyle={tip} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="space-y-1 text-[11px]">
          {rows.map((r, i) => (
            <li key={r.category}><button onClick={() => onPick(r.category)} className={`w-full flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-surface-page ${selected === r.category ? 'bg-primary-light/50 font-bold' : selected !== 'all' ? 'opacity-50' : ''}`}><span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} /><span className="flex-1 text-left truncate">{r.category}</span><span className="tabular-nums">{fmtCr(r.allocationCr)}</span><span className="text-txt-tertiary w-9 text-right">{total ? Math.round(100 * r.allocationCr / total) : 0}%</span></button></li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// Popup for one release: the package, the project, the date, and the state of the project.
function ReleasePopup({ r, onClose, onOpenIti }) {
  const st = STATE[r.projectState] || { kind: 'neutral', label: r.projectState }
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-3" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-modal overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-bdr-light flex items-start gap-3">
          <div className="flex-1 min-w-0"><div className="text-[10px] uppercase tracking-wider font-bold text-primary">Fund release · {r.reference || r.id}</div><div className="text-[15px] font-bold text-txt-primary mt-0.5">{fmtCr(r.amountCr)} to {r.itiName}</div><div className="text-[11px] text-txt-secondary">Released {fmtDate(r.releasedAt)}{r.note ? ` · ${r.note}` : ''}</div></div>
          <button onClick={onClose} className="p-1.5 rounded-pill hover:bg-slate-100"><X className="w-4 h-4 text-txt-secondary" /></button>
        </div>
        <div className="p-4 space-y-3 text-[12px]">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-surface-page p-2.5"><div className="text-[10px] uppercase font-bold text-txt-tertiary">Work package</div><div className="font-bold">{r.category}</div><div className="text-[11px] text-txt-secondary">{r.packageId} · {r.packageTitle}</div></div>
            <div className="rounded-xl bg-surface-page p-2.5"><div className="text-[10px] uppercase font-bold text-txt-tertiary">Project funded</div><div className="font-bold">{r.project}</div>{r.deliverable && <div className="text-[11px] text-txt-secondary mt-0.5">{r.deliverable}</div>}</div>
          </div>
          <div className="rounded-xl border border-bdr-light p-2.5">
            <div className="flex items-center justify-between gap-2"><div className="text-[10px] uppercase font-bold text-txt-tertiary">Project status</div><Pill kind={st.kind}>{st.label}</Pill></div>
            {r.progressPct != null && <div className="mt-2"><Bar pct={r.progressPct} label={`${r.progressPct}% physical progress`} tone={r.projectState === 'stopped' ? 'rose' : 'auto'} /></div>}
            {r.aopBudgetCr != null && <div className="text-[11px] text-txt-secondary mt-1.5">Year-1 AOP record: {fmtCr(r.aopSpentCr)} utilised of {fmtCr(r.aopBudgetCr)} allocated · state {String(r.aopState).replace(/_/g, ' ')}</div>}
          </div>
          <div className="flex justify-end gap-2"><Btn small tone="ghost" onClick={onClose}>Close</Btn><Btn small onClick={onOpenIti}>Open institute budget</Btn></div>
        </div>
      </div>
    </div>
  )
}
