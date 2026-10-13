// Job prep (Module C, student) — résumé draft, document checklist for the
// opportunity I am targeting, mock-interview request, and Karuna.
import { useState } from 'react'
import AvatarCall from '../../components/AvatarCall.jsx'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Pill, Btn, useLoad, Loading, inputCls } from './_ui.jsx'
import { CheckCircle2, Circle, Mic } from 'lucide-react'

export default function JobPrepCanvas({ context }) {
  const { showToast, openCanvas } = useApp()
  const { data, reload } = useLoad(() => api.companionMe())
  const [onCall, setOnCall] = useState(false)
  const [pending, setPending] = useState(null)
  const [skill, setSkill] = useState('')
  if (!data) return <Loading />
  const { trainee, artifacts, applications } = data
  const resume = artifacts.resume?.content || { name: trainee.name, course: trainee.batch?.trade?.name, skills: [], languages: ['Hindi'] }
  const checklist = artifacts.application_checklist?.content || { items: [{ item: 'Aadhaar', done: false }, { item: 'ITI bonafide letter', done: false }, { item: 'Marksheet', done: false }, { item: 'Résumé', done: false }] }
  const target = applications.find(a => !['declined', 'withdrawn', 'not_selected', 'joined', 'follow_up'].includes(a.stage))
  const targetDocs = (target?.opportunity?.documents || '').split(/;|,/).map(x => x.trim()).filter(Boolean)
  async function syncChecklist() { if (!targetDocs.length) return; const items = targetDocs.map(d => ({ item: d, done: checklist.items.find(x => x.item.toLowerCase() === d.toLowerCase())?.done || false })); await api.saveArtifact('application_checklist', { title: `${target.opportunity.title} — checklist`, content: { items, opportunityId: target.opportunityId } }); await api.companionEvent({ stage: 'job_prep', topic: `Checklist built for ${target.opportunity.title}`, theme: 'job_prep', signalCode: 'SIG-OPP-VIEW' }).catch(() => null); showToast({ kind: 'success', text: 'Checklist rebuilt from the opportunity\'s required documents.' }); reload() }
  async function toggle(i) { await api.saveArtifact('application_checklist', { title: artifacts.application_checklist?.title || 'Checklist', content: { items: checklist.items.map((x, k) => k === i ? { ...x, done: !x.done } : x) } }); reload() }
  async function addSkill() { if (!skill) return; await api.saveArtifact('resume', { title: 'Résumé (draft)', content: { ...resume, skills: [...(resume.skills || []), skill] } }); setSkill(''); reload() }
  async function mock() { await api.createReferral({ kind: 'mock_interview', summary: `Mock interview before ${target?.opportunity?.title || 'my next interview'}`, toRole: 'trainer', share: { resume: 'draft', target: target?.opportunity?.title || '—' } }); await api.companionEvent({ stage: 'job_prep', topic: 'Mock interview requested', theme: 'job_prep', signalCode: 'SIG-INTERVIEW-PRACTICE' }).catch(() => null); showToast({ kind: 'success', text: 'Asked your trainer for a mock interview.' }) }
  async function addSkillAndSignal() { await addSkill(); await api.companionEvent({ stage: 'job_prep', topic: 'Résumé edited', theme: 'job_prep', signalCode: 'SIG-RESUME-START' }).catch(() => null) }
  const ctx = `Student ${trainee.name}, ${trainee.education} pass, ${trainee.batch?.trade?.name} at ${trainee.iti?.name}. Résumé: ${JSON.stringify(resume)}. Target opportunity: ${target ? `${target.opportunity.title} at ${target.opportunity.employer.name} (${target.opportunity.type}; eligibility: ${target.opportunity.eligibility}; skills they look for: ${target.opportunity.requiredSkills}; documents: ${target.opportunity.documents}; process: ${target.opportunity.process}; closes ${target.opportunity.closingAt?.slice(0, 10)}; last checked ${target.opportunity.lastCheckedAt?.slice(0, 10)})` : 'none yet'}. RULES: résumé lines only from facts the student or registry confirmed — leave blanks and ask, never invent; interview practice = question, student answer, specific feedback, improved structure, for the selected role; opportunity facts only from this active record with its status and last-checked date. Never promise a job.`
  return (
    <div className="flex flex-col h-full">
      {!onCall && (
        <div className="px-4 pt-4 pb-3 bg-gradient-to-br from-amber-50/70 to-white border-b border-bdr-light flex-shrink-0 space-y-3 max-h-[55vh] overflow-y-auto">
          <div><div className="text-[11px] font-bold uppercase tracking-[2px] text-amber-700">Job prep</div><h2 className="text-[18px] font-bold text-txt-primary leading-tight mt-1">{target ? `Preparing for: ${target.opportunity.title}` : 'Pick an opportunity to prepare for'}</h2>{target && <div className="text-[11px] text-txt-secondary">{target.opportunity.employer.name} · skills: {target.opportunity.requiredSkills || '—'} · documents: {target.opportunity.documents || '—'} · process: {target.opportunity.process || '—'}</div>}{!target && <button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'jobs' })}>See opportunities →</button>}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-bdr-light bg-white p-3"><div className="text-[11px] font-bold uppercase text-txt-secondary mb-1 flex items-center">Documents{target && <button onClick={syncChecklist} className="ml-auto text-[10px] text-primary font-bold normal-case">Build from opportunity</button>}</div><ul className="space-y-1">{checklist.items.map((it, i) => <li key={i}><button onClick={() => toggle(i)} className="flex items-center gap-2 text-[12px]">{it.done ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Circle className="w-4 h-4 text-txt-tertiary" />}<span className={it.done ? 'line-through text-txt-tertiary' : ''}>{it.item}</span></button></li>)}</ul></div>
            <div className="rounded-2xl border border-bdr-light bg-white p-3"><div className="text-[11px] font-bold uppercase text-txt-secondary mb-1">Résumé (draft)</div><div className="text-[12px]"><b>{resume.name}</b> · {resume.course}</div><div className="flex flex-wrap gap-1 mt-1">{(resume.skills || []).map(s => <Pill key={s} kind="info">{s}</Pill>)}</div><div className="flex gap-1.5 mt-2"><input value={skill} onChange={e => setSkill(e.target.value)} placeholder="Add a skill (e.g. Multimeter use)" className={inputCls} /><Btn small tone="ghost" onClick={addSkillAndSignal}>Add</Btn></div></div>
          </div>
          <div className="flex gap-2 flex-wrap"><Btn small onClick={mock}><Mic className="w-3.5 h-3.5" /> Ask trainer for a mock interview</Btn><Btn small tone="ghost" onClick={() => setPending({ text: 'Mere trade ke interview mein kaunse 5 sawaal pucche ja sakte hain? Har ek ka chhota jawab bhi batao.', nonce: Date.now() })}>Likely interview questions</Btn><Btn small tone="ghost" onClick={() => setPending({ text: 'Meri résumé ke liye 3 achhi lines likho jo meri practical skills dikhayein.', nonce: Date.now() })}>Improve my résumé</Btn></div>
        </div>
      )}
      <div className="flex-1 min-h-0"><AvatarCall persona="career-counsellor" title="Karuna · Job prep" intro="Interview ya résumé — kahan se shuru karein?" useWebSearch={false} extraSystem={ctx} pendingPrompt={pending} threadId={context?.threadId} onCallStateChange={(s) => setOnCall(s !== 'idle')} suggestions={['Documents kaunse chahiye?', 'Interview mein kya pehnu?', 'Apprenticeship stipend kitna hota hai?']} /></div>
    </div>
  )
}
