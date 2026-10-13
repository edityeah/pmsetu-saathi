// My applications (Module C/D, student) — each opportunity I showed interest
// in, where it stands, what was shared, and what I can report myself.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Pill, Section, Loading, Btn, useLoad, fmtDate, fmtInr, titleCase, Timeline, inputCls } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

const STEPS = ['interested', 'prepared', 'referred', 'applied', 'interviewed', 'offered', 'joined']
const EV_KIND = { none: 'neutral', student_reported: 'info', document_supported: 'warn', employer_confirmed: 'ok', independently_verified: 'ok', disputed: 'bad' }

export default function ApplicationsCanvas() {
  const { showToast, openCanvas } = useApp()
  const { data, reload } = useLoad(() => api.applications({}))
  const [wage, setWage] = useState({})
  const [open, setOpen] = useState(null)
  useSaathiContext(data ? brief(data) : '', ['Meri application kahan tak pahunchi?', 'Student reported aur employer confirmed mein farak?', 'Agla step kya hai?'])
  if (!data) return <Loading />
  const apps = data.applications
  async function report(a, stage) {
    const body = { stage }
    if (stage === 'prepared') body.consent = true
    if (stage === 'offered' || stage === 'joined') body.wage = wage[a.id] ? Number(wage[a.id]) : undefined
    await api.applicationStage(a.id, body); showToast({ kind: 'success', text: stage === 'prepared' ? 'Consent given — the placement cell can refer you now.' : `Reported ${stage}. Your ITI and the employer will confirm.` }); reload()
  }
  async function dispute(a) { await api.applicationStage(a.id, { evidenceLevel: 'disputed', note: 'Student says this record is wrong' }); showToast({ kind: 'warn', text: 'Marked as disputed. The coordinator will check with the employer.' }); reload() }
  return (
    <div className="h-full overflow-y-auto bg-surface-page/40">
      <Hero tone="emerald" eyebrow="My applications" title={`${apps.length} application${apps.length === 1 ? '' : 's'}`} subtitle="Interested → prepared → referred → applied → interviewed → offered → joined. What you report is marked 'student reported' until the employer confirms it." right={<Btn small tone="ghost" onClick={() => openCanvas({ type: 'jobs' })}>Find more</Btn>} />
      <div className="p-4 space-y-3">
        {apps.length === 0 && <div className="text-[12px] text-txt-tertiary">No applications yet. Express interest in an opportunity to start one.</div>}
        {apps.map(a => { const idx = STEPS.indexOf(a.stage); const o = a.opportunity; return (
          <div key={a.id} className="rounded-2xl border border-bdr-light bg-white shadow-card p-3.5">
            <button onClick={() => setOpen(open === a.id ? null : a.id)} className="w-full text-left">
              <div className="flex items-center gap-2 flex-wrap"><div className="text-[13px] font-bold">{o.title}</div><Pill kind="neutral">{o.type}</Pill><Pill kind={EV_KIND[a.evidenceLevel]}>{a.evidenceLevel === 'none' ? 'no evidence yet' : a.evidenceLevel.replace(/_/g, ' ')}</Pill></div>
              <div className="text-[11px] text-txt-secondary">{o.employer.name} · {o.location}{o.wageMin ? ` · ${fmtInr(o.wageMin)}–${fmtInr(o.wageMax)}/month` : o.stipend ? ` · stipend ${fmtInr(o.stipend)}` : ''}</div>
              <div className="mt-2 flex items-center gap-1">{STEPS.map((s, i) => <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= idx ? 'bg-emerald-500' : ['declined', 'withdrawn', 'not_selected'].includes(a.stage) ? 'bg-rose-200' : 'bg-surface-page'}`} title={titleCase(s)} />)}</div>
              <div className="text-[11px] mt-1 flex justify-between"><span><b>{titleCase(a.stage)}</b>{a.nextAction ? ` · next: ${a.nextAction}` : ''}</span><span className="text-txt-tertiary">{fmtDate(a.lastEventAt)}</span></div>
            </button>
            {open === a.id && (
              <div className="mt-3 pt-3 border-t border-bdr-light space-y-3">
                <Timeline items={a.timeline} />
                {a.evidenceNote && <div className="text-[11px] rounded-lg bg-surface-page p-2">{a.evidenceNote}</div>}
                <div className="flex gap-1.5 flex-wrap items-center">
                  {a.stage === 'interested' && <Btn small onClick={() => report(a, 'prepared')}>I'm ready — share my record with the placement cell</Btn>}
                  {['referred', 'prepared'].includes(a.stage) && <Btn small tone="ghost" onClick={() => report(a, 'applied')}>I applied</Btn>}
                  {['applied', 'interviewed', 'referred'].includes(a.stage) && <><input type="number" placeholder={o.type === 'wage' ? 'Wage / month' : 'Stipend'} value={wage[a.id] || ''} onChange={e => setWage(w => ({ ...w, [a.id]: e.target.value }))} className="w-32 rounded-lg border border-bdr px-2 py-1.5 text-[12px]" /><Btn small onClick={() => report(a, 'offered')}>I got an offer</Btn></>}
                  {a.stage === 'offered' && <Btn small tone="ok" onClick={() => report(a, 'joined')}>I joined</Btn>}
                  {['joined', 'follow_up'].includes(a.stage) && a.evidenceLevel !== 'disputed' && <Btn small tone="danger" onClick={() => dispute(a)}>This record is wrong</Btn>}
                  {!['joined', 'follow_up', 'declined', 'withdrawn', 'not_selected'].includes(a.stage) && <Btn small tone="ghost" onClick={() => report(a, 'withdrawn')}>Withdraw</Btn>}
                  {a.stage === 'interested' && <Btn small tone="ghost" onClick={() => openCanvas({ type: 'job_prep' })}>Prepare first</Btn>}
                </div>
              </div>
            )}
          </div>) })}
      </div>
    </div>
  )
}
