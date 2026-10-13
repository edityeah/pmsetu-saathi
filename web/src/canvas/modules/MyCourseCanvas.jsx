// My Course — the trainee LMS. Deliberately simple: modules as a path,
// lessons as a checklist, credits and hours as the score. Nothing Coursera-ish.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Bar, Pill, Loading, Btn, useLoad, Empty } from './_ui.jsx'
import { Lock, CheckCircle2, Circle, PlayCircle, FileText, Wrench, HelpCircle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

const ICON = { video: PlayCircle, text: FileText, practical: Wrench, quiz: HelpCircle }

const QUIZ = [
  { q: 'Kaam shuru karne se pehle sabse pehle kya check karte hain?', a: ['Supply off aur lock-out', 'Phone silent', 'Coolant level'], c: 0 },
  { q: 'Multimeter se voltage naapte waqt kya dhyaan rakhein?', a: ['Current mode pe rakhein', 'Sahi range aur parallel connection', 'Probe ulte lagao'], c: 1 },
  { q: 'Drawing mein ± tolerance ka matlab?', a: ['Rang', 'Material', 'Allowed variation in size'], c: 2 },
]

export default function MyCourseCanvas() {
  const { showToast, openCanvas } = useApp()
  const { data, reload } = useLoad(() => api.myCourse())
  const [open, setOpen] = useState(null)
  const [quiz, setQuiz] = useState(null) // { moduleId, answers }
  useSaathiContext(data ? brief(data) : '', ['Agla lesson kaunsa hai?', 'Mere credits kitne hue?'])
  if (!data) return <Loading />
  if (!data.enrolled) return <div className="p-4"><Empty>You are not enrolled in a batch yet. <button className="text-primary font-bold" onClick={() => openCanvas({ type: 'course_selection' })}>Choose a course →</button></Empty></div>
  const { trade, batch, modules, creditsEarned, creditsTotal, hoursLogged, hoursTotal, ojt } = data
  const current = modules.find(m => m.current) || modules[0]
  const opened = open ?? current.id

  async function done(m, i) { await api.lessonDone(m.id, i); reload() }
  async function submitQuiz(m) {
    const score = QUIZ.reduce((s, q, i) => s + (quiz.answers[i] === q.c ? 1 : 0), 0)
    await api.quizResult({ moduleId: m.id, score, maxScore: QUIZ.length, title: `${m.title} — quick check` })
    showToast({ kind: score >= 2 ? 'success' : 'warn', text: `${score}/${QUIZ.length} — ${score >= 2 ? 'shabash! pass' : 'ek baar phir se dekh lo'}` })
    setQuiz(null); reload()
  }

  return (
    <div className="h-full overflow-y-auto bg-surface-page/40">
      <Hero tone="indigo" eyebrow={`${batch.iti?.name || ''} · ${batch.name}`} title={trade.name} subtitle={`Batch lead ${batch.lead?.name || '—'} · NSQF level ${trade.nsqfLevel} · ${creditsTotal} credits in total`} />
      <div className="px-4 pt-3">
        <div className="rounded-2xl bg-white border border-bdr-light shadow-card p-3 grid grid-cols-3 gap-2 text-center">
          <div><div className="text-[20px] font-bold text-primary">{creditsEarned}<span className="text-[11px] text-txt-tertiary">/{creditsTotal}</span></div><div className="text-[10px] uppercase font-bold text-txt-tertiary">credits</div></div>
          <div><div className="text-[20px] font-bold text-emerald-600">{hoursLogged}<span className="text-[11px] text-txt-tertiary">/{hoursTotal}</span></div><div className="text-[10px] uppercase font-bold text-txt-tertiary">hours</div></div>
          <div><div className="text-[20px] font-bold text-amber-600">M{current.index}</div><div className="text-[10px] uppercase font-bold text-txt-tertiary">current</div></div>
        </div>
      </div>
      <ol className="p-4 space-y-2.5">
        {modules.map(m => {
          const isOpen = opened === m.id
          const Status = m.pctComplete === 100 ? CheckCircle2 : m.locked ? Lock : Circle
          return (
            <li key={m.id} className={`rounded-2xl border bg-white shadow-card overflow-hidden ${m.current ? 'border-primary' : 'border-bdr-light'}`}>
              <button onClick={() => setOpen(isOpen ? '' : m.id)} className="w-full text-left px-3.5 py-3 flex items-center gap-3">
                <Status className={`w-5 h-5 flex-shrink-0 ${m.pctComplete === 100 ? 'text-emerald-600' : m.locked ? 'text-txt-tertiary' : 'text-primary'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-txt-primary truncate">M{m.index} · {m.title}</div>
                  <div className="text-[10px] text-txt-secondary">{m.hours} h · {m.credits} credits · <span className="capitalize">{m.kind}</span>{m.quiz ? ` · quick check ${m.quiz.marks}/${m.quiz.assessment.maxMarks}` : ''}</div>
                  {!m.locked && <div className="mt-1.5"><Bar pct={m.pctComplete} tone={m.pctComplete === 100 ? 'emerald' : 'primary'} /></div>}
                </div>
                {m.current && <Pill kind="info">now</Pill>}
                {isOpen ? <ChevronUp className="w-4 h-4 text-txt-tertiary" /> : <ChevronDown className="w-4 h-4 text-txt-tertiary" />}
              </button>
              {isOpen && !m.locked && m.kind !== 'ojt' && (
                <div className="border-t border-bdr-light px-3.5 py-2.5 space-y-1.5">
                  {m.lessons.map((l, i) => {
                    const Icon = ICON[l.type] || FileText
                    const isDone = m.lessonsDone.includes(i)
                    return (
                      <div key={i} className="flex items-center gap-2 text-[12px]">
                        <Icon className={`w-4 h-4 flex-shrink-0 ${l.type === 'practical' ? 'text-amber-600' : l.type === 'quiz' ? 'text-violet-600' : 'text-primary'}`} />
                        <span className={`flex-1 ${isDone ? 'line-through text-txt-tertiary' : ''}`}>{l.title}</span>
                        <span className="text-[10px] text-txt-tertiary">{l.minutes >= 60 ? `${Math.round(l.minutes / 60)} h` : `${l.minutes} min`}</span>
                        {l.type === 'quiz' ? (!isDone && <Btn small onClick={() => setQuiz({ moduleId: m.id, answers: {} })}>Start</Btn>) : (isDone ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Btn small tone="ghost" onClick={() => done(m, i)}>Done</Btn>)}
                      </div>
                    )
                  })}
                  {quiz?.moduleId === m.id && (
                    <div className="mt-2 rounded-xl bg-violet-50 border border-violet-200 p-3 space-y-3">
                      {QUIZ.map((q, qi) => (
                        <div key={qi}><div className="text-[12px] font-bold text-txt-primary mb-1">{qi + 1}. {q.q}</div><div className="flex flex-col gap-1">{q.a.map((a, ai) => <label key={ai} className={`text-[12px] rounded-lg px-2 py-1.5 border cursor-pointer ${quiz.answers[qi] === ai ? 'bg-white border-violet-400' : 'bg-white/60 border-transparent'}`}><input type="radio" name={`q${qi}`} className="mr-2 accent-violet-600" checked={quiz.answers[qi] === ai} onChange={() => setQuiz(z => ({ ...z, answers: { ...z.answers, [qi]: ai } }))} />{a}</label>)}</div></div>
                      ))}
                      <div className="flex gap-2 justify-end"><Btn small tone="ghost" onClick={() => setQuiz(null)}>Cancel</Btn><Btn small onClick={() => submitQuiz(m)} disabled={Object.keys(quiz.answers).length < QUIZ.length}>Submit</Btn></div>
                    </div>
                  )}
                  <div className="pt-1"><button onClick={() => openCanvas({ type: 'doubt_solver', moduleId: m.id, moduleTitle: m.title })} className="inline-flex items-center gap-1 text-[11px] font-bold text-primary"><Sparkles className="w-3 h-3" /> Doubt? Ask Guru ji about this module</button></div>
                </div>
              )}
              {isOpen && m.kind === 'ojt' && (
                <div className="border-t border-bdr-light px-3.5 py-2.5 text-[12px] text-txt-secondary">
                  {ojt ? <>At <b>{ojt.employer?.name}</b> · {ojt.hoursLogged}/{ojt.hoursTarget || 150} h · mentor {ojt.mentorName || 'TBD'}. <button className="text-primary font-bold" onClick={() => openCanvas({ type: 'ojt_logbook' })}>Open logbook →</button></> : <>OJT is arranged by the placement cell with a cluster employer. <button className="text-primary font-bold" onClick={() => openCanvas({ type: 'jobs' })}>See opportunities →</button></>}
                </div>
              )}
              {isOpen && m.locked && <div className="border-t border-bdr-light px-3.5 py-2.5 text-[12px] text-txt-tertiary">Unlocks when the batch reaches module {m.index}.</div>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
