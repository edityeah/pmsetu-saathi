// Reports & AOP — the quarterly pack the License Agreement requires (via the
// IMA to the SSC), the Annual Operational Plan, and the annual report.
// "Generate pack" assembles live data into the IMA format.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Pill, Section, Table, Loading, Btn, useLoad, fmtDate, fmtCr, stateKind, titleCase } from './_ui.jsx'
import { FileDown, Sparkles } from 'lucide-react'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

export default function ReportsCanvas() {
  const { role, showToast, openCanvas } = useApp()
  const { data, reload } = useLoad(() => api.reports())
  const [pack, setPack] = useState(null)
  const [busy, setBusy] = useState(false)
  useSaathiContext(data ? brief(data) : '', ['What goes into the Q2 report pack?', 'When is the next AOP due?'])
  if (!data) return <Loading />

  async function generate() { setBusy(true); try { setPack(await api.reportPack()) } finally { setBusy(false) } }
  async function submit(r) { await api.reportSubmit(r.id); showToast({ kind: 'success', text: `${r.period} submitted to IMA + SSC.` }); reload() }

  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="sky" eyebrow="License Agreement · reporting" title="Reports, AOP and the IMA pack" subtitle="Quarterly reports go to the SSC through the IMA: operations, upgradation works, KPI compliance, enrolment, placements, dropouts. A new Annual Plan is due 3 months before the current one ends." />
      <div className="p-4 space-y-4">
        <Section tone="indigo" title="Report calendar" hint="Due dates from the License Agreement and SSC calendar.">
          <Table tone="indigo" columns={[
            { key: 'period', label: 'Report', render: r => <div><div className="font-semibold">{r.period}</div><div className="text-[10px] text-txt-tertiary">{titleCase(r.kind)}</div></div> },
            { key: 'dueAt', label: 'Due', render: r => fmtDate(r.dueAt) },
            { key: 'submittedAt', label: 'Submitted', render: r => fmtDate(r.submittedAt) },
            { key: 'state', label: 'Status', render: r => <Pill kind={stateKind(r.state)}>{r.state.replace(/_/g, ' ')}</Pill> },
            { key: 'act', label: '', align: 'right', render: r => role === 'spv_ceo' && (r.state === 'draft' || r.state === 'returned') ? <Btn small onClick={() => submit(r)}>Submit</Btn> : null },
          ]} rows={data.reports} />
        </Section>
        <Section tone="emerald" title="Generate the quarterly IMA pack from live data" hint="Assembles operations, upgradation, KPIs and finance exactly as the IMA inspects them." right={<Btn onClick={generate} disabled={busy}><Sparkles className="w-3.5 h-3.5" />{busy ? 'Generating…' : 'Generate pack'}</Btn>}>
          {!pack ? <div className="text-[12px] text-txt-tertiary px-2 py-2">No pack generated in this session yet.</div> : <Pack pack={pack} onOpen={openCanvas} />}
        </Section>
      </div>
    </div>
  )
}

function Pack({ pack, onOpen }) {
  const s = pack.sections
  return (
    <div className="space-y-3 text-[12px]">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><div className="font-bold text-txt-primary">{pack.cluster.name} · {pack.period}</div><div className="text-[10px] text-txt-tertiary">Generated {new Date(pack.generatedAt).toLocaleString('en-IN')} · for the IMA → SSC</div></div>
        <Btn tone="ghost" small onClick={() => { const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `IMA-pack-${pack.period.replace(/\W+/g, '-')}.json`; a.click() }}><FileDown className="w-3 h-3" /> Download</Btn>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Mini label="Active enrolment" value={s.operations.enrolmentActive} /><Mini label="Dropouts" value={s.operations.dropouts} />
        <Mini label="OJT / apprentice spells" value={s.operations.spells.reduce((a, x) => a + x.count, 0)} /><Mini label="KPI score" value={`${s.score.score}%`} />
      </div>
      <div>
        <div className="text-[10px] text-txt-tertiary mb-2">Coverage: {pack.coverage}</div>
      <div className="font-bold text-txt-secondary uppercase text-[10px] tracking-wider mb-1">1 · Operations — applications by stage</div>
        <div className="flex flex-wrap gap-1.5">{s.operations.placementsByState.map(p => <Pill key={p.state} kind={stateKind(p.state)}>{p.state} · {p.count}</Pill>)}</div>
      </div>
      <div>
        <div className="font-bold text-txt-secondary uppercase text-[10px] tracking-wider mb-1">2 · Upgradation works</div>
        <Table tone="emerald" columns={[{ key: 'iti', label: 'ITI' }, { key: 'title', label: 'Work' }, { key: 'pct', label: '%', align: 'right' }, { key: 'state', label: 'State', render: r => <Pill kind={stateKind(r.state)}>{r.state}</Pill> }]} rows={s.upgradation.civil} />
      </div>
      <div>
        <div className="font-bold text-txt-secondary uppercase text-[10px] tracking-wider mb-1">3 · KPI compliance</div>
        <Table tone="emerald" columns={[{ key: 'name', label: 'KPI', render: r => `${r.code} · ${r.name}` }, { key: 'baseline', label: 'Baseline', align: 'right', render: r => r.baseline ?? '—' }, { key: 'current', label: 'Current', align: 'right', render: r => r.current ?? '—' }, { key: 'target', label: 'Y1 target', align: 'right', render: r => r.target ?? '—' }, { key: 'coverage', label: 'Coverage', render: r => <span className="text-[10px]">{r.coverage || r.valueStatus}</span> }, { key: 'verified', label: 'IMA', render: r => r.current == null ? <span className="text-txt-tertiary text-[10px]">n/a</span> : <Pill kind={r.verified ? 'ok' : 'warn'}>{r.verified ? 'verified' : 'unverified'}</Pill> }]} rows={s.kpis} />
      </div>
      <div>
        <div className="font-bold text-txt-secondary uppercase text-[10px] tracking-wider mb-1">4 · Finance</div>
        <div className="text-txt-secondary">Utilised {fmtCr(s.finance.utilisation.utilisedCr)} of {fmtCr(s.finance.utilisation.budgetCr)} ({s.finance.utilisation.utilisedPct}%) · UCs: {s.finance.ucs.map(u => `${u.period} ${u.state}`).join(', ')} · <button className="text-primary font-bold" onClick={() => onOpen({ type: 'finance_escrow' })}>open escrow →</button></div>
      </div>
    </div>
  )
}
function Mini({ label, value }) { return <div className="rounded-xl bg-surface-page p-2.5"><div className="text-[10px] uppercase font-bold text-txt-tertiary">{label}</div><div className="text-[18px] font-bold text-txt-primary">{value}</div></div> }
