// Milestones & evidence — the SPV side of IMA verification. Submit an
// evidence pack per milestone; watch it move pending → submitted → verified.
import { useState, Fragment } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Pill, Section, Loading, Btn, useLoad, fmtDate, stateKind, titleCase, Field, inputCls } from './_ui.jsx'
import { readFileAsDataUrl, ACCEPT_LETTER } from '../../utils/fileUpload.js'
import { Upload, FileText } from 'lucide-react'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

const KIND_ICON = { civil: '🏢', equipment: '📦', course: '📚', hr: '👨‍🏫', faculty: '👨‍🏫', student_services: '🤝', student_industry: '🤝', report: '📄', finance: '🏦', governance: '⚖️', digital: '💻' }

export default function MilestonesCanvas() {
  const { role, showToast, meExtra } = useApp()
  const { data, reload } = useLoad(() => api.milestones())
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState(null)
  const [forming, setForming] = useState(null)
  const [note, setNote] = useState('')
  const [link, setLink] = useState('')
  useSaathiContext(data ? brief(data) : '', ['Which milestones need evidence next?', 'What did the IMA return and why?'])
  if (!data) return <Loading />
  const myIti = role === 'iti_principal' ? meExtra?.iti?.code : null
  const all = data.milestones.filter(m => !myIti || !m.itiCode || m.itiCode === myIti)
  const list = all.filter(m => filter === 'all' || m.state === filter)
  const counts = { verified: all.filter(m => m.state === 'verified').length, submitted: all.filter(m => m.state === 'submitted').length, pending: all.filter(m => m.state === 'pending').length, rejected: all.filter(m => m.state === 'rejected').length }

  async function submit(m, file, text, href) {
    setBusy(m.id)
    try {
      let url = href || undefined
      if (file) url = await readFileAsDataUrl(file)
      await api.milestoneSubmit(m.id, { evidenceUrl: url, evidenceNote: text || (file ? `${file.name} uploaded by ${role}` : 'Evidence pack (photos, invoices, SPV certification) attached.') })
      setForming(null); setNote(''); setLink('')
      showToast({ kind: 'success', text: 'Submitted to IMA for verification.' }); reload()
    } catch (e) { showToast({ kind: 'danger', text: e.message }) } finally { setBusy(null) }
  }

  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="emerald" eyebrow="Independent Monitoring Agency" title="Milestones & evidence packs" subtitle="The IMA certifies milestone completion and triggers tranche releases. Every claim needs evidence it can inspect." />
      <div className="p-4 space-y-4">
        <StatGrid>
          <Stat label="Verified" value={counts.verified} tone="emerald" onClick={() => setFilter('verified')} />
          <Stat label="Awaiting IMA" value={counts.submitted} tone="amber" onClick={() => setFilter('submitted')} />
          <Stat label="Pending" value={counts.pending} tone="sky" onClick={() => setFilter('pending')} />
          <Stat label="Returned" value={counts.rejected} tone="rose" onClick={() => setFilter('rejected')} />
        </StatGrid>
        <div className="flex gap-2 flex-wrap">{['all', 'pending', 'submitted', 'verified', 'rejected'].map(f => <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-pill text-[11px] font-bold border ${filter === f ? 'bg-primary text-white border-primary' : 'bg-white border-bdr text-txt-secondary'}`}>{titleCase(f)}</button>)}</div>
        <ul className="space-y-2.5">
          {list.map(m => (<Fragment key={m.id}>
            <li className="rounded-2xl border border-bdr-light bg-white shadow-card p-3.5 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-surface-page flex items-center justify-center text-[18px] flex-shrink-0">{KIND_ICON[m.kind] || '📌'}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap"><div className="text-[13px] font-bold text-txt-primary">{m.title}</div><Pill kind={stateKind(m.state)}>{m.state}</Pill><span className="text-[10px] text-txt-tertiary">{m.weightPct}% weight</span></div>
                <div className="text-[11px] text-txt-secondary mt-0.5">{m.itiCode || 'Cluster-level'} · due {fmtDate(m.dueAt)}{m.submittedAt ? ` · submitted ${fmtDate(m.submittedAt)}` : ''}{m.verifiedAt ? ` · verified ${fmtDate(m.verifiedAt)} by ${m.verifiedBy?.name || 'IMA'}` : ''}</div>
                {m.evidenceNote && <div className="text-[11px] text-txt-secondary mt-1 inline-flex items-center gap-1"><FileText className="w-3 h-3" />{m.evidenceNote}</div>}
                {m.rejectNote && <div className="text-[11px] text-rose-700 mt-1 bg-rose-50 rounded-lg px-2 py-1">IMA: {m.rejectNote}</div>}
              </div>
              {(role === 'spv_ceo' || role === 'iti_principal') && (m.state === 'pending' || m.state === 'rejected') && (
                <label className="flex-shrink-0">
                  <input type="file" accept={ACCEPT_LETTER} className="hidden" onChange={e => e.target.files?.[0] && submit(m, e.target.files[0])} />
                  <span className="inline-flex items-center gap-1.5 rounded-pill font-bold px-3 py-1.5 text-[11px] bg-primary text-white cursor-pointer hover:opacity-90"><Upload className="w-3 h-3" />{busy === m.id ? 'Uploading…' : 'Submit evidence'}</span>
                </label>
              )}
              {(role === 'spv_ceo' || role === 'iti_principal') && (m.state === 'pending' || m.state === 'rejected') && <Btn tone="ghost" small onClick={() => { setForming(forming === m.id ? null : m.id); setNote(''); setLink('') }}>{forming === m.id ? 'Close' : 'Submit evidence note'}</Btn>}
              </li>
              {forming === m.id && (
                <li key={`${m.id}-form`} className="rounded-2xl border border-primary/30 bg-primary-light/30 p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="md:col-span-2 text-[12px] font-bold">Evidence for: {m.title}</div>
                  <Field label="What is being submitted" className="md:col-span-2"><textarea className={inputCls} rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Room survey report signed by the principal; photos of the CNC lab; contractor measurement sheet" /></Field>
                  <Field label="Link to the document (optional)"><input className={inputCls} value={link} onChange={e => setLink(e.target.value)} placeholder="https://… or file reference" /></Field>
                  <div className="flex items-end gap-2 justify-end"><Btn small tone="ghost" onClick={() => setForming(null)}>Cancel</Btn><Btn small disabled={busy === m.id || !note.trim()} onClick={() => submit(m, null, note.trim(), link.trim())}>{busy === m.id ? 'Submitting…' : 'Submit to IMA'}</Btn></div>
                </li>
              )}
          </Fragment>))}
        </ul>
      </div>
    </div>
  )
}
