// IMA verification queue — milestones the SPV submitted, with evidence.
// Verify or return with a note. Verified weight feeds tranche certification.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Pill, Section, Loading, Btn, useLoad, fmtDate, stateKind, titleCase } from './_ui.jsx'
import FilePreview from '../../components/FilePreview.jsx'
import { ShieldCheck, Undo2, FileText } from 'lucide-react'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

export default function VerificationQueueCanvas() {
  const { showToast, openCanvas } = useApp()
  const { data, reload } = useLoad(() => api.milestones())
  const [tab, setTab] = useState('submitted')
  useSaathiContext(data ? brief(data) : '', ['Which submissions carry the most weight?', 'What evidence is missing on the returned milestone?'])
  if (!data) return <Loading />
  const all = data.milestones
  const list = all.filter(m => tab === 'all' || m.state === tab)
  const verifiedW = all.filter(m => m.state === 'verified').reduce((s, m) => s + m.weightPct, 0)
  async function decide(m, decision) {
    const note = decision === 'rejected' ? window.prompt('Observation for the SPV', 'Commissioning certificate missing; resubmit with OEM sign-off.') : undefined
    if (decision === 'rejected' && note === null) return
    await api.milestoneVerify(m.id, { decision, note }); showToast({ kind: 'success', text: decision === 'verified' ? 'Verified · counts toward tranche.' : 'Returned to SPV with observation.' }); reload()
  }
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="indigo" eyebrow="Independent Monitoring Agency" title={`${all.filter(m => m.state === 'submitted').length} submissions awaiting verification`} subtitle="You certify milestone completion against evidence and site inspection; the SPMU releases project-level tranches on your certification." right={<div className="text-right"><div className="text-[10px] uppercase font-bold text-txt-tertiary">weighted verified</div><div className="text-[26px] font-bold text-primary leading-none">{Math.round(verifiedW)}%</div></div>} />
      <div className="p-4 space-y-4">
        <StatGrid>
          <Stat label="Submitted" value={all.filter(m => m.state === 'submitted').length} tone="amber" onClick={() => setTab('submitted')} />
          <Stat label="Verified" value={all.filter(m => m.state === 'verified').length} tone="emerald" onClick={() => setTab('verified')} />
          <Stat label="Returned" value={all.filter(m => m.state === 'rejected').length} tone="rose" onClick={() => setTab('rejected')} />
          <Stat label="Not yet due" value={all.filter(m => m.state === 'pending').length} tone="sky" onClick={() => setTab('pending')} />
        </StatGrid>
        <div className="flex gap-2 flex-wrap">{['submitted', 'verified', 'rejected', 'pending', 'all'].map(f => <button key={f} onClick={() => setTab(f)} className={`px-3 py-1.5 rounded-pill text-[11px] font-bold border ${tab === f ? 'bg-primary text-white border-primary' : 'bg-white border-bdr text-txt-secondary'}`}>{titleCase(f)}</button>)}</div>
        <ul className="space-y-2.5">
          {list.map(m => (
            <li key={m.id} className="rounded-2xl border border-bdr-light bg-white shadow-card p-3.5">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap"><div className="text-[13px] font-bold text-txt-primary">{m.title}</div><Pill kind={stateKind(m.state)}>{m.state}</Pill><Pill kind="neutral">{titleCase(m.kind)}</Pill><span className="text-[10px] text-txt-tertiary">{m.weightPct}% weight</span></div>
                  <div className="text-[11px] text-txt-secondary mt-0.5">{m.itiCode || 'Cluster-level'} · due {fmtDate(m.dueAt)}{m.submittedAt ? ` · submitted ${fmtDate(m.submittedAt)}` : ''}{m.verifiedAt ? ` · verified ${fmtDate(m.verifiedAt)}` : ''}</div>
                  {m.evidenceNote && <div className="mt-2 flex items-start gap-2 text-[11px] text-txt-secondary bg-surface-page rounded-lg p-2"><FileText className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /><span className="flex-1">{m.evidenceNote}</span>{m.evidenceUrl && !m.evidenceUrl.startsWith('/demo') && <FilePreview url={m.evidenceUrl} />}</div>}
                  {m.rejectNote && <div className="text-[11px] text-rose-700 mt-1">Your observation: {m.rejectNote}</div>}
                </div>
                {m.state === 'submitted' && <div className="flex flex-col gap-1.5 flex-shrink-0"><Btn small tone="ok" onClick={() => decide(m, 'verified')}><ShieldCheck className="w-3.5 h-3.5" /> Verify</Btn><Btn small tone="danger" onClick={() => decide(m, 'rejected')}><Undo2 className="w-3.5 h-3.5" /> Return</Btn></div>}
              </div>
              {m.kind === 'civil' && <div className="mt-2"><button onClick={() => openCanvas({ type: 'civil_works' })} className="text-[11px] text-primary font-bold">Check civil works progress →</button></div>}
              {m.kind === 'equipment' && <div className="mt-2"><button onClick={() => openCanvas({ type: 'procurement' })} className="text-[11px] text-primary font-bold">Check procurement state →</button></div>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
