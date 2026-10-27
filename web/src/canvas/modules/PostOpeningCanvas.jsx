// Post an opportunity (employer) — apprenticeship, OJT or wage. Goes to
// the SPV as 'checking'; students see it once the SPV publishes it.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Pill, Section, Table, Loading, Btn, useLoad, fmtInr, fmtDate, Field, inputCls } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

export default function PostOpeningCanvas() {
  const { showToast } = useApp()
  const { data, reload } = useLoad(() => api.opportunities({}))
  const [form, setForm] = useState({ title: '', type: 'apprenticeship', tradeCodes: 'ELE', location: 'Okhla', openings: 5, wageMin: '', wageMax: '', stipend: 9000, eligibility: '', documents: 'Aadhaar, ITI marksheet', process: 'Trade test + interview', shiftTravel: 'Day shift', closingAt: '' })
  useSaathiContext(data ? brief(data) : '', ['Which of my openings are live?'])
  if (!data) return <Loading />
  async function submit(e) {
    e.preventDefault()
    await api.postOpportunity({ ...form, tradeCodes: form.tradeCodes.split(',').map(s => s.trim()).filter(Boolean), openings: Number(form.openings), wageMin: form.type === 'wage' && form.wageMin ? Number(form.wageMin) : undefined, wageMax: form.type === 'wage' && form.wageMax ? Number(form.wageMax) : undefined, stipend: form.type !== 'wage' && form.stipend ? Number(form.stipend) : undefined, closingAt: form.closingAt || undefined })
    showToast({ kind: 'success', text: 'Sent to the SPV for checking. Students see it once published.' }); reload()
  }
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="indigo" eyebrow="Post an opportunity" title="What do you need?" subtitle="The SPV checks each opening (eligibility, documents, pay, shift) and publishes it to the right ITIs. Expired or filled openings are archived, not left hanging." />
      <div className="p-4 space-y-4">
        <Section tone="indigo" title="New opportunity">
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-4 gap-2 text-[12px]">
            <Field label="Title" className="md:col-span-2"><input className={inputCls} required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Apprentice electrician (NAPS)" /></Field>
            <Field label="Type"><select className={inputCls} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="apprenticeship">Apprenticeship</option><option value="ojt">OJT</option><option value="wage">Wage job</option></select></Field>
            <Field label="Openings"><input type="number" min="1" className={inputCls} value={form.openings} onChange={e => setForm({ ...form, openings: e.target.value })} /></Field>
            <Field label="Trades (codes, comma-separated)"><input className={inputCls} value={form.tradeCodes} onChange={e => setForm({ ...form, tradeCodes: e.target.value })} /></Field>
            <Field label="Location"><input className={inputCls} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></Field>
            {form.type === 'wage' ? <><Field label="Wage min / month"><input type="number" className={inputCls} value={form.wageMin} onChange={e => setForm({ ...form, wageMin: e.target.value })} /></Field><Field label="Wage max / month"><input type="number" className={inputCls} value={form.wageMax} onChange={e => setForm({ ...form, wageMax: e.target.value })} /></Field></> : <Field label="Stipend / month" className="md:col-span-2"><input type="number" className={inputCls} value={form.stipend} onChange={e => setForm({ ...form, stipend: e.target.value })} /></Field>}
            <Field label="Eligibility" className="md:col-span-2"><input className={inputCls} value={form.eligibility} onChange={e => setForm({ ...form, eligibility: e.target.value })} placeholder="e.g. ELE pass-out; 10th pass" /></Field>
            <Field label="Documents"><input className={inputCls} value={form.documents} onChange={e => setForm({ ...form, documents: e.target.value })} /></Field>
            <Field label="Process"><input className={inputCls} value={form.process} onChange={e => setForm({ ...form, process: e.target.value })} /></Field>
            <Field label="Shift / travel" className="md:col-span-2"><input className={inputCls} value={form.shiftTravel} onChange={e => setForm({ ...form, shiftTravel: e.target.value })} /></Field>
            <Field label="Closing date"><input type="date" className={inputCls} value={form.closingAt} onChange={e => setForm({ ...form, closingAt: e.target.value })} /></Field>
            <div className="flex items-end"><Btn type="submit">Send to SPV</Btn></div>
          </form>
        </Section>
        <Section tone="emerald" title="Your opportunities">
          <Table tone="emerald" columns={[{ key: 'title', label: 'Title', render: r => <div><div className="font-semibold">{r.title}</div><div className="text-[10px] text-txt-tertiary">{r.type} · trades {r.tradeCodes.join(', ') || 'any'} · {r.location}</div></div> }, { key: 'openings', label: 'Filled / open', align: 'right', render: r => `${r.filled}/${r.openings}` }, { key: 'pay', label: 'Pay', render: r => r.wageMin ? `${fmtInr(r.wageMin)}–${fmtInr(r.wageMax)}` : r.stipend ? `stipend ${fmtInr(r.stipend)}` : '—' }, { key: 'status', label: 'Status', render: r => <Pill kind={r.status === 'live' ? 'ok' : r.status === 'checking' ? 'warn' : 'neutral'}>{r.status}</Pill> }, { key: 'closingAt', label: 'Closes', render: r => fmtDate(r.closingAt) }, { key: 'apps', label: 'Applicants', align: 'right', render: r => r._count.applications }]} rows={data.opportunities} />
        </Section>
      </div>
    </div>
  )
}
