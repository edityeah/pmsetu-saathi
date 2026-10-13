// Choose a course — grounded in the Student Companion KB: institute-specific
// course cards (practical focus, sample project, tools, Year-1 intake) and the
// interest map (statement → suggested programme + clarifying question).
// Every tap writes a Signal Taxonomy event; Saathi counsels on top.
import { useState } from 'react'
import AvatarCall from '../../components/AvatarCall.jsx'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Pill, Loading, Chips } from './_ui.jsx'

export default function CourseSelectionCanvas({ context }) {
  const { meExtra, showToast } = useApp()
  const { data } = useLoad(() => api.companionKb({}))
  const { data: trades } = useLoad(() => api.lmsTrades())
  const [pending, setPending] = useState(null)
  const [onCall, setOnCall] = useState(false)
  const [iti, setIti] = useState(meExtra?.trainee?.iti?.code || 'PUS')
  const [shortlist, setShortlist] = useState([])
  if (!data || !trades) return <Loading />
  const courses = data.courses.filter(c => c.itiCode === iti)
  const upcoming = trades.trades.filter(t => t.kind === 'new_specialist' || t.kind === 'short_term')
  async function view(c) {
    await api.companionEvent({ stage: 'explore', topic: `Viewed ${c.courseName} at ${c.itiCode}`, theme: 'course_interest', subtheme: c.programCode, signalCode: 'SIG-COURSE-VIEW' }).catch(() => null)
    setPending({ text: `Tell me about ${c.courseName} at ${c.itiCode === 'PUS' ? 'Pusa' : 'Shahdara'}: who it suits, what I would make in Year 1, and which two roles it leads to. Then ask me one clarifying question.`, nonce: Date.now() })
  }
  async function save(c) {
    if (shortlist.includes(c.id)) return
    setShortlist(s => [...s, c.id]); showToast({ kind: 'success', text: `${c.courseName} shortlisted.` })
    await api.companionEvent({ stage: 'explore', topic: `Shortlisted ${c.courseName} at ${c.itiCode}`, theme: 'course_interest', subtheme: c.programCode, signalCode: 'SIG-COURSE-SHORTLIST' }).catch(() => null)
  }
  function interest(i) { setPending({ text: `${i.statement}. Which course fits me and why? (Suggested ${i.suggestedProgram}, alternative ${i.alternativeProgram || 'none'}) — ask me: "${i.clarifyingQuestion}"`, nonce: Date.now() }) }
  const ctx = `COURSE CATALOGUE (${iti}; keep facts consistent): ${courses.map(c => `${c.courseName} [${c.programCode}] ${c.durationMonths} months, Y1 intake ${c.y1Enrolment}/${c.y1Capacity}, entry ${c.entryQualification}; practical focus ${c.practicalFocus}; sample project ${c.sampleProject}; tools ${c.commonTools}; job family ${c.jobFamily}; fits a student who ${c.fitPrompt}`).join(' || ')}. INTEREST MAP: ${data.interests.map(i => `"${i.statement}" → ${i.suggestedProgram} (alt ${i.alternativeProgram || '—'}): ${i.whyFit}; ask "${i.clarifyingQuestion}"`).join(' || ')}. UPCOMING PROGRAMMES (launch from Year 2 only after launch gates pass; do not promise an intake date): ${upcoming.map(t => `${t.name} (${t.status.replace(/_/g, ' ')}; ${t.itis.map(i => `${i.iti.code} ${i.launch}`).join(', ') || 'TBD'})`).join('; ')}. RULES: present two options with the reason and verified facts, then one clarifying question; never assign a fixed label; offer the Student Counsellor (course counselling, 2 working days) when facts are incomplete.`
  return (
    <div className="flex flex-col h-full">
      {!onCall && (
        <div className="px-4 pt-4 pb-3 bg-gradient-to-br from-sky-50/70 to-white border-b border-bdr-light flex-shrink-0 max-h-[58vh] overflow-y-auto">
          <div className="flex items-center gap-2 flex-wrap"><div><div className="text-[11px] font-bold uppercase tracking-[2px] text-sky-700">Course selection</div><h2 className="text-[18px] font-bold text-txt-primary leading-tight mt-1">{courses.length} courses at {iti === 'PUS' ? 'Pusa' : 'Shahdara'}</h2></div><div className="ml-auto"><Chips options={[{ id: 'PUS', label: 'Pusa' }, { id: 'SHA', label: 'Shahdara' }]} value={iti} onChange={setIti} /></div></div>
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {courses.map(c => (
              <div key={c.id} className="flex-shrink-0 w-[190px] rounded-2xl border border-bdr-light bg-white p-2.5 flex flex-col">
                <div className="flex items-center justify-between"><Pill kind="ok">{c.programCode}</Pill><span className="text-[10px] text-txt-tertiary">{c.durationMonths} mo</span></div>
                <div className="text-[12px] font-bold text-txt-primary leading-tight mt-1.5 line-clamp-2">{c.courseName}</div>
                <div className="text-[10px] text-txt-secondary mt-1 line-clamp-2">{c.practicalFocus}</div>
                <div className="text-[10px] text-txt-tertiary mt-1">Y1 intake {c.y1Enrolment}/{c.y1Capacity}</div>
                <div className="mt-auto pt-2 flex gap-1"><button onClick={() => view(c)} className="flex-1 text-[10px] font-bold rounded-pill bg-primary text-white py-1">Ask</button><button onClick={() => save(c)} className={`text-[10px] font-bold rounded-pill border px-2 py-1 ${shortlist.includes(c.id) ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'border-bdr text-txt-secondary'}`}>{shortlist.includes(c.id) ? '✓' : '+'}</button></div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-txt-tertiary">Or start from what you like</div>
          <div className="mt-1 flex gap-1.5 flex-wrap">{data.interests.map(i => <button key={i.id} onClick={() => interest(i)} className="text-[11px] rounded-pill bg-white border border-bdr-light px-2.5 py-1 hover:border-sky-400">{i.statement}</button>)}</div>
        </div>
      )}
      <div className="flex-1 min-h-0">
        <AvatarCall persona="career-counsellor" title="Saathi · Course choice" intro="Batao, kya padhna pasand hai aur kitni padhai hui hai?" useWebSearch={false} extraSystem={ctx} pendingPrompt={pending} threadId={context?.threadId} onCallStateChange={(s) => setOnCall(s !== 'idle')}
          suggestions={['10th pass hoon, machines pasand hain', 'Automation wala course kab shuru hoga?', 'Sabse jaldi job kis course se?']} />
      </div>
    </div>
  )
}
