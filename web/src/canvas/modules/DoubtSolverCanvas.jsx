// Doubt solver — Guru ji, scoped to the student's programme. The KB learning
// topics supply the concept, the common doubt, a practice prompt, the safety
// level and the escalation rule; "Still confused" and "Ask my trainer" write
// the matching signals.
import { useState } from 'react'
import AvatarCall from '../../components/AvatarCall.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { api } from '../../api/client.js'
import { useLoad, Btn, Pill } from './_ui.jsx'
import { BookOpen, HelpCircle, ListChecks, Wrench, ChevronRight } from 'lucide-react'

export default function DoubtSolverCanvas({ context }) {
  const { meExtra, showToast } = useApp()
  const { data } = useLoad(() => api.myCourse())
  const { data: kb } = useLoad(() => api.companionKb({}))
  const [pending, setPending] = useState(null)
  const [onCall, setOnCall] = useState(false)
  const [topic, setTopic] = useState(null)
  const t = meExtra?.trainee
  const current = data?.modules?.find(m => context?.moduleId ? m.id === context.moduleId : m.current)
  const lessons = current?.lessons || []
  const topics = kb?.topics || []
  const safety = s => s === 'High' ? 'bad' : s === 'Medium' ? 'warn' : 'ok'
  const ctx = data?.enrolled ? `Student ${t?.name} (${t?.education} pass, speaks ${meExtra?.user?.language || 'Hindi'}) is in ${data.trade.name}, module ${current?.index} "${current?.title}" (${current?.pctComplete}% done), batch lead ${data.batch?.lead?.name}. Lessons: ${lessons.map(l => l.title).join('; ')}. LEARNING TOPIC INDEX for this programme (retrieve the matching topic before answering): ${topics.map(x => `${x.topic} [${x.subjectArea}; safety ${x.safetyLevel}] — ${x.conceptSummary}; common doubt "${x.commonDoubt}"; practice: ${x.practicePrompt}; escalation: ${x.escalationRule}`).join(' || ')}. RULES: short explanation → steps → check understanding → source or trainer; keep High-safety topics conceptual and say the supervised next step; if the student is still confused after two tries, offer 'Ask my trainer' (the companion refers it with the lesson reference). Hinglish if they use it.` : 'Student not enrolled yet; help them understand ITI trades.'
  async function askTrainer() { const ref = topic ? `${topic.topic} (${topic.id})` : (lessons[0]?.title || current?.title || 'current topic'); await api.createReferral({ kind: 'doubt', summary: `Doubt in ${current ? `M${current.index} ${current.title}` : data?.trade?.name}: ${ref}`, toRole: 'trainer', share: { lesson: ref, attendance: 'last 15 days' } }); showToast({ kind: 'success', text: 'Sent to your trainer with the lesson reference.' }) }
  async function stillConfused() { await api.companionEvent({ stage: 'doubt', topic: `Still confused: ${topic?.topic || current?.title || 'topic'}`, theme: 'learning_need', subtheme: topic?.id, signalCode: 'SIG-STILL-CONFUSED' }).catch(() => null); setPending({ text: 'Jo pichli baar samjhaya wo samajh nahi aaya. Koi aur example se samjhao, aur chhote steps mein. Phir ek chhota sawaal pucho.', nonce: Date.now() }) }
  async function openTopic(x) { setTopic(x); await api.companionEvent({ stage: 'doubt', topic: x.topic, theme: 'learning_need', subtheme: x.id, signalCode: 'SIG-DOUBT-TOPIC' }).catch(() => null); setPending({ text: `${x.commonDoubt} (Topic: ${x.topic}, ${x.subjectArea}.) Explain simply with a shop-floor example, then give me the practice task: ${x.practicePrompt}`, nonce: Date.now() }) }
  const actions = [
    { icon: BookOpen, tone: 'bg-indigo-100 text-indigo-700', title: "Explain today's lesson", desc: lessons[0]?.title || 'Current topic', prompt: `Mujhe "${lessons.find(l => !current?.lessonsDone?.includes(lessons.indexOf(l)))?.title || lessons[0]?.title || 'aaj ka topic'}" simple words mein samjhao, ek shop-floor example ke saath.` },
    { icon: Wrench, tone: 'bg-amber-100 text-amber-700', title: 'Step-by-step practical', desc: 'How do I do the job safely?', prompt: `Step by step batao: "${lessons.find(l => l.type === 'practical')?.title || 'practical job'}" kaise karein, safety points ke saath (conceptual; trainer supervision zaroori).` },
    { icon: ListChecks, tone: 'bg-violet-100 text-violet-700', title: 'Quiz me', desc: '3 quick questions', prompt: `Mujhe ${current?.title || 'is module'} par 3 sawaal pucho, ek ek karke.` },
    { icon: HelpCircle, tone: 'bg-emerald-100 text-emerald-700', title: 'I did not understand', desc: 'Re-explain, different example', onClick: stillConfused },
  ]
  return (
    <div className="flex flex-col h-full">
      {!onCall && (
        <div className="px-4 pt-4 pb-3 bg-gradient-to-br from-emerald-50/70 to-white border-b border-bdr-light flex-shrink-0 max-h-[58vh] overflow-y-auto">
          <div className="text-[11px] font-bold uppercase tracking-[2px] text-emerald-700">Guru ji · Doubt Solver</div>
          <div className="flex items-start gap-2"><h2 className="text-[18px] font-bold text-txt-primary leading-tight mt-1 flex-1">{current ? `M${current.index} · ${current.title}` : 'What is confusing you?'}</h2>{data?.enrolled && <Btn small tone="ghost" onClick={askTrainer}>Ask my trainer</Btn>}</div>
          {topics.length > 0 && <>
            <div className="mt-2 text-[10px] font-bold uppercase tracking-wider text-txt-tertiary">Topics for {t?.batch?.trade?.code} · tap a doubt</div>
            <div className="mt-1 flex gap-1.5 flex-wrap">{topics.map(x => <button key={x.id} onClick={() => openTopic(x)} className={`text-left text-[11px] rounded-xl bg-white border px-2.5 py-1.5 inline-flex items-center gap-1.5 ${topic?.id === x.id ? 'border-emerald-400' : 'border-bdr-light hover:border-emerald-300'}`}><span>{x.topic}</span><Pill kind={safety(x.safetyLevel)}>{x.safetyLevel}</Pill></button>)}</div>
            {topic && <div className="mt-1.5 text-[10px] text-txt-secondary rounded-lg bg-white border border-bdr-light p-2"><b>{topic.subjectArea}:</b> {topic.conceptSummary}. <span className="text-amber-800">{topic.escalationRule}.</span></div>}
          </>}
          <div className="grid grid-cols-2 gap-2 mt-3">
            {actions.map((a, i) => { const Icon = a.icon; return (
              <button key={i} onClick={() => a.onClick ? a.onClick() : setPending({ text: a.prompt, nonce: Date.now() })} className="text-left rounded-2xl border border-bdr-light bg-white hover:border-emerald-400 p-2.5 flex items-start gap-2">
                <div className={`w-8 h-8 rounded-xl ${a.tone} flex items-center justify-center flex-shrink-0`}><Icon className="w-4 h-4" /></div>
                <div className="min-w-0"><div className="font-bold text-[12px] leading-tight">{a.title}</div><div className="text-[10px] text-txt-secondary truncate">{a.desc}</div></div>
                <ChevronRight className="w-3 h-3 text-txt-tertiary ml-auto mt-1" />
              </button>) })}
          </div>
        </div>
      )}
      <div className="flex-1 min-h-0">
        <AvatarCall persona="learning-assistant" title="Guru ji" intro="Pucho — koi bhi doubt, kisi bhi bhasha mein." useWebSearch={false} extraSystem={ctx} pendingPrompt={pending} threadId={context?.threadId} onCallStateChange={(s) => setOnCall(s !== 'idle')}
          suggestions={['Three-phase aur single-phase mein farak?', 'Multimeter se reading kaise lete hain?', 'Earthing kyun zaroori hai?']} />
      </div>
    </div>
  )
}
