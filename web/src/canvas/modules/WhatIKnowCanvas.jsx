// What I know (Module C, student) — the companion shows the student exactly
// what it holds: identity, attendance, marks, practicals, interests and
// barriers they raised, and what has been shared with whom. Anything wrong
// can be flagged for correction.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Pill, Section, Loading, Btn, useLoad, fmtDate, titleCase, inputCls } from './_ui.jsx'
import { ShieldCheck } from 'lucide-react'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

export default function WhatIKnowCanvas() {
  const { showToast, openCanvas } = useApp()
  const { data, reload } = useLoad(() => api.companionMe())
  const [fix, setFix] = useState('')
  useSaathiContext(data ? brief(data) : '', ['Meri attendance kaisi chal rahi hai?', 'Mere marks ka matlab kya hai?', 'Kya share hua hai mere trainer ke saath?'])
  if (!data) return <Loading />
  const { trainee, attendance, assessments, lastMark, practicals, artifacts, referrals, events, support } = data
  const profile = artifacts.profile?.content || {}
  const direct = events.filter(e => e.source === 'direct')
  async function correct() { if (!fix) return; await api.createReferral({ kind: 'registry_correction', summary: fix, toRole: 'principal', share: { field: 'record correction' } }); showToast({ kind: 'success', text: 'Sent to the principal for correction.' }); setFix(''); reload() }
  return (
    <div className="h-full overflow-y-auto bg-surface-page/40">
      <Hero tone="sky" eyebrow="Saathi jaanta hai" title={`${trainee.name.split(' ')[0]}, yeh hai jo main jaanta hoon`} subtitle="Only you and your institute see this. Nothing is shared with an employer without your tap." />
      <div className="p-4 space-y-4">
        <StatGrid>
          <Stat label="Attendance (15 days)" value={attendance.pct == null ? '—' : `${attendance.pct}%`} sub={`${attendance.present} of ${attendance.total} sessions`} tone={attendance.pct == null ? 'slate' : attendance.pct >= 85 ? 'emerald' : attendance.pct >= 70 ? 'amber' : 'rose'} />
          <Stat label="Last test" value={lastMark ? `${lastMark.marks}/${lastMark.assessment.maxMarks}` : '—'} sub={lastMark ? `${lastMark.assessment.title} · ${lastMark.reviewState === 'confirmed' ? 'confirmed' : 'provisional'}` : 'no marks yet'} tone="violet" />
          <Stat label="Practicals" value={practicals.length ? `${practicals.filter(p => p.result === 'demonstrated').length}/${practicals.length}` : '—'} sub={practicals.some(p => p.result === 'needs_re_practice') ? 'one needs re-practice' : 'demonstrated'} tone="teal" />
          <Stat label="Support" value={support.length} sub={support.length ? support.map(s => titleCase(s.reason)).join(', ') : 'nothing open'} tone={support.length ? 'amber' : 'emerald'} />
        </StatGrid>
        <Section tone="indigo" title="My record" hint="From the student registry and your batch."><div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[12px]">{[['Course', trainee.batch?.trade?.name], ['Batch', trainee.batch?.name], ['ITI', trainee.iti?.name], ['Batch lead', trainee.batch?.lead?.name], ['Education', trainee.education], ['Joined', fmtDate(trainee.enrolledAt)], ['Ends', fmtDate(trainee.batch?.endDate)], ['Phone', trainee.phone]].map(([l, v]) => <div key={l} className="rounded-xl bg-white border border-bdr-light p-2"><div className="text-[9px] uppercase font-bold text-txt-tertiary">{l}</div><div className="font-semibold truncate">{v || '—'}</div></div>)}</div></Section>
        <Section tone="emerald" title="Recent attendance" hint="P present · L late · E excused · A absent">
          <div className="flex flex-wrap gap-1">{attendance.recent.map(m => <span key={m.id} title={`${fmtDate(m.session.date)} · ${m.session.subject.name}`} className={`w-7 h-7 rounded text-[10px] font-bold flex items-center justify-center ${m.status === 'present' ? 'bg-emerald-100 text-emerald-700' : m.status === 'late' ? 'bg-amber-100 text-amber-700' : m.status === 'excused' ? 'bg-sky-100 text-sky-700' : 'bg-rose-100 text-rose-700'}`}>{m.status[0].toUpperCase()}</span>)}</div>
          {attendance.recent.length === 0 && <div className="text-[12px] text-txt-tertiary">No attendance recorded yet.</div>}
        </Section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Section tone="amber" title="Marks"><ul className="space-y-1 text-[12px]">{assessments.map(a => <li key={a.id} className="flex items-center gap-2"><span className="flex-1 truncate">{a.assessment.title}</span><b>{a.marks == null ? titleCase(a.status) : `${a.marks}/${a.assessment.maxMarks}`}</b><Pill kind={a.reviewState === 'confirmed' ? 'ok' : 'warn'}>{a.reviewState === 'confirmed' ? 'confirmed' : 'provisional'}</Pill></li>)}{assessments.length === 0 && <li className="text-txt-tertiary">None yet.</li>}</ul></Section>
          <Section tone="violet" title="Practicals"><ul className="space-y-1 text-[12px]">{practicals.map(p => <li key={p.id} className="flex items-center gap-2"><Pill kind={p.result === 'demonstrated' ? 'ok' : p.result === 'developing' ? 'warn' : 'bad'}>{titleCase(p.result)}</Pill><span className="flex-1 truncate">{p.task.title}</span>{p.recheckAt && <span className="text-[10px] text-txt-tertiary">recheck {fmtDate(p.recheckAt)}</span>}</li>)}{practicals.length === 0 && <li className="text-txt-tertiary">Not observed yet.</li>}</ul></Section>
        </div>
        <Section tone="sky" title="What you told me" hint="Interests, goals and barriers you raised. Inferred guesses are kept separate and never shown as facts.">
          <div className="flex flex-wrap gap-1.5">{(profile.interests || []).map(i => <span key={i} className="text-[11px] rounded-pill bg-indigo-50 text-indigo-700 px-2.5 py-1">interest · {i}</span>)}{(profile.constraints || []).map(i => <span key={i} className="text-[11px] rounded-pill bg-amber-50 text-amber-800 px-2.5 py-1">barrier · {i}</span>)}{direct.map(e => <span key={e.id} className="text-[11px] rounded-pill bg-surface-page px-2.5 py-1">{titleCase(e.theme || e.stage)} · {e.topic}</span>)}</div>
        </Section>
        <Section tone="rose" title="Shared with my institute" hint="Each referral shows exactly what was shared.">
          <ul className="space-y-1 text-[12px]">{referrals.map(r => <li key={r.id} className="flex items-start gap-2"><ShieldCheck className="w-3.5 h-3.5 text-primary mt-0.5" /><div><b>{titleCase(r.kind)}</b> to {r.toUser?.name || r.toRole} · {fmtDate(r.createdAt)} · <Pill kind={r.state === 'resolved' ? 'ok' : 'info'}>{r.state.replace(/_/g, ' ')}</Pill><div className="text-[10px] text-txt-tertiary">Shared: {Object.entries(r.shared || {}).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'summary only'}</div></div></li>)}{referrals.length === 0 && <li className="text-txt-tertiary">Nothing shared yet.</li>}</ul>
        </Section>
        <Section tone="teal" title="Something wrong?" hint="Name spelling, batch, phone, a mark — tell the principal.">
          <div className="flex gap-2"><input value={fix} onChange={e => setFix(e.target.value)} placeholder="e.g. My surname is Kashyap, not Kasyap" className={inputCls} /><Btn small onClick={correct}>Send</Btn></div>
          <div className="mt-2"><button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'help_from_institute' })}>Ask for help instead →</button></div>
        </Section>
      </div>
    </div>
  )
}
