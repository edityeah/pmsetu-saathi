// OJT logbook (student) — log hours and tasks for my OJT or apprenticeship
// spell; see mentor and ITI sign-off.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Bar, Pill, Section, Loading, Btn, useLoad, fmtDate, Empty, inputCls } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

export default function OjtLogbookCanvas() {
  const { showToast, openCanvas } = useApp()
  const { data, reload } = useLoad(() => api.spells({}))
  const [form, setForm] = useState({ hours: 4, task: '', traineeNote: '' })
  useSaathiContext(data ? brief(data) : '', ['Kitne hours baaki hain?', 'Mentor sign-off kaise hoga?'])
  if (!data) return <Loading />
  const s = data.spells.find(x => x.type === 'ojt' || x.type === 'apprenticeship')
  if (!s) return <div className="p-4"><Empty>No OJT or apprenticeship yet. OJT is arranged by your ITI's placement cell during the course; apprenticeships come from the opportunities list. <button className="text-primary font-bold" onClick={() => openCanvas({ type: 'jobs' })}>See opportunities →</button></Empty></div>
  async function log(e) { e.preventDefault(); if (!form.task) return showToast({ kind: 'warn', text: 'Describe the task.' }); await api.spellLog(s.id, { ...form, hours: Number(form.hours) }); showToast({ kind: 'success', text: `${form.hours} hours logged.` }); setForm({ hours: 4, task: '', traineeNote: '' }); reload() }
  return (
    <div className="h-full overflow-y-auto bg-surface-page/40">
      <Hero tone="orange" eyebrow={s.type === 'ojt' ? 'On-the-Job Training' : 'Apprenticeship'} title={s.role} subtitle={`${s.employer.name} · mentor ${s.mentorName || 'to be named'} · started ${fmtDate(s.startAt)}`} />
      <div className="p-4 space-y-4">
        {s.hoursTarget && <div className="rounded-2xl bg-white border border-bdr-light p-3"><Bar pct={100 * s.hoursLogged / s.hoursTarget} label={`${s.hoursLogged} of ${s.hoursTarget} hours`} tone="auto" /><div className="mt-2 flex gap-2 flex-wrap"><Pill kind={s.mentorSignedAt ? 'ok' : 'warn'}>mentor {s.mentorSignedAt ? 'signed' : 'not yet'}</Pill><Pill kind={s.itiSignedAt ? 'ok' : 'warn'}>ITI {s.itiSignedAt ? 'signed' : 'not yet'}</Pill><Pill kind="info">{s.evidenceLevel.replace(/_/g, ' ')}</Pill></div></div>}
        <Section tone="indigo" title="Log today">
          <form onSubmit={log} className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <input type="number" min="0.5" max="12" step="0.5" value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} className={inputCls} />
            <input value={form.task} onChange={e => setForm({ ...form, task: e.target.value })} placeholder="What did you do?" className={`${inputCls} md:col-span-2`} />
            <Btn type="submit" small>Log hours</Btn>
            <input value={form.traineeNote} onChange={e => setForm({ ...form, traineeNote: e.target.value })} placeholder="What did you learn? (optional)" className={`${inputCls} md:col-span-4`} />
          </form>
        </Section>
        <Section tone="emerald" title="Logbook">
          <ul className="space-y-1.5 text-[12px]">{[...s.logbook].reverse().map((l, i) => <li key={i} className="flex items-start gap-2"><span className="text-[10px] text-txt-tertiary w-20">{l.date}</span><span className="flex-1"><b>{l.hours} h</b> · {l.task}{l.traineeNote ? <span className="block text-[11px] text-txt-secondary">{l.traineeNote}</span> : null}</span></li>)}{s.logbook.length === 0 && <li className="text-txt-tertiary">No entries yet.</li>}</ul>
        </Section>
      </div>
    </div>
  )
}
