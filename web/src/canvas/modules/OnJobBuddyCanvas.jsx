// On-job buddy (student) — month-1 and month-3 follow-ups after joining,
// plus a place to raise a problem at work. Each answer updates the spell
// and the application (still working / changed / not working).
import { useState } from 'react'
import AvatarCall from '../../components/AvatarCall.jsx'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Pill, Btn, useLoad, Loading, fmtDate, fmtInr } from './_ui.jsx'

export default function OnJobBuddyCanvas({ context }) {
  const { showToast, meExtra } = useApp()
  const { data, reload } = useLoad(() => api.spells({}))
  const [onCall, setOnCall] = useState(false)
  if (!data) return <Loading />
  const spell = data.spells.find(s => s.type === 'wage') || data.spells[0]
  const due = data.followUpsDue
  async function respond(f, status) { await api.followUpRespond(f.id, { status }); showToast({ kind: 'success', text: status === 'working' ? 'Thanks — recorded. Counts for your ITI.' : 'Recorded. Your ITI will reach out.' }); reload() }
  const ctx = spell ? `Student ${meExtra?.trainee?.name} works as ${spell.role} at ${spell.employer.name} since ${fmtDate(spell.startAt)}${spell.wage ? ` at ₹${spell.wage}/month` : ''}. Evidence level ${spell.evidenceLevel}. Help with workplace problems (hours, pay, safety, respect), how to raise them, and when to tell the ITI. Never promise outcomes.` : 'Student has not joined a job yet; talk about what to expect in the first month at work.'
  return (
    <div className="flex flex-col h-full">
      {!onCall && (
        <div className="px-4 pt-4 pb-3 bg-gradient-to-br from-lime-50/70 to-white border-b border-bdr-light flex-shrink-0 space-y-3">
          <div><div className="text-[11px] font-bold uppercase tracking-[2px] text-lime-700">On-job buddy</div><h2 className="text-[18px] font-bold text-txt-primary leading-tight mt-1">{spell ? `${spell.role} · ${spell.employer.name}` : 'Not on a job yet'}</h2>{spell && <div className="text-[11px] text-txt-secondary">since {fmtDate(spell.startAt)}{spell.wage ? ` · ${fmtInr(spell.wage)}/month` : ''} · <Pill kind={spell.evidenceLevel === 'disputed' ? 'bad' : 'info'}>{spell.evidenceLevel.replace(/_/g, ' ')}</Pill></div>}</div>
          {due.length > 0 && <div className="rounded-2xl border border-primary/30 bg-white p-3"><div className="text-[12px] font-bold">Check-in due · {fmtDate(due[0].dueAt)}</div><div className="text-[11px] text-txt-secondary mb-2">Still at {due[0].spell.employer.name}? One tap.</div><div className="flex gap-1.5 flex-wrap"><Btn small tone="ok" onClick={() => respond(due[0], 'working')}>Yes, still working</Btn><Btn small tone="ghost" onClick={() => respond(due[0], 'changed')}>Changed job</Btn><Btn small tone="danger" onClick={() => respond(due[0], 'not_working')}>Not working now</Btn></div></div>}
          {spell && <ul className="flex gap-1.5 flex-wrap text-[10px]">{spell.followUps.map(f => <li key={f.id}><Pill kind={f.respondedAt ? 'ok' : new Date(f.dueAt) < new Date() ? 'bad' : 'neutral'}>{fmtDate(f.dueAt)}{f.status ? ` · ${f.status}` : f.respondedAt ? '' : ' · due'}</Pill></li>)}</ul>}
        </div>
      )}
      <div className="flex-1 min-h-0"><AvatarCall persona="general" title="Saathi · On the job" intro="Kaam kaisa chal raha hai? Koi dikkat ho to batao." useWebSearch={false} extraSystem={ctx} threadId={context?.threadId} onCallStateChange={(s) => setOnCall(s !== 'idle')} suggestions={['Salary late hai, kya karun?', 'Shift bahut lambi hai', 'Supervisor se baat kaise karun?']} /></div>
    </div>
  )
}
