// Placement analytics — section 5, module 1. Candidate movement, joining
// evidence and retention coverage. Hero numbers, the distinct-person funnel,
// joined outcomes, the verification ladder, retention checks and the ITI
// comparison. Spacious: one idea per card. Download report exports CSV.
import { useState } from 'react'
import { Download } from 'lucide-react'
import { BarChart, Bar as RBar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from 'recharts'
import FilterBar from './_FilterBar.jsx'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading, Hero, Stat, StatGrid, Section, Table, Tabs, Pill, Btn, fmtNum, fmtPct, fmtInr } from './_ui.jsx'
import { useSaathiContext } from '../CanvasSaathi.jsx'

const C = { primary: '#386AF6', sky: '#0EA5E9', emerald: '#10B981', amber: '#F59E0B', rose: '#F43F5E', violet: '#8B5CF6', teal: '#14B8A6', slate: '#64748B' }
const tip = { background: 'white', border: '1px solid #CFD8E6', borderRadius: 8, fontSize: 11 }
const TYPE = { wage: { label: 'Wage employment', color: C.primary }, apprenticeship: { label: 'Apprenticeship', color: C.emerald }, ojt: { label: 'OJT', color: C.violet } }
const todayIso = () => new Date().toISOString().slice(0, 10)
const Card = ({ title, sub, children }) => <div className="rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden h-full flex flex-col"><div className="px-4 py-2.5 bg-gradient-to-r from-surface-page/50 to-white border-b border-bdr-light"><div className="text-[11px] font-bold uppercase tracking-wider text-primary">{title}</div>{sub && <div className="text-[10px] text-txt-tertiary">{sub}</div>}</div><div className="p-4 flex-1 flex flex-col justify-center">{children}</div></div>

export default function PlacementPipelineCanvas({ context }) {
  const { role, openCanvas } = useApp()
  const [itiId, setItiId] = useState(context?.itiId || 'all'), [trade, setTrade] = useState('all'), [type, setType] = useState('all'), [employerId, setEmployerId] = useState('all'), [asOf, setAsOf] = useState(todayIso())
  const { data: itis } = useLoad(() => api.itis())
  const { data: d } = useLoad(() => api.placementAnalytics({ itiId, trade, type, employerId, asOf }), [itiId, trade, type, employerId, asOf])
  useSaathiContext(d ? `Placement analytics (as of ${asOf}, ITI ${itiId}, trade ${trade}, type ${type}): live seats ${d.totals.liveSeats}, applications ${d.totals.applications}, candidate pool ${d.totals.pool}, reported joins ${d.totals.reportedJoins}, employer-confirmed ${d.totals.employerConfirmed}, independently verified ${d.totals.verifiedJoins}, disputed ${d.ladder.disputed}; funnel ${d.funnel.map(f => `${f.stage} ${f.n}`).join(' → ')}; outcomes ${d.outcomes.map(o => `${o.type} ${o.n}`).join(', ')}; retention ${d.retention.map(r => `${r.label} coverage ${r.coveragePct ?? '—'}% retention ${r.retentionPct ?? '—'}%`).join(', ')}; by ITI ${d.byIti.map(i => `${i.code} pool ${i.pool} applied ${i.applied} offered ${i.offered} joined ${i.joined}`).join('; ')}.` : '', ['How many learners have joined, and how many are employer-confirmed?', 'Where does the funnel lose most candidates?', 'Which ITI converts offers to joins best?'])
  const canSwitch = role !== 'iti_principal' && role !== 'trainer'
  const filters = [{ label: 'Cohort', value: 'Pass-outs and final-year' }, ...(canSwitch ? [{ label: 'ITI', value: itiId, options: [{ id: 'all', label: 'All reporting ITIs' }, ...((itis?.itis || []).map(i => ({ id: i.id, label: i.name })))], onChange: setItiId }] : []), { label: 'Trade', value: trade, options: [{ id: 'all', label: 'All trades' }, ...((d?.options.trades || []).map(t => ({ id: t.id, label: t.name })))], onChange: setTrade }, { label: 'Outcome type', value: type, options: [{ id: 'all', label: 'All types' }, { id: 'wage', label: 'Wage employment' }, { id: 'apprenticeship', label: 'Apprenticeship' }, { id: 'ojt', label: 'OJT' }], onChange: setType }, { label: 'Employer', value: employerId, options: [{ id: 'all', label: 'All employers' }, ...((d?.options.employers || []).map(e => ({ id: e.id, label: e.name })))], onChange: setEmployerId }, { label: 'As of', type: 'date', value: asOf, onChange: setAsOf }]
  function exportCsv() {
    if (!d) return
    const rows = [['Funnel stage', 'Distinct people', 'Conversion %'], ...d.funnel.map(f => [f.stage, f.n, f.pct ?? '']), [], ['Verification', 'People'], ['Reported joins', d.ladder.reported], ['Employer confirmed', d.ladder.employerConfirmed], ['Independently verified', d.ladder.independentlyVerified], ['Disputed', d.ladder.disputed], [], ['ITI', 'Candidate pool', 'Applied', 'Interviewed', 'Offered', 'Joined', 'Women joined'], ...d.byIti.map(i => [i.name, i.pool, i.applied, i.interviewed, i.offered, i.joined, i.women])]
    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `placement-analytics-${asOf}.csv`; a.click()
  }
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="emerald" eyebrow="Placement analytics" title={d ? `${fmtNum(d.totals.reportedJoins)} reported joins · ${fmtNum(d.totals.verifiedJoins)} independently verified` : 'Placement analytics'} subtitle="Candidate movement, joining evidence and retention coverage. Applications are not people; offers are not joins; verification levels are not additive." right={<button onClick={exportCsv} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white border border-bdr text-[11px] font-bold text-txt-primary hover:bg-surface-page"><Download className="w-3.5 h-3.5" /> Download report</button>} />
      <Tabs tabs={[{ id: 'analytics', label: 'Placement analytics' }, { id: 'employers', label: 'Employer directory' }]} active="analytics" onChange={t => t === 'employers' && openCanvas({ type: 'employer_register' })} />
      <FilterBar items={filters} note={d ? `${fmtNum(d.totals.applications)} application records` : ''} />
      {!d ? <Loading /> : (
        <div className="p-4 space-y-5">
          <StatGrid>
            <Stat label="Live opening seats" value={fmtNum(d.totals.liveSeats)} sub="open across live opportunities" tone="indigo" onClick={() => openCanvas({ type: 'employer_register' })} />
            <Stat label="Application records" value={fmtNum(d.totals.applications)} sub={`from ${fmtNum(d.totals.pool)} candidates · multiple applications allowed`} tone="sky" />
            <Stat label="Reported joins" value={fmtNum(d.totals.reportedJoins)} sub="distinct people" tone="violet" />
            <Stat label="Independently verified joins" value={fmtNum(d.totals.verifiedJoins)} sub={`${fmtNum(d.totals.employerConfirmed)} employer-confirmed`} tone="emerald" />
          </StatGrid>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-stretch">
            <div className="xl:col-span-3"><Card title="Distinct-person placement funnel" sub="Each person counted once per stage; the percentage is conversion from the stage before.">
              <div style={{ height: 300 }}><ResponsiveContainer><BarChart data={d.funnel.map(f => ({ ...f, label: f.pct != null ? `${f.n} (${f.pct}%)` : String(f.n) }))} layout="vertical" margin={{ top: 4, right: 80, left: 8, bottom: 0 }} barCategoryGap={8}><XAxis type="number" hide /><YAxis type="category" dataKey="stage" width={118} fontSize={11} stroke="#7383A5" /><Tooltip contentStyle={tip} formatter={(v, n, p) => [`${v} people${p.payload.pct != null ? ` · ${p.payload.pct}% of previous` : ''}`, 'Reached']} /><RBar dataKey="n" radius={[0, 6, 6, 0]}>{d.funnel.map((f, i) => <Cell key={f.stage} fill={`rgba(56,106,246,${0.35 + 0.65 * (i / Math.max(1, d.funnel.length - 1))})`} />)}<LabelList dataKey="label" position="right" fontSize={11} fill="#1A1F36" /></RBar></BarChart></ResponsiveContainer></div>
            </Card></div>
            <div className="xl:col-span-2 grid grid-cols-1 gap-5">
              <Card title="Active joined outcomes" sub="distinct people in an active spell">
                <div className="flex items-center gap-4">
                  <div style={{ width: 150, height: 150 }} className="relative flex-shrink-0"><ResponsiveContainer><PieChart><Pie data={d.outcomes.map(o => ({ name: TYPE[o.type].label, value: o.n, color: TYPE[o.type].color }))} dataKey="value" nameKey="name" innerRadius={44} outerRadius={68} paddingAngle={2} stroke="white">{d.outcomes.map(o => <Cell key={o.type} fill={TYPE[o.type].color} />)}</Pie><Tooltip contentStyle={tip} /></PieChart></ResponsiveContainer><div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"><div className="text-[20px] font-bold leading-none">{d.outcomes.reduce((s, o) => s + o.n, 0)}</div><div className="text-[10px] text-txt-tertiary">total</div></div></div>
                  <ul className="text-[12px] space-y-2 flex-1">{d.outcomes.map(o => <li key={o.type} className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: TYPE[o.type].color }} /><span className="flex-1 text-txt-secondary">{TYPE[o.type].label}</span><b>{o.n}</b></li>)}</ul>
                </div>
              </Card>
              <Card title="Verification ladder" sub="Progressive evidence levels, not additive.">
                <div className="space-y-2.5">{[['Reported joins', d.ladder.reported, C.sky], ['Employer confirmed', d.ladder.employerConfirmed, C.primary], ['Independently verified', d.ladder.independentlyVerified, C.emerald], ['Disputed (excluded)', d.ladder.disputed, C.rose]].map(([l, v, col]) => <div key={l} className="flex items-center gap-3 text-[12px]"><span className="w-40 text-txt-secondary">{l}</span><div className="flex-1 h-4 rounded bg-surface-page overflow-hidden"><div className="h-full rounded" style={{ width: `${d.ladder.reported ? Math.max(2, 100 * v / d.ladder.reported) : 0}%`, background: col }} /></div><b className="w-8 text-right tabular-nums">{v}</b></div>)}</div>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-stretch">
            <div className="xl:col-span-3"><Card title="Retention checks" sub="Follow-up coverage and known retention among responses. No response is unknown, not an exit.">
              {d.retention.every(r => !r.due) ? <div className="text-[12px] text-txt-secondary">No follow-ups are due yet in this scope; the first check comes one month after joining.</div> : (
                <div style={{ height: 220 }}><ResponsiveContainer><BarChart data={d.retention.map(r => ({ ...r, coverage: r.coveragePct ?? 0, retention: r.retentionPct ?? 0 }))} margin={{ top: 16, right: 8, left: 0, bottom: 0 }} barGap={6}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} /><XAxis dataKey="label" fontSize={11} stroke="#7383A5" /><YAxis domain={[0, 100]} fontSize={10} stroke="#7383A5" width={34} tickFormatter={v => `${v}%`} /><Tooltip contentStyle={tip} formatter={(v, n, p) => [p.payload.due ? `${v}%` : 'not due yet', n]} /><Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} /><RBar dataKey="coverage" name="Follow-up coverage" fill={C.sky} radius={[4, 4, 0, 0]}><LabelList dataKey="coverage" position="top" fontSize={10} formatter={(v, e) => v ? `${v}%` : ''} /></RBar><RBar dataKey="retention" name="Known retention among responses" fill={C.emerald} radius={[4, 4, 0, 0]}><LabelList dataKey="retention" position="top" fontSize={10} formatter={v => v ? `${v}%` : ''} /></RBar></BarChart></ResponsiveContainer></div>
              )}
              <div className="text-[11px] text-txt-tertiary mt-2">{d.retention.map(r => `${r.label}: ${r.due ? `${r.responded} of ${r.due} responded` : 'not due yet'}`).join(' · ')}</div>
            </Card></div>
            <div className="xl:col-span-2">{d.byIti.length === 1 ? <Card title="Trade comparison" sub="Distinct people per stage, by course.">
              <Table columns={[
                { key: 'name', label: 'Trade', render: i => <button className={`font-semibold hover:text-primary text-left ${trade === i.id ? 'text-primary' : ''}`} onClick={() => setTrade(trade === i.id ? 'all' : i.id)}>{i.name}</button> },
                { key: 'pool', label: 'Pool', align: 'right' }, { key: 'applied', label: 'Applied', align: 'right' }, { key: 'offered', label: 'Offered', align: 'right' },
                { key: 'joined', label: 'Joined', align: 'right', render: i => <b>{i.joined}</b> },
              ]} rows={d.byTrade || []} empty="No placement activity by trade yet." />
              <div className="text-[11px] text-txt-tertiary mt-2">Tap a trade to scope the page to its funnel; tap again for all trades.{d.totals.medianWage ? ` Median reported wage ${fmtInr(d.totals.medianWage)} per month.` : ''}</div>
            </Card> : <Card title="ITI comparison" sub="Distinct people per stage.">
              <Table columns={[
                { key: 'name', label: 'ITI', render: i => <button className="font-semibold hover:text-primary text-left" onClick={() => setItiId(i.id)}>{i.name}</button> },
                { key: 'pool', label: 'Pool', align: 'right' }, { key: 'applied', label: 'Applied', align: 'right' }, { key: 'offered', label: 'Offered', align: 'right' },
                { key: 'joined', label: 'Joined', align: 'right', render: i => <b>{i.joined}</b> },
              ]} rows={d.byIti} />
              <div className="text-[11px] text-txt-tertiary mt-2">Tap an ITI to scope the page to its funnel.{d.totals.medianWage ? ` Median reported wage ${fmtInr(d.totals.medianWage)} per month.` : ''}</div>
            </Card>}            </div>
          </div>
        </div>
      )}
    </div>
  )
}
