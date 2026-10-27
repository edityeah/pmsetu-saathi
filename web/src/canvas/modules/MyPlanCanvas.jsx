// My plan (Module C, student) — today, upcoming tests, career steps with
// checkboxes (saved as an artifact), application next actions, support.
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Pill, Section, Loading, Btn, useLoad, fmtDate, titleCase, Bar } from './_ui.jsx'
import { CheckCircle2, Circle, CalendarDays } from 'lucide-react'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

export default function MyPlanCanvas() {
  const { showToast, openCanvas } = useApp()
  const { data, reload } = useLoad(() => api.companionMe())
  useSaathiContext(data ? brief(data) : '', ['Is hafte kya karna hai?', 'Test ki taiyari kaise karun?', 'Mera agla career step kya hai?'])
  if (!data) return <Loading />
  const { trainee, sessionsToday, upcoming, artifacts, applications, support, progress } = data
  const plan = artifacts.career_plan?.content || { goal: 'Set a goal with Karuna', steps: [] }
  const current = progress.find(p => p.module.index === (trainee.batch?.currentModule || 1)) || progress[0]
  async function toggle(i) { const steps = plan.steps.map((s, k) => k === i ? { ...s, done: !s.done } : s); await api.saveArtifact('career_plan', { title: artifacts.career_plan?.title || 'My plan', content: { ...plan, steps } }); reload() }
  async function addStep() { const step = window.prompt('New step'); if (!step) return; await api.saveArtifact('career_plan', { title: 'My plan', content: { ...plan, steps: [...plan.steps, { step, due: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10), done: false }] } }); showToast({ kind: 'success', text: 'Added.' }); reload() }
  return (
    <div className="h-full overflow-y-auto bg-surface-page/40">
      <Hero tone="violet" eyebrow="My plan" title={plan.goal} subtitle={`${trainee.batch?.trade?.name || ''} · ${trainee.batch?.name || ''}`} />
      <div className="p-4 space-y-4">
        <Section tone="indigo" title="Today" hint={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}>
          {sessionsToday.length === 0 ? <div className="text-[12px] text-txt-tertiary">No classes scheduled today.</div> : <ul className="space-y-1.5 text-[12px]">{sessionsToday.map(s => <li key={s.id} className="flex items-center gap-2"><CalendarDays className="w-3.5 h-3.5 text-primary" /><b>{s.startTime}</b><span className="flex-1 truncate">{s.subject.name} · {s.room} · {s.trainer?.name || ''}</span><Pill kind={s.delivery === 'cancelled' ? 'bad' : 'info'}>{s.delivery}</Pill></li>)}</ul>}
          {current && <div className="mt-3"><div className="text-[11px] text-txt-secondary mb-1">Module {current.module.index}: {current.module.title}</div><Bar pct={current.pctComplete} label={`${current.lessonsDone.length} of ${current.module.lessons.length} lessons`} /><button className="mt-1 text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'my_course' })}>Continue →</button></div>}
        </Section>
        <Section tone="emerald" title="Coming up" hint="Tests planned for your batch in the next two weeks.">
          <ul className="space-y-1.5 text-[12px]">{upcoming.map(a => <li key={a.id} className="flex items-center gap-2"><Pill kind="warn">{fmtDate(a.date)}</Pill><span className="flex-1">{a.title}{a.topic ? ` · ${a.topic}` : ''} · max {a.maxMarks}</span><button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'doubt_solver' })}>Revise</button></li>)}{upcoming.length === 0 && <li className="text-txt-tertiary">Nothing scheduled.</li>}</ul>
        </Section>
        <Section title="Career steps" hint="Tick as you go. Karuna can add steps." right={<Btn small tone="ghost" onClick={addStep}>+ Step</Btn>}>
          <ul className="space-y-1.5">{plan.steps.map((s, i) => <li key={i}><button onClick={() => toggle(i)} className="w-full text-left flex items-center gap-2 text-[12px]">{s.done ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Circle className="w-4 h-4 text-txt-tertiary" />}<span className={`flex-1 ${s.done ? 'line-through text-txt-tertiary' : ''}`}>{s.step}</span><span className="text-[10px] text-txt-tertiary">{s.due}</span></button></li>)}{plan.steps.length === 0 && <li className="text-[12px] text-txt-tertiary">No steps yet — talk to Karuna.</li>}</ul>
        </Section>
        <Section tone="amber" title="Applications · next action" right={<button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'applications' })}>All →</button>}>
          <ul className="space-y-1.5 text-[12px]">{applications.filter(a => a.nextAction).map(a => <li key={a.id} className="flex items-center gap-2"><Pill kind="info">{a.stage.replace(/_/g, ' ')}</Pill><span className="flex-1 truncate">{a.opportunity.title} · <b>{a.nextAction}</b></span><span className="text-[10px] text-txt-tertiary">{fmtDate(a.dueAt)}</span></li>)}{applications.length === 0 && <li className="text-txt-tertiary">No applications yet. <button className="text-primary font-bold" onClick={() => openCanvas({ type: 'jobs' })}>See opportunities →</button></li>}</ul>
        </Section>
        {support.length > 0 && <Section tone="violet" title="Your institute is following up"><ul className="space-y-1 text-[12px]">{support.map(s => <li key={s.id}><Pill kind="warn">{titleCase(s.reason)}</Pill> {s.nextAction} · {s.owner?.name || 'your ITI'}</li>)}</ul></Section>}
      </div>
    </div>
  )
}
