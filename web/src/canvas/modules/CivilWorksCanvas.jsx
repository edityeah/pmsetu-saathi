// Civil works — per-ITI labs/classrooms/hostel. Design approval (IMA/State),
// scheduled completion (liquidated damages beyond it), IMA inspection.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Bar, Pill, Loading, Btn, useLoad, fmtDate, fmtCr, stateKind } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'
import AssignTaskForm, { AssignTaskToggle, AskStatusBox } from './_AssignTask.jsx'

export default function CivilWorksCanvas({ context }) {
  const { role, meExtra, showToast } = useApp()
  const { data, reload } = useLoad(() => api.civil())
  const [editing, setEditing] = useState(null)
  const [asking, setAsking] = useState(null)
  const [assigning, setAssigning] = useState(false)
  const [assignFor, setAssignFor] = useState(null)
  useSaathiContext(data ? brief(data) : '', ['Which works are delayed and what is the recovery plan?'])
  if (!data) return <Loading />
  const myIti = role === 'iti_principal' ? meExtra?.iti?.id : (context?.itiId || null)
  const works = data.works.filter(w => !myIti || w.itiId === myIti)
  const scopeName = myIti ? (data.works.find(w => w.itiId === myIti)?.iti?.name || meExtra?.iti?.name) : null
  const total = works.reduce((s, w) => s + w.budgetCr, 0)
  const weighted = total ? Math.round(works.reduce((s, w) => s + w.pctComplete * w.budgetCr, 0) / total) : 0
  const delayed = works.filter(w => w.state === 'delayed' || (new Date(w.scheduledCompletion) < new Date() && w.pctComplete < 100))

  async function save(w, pct) { await api.civilProgress(w.id, { pctComplete: pct }); setEditing(null); showToast({ kind: 'success', text: 'Progress updated. IMA sees the new figure at next inspection.' }); reload() }

  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="orange" eyebrow="Upgradation works" title={myIti ? `Civil works at ${scopeName || 'this ITI'}` : 'Civil works across the cluster'} subtitle="Designs go to the IMA and State before work starts. Delay past the scheduled completion date attracts liquidated damages against the performance security." />
      <div className="p-4 space-y-4">
        {role === 'spv_ceo' && (
          <div className="flex items-center gap-2 flex-wrap">
            <AssignTaskToggle open={assigning} onToggle={() => { setAssigning(a => !a); setAssignFor(null) }} />
            <span className="text-[11px] text-txt-tertiary">Put a civil follow-up on a principal; they are notified in-app.</span>
          </div>
        )}
        {assigning && <AssignTaskForm defaults={{ itiId: assignFor?.itiId || myIti || undefined, category: 'Civil', title: assignFor ? `Civil: ${assignFor.title} — update and evidence` : '', evidence: 'Site photo and contractor progress note' }} lockIti={!!assignFor} onDone={() => { setAssigning(false); setAssignFor(null) }} onCancel={() => { setAssigning(false); setAssignFor(null) }} />}
        <StatGrid>
          <Stat label="Works" value={works.length} sub={fmtCr(total)} tone="indigo" />
          <Stat label="Weighted progress" value={`${weighted}%`} sub="by budget" tone={weighted >= 40 ? 'emerald' : 'amber'} />
          <Stat label="Delayed" value={delayed.length} tone={delayed.length ? 'rose' : 'emerald'} />
          <Stat label="IMA inspected" value={works.filter(w => w.imaInspectedAt).length} sub={`of ${works.filter(w => w.startedAt).length} started`} tone="sky" />
        </StatGrid>
        <ul className="space-y-2.5">
          {works.map(w => (
            <li key={w.id} className="rounded-2xl border border-bdr-light bg-white shadow-card p-3.5">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap"><div className="text-[13px] font-bold text-txt-primary">{w.title}</div><Pill kind={stateKind(w.state)}>{w.state.replace(/_/g, ' ')}</Pill></div>
                  <div className="text-[11px] text-txt-secondary mt-0.5">{w.iti.name} · {fmtCr(w.budgetCr)} · {w.contractor || 'contractor TBD'}</div>
                  <div className="text-[10px] text-txt-tertiary mt-0.5">Design {w.designApprovedAt ? `approved ${fmtDate(w.designApprovedAt)}` : 'pending'} · started {fmtDate(w.startedAt)} · due {fmtDate(w.scheduledCompletion)} · IMA inspection {w.imaInspectedAt ? fmtDate(w.imaInspectedAt) : 'not yet'}</div>
                </div>
                <div className="text-right flex-shrink-0"><div className="text-[22px] font-bold leading-none">{w.pctComplete}%</div></div>
              </div>
              <div className="mt-2"><Bar pct={w.pctComplete} tone={w.state === 'delayed' ? 'rose' : 'auto'} /></div>
              {role === 'iti_principal' && (
                editing === w.id ? (
                  <div className="mt-2 flex items-center gap-2"><input type="range" min="0" max="100" defaultValue={w.pctComplete} id={`r-${w.id}`} className="flex-1 accent-primary" /><Btn small onClick={() => save(w, Number(document.getElementById(`r-${w.id}`).value))}>Save</Btn><Btn small tone="ghost" onClick={() => setEditing(null)}>Cancel</Btn></div>
                ) : <div className="mt-2"><Btn small tone="ghost" onClick={() => setEditing(w.id)}>Update progress</Btn></div>
              )}
              {role === 'spv_ceo' && (asking === w.id
                ? <AskStatusBox placeholder={`What do you want to know about ${w.title}?`} onCancel={() => setAsking(null)} onSend={async q => { await api.civilAsk(w.id, q); showToast({ kind: 'success', text: `Sent to the principal of ${w.iti.name}.` }); setAsking(null) }} />
                : <div className="mt-2 flex gap-1.5 flex-wrap"><Btn small tone="ghost" onClick={() => setAsking(w.id)}>Ask for current status</Btn><Btn small tone="ghost" onClick={() => { setAssignFor(w); setAssigning(true); window.scrollTo?.({ top: 0 }) }}>Assign a task</Btn></div>)}
              {role === 'ima_officer' && <div className="mt-2"><Btn small tone="ghost" onClick={() => showToast({ kind: 'success', text: `Inspection scheduled for ${w.iti.name}.` })}>Schedule inspection</Btn></div>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
