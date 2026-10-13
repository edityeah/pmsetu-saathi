// Student 360 (principal / trainer / CEO) — one student: attendance,
// marks, practicals, support history, referrals, the themes they raised
// (direct only), and their applications.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Pill, Section, Table, Loading, Btn, useLoad, fmtDate, stateKind, titleCase, inputCls } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

export default function StudentProfileCanvas({ context }) {
  const { role, showToast, openCanvas } = useApp()
  const id = context?.traineeId
  const { data, reload } = useLoad(() => id ? api.student(id) : Promise.resolve(null), [id])
  const [note, setNote] = useState('')
  useSaathiContext(data ? brief(data) : '', ['Summarise this student in three lines.', 'What support does this student need?'])
  if (!id) return <div className="p-4 text-[12px] text-txt-tertiary">Open a student from a roster or the support queue.</div>
  if (!data) return <Loading />
  const { trainee, attendance, assessments, practicals, support, referrals, companionThemes, applications } = data
  async function addSupport() { await api.createSupport({ traineeId: trainee.id, reason: 'companion_referral', detail: note || 'Flagged by ' + role, nextAction: 'Talk to the student', dueDays: 3 }); showToast({ kind: 'success', text: 'Support action created.' }); setNote(''); reload() }
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="sky" eyebrow={`${trainee.iti.name} · ${trainee.batch?.name || ''}`} title={trainee.name} subtitle={`${trainee.batch?.trade?.name || ''} · ${trainee.gender === 'F' ? 'F' : 'M'} · ${trainee.education}${trainee.pwd ? ' · PwD (' + trainee.pwdType + ')' : ''} · batch lead ${trainee.batch?.lead?.name || '—'} · ${trainee.registryMatched ? 'registry record' : 'not in the registry'} · ${trainee.status}`} />
      <div className="p-4 space-y-4">
        <StatGrid>
          <Stat label="Attendance (15d)" value={attendance.pct == null ? '—' : `${attendance.pct}%`} sub={`${attendance.present} present · ${attendance.absent} absent · ${attendance.late} late`} tone={attendance.pct == null ? 'slate' : attendance.pct >= 85 ? 'emerald' : attendance.pct >= 70 ? 'amber' : 'rose'} />
          <Stat label="Assessments" value={assessments.filter(a => a.marks != null).length} sub={assessments.length ? `latest ${assessments[assessments.length - 1]?.marks ?? '—'}/${assessments[assessments.length - 1]?.assessment.maxMarks}` : 'none'} tone="violet" />
          <Stat label="Practicals" value={practicals.length} sub={`${practicals.filter(p => p.result === 'needs_re_practice').length} need re-practice`} tone="teal" />
          <Stat label="Support actions" value={support.filter(s => s.state !== 'closed').length} sub={`${support.length} total`} tone={support.some(s => s.state !== 'closed') ? 'rose' : 'emerald'} />
        </StatGrid>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="Recent attendance"><div className="flex flex-wrap gap-1">{attendance.recent.map(m => <span key={m.id} title={`${fmtDate(m.session.date)} · ${m.session.subject.name}`} className={`w-6 h-6 rounded text-[9px] font-bold flex items-center justify-center ${m.status === 'present' ? 'bg-emerald-100 text-emerald-700' : m.status === 'late' ? 'bg-amber-100 text-amber-700' : m.status === 'excused' ? 'bg-sky-100 text-sky-700' : m.status === 'absent' ? 'bg-rose-100 text-rose-700' : 'bg-violet-100 text-violet-700'}`}>{m.status[0].toUpperCase()}</span>)}</div></Section>
          <Section title="Marks"><Table columns={[{ key: 'title', label: 'Assessment', render: r => <div>{r.assessment.title}<div className="text-[10px] text-txt-tertiary">{fmtDate(r.assessment.date)} · {r.assessment.type}</div></div> }, { key: 'marks', label: 'Marks', align: 'right', render: r => r.marks == null ? <span className="text-txt-tertiary">{titleCase(r.status)}</span> : <b className={r.marks / r.assessment.maxMarks < 0.4 ? 'text-rose-700' : ''}>{r.marks}/{r.assessment.maxMarks}</b> }, { key: 'reviewState', label: 'Review', render: r => <Pill kind={stateKind(r.reviewState)}>{r.reviewState.replace(/_/g, ' ')}</Pill> }]} rows={assessments} empty="No marks yet." /></Section>
          <Section title="Practicals"><ul className="space-y-1 text-[12px]">{practicals.map(p => <li key={p.id} className="flex items-center gap-2"><Pill kind={p.result === 'demonstrated' ? 'ok' : p.result === 'developing' ? 'warn' : p.result === 'needs_re_practice' ? 'bad' : 'neutral'}>{titleCase(p.result)}</Pill><span className="flex-1 truncate">{p.task.title}</span><span className="text-[10px] text-txt-tertiary">{fmtDate(p.observedAt)}</span></li>)}{practicals.length === 0 && <li className="text-txt-tertiary">Not observed yet.</li>}</ul></Section>
          <Section title="What they raised with the companion" hint="Direct statements only; inferred themes are not shown per student.">
            <ul className="space-y-1 text-[12px]">{companionThemes.map((e, i) => <li key={i} className="flex items-center gap-2"><Pill kind="neutral">{titleCase(e.theme || e.stage)}</Pill><span className="flex-1 truncate">{e.topic}</span><span className="text-[10px] text-txt-tertiary">{fmtDate(e.createdAt)}</span></li>)}{companionThemes.length === 0 && <li className="text-txt-tertiary">Nothing shared.</li>}</ul>
          </Section>
          <Section title="Support and referrals">
            <ul className="space-y-1 text-[12px]">{support.map(s => <li key={s.id} className="flex items-center gap-2"><Pill kind={stateKind(s.state)}>{s.state.replace(/_/g, ' ')}</Pill><span className="flex-1 truncate">{titleCase(s.reason)} · {s.nextAction || s.detail}</span><span className="text-[10px] text-txt-tertiary">{fmtDate(s.dueAt)}</span></li>)}{referrals.map(r => <li key={r.id} className="flex items-center gap-2"><Pill kind={stateKind(r.state)}>{r.state.replace(/_/g, ' ')}</Pill><span className="flex-1 truncate">Referral · {titleCase(r.kind)}: {r.summary}</span></li>)}</ul>
            {(role === 'trainer' || role === 'iti_principal') && <div className="mt-2 flex gap-1.5"><input value={note} onChange={e => setNote(e.target.value)} placeholder="Why does this student need support?" className={inputCls} /><Btn small onClick={addSupport}>Add action</Btn></div>}
          </Section>
          <Section title="Applications" right={<button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'placement_pipeline' })}>Pipeline →</button>}>
            <ul className="space-y-1 text-[12px]">{applications.map(a => <li key={a.id} className="flex items-center gap-2"><Pill kind={stateKind(a.stage)}>{a.stage.replace(/_/g, ' ')}</Pill><span className="flex-1 truncate">{a.opportunity.title} · {a.opportunity.employer.name}</span><Pill kind={a.evidenceLevel === 'disputed' ? 'bad' : a.evidenceLevel === 'none' ? 'neutral' : 'info'}>{a.evidenceLevel.replace(/_/g, ' ')}</Pill></li>)}{applications.length === 0 && <li className="text-txt-tertiary">None.</li>}</ul>
          </Section>
        </div>
      </div>
    </div>
  )
}
