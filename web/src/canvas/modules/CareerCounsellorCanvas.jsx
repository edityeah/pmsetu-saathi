// Career counsellor — Karuna, grounded in the KB role catalogue and the
// course-role map for the student's programme. Stating a target role writes
// SIG-ROLE-STATED; Karuna presents two or three paths without promises.
import { useState } from 'react'
import AvatarCall from '../../components/AvatarCall.jsx'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading, Pill } from './_ui.jsx'
import { Briefcase, TrendingUp, GraduationCap, MapPin, ChevronRight } from 'lucide-react'

export default function CareerCounsellorCanvas({ context }) {
  const { meExtra, showToast } = useApp()
  const { data } = useLoad(() => api.companionKb({}))
  const [pending, setPending] = useState(null)
  const [onCall, setOnCall] = useState(false)
  const [target, setTarget] = useState(null)
  if (!data) return <Loading />
  const t = meExtra?.trainee
  const trade = t?.batch?.trade?.name
  const roles = data.roles
  async function pick(r) {
    setTarget(r.id); showToast({ kind: 'success', text: `Target role noted: ${r.roleName}` })
    await api.companionEvent({ stage: 'career', topic: `Target role: ${r.roleName}`, theme: 'aspiration', subtheme: r.id, signalCode: 'SIG-ROLE-STATED' }).catch(() => null)
    await api.saveArtifact('career_plan', { title: 'My plan', content: { ...(data.plan || {}), goal: r.roleName, steps: [{ step: `Build: ${r.skillsToBuild || r.tasksSkills}`, due: '', done: false }, { step: `Evidence project: ${r.evidenceProject || '—'}`, due: '', done: false }] } }).catch(() => null)
    setPending({ text: `I want to become a ${r.roleName}. Where am I now, what is the skill gap, which project proves it, and what is my next step this month?`, nonce: Date.now() })
  }
  const actions = [
    { icon: Briefcase, tone: 'bg-indigo-100 text-indigo-700', title: 'Roles after my course', prompt: `${trade || 'Mere trade'} ke baad kaunse 2-3 entry roles hain, kya kaam hota hai, aur Delhi NCR mein starting wage kya hoti hai?` },
    { icon: TrendingUp, tone: 'bg-emerald-100 text-emerald-700', title: '5-year path', prompt: `Agar main ${trade || 'yeh trade'} karke trainee role se shuru karta/karti hoon, to progression example ke hisaab se 5 saal mein kahan tak pahunch sakta/sakti hoon?` },
    { icon: GraduationCap, tone: 'bg-amber-100 text-amber-700', title: 'Further study', prompt: 'ITI ke baad diploma ya degree kaise kar sakte hain? NCrF credits kaam aayenge?' },
    { icon: MapPin, tone: 'bg-rose-100 text-rose-700', title: 'Stay near home?', prompt: 'Ghar ke paas hi kaam karna hai. Mere course ke roles kahan hote hain aur kaunse opportunities abhi live hain?' },
  ]
  const ctx = `Student ${t?.name}, ${t?.education} pass, programme ${t?.batch?.trade?.code} (${trade}), ITI ${t?.iti?.name}. ROLE CATALOGUE for this programme (explain; never invent demand or guaranteed progression): ${roles.map(r => `${r.roleName} [${r.id}] — ${r.summary}; tasks/skills: ${r.tasksSkills}; workplace skills: ${r.workplaceSkills}; where: ${r.typicalWorkplace}; entry: ${r.entryPathway}; progression example: ${r.progression}; skills to build: ${r.skillsToBuild}; evidence project: ${r.evidenceProject}; note: ${r.recommendationNote}`).join(' || ')}. Opportunities live for this ITI are in the Opportunities screen (status and last-checked dates matter; wages are illustrative: apprenticeship stipends ₹9–13k, wage roles ₹13–20k). RULES: present two or three plausible paths; structure = current stage, target role, skill gap, project, next step; label fit as an estimate and offer revision; never promise employment.`
  return (
    <div className="flex flex-col h-full">
      {!onCall && (
        <div className="px-4 pt-4 pb-3 bg-gradient-to-br from-fuchsia-50/70 to-white border-b border-bdr-light flex-shrink-0 max-h-[58vh] overflow-y-auto">
          <div className="text-[11px] font-bold uppercase tracking-[2px] text-fuchsia-700">Karuna · Career Counsellor</div>
          <h2 className="text-[18px] font-bold text-txt-primary leading-tight mt-1">Hi {t?.name?.split(' ')[0] || 'there'} — let's plan after {trade || 'your course'}</h2>
          {roles.length > 0 && <>
            <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-txt-tertiary">Entry roles for {t?.batch?.trade?.code} · tap one to set it as your target</div>
            <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">{roles.map(r => (
              <button key={r.id} onClick={() => pick(r)} className={`text-left rounded-2xl border p-2.5 bg-white ${target === r.id ? 'border-fuchsia-400' : 'border-bdr-light hover:border-fuchsia-300'}`}>
                <div className="flex items-center gap-2"><div className="font-bold text-[12px] flex-1">{r.roleName}</div><Pill kind="neutral">{r.sector}</Pill></div>
                <div className="text-[10px] text-txt-secondary mt-0.5 line-clamp-2">{r.summary}</div>
                <div className="text-[10px] text-txt-tertiary mt-1">→ {r.progression}</div>
              </button>))}</div>
          </>}
          <div className="grid grid-cols-2 gap-2 mt-3">
            {actions.map((a, i) => { const Icon = a.icon; return (
              <button key={i} onClick={() => setPending({ text: a.prompt, nonce: Date.now() })} className="text-left rounded-2xl border border-bdr-light bg-white hover:border-fuchsia-400 p-2.5 flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl ${a.tone} flex items-center justify-center flex-shrink-0`}><Icon className="w-4 h-4" /></div>
                <div className="font-bold text-[12px] leading-tight flex-1">{a.title}</div><ChevronRight className="w-3 h-3 text-txt-tertiary" />
              </button>) })}
          </div>
        </div>
      )}
      <div className="flex-1 min-h-0">
        <AvatarCall persona="career-counsellor" title="Karuna" intro="Career ke baare mein jo bhi sawaal ho, pucho." useWebSearch={false} extraSystem={ctx} pendingPrompt={pending} threadId={context?.threadId} onCallStateChange={(s) => setOnCall(s !== 'idle')}
          suggestions={['Electrician ki starting wage kitni hoti hai?', 'Apprenticeship vs direct job?', 'Interview mein kya puchte hain?']} />
      </div>
    </div>
  )
}
