// Escrow & UCs — who has deposited, what is usable, which utilisation
// certificates are CA-certified and PFMS-matched. Funds are usable only
// once all three parties have deposited for the tranche.
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Pill, Section, Table, Loading, Btn, useLoad, fmtDate, fmtCr, stateKind } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

export default function FinanceEscrowCanvas() {
  const { role, showToast } = useApp()
  const { data, reload } = useLoad(() => api.finance())
  useSaathiContext(data ? brief(data) : '', ['What is the escrow balance and what is still due?'])
  if (!data) return <Loading />
  const { deposits, ucs, utilisation, escrow } = data
  async function submitUc(u) { await api.ucSubmit(u.id); showToast({ kind: 'success', text: `${u.period} UC submitted (CA-certified).` }); reload() }
  const byYear = {}
  for (const d of deposits) (byYear[`Year ${d.year} · ${d.tranche}`] ||= []).push(d)
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="lime" eyebrow="Fund flow · §4.2–4.3" title="Escrow account & utilisation certificates" subtitle="All payments cashless via PFMS. Interest goes back to the Consolidated Fund. No new release until UCs for ≥75% of previous funds are accepted." />
      <div className="p-4 space-y-4">
        <StatGrid>
          <Stat label="In escrow (deposited)" value={fmtCr(escrow.depositedCr)} tone="emerald" />
          <Stat label="Utilised" value={fmtCr(utilisation.utilisedCr)} sub={`${utilisation.utilisedPct}% of AOP`} tone="indigo" />
          <Stat label="Escrow balance" value={fmtCr(escrow.balanceCr)} sub="ring-fenced" tone="sky" />
          <Stat label="Due from parties" value={fmtCr(escrow.pendingCr)} sub="next tranche" tone="amber" />
        </StatGrid>
        {Object.entries(byYear).map(([k, rows]) => (
          <Section key={k} title={k} hint="Funds usable only after Centre, State and Industry have all deposited.">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {rows.map(d => (
                <div key={d.id} className={`rounded-xl border p-3 ${d.state === 'deposited' ? 'bg-emerald-50 border-emerald-200/60' : 'bg-amber-50 border-amber-200/60'}`}>
                  <div className="text-[10px] uppercase font-bold text-txt-secondary">{d.source}</div>
                  <div className="text-[18px] font-bold text-txt-primary">{fmtCr(d.amountCr)}</div>
                  <div className="text-[10px] text-txt-secondary">{d.state === 'deposited' ? `deposited ${fmtDate(d.depositedAt)}` : `due ${fmtDate(d.dueAt)}`}</div>
                </div>
              ))}
            </div>
          </Section>
        ))}
        <Section title="Utilisation certificates" hint="Certified by the SPV head of finance and a Chartered Accountant; reviewed by SPMU / NPMU.">
          <Table columns={[
            { key: 'period', label: 'Period' },
            { key: 'amountCr', label: 'Amount', align: 'right', render: r => fmtCr(r.amountCr) },
            { key: 'caCertified', label: 'CA', render: r => <Pill kind={r.caCertified ? 'ok' : 'warn'}>{r.caCertified ? 'certified' : 'pending'}</Pill> },
            { key: 'pfmsMatched', label: 'PFMS', render: r => <Pill kind={r.pfmsMatched ? 'ok' : 'neutral'}>{r.pfmsMatched ? 'matched' : '—'}</Pill> },
            { key: 'state', label: 'Status', render: r => <Pill kind={stateKind(r.state)}>{r.state}</Pill> },
            { key: 'act', label: '', align: 'right', render: r => role === 'spv_ceo' && r.state === 'draft' ? <Btn small onClick={() => submitUc(r)}>Certify & submit</Btn> : r.acceptedAt ? <span className="text-[10px] text-txt-tertiary">accepted {fmtDate(r.acceptedAt)}</span> : null },
          ]} rows={ucs} />
        </Section>
      </div>
    </div>
  )
}
