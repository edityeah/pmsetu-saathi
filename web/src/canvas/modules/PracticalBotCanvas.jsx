// Practical bot (Module B) — rubric observation per student per task:
// three criteria scored 0–2, a result (demonstrated / developing / needs
// re-practice / not observed) and a recheck date when needed.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Pill, Section, Loading, Btn, useLoad, fmtDate, titleCase, inputCls } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

const RESULT_KIND = { demonstrated: 'ok', developing: 'warn', needs_re_practice: 'bad', not_observed: 'neutral' }

export default function PracticalBotCanvas({ context }) {
  const { showToast } = useApp()
  const { data: batches } = useLoad(() => api.batches({}))
  const [batchId, setBatchId] = useState(context?.batchId || null)
  const first = batches?.batches?.find(b => b.state === 'running')?.id
  const active = batchId || first
  const { data, reload } = useLoad(() => active ? api.practicals(active) : Promise.resolve(null), [active])
  const [cell, setCell] = useState(null) // { traineeId, taskId }
  const [scores, setScores] = useState({})
  const [note, setNote] = useState('')
  const [recheck, setRecheck] = useState(7)
  useSaathiContext(data ? brief(data) : '', ['Who needs re-practice and when is the recheck?', 'Which task has not been observed for most students?'])
  if (!batches || !data) return <Loading />
  if (!data.batch) return <div className="p-4 text-[12px] text-txt-tertiary">No batch selected.</div>
  const { batch, tasks, matrix, counts } = data
  const total = Object.values(scores).reduce((a, b) => a + b, 0)
  const suggested = total >= 5 ? 'demonstrated' : total >= 3 ? 'developing' : 'needs_re_practice'
  const task = tasks.find(t => t.id === cell?.taskId)
  async function save(result) {
    await api.observe({ taskId: cell.taskId, traineeId: cell.traineeId, scores, result, note: note || undefined, recheckDays: result === 'needs_re_practice' ? Number(recheck) : undefined })
    showToast({ kind: 'success', text: `${titleCase(result)} recorded${result === 'needs_re_practice' ? ' · recheck and support action created' : ''}.` }); setCell(null); setScores({}); setNote(''); reload()
  }
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="teal" eyebrow="Practical bot · rubric observation" title={batch.name} subtitle={`${batch.trade.name} · ${tasks.length} practical tasks · ${matrix.length} students. Results stay 'not observed' until you record one; they are never inferred from attendance.`}
        right={<select value={active || ''} onChange={e => { setBatchId(e.target.value); setCell(null) }} className="text-[12px] rounded-lg border border-bdr px-2 py-1.5 bg-white max-w-[240px]">{batches.batches.filter(b => b.state === 'running').map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>} />
      <div className="p-4 space-y-4">
        <StatGrid>
          <Stat label="Demonstrated" value={counts.demonstrated || 0} tone="emerald" />
          <Stat label="Developing" value={counts.developing || 0} tone="amber" />
          <Stat label="Needs re-practice" value={counts.needs_re_practice || 0} sub="recheck scheduled" tone="rose" />
          <Stat label="Not yet observed" value={matrix.length * tasks.length - Object.values(counts).reduce((a, b) => a + b, 0)} sub="student × task cells" tone="slate" />
        </StatGrid>
        {cell && task && (
          <Section title={`${matrix.find(m => m.id === cell.traineeId)?.name} · ${task.title}`} hint="Score each criterion 0 (not shown) · 1 (partly) · 2 (fully).">
            <div className="space-y-2">
              {task.rubric.map(c => <div key={c} className="flex items-center gap-3 text-[12px]"><span className="flex-1">{c}</span><div className="flex rounded-pill bg-surface-page p-0.5">{[0, 1, 2].map(v => <button key={v} onClick={() => setScores(s => ({ ...s, [c]: v }))} className={`w-8 h-7 rounded-pill text-[11px] font-bold ${scores[c] === v ? (v === 2 ? 'bg-emerald-500 text-white' : v === 1 ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white') : 'text-txt-tertiary'}`}>{v}</button>)}</div></div>)}
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note for the student (optional)" className={inputCls} />
              <div className="flex items-center gap-2 flex-wrap text-[12px]"><span>Total <b>{total}</b>/{task.rubric.length * 2} → suggested <Pill kind={RESULT_KIND[suggested]}>{titleCase(suggested)}</Pill></span><span className="ml-auto inline-flex items-center gap-1">Recheck in <input type="number" min="1" max="30" value={recheck} onChange={e => setRecheck(e.target.value)} className="w-14 rounded-lg border border-bdr px-1.5 py-1" /> days</span></div>
              <div className="flex gap-1.5 flex-wrap justify-end"><Btn small tone="ghost" onClick={() => setCell(null)}>Cancel</Btn><Btn small tone="ghost" onClick={() => save('not_observed')}>Not observed</Btn><Btn small tone="danger" onClick={() => save('needs_re_practice')}>Needs re-practice</Btn><Btn small tone="amber" onClick={() => save('developing')}>Developing</Btn><Btn small tone="ok" onClick={() => save('demonstrated')}>Demonstrated</Btn></div>
            </div>
          </Section>
        )}
        <Section title="Students × tasks" hint="Tap a cell to observe. Latest observation shown.">
          <div className="overflow-x-auto"><table className="w-full text-[11px]">
            <thead><tr className="bg-surface-page/50 border-b border-bdr-light"><th className="px-2 py-2 text-left font-bold text-txt-secondary uppercase text-[10px]">Student</th>{tasks.map(t => <th key={t.id} className="px-2 py-2 text-left font-bold text-txt-secondary uppercase text-[10px] min-w-[150px]">{t.title}{!t.required && <span className="text-txt-tertiary font-normal"> (optional)</span>}</th>)}</tr></thead>
            <tbody>{matrix.map(m => <tr key={m.id} className="border-b border-bdr-light/60"><td className="px-2 py-1.5 font-semibold whitespace-nowrap">{m.name}</td>{tasks.map(t => { const o = m.byTask[t.id]; return <td key={t.id} className="px-2 py-1.5"><button onClick={() => { setCell({ traineeId: m.id, taskId: t.id }); setScores({}); setNote('') }} className="text-left">{o ? <div><Pill kind={RESULT_KIND[o.result]}>{titleCase(o.result)}</Pill><div className="text-[9px] text-txt-tertiary">{fmtDate(o.observedAt)}{o.recheckAt ? ` · recheck ${fmtDate(o.recheckAt)}` : ''}</div></div> : <span className="text-txt-tertiary">+ observe</span>}</button></td> })}</tr>)}</tbody>
          </table></div>
        </Section>
      </div>
    </div>
  )
}
