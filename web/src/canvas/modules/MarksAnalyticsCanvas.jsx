// Marks and analytics (student) — every assessment with its source and
// review date, the trend, averages by type, and practical observations.
// Record-grounded: an unreviewed or pending mark is shown as such, never
// as a number that does not exist.
import { BarChart, Bar as RBar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading, Hero, Stat, StatGrid, Section, Table, Pill, Btn, fmtDate, titleCase } from './_ui.jsx'
import { useSaathiContext } from '../CanvasSaathi.jsx'

const tip = { background: 'white', border: '1px solid #CFD8E6', borderRadius: 8, fontSize: 11 }
const TYPE = { theory: '#386AF6', practical: '#10B981', viva: '#F59E0B' }
const ST = { reviewed: { kind: 'ok', label: 'Reviewed' }, awaiting_check: { kind: 'warn', label: 'Awaiting institute check' }, absent: { kind: 'bad', label: 'Absent' }, upcoming: { kind: 'info', label: 'Upcoming' } }
const short = t => t.replace(' · theory', '').replace('Unit test', 'UT').replace('Practical check', 'Prac').replace('Viva voce', 'Viva')

export default function MarksAnalyticsCanvas() {
  const { openCanvas } = useApp()
  const { data: d } = useLoad(() => api.marks())
  useSaathiContext(d ? `Marks for ${d.trainee.name} (${d.trainee.trade}): attendance ${d.attendance.pct ?? '—'}% in ${d.attendance.windowDays} days (minimum ${d.attendance.threshold}%). Average ${d.average ?? '—'}%. Assessments: ${d.series.map(s => `${s.title} (${s.type}, ${fmtDate(s.date)}): ${s.pct != null ? s.pct + '% ' + s.status : s.status}`).join('; ')}. Practicals: ${d.practicals.map(p => `${p.title} ${p.result}`).join('; ') || 'none'}.` : '', ['Mera average kitna hai?', 'Kaunsa exam weak tha?', 'Marks galat hain to kya karun?'])
  if (!d) return <Loading />
  const chart = d.series.map(s => ({ ...s, label: short(s.title), value: s.pct ?? 0 }))
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="teal" eyebrow="Marks and analytics · from your ITI record" title={d.average != null ? `Average ${d.average}% across ${d.series.filter(s => s.pct != null).length} assessments` : 'No confirmed marks yet'} subtitle="Each figure cites its assessment and review date. Blank is not zero. Disputes go through the institute correction route." />
      <div className="p-4 space-y-5">
        <StatGrid>
          <Stat label="Attendance" value={d.attendance.pct == null ? '—' : `${d.attendance.pct}%`} sub={d.attendance.pct == null ? 'no sessions reported' : d.attendance.pct >= d.attendance.threshold ? `above the ${d.attendance.threshold}% minimum` : `below the ${d.attendance.threshold}% minimum`} tone={d.attendance.pct == null ? 'amber' : d.attendance.pct >= d.attendance.threshold ? 'emerald' : 'rose'} onClick={() => openCanvas({ type: 'timetable' })} />
          <Stat label="Last exam" value={d.lastExam ? `${d.lastExam.pct}%` : '—'} sub={d.lastExam ? `${d.lastExam.title} · ${fmtDate(d.lastExam.date)}` : 'no marks yet'} tone="violet" />
          <Stat label="Next exam" value={d.nextExam ? `${d.nextExam.daysLeft} days` : '—'} sub={d.nextExam ? `${d.nextExam.title} · ${titleCase(d.nextExam.type)}` : 'nothing scheduled'} tone={d.nextExam && d.nextExam.daysLeft <= 7 ? 'amber' : 'sky'} onClick={() => openCanvas({ type: 'timetable' })} />
          <Stat label="Awaiting check" value={d.series.filter(s => s.status === 'awaiting_check').length} sub="conducted, marks not yet confirmed" tone="amber" />
        </StatGrid>
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-stretch">
          <div className="xl:col-span-3 rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden flex flex-col"><div className="px-4 py-2.5 bg-gradient-to-r from-surface-page/50 to-white border-b border-bdr-light"><div className="text-[11px] font-bold uppercase tracking-wider text-primary">Marks by assessment</div><div className="text-[10px] text-txt-tertiary">percentage of maximum marks · hatched when not yet scored</div></div>
            <div className="p-4"><div style={{ height: 240 }}><ResponsiveContainer><BarChart data={chart} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} /><XAxis dataKey="label" fontSize={10} stroke="#7383A5" interval={0} /><YAxis domain={[0, 100]} fontSize={10} stroke="#7383A5" width={34} tickFormatter={v => `${v}%`} /><Tooltip contentStyle={tip} formatter={(v, n, p) => [p.payload.pct != null ? `${p.payload.pct}% (${p.payload.marks} of ${p.payload.maxMarks})` : ST[p.payload.status]?.label, p.payload.title]} /><RBar dataKey="value" radius={[6, 6, 0, 0]}>{chart.map(c => <Cell key={c.id} fill={c.pct != null ? TYPE[c.type] || '#386AF6' : '#E2E8F0'} stroke={c.pct == null ? '#94A3B8' : undefined} strokeDasharray={c.pct == null ? '4 3' : undefined} />)}<LabelList dataKey="pct" position="top" fontSize={10} formatter={v => v != null ? `${v}%` : '—'} /></RBar></BarChart></ResponsiveContainer></div>
            <div className="flex gap-3 text-[10px] text-txt-secondary mt-1">{Object.entries(TYPE).map(([k, c]) => <span key={k} className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />{titleCase(k)}</span>)}</div></div>
          </div>
          <div className="xl:col-span-2 rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden"><div className="px-4 py-2.5 bg-gradient-to-r from-surface-page/50 to-white border-b border-bdr-light"><div className="text-[11px] font-bold uppercase tracking-wider text-primary">Average by type</div><div className="text-[10px] text-txt-tertiary">confirmed marks only</div></div>
            <div className="p-4 space-y-3">{d.byType.length === 0 ? <div className="text-[12px] text-txt-tertiary">No confirmed marks yet.</div> : d.byType.map(t => <div key={t.type} className="text-[12px]"><div className="flex justify-between"><span className="font-semibold">{titleCase(t.type)}</span><span className="text-txt-secondary">{t.avgPct}% · {t.n} assessment{t.n === 1 ? '' : 's'}</span></div><div className="h-2 rounded-full bg-surface-page overflow-hidden mt-1"><div className="h-full rounded-full" style={{ width: `${t.avgPct}%`, background: TYPE[t.type] }} /></div></div>)}
              {d.practicals.length > 0 && <div className="pt-2 border-t border-bdr-light"><div className="text-[10px] uppercase tracking-wider font-bold text-txt-tertiary mb-1.5">Practical observations</div><ul className="space-y-1.5">{d.practicals.slice(0, 5).map((p, i) => <li key={i} className="flex items-center gap-2 text-[12px]"><span className="flex-1 min-w-0 truncate">{p.title}</span><Pill kind={p.result === 'demonstrated' ? 'ok' : p.result === 'developing' ? 'warn' : 'bad'}>{titleCase(p.result)}</Pill></li>)}</ul></div>}
            </div>
          </div>
        </div>
        <Section tone="indigo" title="Every assessment" hint="Source and review date per mark. Marks entered by OCR are flagged until a trainer confirms them.">
          <Table tone="indigo" columns={[
            { key: 'title', label: 'Assessment', render: s => <div><div className="font-semibold">{s.title}</div><div className="text-[10px] text-txt-tertiary">{titleCase(s.type)}{s.subject ? ` · ${s.subject}` : ''} · {fmtDate(s.date)}</div></div> },
            { key: 'marks', label: 'Marks', align: 'right', render: s => s.marks != null ? <b>{s.marks} / {s.maxMarks}</b> : <span className="text-txt-tertiary">— / {s.maxMarks}</span> },
            { key: 'pct', label: '%', align: 'right', render: s => s.pct != null ? `${s.pct}%` : '—' },
            { key: 'status', label: 'Status', render: s => <Pill kind={ST[s.status]?.kind || 'neutral'}>{ST[s.status]?.label || titleCase(s.status)}</Pill> },
            { key: 'source', label: 'Source', render: s => <span className="text-[11px]">{s.source === 'ocr' ? 'Scanned mark sheet' : s.source === 'manual' ? 'Entered by trainer' : '—'}{s.reviewState ? ` · ${titleCase(s.reviewState)}` : ''}</span> },
          ]} rows={d.series} empty="No assessments scheduled for your batch yet." />
        </Section>
        <div className="rounded-2xl border border-bdr-light bg-surface-page/60 px-4 py-3 flex items-center gap-3 flex-wrap text-[12px] text-txt-secondary"><span className="flex-1">{d.correctionRoute}</span><Btn small tone="ghost" onClick={() => openCanvas({ type: 'help_from_institute' })}>Ask for a correction</Btn></div>
      </div>
    </div>
  )
}
