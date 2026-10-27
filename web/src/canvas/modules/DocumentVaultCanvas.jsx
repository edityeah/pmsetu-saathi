// Document vault (student) — one store for every document, each with its
// provenance (DigiLocker-verified, self uploaded, awaiting institute check,
// not added yet). Reachable from every section.
import { useState } from 'react'
import { X } from 'lucide-react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading, Hero, Stat, StatGrid, Section, Pill, Btn, Field, inputCls, fmtDate } from './_ui.jsx'
import { useSaathiContext } from '../CanvasSaathi.jsx'

const STATE = { verified: { kind: 'ok', label: 'Verified' }, self: { kind: 'info', label: 'Self uploaded' }, awaiting: { kind: 'warn', label: 'Awaiting institute check' }, missing: { kind: 'neutral', label: 'Not added yet' } }
const ICON = { marksheet: '📄', id: '🪪', photo: '🖼️', certificate: '📜', letter: '✉️', other: '📎' }

export default function DocumentVaultCanvas() {
  const { showToast } = useApp()
  const { data: d, reload } = useLoad(() => api.documents())
  const [adding, setAdding] = useState(false), [busy, setBusy] = useState(false)
  useSaathiContext(d ? `Document vault: ${d.counts.verified} verified, ${d.counts.self} self uploaded, ${d.counts.awaiting} awaiting institute check, ${d.counts.missing} not added. Documents: ${d.documents.map(x => `${x.name} (${x.state}${x.source ? ', ' + x.source : ''})`).join('; ')}.` : '', ['Kaunse documents verified hain?', 'Apprenticeship ke liye kya documents chahiye?'])
  async function fetchDigi() { setBusy(true); try { const r = await api.digilockerFetch(); showToast({ kind: 'success', text: r.fetched ? `${r.fetched} document${r.fetched === 1 ? '' : 's'} fetched and verified via DigiLocker.` : 'Everything standard is already verified.' }); reload() } catch (e) { showToast({ kind: 'danger', text: e.message }) } finally { setBusy(false) } }
  if (!d) return <Loading />
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="sky" eyebrow="Document vault · DigiLocker and uploads" title={`${d.counts.verified} verified document${d.counts.verified === 1 ? '' : 's'}`} subtitle="One store for everything you will be asked for. A DigiLocker document is verified; an upload is yours until the institute checks it." right={<div className="flex gap-2"><button onClick={fetchDigi} disabled={busy} className="px-3 py-1.5 rounded-pill bg-primary text-white text-[11px] font-bold hover:opacity-90 disabled:opacity-60">Fetch from DigiLocker</button><button onClick={() => setAdding(true)} className="px-3 py-1.5 rounded-pill bg-white border border-bdr text-[11px] font-bold">Upload a file</button></div>} />
      <div className="p-4 space-y-5">
        <StatGrid>
          <Stat label="Verified" value={d.counts.verified} sub="DigiLocker or institute" tone="emerald" />
          <Stat label="Self uploaded" value={d.counts.self} sub="yours, not yet checked" tone="sky" />
          <Stat label="Awaiting check" value={d.counts.awaiting} sub="institute reviewing" tone="amber" />
          <Stat label="Not added" value={d.counts.missing} sub="needed for some applications" tone={d.counts.missing ? 'rose' : 'emerald'} />
        </StatGrid>
        <Section tone="indigo" title="Your documents" hint="A marksheet lands here from Academics, a certificate at Placement, an experience letter on the job.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {d.documents.map(x => <div key={x.id} className={`rounded-2xl border p-3 ${x.state === 'missing' ? 'border-dashed border-bdr bg-white' : 'border-bdr-light bg-surface-page/50'}`}>
              <div className="flex items-start gap-3"><span className="w-9 h-9 rounded-xl bg-white border border-bdr-light flex items-center justify-center text-[18px]" aria-hidden>{x.state === 'missing' ? '➕' : ICON[x.kind] || ICON.other}</span><div className="flex-1 min-w-0"><div className="text-[13px] font-bold text-txt-primary">{x.name}</div><div className="text-[10px] text-txt-tertiary">{x.source === 'digilocker' ? 'via DigiLocker' : x.source === 'upload' ? 'Uploaded' : x.source === 'institute' ? 'Issued by the institute' : x.note || 'Not added yet'}</div></div></div>
              <div className="mt-2.5 flex items-center justify-between"><Pill kind={STATE[x.state].kind}>{STATE[x.state].label}{x.state === 'verified' && x.verifiedAt ? ` · ${fmtDate(x.verifiedAt)}` : ''}</Pill>{x.state === 'missing' && <button onClick={() => setAdding(x.name)} className="text-[11px] text-primary font-bold">Add →</button>}</div>
            </div>)}
          </div>
        </Section>
      </div>
      {adding && <UploadPopup preset={typeof adding === 'string' ? adding : ''} onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload(); showToast({ kind: 'success', text: 'Added to your vault.' }) }} />}
    </div>
  )
}

function UploadPopup({ preset, onClose, onDone }) {
  const { showToast } = useApp()
  const kindOf = n => /marksheet/i.test(n) ? 'marksheet' : /aadhaar|id/i.test(n) ? 'id' : /photo/i.test(n) ? 'photo' : /certificate/i.test(n) ? 'certificate' : /letter/i.test(n) ? 'letter' : 'other'
  const [f, setF] = useState({ name: preset || '', kind: preset ? kindOf(preset) : 'other', source: 'upload' })
  const [busy, setBusy] = useState(false)
  async function submit(e) { e.preventDefault(); setBusy(true); try { await api.addDocument(f); onDone() } catch (err) { showToast({ kind: 'danger', text: err.message }) } finally { setBusy(false) } }
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-3" onClick={onClose}>
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white shadow-modal overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-bdr-light flex items-start gap-3"><div className="flex-1"><div className="text-[10px] uppercase tracking-wider font-bold text-primary">Document vault</div><div className="text-[15px] font-bold text-txt-primary">Add a document</div><div className="text-[11px] text-txt-secondary">An upload stays marked as yours until the institute checks it. DigiLocker documents arrive verified.</div></div><button type="button" onClick={onClose} className="p-1.5 rounded-pill hover:bg-slate-100"><X className="w-4 h-4 text-txt-secondary" /></button></div>
        <div className="p-4 space-y-3">
          <Field label="Document name"><input className={inputCls} value={f.name} onChange={e => setF(x => ({ ...x, name: e.target.value, kind: kindOf(e.target.value) }))} placeholder="e.g. Caste / income certificate" required /></Field>
          <Field label="Type"><select className={inputCls} value={f.kind} onChange={e => setF(x => ({ ...x, kind: e.target.value }))}><option value="marksheet">Marksheet</option><option value="id">ID</option><option value="photo">Photo</option><option value="certificate">Certificate</option><option value="letter">Letter</option><option value="other">Other</option></select></Field>
          <Field label="Source"><select className={inputCls} value={f.source} onChange={e => setF(x => ({ ...x, source: e.target.value }))}><option value="upload">Upload a file from my phone</option><option value="digilocker">Fetch from DigiLocker</option></select></Field>
          <div className="rounded-xl border border-dashed border-bdr bg-surface-page/60 px-3 py-4 text-center text-[11px] text-txt-tertiary">Demo: the file picker is skipped; the record is created with the provenance you chose.</div>
        </div>
        <div className="px-4 pb-4 flex justify-end gap-2"><Btn tone="ghost" onClick={onClose}>Cancel</Btn><Btn type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add document'}</Btn></div>
      </form>
    </div>
  )
}
