// Report offer / joining (student) — the student's own signal. What they
// report is 'student reported' until the employer confirms. If the record
// says something that is not true, they can dispute it.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Pill, Section, Loading, Btn, useLoad, fmtDate, fmtInr, Empty } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

export default function PlacementConfirmCanvas() {
  const { showToast, openCanvas } = useApp()
  const { data, reload } = useLoad(() => api.applications({}))
  const [wage, setWage] = useState({})
  useSaathiContext(data ? brief(data) : '', ['Main offer kaise report karun?', 'Agar record galat hai to kya karun?'])
  if (!data) return <Loading />
  const active = data.applications.filter(a => ['referred', 'applied', 'interviewed', 'offered'].includes(a.stage))
  const joined = data.applications.filter(a => ['joined', 'follow_up'].includes(a.stage))
  async function report(a, stage) { await api.applicationStage(a.id, { stage, wage: wage[a.id] ? Number(wage[a.id]) : undefined }); showToast({ kind: 'success', text: `Reported ${stage}. The employer and your ITI will confirm.` }); reload() }
  async function dispute(a) { await api.applicationStage(a.id, { evidenceLevel: 'disputed', note: 'Student disputes this record' }); showToast({ kind: 'warn', text: 'Disputed. The coordinator will check with the employer before this is counted.' }); reload() }
  return (
    <div className="h-full overflow-y-auto bg-surface-page/40">
      <Hero tone="violet" eyebrow="Your signal" title="Did you get an offer, or join?" subtitle="Tell your ITI yourself. Your report is one of three signals: yours, the employer's, and the IMA's spot check." />
      <div className="p-4 space-y-4">
        {active.length === 0 && joined.length === 0 && <Empty>No applications in progress. <button className="text-primary font-bold" onClick={() => openCanvas({ type: 'jobs' })}>See opportunities →</button></Empty>}
        {active.length > 0 && <Section tone="indigo" title="In progress">
          <ul className="space-y-2">{active.map(a => <li key={a.id} className="rounded-xl border border-bdr-light bg-white p-2.5 text-[12px]"><div className="flex items-center gap-2 flex-wrap"><b>{a.opportunity.title}</b><Pill kind="info">{a.stage}</Pill></div><div className="text-[11px] text-txt-secondary">{a.opportunity.employer.name} · {fmtDate(a.lastEventAt)}</div><div className="mt-2 flex gap-1.5 flex-wrap items-center"><input type="number" placeholder={a.opportunity.type === 'wage' ? 'Wage offered / month' : 'Stipend / month'} value={wage[a.id] || ''} onChange={e => setWage(w => ({ ...w, [a.id]: e.target.value }))} className="w-36 rounded-lg border border-bdr px-2 py-1.5 text-[12px]" />{a.stage !== 'offered' && <Btn small onClick={() => report(a, 'offered')}>I got an offer</Btn>}{a.stage === 'offered' && <Btn small tone="ok" onClick={() => report(a, 'joined')}>I joined</Btn>}</div></li>)}</ul>
        </Section>}
        {joined.length > 0 && <Section tone="emerald" title="Joined — is the record right?" hint="If the employer's record says you joined but you did not, say so.">
          <ul className="space-y-2">{joined.map(a => <li key={a.id} className="rounded-xl border border-bdr-light bg-white p-2.5 text-[12px]"><div className="flex items-center gap-2 flex-wrap"><b>{a.opportunity.title}</b><Pill kind={a.evidenceLevel === 'disputed' ? 'bad' : a.evidenceLevel === 'student_reported' ? 'info' : 'ok'}>{a.evidenceLevel.replace(/_/g, ' ')}</Pill></div><div className="text-[11px] text-txt-secondary">{a.opportunity.employer.name} · joined {fmtDate(a.joinedAt)}{a.offerWage ? ` · ${fmtInr(a.offerWage)}/month` : ''}</div>{a.evidenceLevel !== 'disputed' && <div className="mt-2 flex gap-1.5"><Btn small tone="ghost" onClick={() => openCanvas({ type: 'on_job_buddy' })}>Check in about the job</Btn><Btn small tone="danger" onClick={() => dispute(a)}>This is wrong</Btn></div>}{a.evidenceNote && <div className="text-[11px] text-rose-700 mt-1">{a.evidenceNote}</div>}</li>)}</ul>
        </Section>}
      </div>
    </div>
  )
}
