// Opportunities (student) — live apprenticeship / OJT / wage openings that
// the SPV has checked and approved for my ITI. Interest starts an
// application; nothing is shared with the employer until I say so.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Pill, Loading, Btn, useLoad, fmtInr, fmtDate, Chips } from './_ui.jsx'
import { MapPin, Building2, CalendarClock, FileText } from 'lucide-react'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

export default function JobsCanvas() {
  const { showToast, openCanvas } = useApp()
  const { data, reload } = useLoad(() => api.opportunities({}))
  const [type, setType] = useState('all')
  const [open, setOpen] = useState(null)
  useSaathiContext(data ? brief(data) : '', ['Kaunsa opportunity mere trade ke liye hai?', 'Apprenticeship aur wage job mein farak?', 'Documents kya chahiye?'])
  if (!data) return <Loading />
  const list = data.opportunities.filter(o => type === 'all' || o.type === type)
  async function interested(o) { await api.apply({ opportunityId: o.id }); showToast({ kind: 'success', text: `Noted. Your trainer will review your résumé before anything is shared.` }); reload() }
  return (
    <div className="h-full overflow-y-auto bg-surface-page/40">
      <Hero tone="teal" eyebrow="Checked by the SPV · approved for your ITI" title={`${list.length} opportunities`} subtitle="Apprenticeship (stipend, NAPS), OJT (while you study) or wage jobs (after you finish). Employers are described by what they do, not by brand." />
      <div className="px-4 pt-3"><Chips options={[{ id: 'all', label: 'All' }, { id: 'apprenticeship', label: 'Apprenticeship' }, { id: 'ojt', label: 'OJT' }, { id: 'wage', label: 'Wage job' }]} value={type} onChange={setType} /></div>
      <div className="p-4 space-y-2.5">
        {list.length === 0 && <div className="text-[12px] text-txt-tertiary">Nothing live for your ITI in this filter.</div>}
        {list.map(o => (
          <div key={o.id} className="rounded-2xl border border-bdr-light bg-white shadow-card p-3.5">
            <div role="button" tabIndex={0} onClick={() => setOpen(open === o.id ? null : o.id)} className="w-full text-left flex items-start gap-3 cursor-pointer">
              <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0"><Building2 className="w-5 h-5" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap"><div className="text-[13px] font-bold text-txt-primary">{o.title}</div><Pill kind="neutral">{o.type}</Pill>{o.tradeMatch && <Pill kind="ok">your trade</Pill>}{!o.eligible && <Pill kind="warn">{o.type === 'wage' ? 'after you finish' : 'check eligibility'}</Pill>}</div>
                <div className="text-[11px] text-txt-secondary">{o.employer.name} · <MapPin className="w-3 h-3 inline" /> {o.location} · {o.openings - o.filled} of {o.openings} open</div>
                <div className="text-[12px] font-bold text-teal-700 mt-1">{o.wageMin ? `${fmtInr(o.wageMin)}–${fmtInr(o.wageMax)}/month` : o.stipend ? `stipend ${fmtInr(o.stipend)}/month` : 'pay to be confirmed'}{o.closingAt && <span className="text-[10px] font-normal text-txt-tertiary"> · <CalendarClock className="w-3 h-3 inline" /> closes {fmtDate(o.closingAt)}</span>}</div>
              </div>
              {o.myApplication ? <Pill kind="info">{o.myApplication.stage.replace(/_/g, ' ')}</Pill> : <Btn small onClick={e => { e.stopPropagation(); interested(o) }}>I'm interested</Btn>}
            </div>
            {open === o.id && (
              <div className="mt-3 pt-3 border-t border-bdr-light text-[11px] space-y-1 text-txt-secondary">
                <div><b>Who can apply:</b> {o.eligibility || '—'}</div>
                <div><b>Skills they look for:</b> {o.requiredSkills || '—'}</div>
                <div><b>Documents:</b> {o.documents || '—'}</div>
                <div><b>Process:</b> {o.process || '—'}</div>
                <div><b>Shift / travel:</b> {o.shiftTravel || '—'}</div>
                <div><b>Starts:</b> {fmtDate(o.startAt)} · checked by SPV {fmtDate(o.lastCheckedAt)}</div>
                <div className="pt-1 flex gap-2"><button className="text-primary font-bold inline-flex items-center gap-1" onClick={() => openCanvas({ type: 'job_prep' })}><FileText className="w-3 h-3" /> Prepare documents</button>{o.myApplication && <button className="text-primary font-bold" onClick={() => openCanvas({ type: 'applications' })}>Track application →</button>}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
