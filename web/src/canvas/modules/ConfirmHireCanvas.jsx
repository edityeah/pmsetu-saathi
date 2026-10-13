// Confirm hires (employer) — interviews, offers and joiners that students or
// coordinators reported for my opportunities. Confirming raises the
// evidence level to employer_confirmed; disputing flags it for the SPV.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Pill, Section, Loading, Btn, useLoad, fmtDate, fmtInr, titleCase } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

export default function ConfirmHireCanvas() {
  const { showToast } = useApp()
  const { data, reload } = useLoad(() => api.applications({}))
  const [wage, setWage] = useState({})
  useSaathiContext(data ? brief(data) : '', ['Who is pending my confirmation?', 'What happens when I dispute a record?'])
  if (!data) return <Loading />
  const apps = data.applications
  const pending = apps.filter(a => ['interviewed', 'offered', 'joined', 'follow_up'].includes(a.stage) && !['employer_confirmed', 'independently_verified'].includes(a.evidenceLevel))
  const confirmed = apps.filter(a => ['employer_confirmed', 'independently_verified'].includes(a.evidenceLevel))
  async function confirm(a) { const stage = a.stage === 'interviewed' ? 'offered' : ['joined', 'follow_up'].includes(a.stage) ? 'joined' : a.stage; await api.applicationStage(a.id, { stage, wage: wage[a.id] ? Number(wage[a.id]) : a.offerWage || undefined, interviewOutcome: 'feedback_received' }); showToast({ kind: 'success', text: `${a.trainee.name}: ${stage} confirmed.` }); reload() }
  async function dispute(a) { await api.applicationStage(a.id, { evidenceLevel: 'disputed', note: 'Employer: no record of this candidate joining' }); showToast({ kind: 'warn', text: 'Marked disputed; SPV coordinator will follow up.' }); reload() }
  async function notSelected(a) { await api.applicationStage(a.id, { stage: 'not_selected', note: 'Not selected at interview' }); reload() }
  return (
    <div className="h-full overflow-y-auto bg-surface-page/40">
      <Hero tone="emerald" eyebrow="Your confirmation" title={`${pending.length} to confirm`} subtitle="Students or the ITI reported these for your opportunities. Your confirmation is what makes a placement count; disputes are resolved by the SPV before anything is reported." />
      <div className="p-4 space-y-4">
        <StatGrid>
          <Stat label="Pending" value={pending.length} tone="amber" />
          <Stat label="Confirmed by you" value={confirmed.length} tone="emerald" />
          <Stat label="Interviewed" value={apps.filter(a => a.stage === 'interviewed').length} tone="sky" />
          <Stat label="Disputed" value={apps.filter(a => a.evidenceLevel === 'disputed').length} tone="rose" />
        </StatGrid>
        <Section title="Pending your confirmation">
          <ul className="space-y-2">{pending.map(a => (
            <li key={a.id} className="rounded-xl border border-bdr-light bg-white p-3 text-[12px]">
              <div className="flex items-center gap-2 flex-wrap"><b className="text-[13px]">{a.trainee.name}</b><Pill kind="info">{a.stage.replace(/_/g, ' ')}</Pill><Pill kind={a.evidenceLevel === 'disputed' ? 'bad' : 'warn'}>{a.evidenceLevel.replace(/_/g, ' ')}</Pill></div>
              <div className="text-[11px] text-txt-secondary">{a.opportunity.title} · {a.trainee.iti.name} · {a.trainee.batch?.tradeId}{a.joinedAt ? ` · joined ${fmtDate(a.joinedAt)}` : a.offerAt ? ` · offer ${fmtDate(a.offerAt)}` : a.interviewAt ? ` · interviewed ${fmtDate(a.interviewAt)}` : ''}{a.offerWage ? ` · reported ${fmtInr(a.offerWage)}/month` : ''}</div>
              {a.evidenceLevel !== 'disputed' && <div className="mt-2 flex gap-1.5 flex-wrap items-center"><input type="number" placeholder={a.opportunity.type === 'wage' ? 'Wage / month' : 'Stipend'} value={wage[a.id] ?? ''} onChange={e => setWage(w => ({ ...w, [a.id]: e.target.value }))} className="w-32 rounded-lg border border-bdr px-2 py-1.5" /><Btn small tone="ok" onClick={() => confirm(a)}>{a.stage === 'interviewed' ? 'Confirm offer made' : ['joined', 'follow_up'].includes(a.stage) ? 'Confirm joined' : 'Confirm'}</Btn>{a.stage === 'interviewed' && <Btn small tone="ghost" onClick={() => notSelected(a)}>Not selected</Btn>}<Btn small tone="danger" onClick={() => dispute(a)}>Dispute</Btn></div>}
            </li>))}{pending.length === 0 && <li className="text-[12px] text-txt-tertiary">Nothing pending.</li>}</ul>
        </Section>
        <Section title="Confirmed">
          <ul className="space-y-1 text-[12px]">{confirmed.map(a => <li key={a.id} className="flex items-center gap-2"><Pill kind="ok">{a.evidenceLevel.replace(/_/g, ' ')}</Pill><span className="flex-1 truncate">{a.trainee.name} · {a.opportunity.title}</span><span className="text-[10px] text-txt-tertiary">{titleCase(a.stage)} · {fmtDate(a.lastEventAt)}</span></li>)}{confirmed.length === 0 && <li className="text-txt-tertiary">None yet.</li>}</ul>
        </Section>
      </div>
    </div>
  )
}
