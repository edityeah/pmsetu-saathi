// Student Voice (Module C, principal / CEO) — what students raise with the
// companion, aggregated by theme. Direct statements and inferred signals are
// counted separately; guests are counted but never identified.
import { useState } from 'react'
import KpiGridCard from '../../components/cards/KpiGridCard.jsx'
import BarChartCard from '../../components/cards/BarChartCard.jsx'
import DonutChartCard from '../../components/cards/DonutChartCard.jsx'
import LineChartCard from '../../components/cards/LineChartCard.jsx'
import AnalystCanvasShell from './_AnalystCanvasShell.jsx'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading, Section, Table, Pill, Chips, titleCase, fmtPct } from './_ui.jsx'

export default function StudentVoiceCanvas({ context }) {
  const { role, openCanvas } = useApp()
  const { data: itis } = useLoad(() => api.itis())
  const [days, setDays] = useState(30)
  const [itiId, setItiId] = useState(context?.itiId || '')
  const { data } = useLoad(() => api.studentVoice({ days, itiId: itiId || undefined }), [days, itiId])
  if (!data) return <Loading />
  const { totals, themes, byStage, trend, byProgramme, perIti, referrals, actions, scope, signals = [] } = data
  const filter = <div className="flex gap-3 flex-wrap items-center"><Chips options={[{ id: 7, label: '7 days' }, { id: 30, label: '30 days' }, { id: 90, label: '90 days' }]} value={days} onChange={setDays} />{role !== 'iti_principal' && itis && <select value={itiId} onChange={e => setItiId(e.target.value)} className="text-[12px] rounded-lg border border-bdr px-2 py-1.5 bg-white"><option value="">Whole cluster</option>{itis.itis.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select>}</div>
  const grid = { title: `${totals.events} signals · ${days} days`, items: [
    { label: 'Students heard', value: totals.students, hint: `${fmtPct(totals.participationPct)} of ${totals.activeStudents.toLocaleString('en-IN')} active`, tone: 'indigo' },
    { label: 'Direct statements', value: totals.direct, hint: 'what students said', tone: 'emerald' },
    { label: 'Inferred signals', value: totals.inferred, hint: 'model-tagged; shown separately', tone: 'amber' },
    { label: 'Guest sessions', value: totals.guests, hint: 'not identified', tone: 'slate' },
    { label: 'Top theme', value: themes[0] ? titleCase(themes[0].theme) : '—', hint: themes[0] ? `${themes[0].students} students` : '', tone: 'rose' },
    { label: 'Barriers raised', value: byStage.barrier || 0, hint: 'travel, timetable, devices, facilities…', tone: 'violet' },
    { label: 'Learning needs', value: (byStage.doubt || 0) + (byStage.practice || 0), hint: 'doubts + practice time', tone: 'sky' },
    { label: 'Open referrals', value: referrals.filter(r => ['sent', 'accepted'].includes(r.state)).reduce((s, r) => s + r.n, 0), hint: 'awaiting reply', tone: 'teal', onClick: () => openCanvas({ type: 'support_queue' }) },
  ] }
  const bars = { title: 'Themes (direct + inferred)', unit: 'signals', orient: 'horizontal', data: themes.map(t => ({ label: titleCase(t.theme), value: t.total, color: ['travel_cost', 'facilities', 'devices', 'timetable', 'cost', 'family'].includes(t.theme) ? 'rose' : ['course_interest', 'aspiration'].includes(t.theme) ? 'emerald' : 'primary' })), annotation: 'Red = barriers, green = interest and aspiration, blue = learning needs.' }
  const donut = { title: 'Direct vs inferred', unit: 'signals', data: [{ label: 'Direct', value: totals.direct, color: 'emerald' }, { label: 'Inferred', value: totals.inferred, color: 'amber' }] }
  const line = { title: 'Signals per week', yAxis: 'signals', series: [{ name: 'All', color: 'primary', data: trend }] }
  const actionBox = (
    <Section title="Actions this suggests" hint="Themes with the most students first; each links to the owner who can act.">
      <ul className="space-y-1.5 text-[12px]">{actions.map(a => <li key={a.theme} className="flex items-start gap-2"><Pill kind="warn">{titleCase(a.theme)}</Pill><span className="flex-1">{a.suggestion}</span><span className="text-[10px] text-txt-tertiary">{a.affected} students</span></li>)}</ul>
      <div className="mt-2 flex gap-2 flex-wrap"><button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'support_queue' })}>Support queue →</button><button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'daily_ops' })}>Facilities issues →</button></div>
    </Section>
  )
  const signalTable = (
    <Section title="Signal taxonomy (from the companion KB)" hint="Structured events, not transcripts. Distinct students per signal; sensitive signals with fewer than 3 students are suppressed.">
      <Table columns={[
        { key: 'dashboardLabel', label: 'Signal', render: r => <div><div className="font-semibold">{r.dashboardLabel}</div><div className="text-[10px] text-txt-tertiary">{r.code} · {r.eventGroup} · {r.sourceMethod}</div></div> },
        { key: 'verificationState', label: 'Verification', render: r => <Pill kind={/Verified|confirmed/.test(r.verificationState) ? 'ok' : /Inferred|Unverified|Self/.test(r.verificationState) ? 'warn' : 'info'}>{r.verificationState}</Pill> },
        { key: 'students', label: 'Students', align: 'right', render: r => r.suppressed ? <span className="text-[10px] text-txt-tertiary">suppressed (&lt;3)</span> : r.students },
        { key: 'events', label: 'Events', align: 'right' },
        { key: 'aggregationRule', label: 'Rule', render: r => <span className="text-[10px] text-txt-secondary">{r.aggregationRule}{r.sensitive !== 'No' ? ` · sensitive: ${r.sensitive}` : ''}</span> },
      ]} rows={signals} empty="No coded signals in this period." />
    </Section>
  )
  const itiTable = scope === 'cluster' ? (
    <Section title="By ITI"><Table columns={[{ key: 'name', label: 'ITI' }, { key: 'registryConnected', label: 'Companion live', render: r => <Pill kind={r.registryConnected ? 'ok' : 'warn'}>{r.registryConnected ? 'yes' : 'no feed'}</Pill> }, { key: 'events', label: 'Signals', align: 'right' }, { key: 'students', label: 'Students heard', align: 'right' }]} rows={perIti} /></Section>
  ) : null
  const saathiContext = `Student Voice (${days} days, ${scope}): ${totals.events} signals from ${totals.students} students (${totals.participationPct}% participation), ${totals.direct} direct / ${totals.inferred} inferred, ${totals.guests} guests. Themes: ${themes.map(t => `${t.theme} ${t.total} (${t.students} students; top: ${t.topics[0]?.topic})`).join('; ')}. By stage ${JSON.stringify(byStage)}. Referrals ${JSON.stringify(referrals)}. Signal taxonomy counts: ${signals.map(s => `${s.dashboardLabel} ${s.suppressed ? 'suppressed' : s.students} students (${s.verificationState})`).join('; ')}.`
  return (
    <AnalystCanvasShell eyebrow="Student Voice" title="What students are telling Saathi." subtitle="Aggregated themes from companion conversations. Individual statements stay with the student unless they chose to share." toneClass="from-pink-50/60 via-white to-white" filterSlot={filter} saathiTitle="Saathi · Voice" saathiContext={saathiContext} threadId={context?.threadId}
      cells={[
        { node: <KpiGridCard card={grid} />, prompt: 'Summarise what students are raising and what I should do first.' },
        { node: <BarChartCard card={bars} />, prompt: 'Which barriers are growing and which ITI do they come from?', span: 'half' },
        { node: <DonutChartCard card={donut} />, prompt: 'How much of this is students saying it directly vs the model inferring?', span: 'half' },
        { node: actionBox, prompt: 'Which of these actions can I take this week without budget?', span: 'half' },
        { node: itiTable || <LineChartCard card={line} />, prompt: 'Is participation rising and are more students using the companion?', span: 'half' },
        { node: signalTable, prompt: 'Which signals are verified facts and which are unverified themes?' },
      ]}
      quickAsks={['Which students raised travel cost and are also absent often?', 'Is there demand for the automation programme?', 'What learning needs should trainers address this week?']} />
  )
}
