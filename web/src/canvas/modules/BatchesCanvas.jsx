// Batches & rosters — pick a batch, see each student's attendance (from
// submitted sessions), marks, practicals, support flags and a risk flag.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Bar, Pill, Section, Table, Loading, useLoad, fmtDate, stateKind, titleCase } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

export default function BatchesCanvas({ context }) {
  const { role, openCanvas } = useApp()
  const { data: list } = useLoad(() => api.batches(context?.itiId ? { itiId: context.itiId } : {}))
  const [batchId, setBatchId] = useState(context?.batchId || null)
  const active = batchId || list?.batches?.find(b => b.state === 'running')?.id || list?.batches?.[0]?.id
  const { data } = useLoad(() => active ? api.batch(active) : Promise.resolve(null), [active])
  useSaathiContext(data ? brief(data) : '', ['Who is at risk in this batch and why?', 'Which students have no attendance data?'])
  if (!list) return <Loading />
  const roster = data?.roster || []
  const b = data?.batch
  const risk = { high: roster.filter(t => t.risk === 'high').length, medium: roster.filter(t => t.risk === 'medium').length, dropped: roster.filter(t => t.risk === 'dropped').length }
  const withAtt = roster.filter(t => t.attendancePct != null)
  return (
    <div className={context?.embedded ? '' : "h-full overflow-y-auto"}>
      {context?.embedded ? <div className="px-4 py-3 border-b border-bdr-light bg-white flex items-center gap-3 flex-wrap"><span className="text-[11px] font-bold text-txt-secondary">Batch</span><select value={active || ''} onChange={e => setBatchId(e.target.value)} className="text-[12px] rounded-lg border border-bdr px-2 py-1.5 bg-white max-w-[320px]">{list.batches.map(x => <option key={x.id} value={x.id}>{x.name} ({x._count.trainees})</option>)}</select>{b && <span className="text-[11px] text-txt-tertiary">{b.trade.name} · lead {b.lead?.name || '—'} · {fmtDate(b.startDate)} → {fmtDate(b.endDate)}</span>}</div> : <Hero tone="emerald" eyebrow={role === 'trainer' ? 'My batches' : 'Batches'} title={b ? b.name : 'Select a batch'} subtitle={b ? `${b.trade.name} · ${b.iti.name} · lead ${b.lead?.name || '—'} · ${b.assignments.length} subject assignments · ${fmtDate(b.startDate)} → ${fmtDate(b.endDate)}${b.cohortLabel ? ' · ' + b.cohortLabel : ''}` : ''}
        right={<select value={active || ''} onChange={e => setBatchId(e.target.value)} className="text-[12px] rounded-lg border border-bdr px-2 py-1.5 bg-white max-w-[260px]">{list.batches.map(x => <option key={x.id} value={x.id}>{x.name} ({x._count.trainees})</option>)}</select>} />}
      {!data ? <Loading /> : (
        <div className="p-4 space-y-4">
          <StatGrid>
            <Stat label="Students" value={roster.length} sub={`${roster.filter(t => t.gender === 'F').length} women · ${roster.filter(t => t.pwd).length} PwD`} tone="indigo" />
            <Stat label="At risk" value={risk.high} sub={`${risk.medium} to watch`} tone={risk.high ? 'rose' : 'emerald'} />
            <Stat label="Avg attendance" value={withAtt.length ? `${Math.round(withAtt.reduce((s, t) => s + t.attendancePct, 0) / withAtt.length)}%` : '—'} sub={withAtt.length ? `${withAtt.length} with data` : 'no sessions reported'} tone="sky" onClick={() => openCanvas({ type: 'attendance_bot' })} />
            <Stat label="Support open" value={roster.filter(t => t.support.length).length} sub="students flagged" tone="amber" onClick={() => openCanvas({ type: 'support_queue' })} />
          </StatGrid>
          <div className="flex gap-2 flex-wrap">
            {(role === 'trainer' || role === 'iti_principal') && <><button onClick={() => openCanvas({ type: 'attendance_bot' })} className="px-3 py-1.5 rounded-pill bg-primary text-white text-[11px] font-bold">Attendance</button><button onClick={() => openCanvas({ type: 'assessments' })} className="px-3 py-1.5 rounded-pill bg-white border border-bdr text-[11px] font-bold">Assessments</button><button onClick={() => openCanvas({ type: 'practical_bot', batchId: b.id })} className="px-3 py-1.5 rounded-pill bg-white border border-bdr text-[11px] font-bold">Practicals</button></>}
            {role === 'trainer' && <button onClick={() => openCanvas({ type: 'module_plan', batchId: b.id })} className="px-3 py-1.5 rounded-pill bg-white border border-bdr text-[11px] font-bold">Module plan</button>}
          </div>
          {b.assignments.length > 0 && <Section tone="indigo" title="Subjects and trainers"><div className="flex flex-wrap gap-1.5">{b.assignments.map(a => <span key={a.id} className="text-[11px] rounded-pill bg-surface-page px-2.5 py-1"><b>{a.subject.name}</b> · {a.trainer.name}{a.responsibility.startsWith('Batch lead') ? ' (lead)' : ''}</span>)}</div></Section>}
          <Section tone="emerald" title="Roster" hint="Risk = attendance below 70% or marks below 40% (high); below 80% or a practical needing re-practice (medium). Blank = no data yet.">
            <Table tone="emerald" columns={[
              { key: 'name', label: 'Student', render: r => <div><button className="font-semibold text-primary text-left" onClick={() => openCanvas({ type: 'student_profile', traineeId: r.id })}>{r.name}</button><div className="text-[10px] text-txt-tertiary">{r.gender === 'F' ? 'F' : 'M'} · {r.education}{r.pwd ? ' · PwD' : ''} · {r.district}</div></div> },
              { key: 'attendancePct', label: 'Attendance (15d)', render: r => <div className="min-w-[110px]">{r.attendancePct == null ? <span className="text-txt-tertiary">—</span> : <Bar pct={r.attendancePct} tone="auto" label={r.absences ? `${r.absences} absent` : ' '} />}</div> },
              { key: 'avgScore', label: 'Marks avg', align: 'right', render: r => r.avgScore == null ? '—' : `${r.avgScore}% (${r.assessments})` },
              { key: 'practicalsNeedRe', label: 'Practicals', render: r => r.practicalsNeedRe ? <Pill kind="bad">{r.practicalsNeedRe} re-practice</Pill> : <span className="text-txt-tertiary">—</span> },
              { key: 'support', label: 'Support', render: r => r.support.length ? r.support.map(s => <Pill key={s} kind="warn">{titleCase(s)}</Pill>) : <span className="text-txt-tertiary">—</span> },
              { key: 'risk', label: 'Risk', render: r => <Pill kind={r.risk === 'high' || r.risk === 'dropped' ? 'bad' : r.risk === 'medium' ? 'warn' : 'ok'}>{r.risk}</Pill> },
            ]} rows={roster} />
          </Section>
        </div>
      )}
    </div>
  )
}
