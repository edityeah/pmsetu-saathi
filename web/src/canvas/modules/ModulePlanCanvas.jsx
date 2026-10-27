// Module plan — the instructor's view of the current 240-hour module:
// lessons, hours, and a Saathi tutor to prepare delivery.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { Hero, Pill, Section, Loading, useLoad, Bar } from './_ui.jsx'
import AvatarCall from '../../components/AvatarCall.jsx'

export default function ModulePlanCanvas({ context }) {
  const { data: list } = useLoad(() => api.batches())
  const [batchId, setBatchId] = useState(context?.batchId || null)
  const active = batchId || list?.batches?.find(b => b.state === 'running')?.id
  const { data: batch } = useLoad(() => active ? api.batch(active) : Promise.resolve(null), [active])
  const [pending, setPending] = useState(null)
  if (!list || !batch) return <Loading />
  const b = batch.batch
  const modules = b.trade.modules
  const current = modules.find(m => m.index === b.currentModule) || modules[0]
  const lessons = (() => { try { return JSON.parse(current.lessons || '[]') } catch { return [] } })()
  const avgProgress = Math.round(batch.roster.reduce((s, t) => s + (t.currentModulePct || 0), 0) / Math.max(1, batch.roster.length))
  const extra = `Instructor is teaching ${b.trade.name}, module ${current.index} "${current.title}" (${current.kind}, ${current.hours} h, ${current.credits} credits) to ${batch.roster.length} trainees (8th-12th pass). Lessons: ${lessons.map(l => `${l.title} (${l.type}, ${l.minutes} min)`).join('; ')}. Batch average progress ${avgProgress}%. Help plan today's delivery, practical demos, safety briefings and quick checks.`
  return (
    <div className="h-full flex flex-col">
      <Hero tone="indigo" eyebrow={`${b.trade.name} · ${b.iti.name}`} title={`Module ${current.index} · ${current.title}`} subtitle={`${current.hours} hours · ${current.credits} NCrF credits · ${current.kind === 'core' ? 'core (fixed nationally)' : 'specific (SPV-designed)'} · batch average ${avgProgress}% through`}
        right={<select value={active} onChange={e => setBatchId(e.target.value)} className="text-[12px] rounded-lg border border-bdr px-2 py-1.5 bg-white max-w-[200px]">{list.batches.filter(x => x.state === 'running').map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>} />
      <div className="px-4 pt-3 pb-2 space-y-3 flex-shrink-0">
        <div className="flex gap-1.5 overflow-x-auto">{modules.map(m => <span key={m.id} className={`text-[10px] px-2 py-1 rounded-pill whitespace-nowrap ${m.index === current.index ? 'bg-primary text-white' : m.index < current.index ? 'bg-emerald-100 text-emerald-800' : 'bg-surface-page text-txt-secondary'}`}>M{m.index} · {m.kind}</span>)}</div>
        <Section tone="indigo" title="Lessons in this module">
          <ul className="space-y-1.5">{lessons.map((l, i) => (
            <li key={i} className="flex items-center gap-2 text-[12px]"><Pill kind={l.type === 'practical' ? 'ok' : l.type === 'quiz' ? 'violet' : 'info'}>{l.type}</Pill><span className="flex-1">{l.title}</span><span className="text-[10px] text-txt-tertiary">{l.minutes} min</span><button onClick={() => setPending({ text: `Give me a 45-minute delivery plan for "${l.title}" with a demo, a safety point and a 3-question quick check.`, nonce: Date.now() })} className="text-[10px] text-primary font-bold">Plan ✨</button></li>
          ))}</ul>
          <div className="mt-2"><Bar pct={avgProgress} label="Batch progress in this module" /></div>
        </Section>
      </div>
      <div className="flex-1 min-h-0 border-t border-bdr-light">
        <AvatarCall persona="learning-assistant" title="Guru ji · Instructor mode" useWebSearch={false} extraSystem={extra + ' Address the user as an instructor, not a learner.'} pendingPrompt={pending} threadId={context?.threadId}
          suggestions={['What do I teach this week?', 'Draft a practical job sheet for threading', 'Which trainees need remedial help?', 'Make a quick check for this module']} />
      </div>
    </div>
  )
}
