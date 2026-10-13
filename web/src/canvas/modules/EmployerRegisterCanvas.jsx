// Employer & opportunity register (Module D) — relationship owner and
// status, MoUs, participating ITIs, the opportunity lifecycle (lead →
// checking → live → paused → filled/expired → archived) and dated feedback.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Pill, Section, Table, Loading, Btn, useLoad, Tabs, Chips, fmtDate, fmtInr, stateKind, titleCase, Field, inputCls } from './_ui.jsx'
import { Plus } from 'lucide-react'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

const OPP_STATES = ['lead', 'checking', 'live', 'paused', 'filled', 'expired', 'archived']

export default function EmployerRegisterCanvas({ context }) {
  const { role, showToast, meExtra } = useApp()
  const [tab, setTab] = useState(context?.tab || 'employers')
  const { data: emp, reload: reloadEmp } = useLoad(() => api.employers())
  const { data: opp, reload: reloadOpp } = useLoad(() => api.opportunities({}))
  const { data: fb, reload: reloadFb } = useLoad(() => api.feedback())
  const [status, setStatus] = useState('all')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', sector: '', city: '', contactName: '', relationshipStatus: 'lead' })
  const [note, setNote] = useState({})
  useSaathiContext(emp && opp && fb ? `Employers: ${emp.employers.map(e => `${e.name} [${e.relationshipStatus}; MoU ${e.mouSignedAt ? 'signed' : 'no'}; ${e.live} live opps; ${e.joined} joined; ITIs ${e.participatingItis.join('/')}]`).join('; ')}. Opportunities: ${opp.opportunities.map(o => `${o.title} @ ${o.employer.name} [${o.status}, ${o.type}, ${o.filled}/${o.openings}, closes ${String(o.closingAt || '').slice(0, 10)}, applicants ${o._count.applications}]`).join('; ')}. Feedback: ${fb.feedback.map(f => `${f.employer.name} (${f.kind}, ${String(f.date).slice(0, 10)}): ${f.text}`).join(' || ')}.` : '', ['Which opportunities need checking before students see them?', 'Which employers have gone quiet?', 'Summarise employer feedback for the quarterly report.'])
  if (!emp || !opp || !fb) return <Loading />
  const employers = emp.employers, opps = opp.opportunities.filter(o => status === 'all' || o.status === status)
  const canEdit = role === 'spv_ceo' || role === 'iti_principal'
  const myIti = role === 'iti_principal' ? meExtra?.iti?.code : null
  async function addEmployer(e) { e.preventDefault(); await api.createEmployer(form); showToast({ kind: 'success', text: 'Employer added as a lead.' }); setAdding(false); reloadEmp() }
  async function setRel(em, relationshipStatus) { await api.updateEmployer(em.id, { relationshipStatus, note: note[em.id] || undefined }); showToast({ kind: 'success', text: `${em.name}: ${relationshipStatus}` }); reloadEmp() }
  async function mou(em) { await api.updateEmployer(em.id, { mouSigned: true }); showToast({ kind: 'success', text: 'MoU recorded; relationship active.' }); reloadEmp() }
  async function setOpp(o, st) { const approvedItis = st === 'live' ? (myIti ? [...new Set([...o.approvedItis, myIti])] : (o.approvedItis.length ? o.approvedItis : ['PUS', 'SHA'])) : undefined; await api.opportunityStatus(o.id, { status: st, approvedItis }); showToast({ kind: 'success', text: `${o.title}: ${st}${st === 'live' ? ` · visible to ${approvedItis.join(', ')}` : ''}` }); reloadOpp() }
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="teal" eyebrow="Employer & opportunity register" title={`${employers.filter(e => e.relationshipStatus === 'active').length} active employers · ${opp.opportunities.filter(o => o.status === 'live').length} live opportunities`} subtitle="An opportunity is checked by the SPV before students see it, and expires or is archived when it stops being open." right={canEdit && <Btn small onClick={() => setAdding(a => !a)}><Plus className="w-3 h-3" /> Employer</Btn>} />
      <Tabs tabs={[{ id: 'employers', label: 'Employers', badge: employers.length }, { id: 'opportunities', label: 'Opportunities', badge: opp.opportunities.length }, { id: 'feedback', label: 'Feedback', badge: fb.feedback.length }]} active={tab} onChange={setTab} />
      <div className="p-4 space-y-4">
        {adding && <form onSubmit={addEmployer} className="rounded-2xl border border-primary/30 bg-primary-light/30 p-3 grid grid-cols-2 md:grid-cols-5 gap-2"><Field label="Employer name" className="col-span-2"><input className={inputCls} required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Solar EPC contractor, Narela" /></Field><Field label="Sector"><input className={inputCls} required value={form.sector} onChange={e => setForm({ ...form, sector: e.target.value })} /></Field><Field label="City"><input className={inputCls} required value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></Field><Field label="Contact"><input className={inputCls} value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} /></Field><div className="col-span-2 md:col-span-5 flex justify-end gap-2"><Btn small tone="ghost" type="button" onClick={() => setAdding(false)}>Cancel</Btn><Btn small type="submit">Add lead</Btn></div></form>}
        {tab === 'employers' && (<>
          <StatGrid><Stat label="Active" value={employers.filter(e => e.relationshipStatus === 'active').length} sub="MoU signed" tone="emerald" /><Stat label="Leads" value={employers.filter(e => e.relationshipStatus === 'lead').length} tone="sky" /><Stat label="Paused" value={employers.filter(e => e.relationshipStatus === 'paused').length} tone="amber" /><Stat label="Joined (all)" value={employers.reduce((s, e) => s + e.joined, 0)} sub="across opportunities" tone="violet" /></StatGrid>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">{employers.map(e => (
            <div key={e.id} className="rounded-2xl border border-bdr-light bg-white shadow-card p-3.5">
              <div className="flex items-center gap-2 flex-wrap"><div className="text-[13px] font-bold">{e.name}</div><Pill kind={e.relationshipStatus === 'active' ? 'ok' : e.relationshipStatus === 'paused' ? 'warn' : 'info'}>{e.relationshipStatus}</Pill><span className="text-[10px] text-txt-tertiary">{e.code}</span></div>
              <div className="text-[11px] text-txt-secondary mt-0.5">{e.sector} · {e.city} · owner {e.relationshipOwnerRole} · contact {e.contactName || '—'} · ITIs {e.participatingItis.join(', ') || '—'}</div>
              <div className="text-[11px] text-txt-secondary">MoU {e.mouSignedAt ? `${e.mouRef} · ${fmtDate(e.mouSignedAt)}` : 'not signed'} · last contact {fmtDate(e.lastInteractionAt)} · next {fmtDate(e.nextEngagementAt)}</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]"><span className="rounded-pill bg-surface-page px-2 py-0.5">{e.live} live · {e.opportunities.length} opportunities</span><span className="rounded-pill bg-surface-page px-2 py-0.5">{e.joined} joined · {e._count.spells} spells</span><span className="rounded-pill bg-surface-page px-2 py-0.5">OJT slots {e.ojtSlots} · hiring {e.hiringCommitment}</span></div>
              {e.feedback[0] && <div className="mt-1.5 text-[11px] italic text-txt-secondary">"{e.feedback[0].text}" <span className="not-italic text-txt-tertiary">— {fmtDate(e.feedback[0].date)}</span></div>}
              {canEdit && <div className="mt-2 flex gap-1.5 flex-wrap items-center"><input value={note[e.id] || ''} onChange={ev => setNote(n => ({ ...n, [e.id]: ev.target.value }))} placeholder="Interaction note" className={`${inputCls} max-w-[200px]`} />{!e.mouSignedAt && <Btn small tone="ok" onClick={() => mou(e)}>MoU signed</Btn>}{e.relationshipStatus !== 'active' && <Btn small tone="ghost" onClick={() => setRel(e, 'active')}>Activate</Btn>}{e.relationshipStatus !== 'paused' && <Btn small tone="ghost" onClick={() => setRel(e, 'paused')}>Pause</Btn>}</div>}
            </div>))}</div>
        </>)}
        {tab === 'opportunities' && (<>
          <Chips options={[{ id: 'all', label: 'All' }, ...OPP_STATES.map(s => ({ id: s, label: `${titleCase(s)} ${opp.opportunities.filter(o => o.status === s).length}` }))]} value={status} onChange={setStatus} />
          <Table columns={[
            { key: 'title', label: 'Opportunity', render: r => <div><div className="font-semibold">{r.title}</div><div className="text-[10px] text-txt-tertiary">{r.employer.name} · {r.location} · trades {r.tradeCodes.join(', ') || 'any'} · v{r.version}</div></div> },
            { key: 'type', label: 'Type', render: r => <Pill kind="neutral">{r.type}</Pill> },
            { key: 'openings', label: 'Openings', align: 'right', render: r => `${r.filled}/${r.openings}` },
            { key: 'pay', label: 'Pay', render: r => r.wageMin ? `${fmtInr(r.wageMin)}–${fmtInr(r.wageMax)}/mo` : r.stipend ? `stipend ${fmtInr(r.stipend)}` : '—' },
            { key: 'closingAt', label: 'Closes', render: r => fmtDate(r.closingAt) },
            { key: 'status', label: 'Status', render: r => <div><Pill kind={r.status === 'live' ? 'ok' : r.status === 'checking' || r.status === 'paused' ? 'warn' : r.status === 'archived' || r.status === 'expired' ? 'bad' : 'info'}>{r.status}</Pill><div className="text-[10px] text-txt-tertiary">{r.approvedItis.length ? `ITIs ${r.approvedItis.join(', ')}` : 'not published'} · checked {fmtDate(r.lastCheckedAt)}</div></div> },
            { key: 'apps', label: 'Applicants', align: 'right', render: r => r._count.applications },
            { key: 'act', label: '', align: 'right', render: r => canEdit ? <div className="flex gap-1 justify-end flex-wrap">{['lead', 'checking', 'paused'].includes(r.status) && <Btn small tone="ok" onClick={() => setOpp(r, 'live')}>Publish</Btn>}{r.status === 'live' && <Btn small tone="ghost" onClick={() => setOpp(r, 'paused')}>Pause</Btn>}{r.status === 'live' && <Btn small tone="ghost" onClick={() => setOpp(r, 'filled')}>Filled</Btn>}{!['archived'].includes(r.status) && <Btn small tone="ghost" onClick={() => setOpp(r, 'archived')}>Archive</Btn>}</div> : null },
          ]} rows={opps} />
        </>)}
        {tab === 'feedback' && (
          <Section title="Employer feedback" hint="Dated and tagged (demand, interviewed, joined). Quotable lines may be used in the quarterly report.">
            <ul className="space-y-2">{fb.feedback.map(f => <li key={f.id} className="rounded-xl border border-bdr-light p-2.5 text-[12px]"><div className="flex items-center gap-2 flex-wrap"><b>{f.employer.name}</b><Pill kind="neutral">{f.kind}</Pill>{f.quotable && <Pill kind="info">quotable</Pill>}<span className="text-[10px] text-txt-tertiary">{fmtDate(f.date)}</span></div><div className="mt-0.5">{f.text}</div></li>)}</ul>
          </Section>
        )}
      </div>
    </div>
  )
}
