// Civil works — per-ITI labs/classrooms/hostel. Design approval (IMA/State),
// scheduled completion (liquidated damages beyond it), IMA inspection.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Bar, Pill, Loading, Btn, useLoad, fmtDate, fmtCr, stateKind } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

export default function CivilWorksCanvas() {
  const { role, meExtra, showToast } = useApp()
  const { data, reload } = useLoad(() => api.civil())
  const [editing, setEditing] = useState(null)
  useSaathiContext(data ? brief(data) : '', ['Which works are delayed and what is the recovery plan?'])
  if (!data) return <Loading />
  const myIti = role === 'iti_principal' ? meExtra?.iti?.id : null
  const works = data.works.filter(w => !myIti || w.itiId === myIti)
  const total = works.reduce((s, w) => s + w.budgetCr, 0)
  const weighted = total ? Math.round(works.reduce((s, w) => s + w.pctComplete * w.budgetCr, 0) / total) : 0
  const delayed = works.filter(w => w.state === 'delayed' || (new Date(w.scheduledCompletion) < new Date() && w.pctComplete < 100))

  async function save(w, pct) { await api.civilProgress(w.id, { pctComplete: pct }); setEditing(null); showToast({ kind: 'success', text: 'Progress updated. IMA sees the new figure at next inspection.' }); reload() }

  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="orange" eyebrow="Upgradation works" title={myIti ? `Civil works at ${meExtra?.iti?.name}` : 'Civil works across the cluster'} subtitle="Designs go to the IMA and State before work starts. Delay past the scheduled completion date attracts liquidated damages against the performance security." />
      <div className="p-4 space-y-4">
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
              {(role === 'spv_ceo' || role === 'iti_principal') && (
                editing === w.id ? (
                  <div className="mt-2 flex items-center gap-2"><input type="range" min="0" max="100" defaultValue={w.pctComplete} id={`r-${w.id}`} className="flex-1 accent-primary" /><Btn small onClick={() => save(w, Number(document.getElementById(`r-${w.id}`).value))}>Save</Btn><Btn small tone="ghost" onClick={() => setEditing(null)}>Cancel</Btn></div>
                ) : <div className="mt-2"><Btn small tone="ghost" onClick={() => setEditing(w.id)}>Update progress</Btn></div>
              )}
              {role === 'ima_officer' && <div className="mt-2"><Btn small tone="ghost" onClick={() => showToast({ kind: 'success', text: `Inspection scheduled for ${w.iti.name}.` })}>Schedule inspection</Btn></div>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
