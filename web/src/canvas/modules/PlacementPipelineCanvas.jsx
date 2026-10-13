// Placement pipeline (Module D) — person-level stages with evidence levels.
// A "placement" is a joined record with an evidence level, never a count
// from a spreadsheet. Coordinators advance stages here; the IMA samples.
import { useState } from 'react'
import KpiGridCard from '../../components/cards/KpiGridCard.jsx'
import BarChartCard from '../../components/cards/BarChartCard.jsx'
import DonutChartCard from '../../components/cards/DonutChartCard.jsx'
import DataTableCard from '../../components/cards/DataTableCard.jsx'
import AnalystCanvasShell from './_AnalystCanvasShell.jsx'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading, Section, Table, Pill, Btn, Chips, fmtDate, fmtInr, titleCase, stateKind } from './_ui.jsx'

const STAGES = ['interested', 'prepared', 'referred', 'applied', 'interviewed', 'offered', 'joined', 'follow_up']
const NEXT = { interested: 'prepared', prepared: 'referred', referred: 'applied', applied: 'interviewed', interviewed: 'offered', offered: 'joined', joined: 'follow_up' }
const EV_KIND = { none: 'neutral', student_reported: 'info', document_supported: 'warn', employer_confirmed: 'ok', independently_verified: 'ok', disputed: 'bad' }

export default function PlacementPipelineCanvas({ context }) {
  const { role, openCanvas, showToast } = useApp()
  const { data: itis } = useLoad(() => api.itis())
  const [itiId, setItiId] = useState(context?.itiId || '')
  const [stage, setStage] = useState('all')
  const { data, reload } = useLoad(() => api.pipeline({ itiId: itiId || undefined }), [itiId])
  const { data: apps, reload: reloadApps } = useLoad(() => api.applications({ itiId: itiId || undefined, stage: stage === 'all' ? undefined : stage }), [itiId, stage])
  if (!data) return <Loading />
  const { total, byStage, joined, evidence, verifiedPlus, byType, perIti, overdue, disputed, conversion, wages } = data
  const canAct = ['spv_ceo', 'iti_principal', 'trainer'].includes(role)
  async function advance(a) { await api.applicationStage(a.id, { stage: NEXT[a.stage] }); showToast({ kind: 'success', text: `${a.trainee.name} → ${NEXT[a.stage].replace(/_/g, ' ')}` }); reload(); reloadApps() }
  const filter = <div className="flex gap-3 flex-wrap items-center">{role !== 'iti_principal' && itis && <select value={itiId} onChange={e => setItiId(e.target.value)} className="text-[12px] rounded-lg border border-bdr px-2 py-1.5 bg-white"><option value="">All ITIs</option>{itis.itis.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select>}<Chips options={[{ id: 'all', label: `All (${total})` }, ...STAGES.map(s => ({ id: s, label: `${titleCase(s)} ${byStage[s] || 0}` }))]} value={stage} onChange={setStage} /></div>
  const grid = { title: 'Pipeline · people, not counts', items: [
    { label: 'In pipeline', value: total, hint: `${byStage.interested + byStage.prepared} preparing`, tone: 'indigo' },
    { label: 'Joined', value: joined, hint: `${byType.wage || 0} wage · ${byType.apprenticeship || 0} apprenticeship · ${byType.ojt || 0} OJT`, tone: 'emerald' },
    { label: 'Employer-confirmed or better', value: verifiedPlus, hint: `${evidence.independently_verified} independently verified`, tone: 'teal' },
    { label: 'Student-reported only', value: evidence.student_reported, hint: 'needs employer confirmation', tone: 'amber', onClick: () => setStage('joined') },
    { label: 'Disputed', value: evidence.disputed, hint: 'resolve before counting', tone: evidence.disputed ? 'rose' : 'emerald' },
    { label: 'Referred → interviewed', value: conversion.interviewPct == null ? '—' : `${conversion.interviewPct}%`, tone: 'sky' },
    { label: 'Interviewed → offered', value: conversion.offerPct == null ? '—' : `${conversion.offerPct}%`, tone: 'violet' },
    { label: 'Median reported wage', value: wages ? fmtInr(wages.median) : '—', hint: wages ? `${wages.n} offers · Y1 range ₹12–14k` : 'no wage offers yet', tone: 'fuchsia' },
  ] }
  const funnel = { title: 'Stage counts', unit: 'people', data: STAGES.map(s => ({ label: titleCase(s), value: byStage[s] || 0, color: s === 'joined' ? 'emerald' : 'primary' })) }
  const donut = { title: 'Evidence level of joined records', unit: 'people', data: Object.entries(evidence).filter(([, v]) => v).map(([k, v]) => ({ label: titleCase(k), value: v, color: k === 'disputed' ? 'rose' : k === 'student_reported' ? 'amber' : k === 'document_supported' ? 'sky' : 'emerald' })) }
  const itiTable = { title: 'By ITI', columns: [{ key: 'name', label: 'ITI', type: 'text' }, { key: 'total', label: 'In pipeline', type: 'number' }, { key: 'referred', label: 'Referred+', type: 'number' }, { key: 'interviewed', label: 'Interviewed+', type: 'number' }, { key: 'joined', label: 'Joined', type: 'number' }, { key: 'employerConfirmedPlus', label: 'Employer-confirmed+', type: 'number' }, { key: 'women', label: 'Women joined', type: 'number' }, { key: 'feed', label: 'Registry', type: 'text' }], rows: perIti.map(i => ({ ...i, feed: i.registryConnected ? 'connected' : 'no feed' })) }
  const list = (
    <Section title={`Applications · ${stage === 'all' ? 'all stages' : titleCase(stage)}`} hint="Coordinators move a record forward with the evidence they hold; students and employers confirm their own steps.">
      <Table columns={[
        { key: 'trainee', label: 'Student', render: r => <div><button className="font-semibold text-primary" onClick={() => openCanvas({ type: 'student_profile', traineeId: r.trainee.id })}>{r.trainee.name}</button><div className="text-[10px] text-txt-tertiary">{r.trainee.iti.code} · {r.trainee.batch?.tradeId}{r.trainee.batch?.cohortLabel?.includes('Pre-scheme') ? ' · pre-scheme' : ''}</div></div> },
        { key: 'opp', label: 'Opportunity', render: r => <div>{r.opportunity.title}<div className="text-[10px] text-txt-tertiary">{r.opportunity.employer.name} · {r.opportunity.type}</div></div> },
        { key: 'stage', label: 'Stage', render: r => <Pill kind={stateKind(r.stage)}>{r.stage.replace(/_/g, ' ')}</Pill> },
        { key: 'evidenceLevel', label: 'Evidence', render: r => <Pill kind={EV_KIND[r.evidenceLevel]}>{r.evidenceLevel.replace(/_/g, ' ')}</Pill> },
        { key: 'nextAction', label: 'Next', render: r => <span className="text-[11px]">{r.nextAction || '—'}<span className={`block text-[10px] ${r.dueAt && new Date(r.dueAt) < new Date() ? 'text-rose-700 font-bold' : 'text-txt-tertiary'}`}>{r.dueAt ? fmtDate(r.dueAt) : ''}</span></span> },
        { key: 'act', label: '', align: 'right', render: r => canAct && NEXT[r.stage] && !['joined', 'follow_up'].includes(r.stage) ? <Btn small tone="ghost" onClick={() => advance(r)}>→ {NEXT[r.stage]}</Btn> : null },
      ]} rows={(apps?.applications || []).slice(0, 80)} />
    </Section>
  )
  const overdueBox = (
    <Section title={`Overdue next actions · ${overdue.length}`} hint="Owner has a due date in the past.">
      <ul className="space-y-1 text-[12px]">{overdue.slice(0, 8).map(a => <li key={a.id} className="flex items-center gap-2"><Pill kind={stateKind(a.stage)}>{a.stage.replace(/_/g, ' ')}</Pill><span className="flex-1 truncate"><b>{a.trainee.name}</b> · {a.nextAction}</span><span className="text-[10px] text-rose-700 font-bold">{fmtDate(a.dueAt)}</span></li>)}{overdue.length === 0 && <li className="text-txt-tertiary">None.</li>}</ul>
      {disputed.length > 0 && <div className="mt-2 text-[11px] text-rose-700"><b>Disputed:</b> {disputed.map(d => `${d.trainee.name} (${d.opportunity.employer.name})`).join('; ')}</div>}
    </Section>
  )
  const saathiContext = `Placement pipeline (${itiId ? 'one ITI' : 'cluster'}): total ${total}, by stage ${JSON.stringify(byStage)}, joined ${joined}, evidence ${JSON.stringify(evidence)}, verified-plus ${verifiedPlus}, conversion ${JSON.stringify(conversion)}, wages ${JSON.stringify(wages)}, per ITI ${perIti.map(i => `${i.code} joined ${i.joined} confirmed+ ${i.employerConfirmedPlus}`).join('; ')}; overdue actions ${overdue.length}; disputed ${disputed.length}.`
  return (
    <AnalystCanvasShell eyebrow="Industry & placement" title="Who is where, and on what evidence." subtitle="Pre-scheme pass-outs in the wage branch; current COPA students on OJT; Year-1 cohorts preparing. Only employer-confirmed and independently verified records should reach a KPI." toneClass="from-emerald-50/70 via-white to-white" filterSlot={filter} saathiTitle="Saathi · Placement" saathiContext={saathiContext} threadId={context?.threadId}
      cells={[
        { node: <KpiGridCard card={grid} />, prompt: 'How many placements can we honestly report to the IMA today?' },
        { node: <BarChartCard card={funnel} />, prompt: 'Where does the pipeline leak most and what would fix it?', span: 'half' },
        { node: <DonutChartCard card={donut} />, prompt: 'Which joined records still need employer confirmation?', span: 'half' },
        { node: <DataTableCard card={itiTable} />, prompt: 'Compare ITIs on conversion and evidence quality.' },
        { node: list, prompt: 'Which applications are overdue and who should chase them?' },
        { node: overdueBox, prompt: 'Draft reminders for the overdue next actions.', span: 'half' },
      ]}
      quickAsks={['What counts as a verified placement under the License Agreement?', 'Which employers converted interviews best?', 'How do OJT spells differ from apprenticeships in the KPI?']} />
  )
}
