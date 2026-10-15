// Employer directory — section 5, module 2. Cluster employers, participating
// ITIs and relationship evidence: hero numbers, a five-row list with View
// more, an employer record page (description, opportunities, placements,
// interaction history), Add credible employer as a popup, Download list.
import { useMemo, useState } from 'react'
import { Download, Plus, Search, X, ChevronRight } from 'lucide-react'
import FilterBar from './_FilterBar.jsx'
import { DetailPage, DetailCard, LabelGrid } from './_Detail.jsx'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading, Hero, Stat, StatGrid, Section, Table, Tabs, Pill, Btn, Field, inputCls, fmtDate, fmtNum, fmtInr, titleCase, stateKind } from './_ui.jsx'
import { useSaathiContext } from '../CanvasSaathi.jsx'

const REL = { active: { kind: 'ok', label: 'Active partner' }, lead: { kind: 'warn', label: 'Interested' }, paused: { kind: 'neutral', label: 'Paused' } }

export default function EmployerRegisterCanvas({ context }) {
  const { role, openCanvas, showToast, meExtra } = useApp()
  const [tab, setTab] = useState(context?.tab === 'opportunities' ? 'opportunities' : 'employers')
  const [itiCode, setItiCode] = useState('all'), [sector, setSector] = useState('all'), [rel, setRel] = useState('all'), [tradeF, setTradeF] = useState('all'), [q, setQ] = useState('')
  const [open, setOpen] = useState(null), [adding, setAdding] = useState(false), [all, setAll] = useState(false)
  const { data: emp, reload } = useLoad(() => api.employers())
  const { data: opp } = useLoad(() => api.opportunities({}))
  const { data: itis } = useLoad(() => api.itis())
  const rows = useMemo(() => {
    if (!emp) return []
    const opps = opp?.opportunities || []
    return emp.employers.map(e => { const os = opps.filter(o => o.employerId === e.id); const live = os.filter(o => o.status === 'live'); return { ...e, trades: [...new Set(os.flatMap(o => o.tradeCodes || []))], liveOpps: live.length, liveSeats: live.reduce((s, o) => s + Math.max(0, o.openings - o.filled), 0) } })
      .filter(e => itiCode === 'all' || (e.participatingItis || []).includes(itiCode)).filter(e => sector === 'all' || e.sector === sector).filter(e => rel === 'all' || e.relationshipStatus === rel).filter(e => tradeF === 'all' || e.trades.includes(tradeF)).filter(e => !q || `${e.name} ${e.code}`.toLowerCase().includes(q.toLowerCase()))
  }, [emp, opp, itiCode, sector, rel, tradeF, q])
  useSaathiContext(emp ? `Employer directory: ${emp.employers.length} employers (${emp.employers.filter(e => e.relationshipStatus === 'active').length} active partners); live opportunities ${(opp?.opportunities || []).filter(o => o.status === 'live').length}; by sector ${Object.entries(emp.employers.reduce((m, e) => { m[e.sector] = (m[e.sector] || 0) + 1; return m }, {})).map(([k, v]) => `${k} ${v}`).join(', ')}.` : '', ['Which employers engage both Pusa and Shahdara?', 'Which employers have live openings for welders?'])
  if (open) return <EmployerRecord id={open} onBack={() => setOpen(null)} openCanvas={openCanvas} />
  const sectors = [...new Set((emp?.employers || []).map(e => e.sector))].sort()
  const trades = [...new Set((opp?.opportunities || []).flatMap(o => o.tradeCodes || []))].sort()
  const liveOpps = (opp?.opportunities || []).filter(o => o.status === 'live')
  const filters = [{ label: 'ITI', value: itiCode, options: [{ id: 'all', label: 'All reporting ITIs' }, ...((itis?.itis || []).map(i => ({ id: i.code, label: i.name })))], onChange: setItiCode }, { label: 'Sector', value: sector, options: [{ id: 'all', label: 'All sectors' }, ...sectors.map(s => ({ id: s, label: s }))], onChange: setSector }, { label: 'Relationship', value: rel, options: [{ id: 'all', label: 'All statuses' }, { id: 'active', label: 'Active partner' }, { id: 'lead', label: 'Interested' }, { id: 'paused', label: 'Paused' }], onChange: setRel }, { label: 'Trade', value: tradeF, options: [{ id: 'all', label: 'All trades' }, ...trades.map(t => ({ id: t, label: t }))], onChange: setTradeF }]
  function exportCsv() {
    const csv = [['Code', 'Employer', 'Sector', 'City', 'Participating ITIs', 'Relevant trades', 'Relationship', 'MoU', 'Hiring commitment', 'OJT slots', 'Live opportunities', 'Live seats'], ...rows.map(e => [e.code, e.name, e.sector, e.city, (e.participatingItis || []).join(' '), e.trades.join(' '), e.relationshipStatus, e.mouRef || '', e.hiringCommitment, e.ojtSlots, e.liveOpps, e.liveSeats])].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'employer-directory.csv'; a.click()
  }
  const shown = all ? rows : rows.slice(0, 5)
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="teal" eyebrow="Employer directory" title={emp ? `${emp.employers.length} employers · ${emp.employers.filter(e => e.relationshipStatus === 'active').length} active partners` : 'Employer directory'} subtitle="Cluster employers, participating ITIs and relationship evidence. Credibility is based on recorded source and review details, not an external accreditation." right={<div className="flex gap-2"><button onClick={exportCsv} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-white border border-bdr text-[11px] font-bold text-txt-primary hover:bg-surface-page"><Download className="w-3.5 h-3.5" /> Download list</button>{(role === 'spv_ceo' || role === 'iti_principal') && <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-primary text-white text-[11px] font-bold hover:opacity-90"><Plus className="w-3.5 h-3.5" /> Add credible employer</button>}</div>} />
      <Tabs tabs={[{ id: 'analytics', label: 'Placement analytics' }, { id: 'employers', label: 'Employer directory' }, { id: 'opportunities', label: 'Opportunities', badge: liveOpps.length }]} active={tab} onChange={t => t === 'analytics' ? openCanvas({ type: 'placement_pipeline' }) : setTab(t)} />
      {tab === 'employers' && (<>
        <FilterBar items={filters} note={`${rows.length} employers`} />
        <div className="px-4 pt-3 flex items-center gap-2 flex-wrap">
          <label className="relative flex-1 min-w-[200px] max-w-sm"><Search className="w-3.5 h-3.5 absolute left-2 top-2.5 text-txt-tertiary" /><input className={`${inputCls} pl-7`} placeholder="Employer name or ID" value={q} onChange={e => setQ(e.target.value)} /></label>
          {(itiCode !== 'all' || sector !== 'all' || rel !== 'all' || tradeF !== 'all' || q) && <button className="text-[11px] text-primary font-bold" onClick={() => { setItiCode('all'); setSector('all'); setRel('all'); setTradeF('all'); setQ('') }}>Clear filters</button>}
        </div>
        {!emp ? <Loading /> : (
          <div className="p-4 space-y-5">
            <StatGrid>
              <Stat label="Employer records" value={fmtNum(emp.employers.length)} sub={`${emp.employers.filter(e => e.relationshipStatus === 'lead').length} interested · ${emp.employers.filter(e => e.relationshipStatus === 'paused').length} paused`} tone="indigo" />
              <Stat label="Active partners" value={fmtNum(emp.employers.filter(e => e.relationshipStatus === 'active').length)} sub={`${emp.employers.filter(e => e.mouSignedAt).length} with an MoU`} tone="emerald" />
              <Stat label="Live opportunities" value={fmtNum(liveOpps.length)} sub={`${new Set(liveOpps.map(o => o.employerId)).size} employers hiring now`} tone="violet" onClick={() => setTab('opportunities')} />
              <Stat label="Live opening seats" value={fmtNum(liveOpps.reduce((s, o) => s + Math.max(0, o.openings - o.filled), 0))} sub="openings not yet filled" tone="amber" />
            </StatGrid>
            <Section title="Cluster employer list" hint={`Showing ${shown.length} of ${rows.length}. Tap an employer for its record.`}>
              <Table columns={[
                { key: 'name', label: 'Employer', render: e => <button className="text-left hover:text-primary" onClick={() => setOpen(e.id)}><div className="font-semibold">{e.name}</div><div className="text-[10px] text-txt-tertiary font-mono">{e.code}</div></button> },
                { key: 'sector', label: 'Sector / geography', render: e => <span className="text-[11px]">{e.sector} · {e.city}</span> },
                { key: 'itis', label: 'Participating ITIs', render: e => <span className="text-[11px]">{(e.participatingItis || []).join(' + ') || '—'}</span> },
                { key: 'trades', label: 'Relevant trades', render: e => <span className="text-[11px]">{e.trades.join(' · ') || '—'}</span> },
                { key: 'rel', label: 'Relationship', render: e => <Pill kind={REL[e.relationshipStatus]?.kind || 'neutral'}>{REL[e.relationshipStatus]?.label || e.relationshipStatus}</Pill> },
                { key: 'open', label: '', align: 'right', render: e => <button onClick={() => setOpen(e.id)} className="p-1 rounded-pill hover:bg-surface-page"><ChevronRight className="w-4 h-4 text-primary" /></button> },
              ]} rows={shown} empty="No employers match." />
              {rows.length > 5 && <div className="flex items-center justify-between pt-2 text-[11px] text-txt-tertiary"><span>Showing {shown.length} of {rows.length} employers</span><button className="text-primary font-bold" onClick={() => setAll(a => !a)}>{all ? 'Show five' : `View more (${rows.length - 5})`} →</button></div>}
            </Section>
          </div>
        )}
      </>)}
      {tab === 'opportunities' && <Opportunities opps={opp?.opportunities || []} employers={emp?.employers || []} onEmployer={setOpen} />}
      {adding && <AddEmployerPopup itis={itis?.itis || []} defaultIti={role === 'iti_principal' ? meExtra?.iti?.code : null} onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload(); showToast({ kind: 'success', text: 'Employer added to the directory as interested.' }) }} />}
    </div>
  )
}

function Opportunities({ opps, employers, onEmployer }) {
  const [all, setAll] = useState(false)
  const rows = [...opps].sort((a, b) => (a.status === 'live' ? 0 : 1) - (b.status === 'live' ? 0 : 1))
  const shown = all ? rows : rows.slice(0, 5)
  const nameOf = id => employers.find(e => e.id === id)?.name || '—'
  return (
    <div className="p-4 space-y-5">
      <StatGrid>
        <Stat label="Live" value={opps.filter(o => o.status === 'live').length} sub="visible to students" tone="emerald" />
        <Stat label="Being checked" value={opps.filter(o => o.status === 'checking').length} sub="SPV review before students see it" tone="amber" />
        <Stat label="Openings" value={fmtNum(opps.filter(o => o.status === 'live').reduce((s, o) => s + o.openings, 0))} sub="across live opportunities" tone="indigo" />
        <Stat label="Paused or filled" value={opps.filter(o => ['paused', 'filled', 'archived'].includes(o.status)).length} tone="slate" />
      </StatGrid>
      <Section title="Opportunities" hint={`Showing ${shown.length} of ${rows.length}.`}>
        <Table columns={[
          { key: 'title', label: 'Opportunity', render: o => <div><div className="font-semibold">{o.title}</div><button className="text-[10px] text-primary" onClick={() => onEmployer(o.employerId)}>{nameOf(o.employerId)}</button></div> },
          { key: 'type', label: 'Type', render: o => <Pill kind={o.type === 'wage' ? 'info' : o.type === 'ojt' ? 'violet' : 'ok'}>{o.type === 'ojt' ? 'OJT' : titleCase(o.type)}</Pill> },
          { key: 'openings', label: 'Openings', align: 'right', render: o => `${o.openings - o.filled} of ${o.openings}` },
          { key: 'pay', label: 'Pay', render: o => o.wageMin ? `${fmtInr(o.wageMin)}–${fmtInr(o.wageMax)} / month` : o.stipend ? `${fmtInr(o.stipend)} stipend` : '—' },
          { key: 'closingAt', label: 'Closes', render: o => fmtDate(o.closingAt) },
          { key: 'status', label: 'Status', render: o => <Pill kind={stateKind(o.status)}>{titleCase(o.status)}</Pill> },
        ]} rows={shown} empty="No opportunities." />
        {rows.length > 5 && <div className="flex items-center justify-between pt-2 text-[11px] text-txt-tertiary"><span>Showing {shown.length} of {rows.length}</span><button className="text-primary font-bold" onClick={() => setAll(a => !a)}>{all ? 'Show five' : `View more (${rows.length - 5})`} →</button></div>}
      </Section>
    </div>
  )
}

function EmployerRecord({ id, onBack, openCanvas }) {
  const { data: d } = useLoad(() => api.employerProfile(id), [id])
  useSaathiContext(d ? `Employer record: ${d.employer.description} Live opportunities ${d.stats.liveOpportunities} (${d.stats.liveSeats} seats), candidates in process ${d.stats.candidatesInProcess}, joined ${d.stats.joined}, on OJT ${d.stats.onOjt}. History: ${d.history.slice(0, 5).map(h => `${fmtDate(h.date)} ${h.kind}: ${h.text}`).join('; ')}.` : '', ['What has this employer said about our candidates?', 'How many of our students joined here?'])
  if (!d) return <Loading />
  const e = d.employer, rel = REL[e.relationshipStatus] || { kind: 'neutral', label: e.relationshipStatus }
  return (
    <DetailPage onBack={onBack} eyebrow="Employer record · cluster directory" title={e.name} id={`${e.code}${e.mouRef ? ` · ${e.mouRef}` : ''}`} sub={`${e.sector} · ${e.city}`} pill={rel}>
      <DetailCard title="About this employer" icon="🏭">
        <p className="text-[13px] text-txt-primary leading-relaxed mb-4">{e.description}</p>
        <LabelGrid items={[['Sector', e.sector], ['Geography', e.sites.join(', ') || e.city], ['Participating ITIs', e.participatingItis.join(', ') || '—'], ['Relevant trades', e.trades.join(', ') || '—'], ['Relationship owner', e.relationshipOwnerRole], ['Contact', e.contactName ? `${e.contactName} · ${e.contactChannel || ''}` : '—'], ['MoU', e.mouSignedAt ? `Signed ${fmtDate(e.mouSignedAt)}` : 'None yet'], ['Hiring commitment', `${e.hiringCommitment} hires${e.ojtSlots ? ` · ${e.ojtSlots} OJT slots` : ''}`], ['Last interaction', fmtDate(e.lastInteractionAt)], ['Next engagement', fmtDate(e.nextEngagementAt)]]} />
      </DetailCard>
      <StatGrid>
        <Stat label="Live opportunities" value={d.stats.liveOpportunities} sub={`${d.stats.liveSeats} open seats`} tone="violet" />
        <Stat label="Candidates in process" value={d.stats.candidatesInProcess} sub="referred to offered" tone="sky" />
        <Stat label="Joined" value={d.stats.joined} sub="distinct people" tone="emerald" />
        <Stat label="On OJT" value={d.stats.onOjt} sub="active spells" tone="teal" />
      </StatGrid>
      <DetailCard title="Linked opportunities" icon="📋">
        <Table columns={[{ key: 'title', label: 'Opportunity', render: o => <div><div className="font-semibold">{o.title}</div><div className="text-[10px] text-txt-tertiary">{o.location} · {o.tradeCodes.join(', ')}</div></div> }, { key: 'type', label: 'Type', render: o => o.type === 'ojt' ? 'OJT' : titleCase(o.type) }, { key: 'openings', label: 'Openings', align: 'right', render: o => `${o.openings - o.filled} of ${o.openings}` }, { key: 'status', label: 'Status', render: o => <Pill kind={stateKind(o.status)}>{titleCase(o.status)}</Pill> }]} rows={e.opportunities.slice(0, 5)} empty="No opportunities posted." />
      </DetailCard>
      <DetailCard title="Our students here" icon="🎓">
        <Table columns={[{ key: 'name', label: 'Student', render: x => <div><div className="font-semibold">{x.name}</div><div className="text-[10px] text-txt-tertiary">{x.itiId} · {x.role}</div></div> }, { key: 'type', label: 'Type', render: x => x.type === 'ojt' ? 'OJT' : titleCase(x.type) }, { key: 'startAt', label: 'Since', render: x => fmtDate(x.startAt) }, { key: 'evidenceLevel', label: 'Evidence', render: x => <Pill kind={x.evidenceLevel === 'disputed' ? 'bad' : ['employer_confirmed', 'independently_verified'].includes(x.evidenceLevel) ? 'ok' : 'warn'}>{titleCase(x.evidenceLevel)}</Pill> }]} rows={d.placements.slice(0, 5)} empty="No joins recorded yet." />
        {d.placements.length > 5 && <div className="text-[11px] text-txt-tertiary pt-2">Showing 5 of {d.placements.length}. The placement pipeline has the full list.</div>}
      </DetailCard>
      <DetailCard title="Interaction history" icon="🗒️">
        <Table columns={[{ key: 'date', label: 'Date', render: h => fmtDate(h.date) }, { key: 'kind', label: 'Kind', render: h => <Pill kind="neutral">{h.kind}</Pill> }, { key: 'text', label: 'Note', render: h => <span className="text-[12px]">{h.text}</span> }, { key: 'by', label: 'By' }]} rows={d.history.slice(0, 5)} empty="No interactions recorded." />
      </DetailCard>
      <div className="flex gap-2 flex-wrap"><Btn tone="ghost" onClick={() => openCanvas({ type: 'placement_pipeline' })}>Open placement analytics</Btn></div>
    </DetailPage>
  )
}

function AddEmployerPopup({ itis, defaultIti, onClose, onDone }) {
  const { showToast } = useApp()
  const [f, setF] = useState({ name: '', sector: '', city: '', contactName: '', participatingItis: defaultIti ? [defaultIti] : [], ojtSlots: 0, hiringCommitment: 0, source: '' })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  async function submit(e) {
    e.preventDefault(); setBusy(true)
    try { await api.createEmployer({ name: f.name, sector: f.sector, city: f.city, contactName: f.contactName || undefined, relationshipStatus: 'lead', participatingItis: f.participatingItis, ojtSlots: Number(f.ojtSlots) || 0, hiringCommitment: Number(f.hiringCommitment) || 0 }); onDone() }
    catch (err) { showToast({ kind: 'danger', text: err.message }) } finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-3" onClick={onClose}>
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white shadow-modal overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-bdr-light flex items-start gap-3"><div className="flex-1"><div className="text-[10px] uppercase tracking-wider font-bold text-primary">Employer directory</div><div className="text-[15px] font-bold text-txt-primary">Add a credible employer</div><div className="text-[11px] text-txt-secondary">Added as interested; it becomes an active partner once an MoU or a first hire is recorded.</div></div><button type="button" onClick={onClose} className="p-1.5 rounded-pill hover:bg-slate-100"><X className="w-4 h-4 text-txt-secondary" /></button></div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Employer name" className="sm:col-span-2"><input className={inputCls} value={f.name} onChange={e => set('name', e.target.value)} required /></Field>
          <Field label="Sector"><input className={inputCls} value={f.sector} onChange={e => set('sector', e.target.value)} placeholder="e.g. Electrical services" required /></Field>
          <Field label="City / site"><input className={inputCls} value={f.city} onChange={e => set('city', e.target.value)} placeholder="e.g. Okhla, Delhi" required /></Field>
          <Field label="Contact person"><input className={inputCls} value={f.contactName} onChange={e => set('contactName', e.target.value)} /></Field>
          <Field label="Source of the lead"><input className={inputCls} value={f.source} onChange={e => set('source', e.target.value)} placeholder="Industry visit, referral, job fair…" /></Field>
          <Field label="Hiring commitment"><input type="number" min="0" className={inputCls} value={f.hiringCommitment} onChange={e => set('hiringCommitment', e.target.value)} /></Field>
          <Field label="OJT slots"><input type="number" min="0" className={inputCls} value={f.ojtSlots} onChange={e => set('ojtSlots', e.target.value)} /></Field>
          <div className="sm:col-span-2"><div className="text-[12px] font-bold text-txt-secondary mb-1">Participating ITIs</div><div className="flex gap-2 flex-wrap">{itis.map(i => <label key={i.code} className={`text-[11px] px-2.5 py-1 rounded-pill border cursor-pointer ${f.participatingItis.includes(i.code) ? 'bg-primary text-white border-primary' : 'bg-white border-bdr'}`}><input type="checkbox" className="hidden" checked={f.participatingItis.includes(i.code)} onChange={() => set('participatingItis', f.participatingItis.includes(i.code) ? f.participatingItis.filter(c => c !== i.code) : [...f.participatingItis, i.code])} />{i.name.replace('Government ITI ', '')}</label>)}</div></div>
        </div>
        <div className="px-4 pb-4 flex justify-end gap-2"><Btn tone="ghost" onClick={onClose}>Cancel</Btn><Btn type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add employer'}</Btn></div>
      </form>
    </div>
  )
}
