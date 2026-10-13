// Procurement pipeline — packages move planned → tendered → awarded →
// delivered → installed → closed. Equipment is the biggest KPI weight, so
// "delivered but not installed" is the gap the IMA keeps finding.
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Pill, Loading, Btn, useLoad, fmtDate, fmtCr, stateKind } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

const STAGES = ['planned', 'tendered', 'awarded', 'delivered', 'installed', 'closed']

export default function ProcurementCanvas() {
  const { role, showToast } = useApp()
  const { data, reload } = useLoad(() => api.procurement())
  useSaathiContext(data ? brief(data) : '', ['Which packages are awarded but not delivered?'])
  if (!data) return <Loading />
  const pk = data.packages
  const total = pk.reduce((s, p) => s + p.budgetCr, 0)
  const by = (st) => pk.filter(p => p.state === st)
  const idx = (st) => STAGES.indexOf(st)
  async function advance(p) { await api.procurementAdvance(p.id); showToast({ kind: 'success', text: `${p.code} moved to ${STAGES[idx(p.state) + 1]}.` }); reload() }
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="teal" eyebrow="Procurement & contract management" title={`${pk.length} packages · ${fmtCr(total)}`} subtitle="Under Companies Act / GFR rules through the SPV's AOP. Contracts above the SHA threshold are reserved matters." />
      <div className="p-4 space-y-4">
        <StatGrid>
          <Stat label="Awaiting award" value={by('planned').length + by('tendered').length} sub={fmtCr([...by('planned'), ...by('tendered')].reduce((s, p) => s + p.budgetCr, 0))} tone="sky" />
          <Stat label="Awarded, not delivered" value={by('awarded').length} sub={fmtCr(by('awarded').reduce((s, p) => s + p.budgetCr, 0))} tone="amber" />
          <Stat label="Delivered, not installed" value={by('delivered').length} sub="commissioning evidence needed" tone={by('delivered').length ? 'rose' : 'emerald'} />
          <Stat label="Installed / closed" value={by('installed').length + by('closed').length} tone="emerald" />
        </StatGrid>
        <div className="overflow-x-auto">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(170px, 1fr))`, minWidth: 1020 }}>
            {STAGES.map(st => (
              <div key={st} className="rounded-2xl bg-surface-page/60 border border-bdr-light p-2 min-h-[220px]">
                <div className="text-[10px] uppercase tracking-wider font-bold text-txt-secondary px-1 mb-2 flex justify-between"><span>{st}</span><span>{by(st).length}</span></div>
                <div className="space-y-2">
                  {by(st).map(p => (
                    <div key={p.id} className="rounded-xl bg-white border border-bdr-light p-2.5 shadow-card">
                      <div className="text-[10px] font-bold text-primary">{p.code} · {fmtCr(p.budgetCr)}</div>
                      <div className="text-[12px] font-bold text-txt-primary leading-snug mt-0.5">{p.title}</div>
                      <div className="text-[10px] text-txt-secondary mt-1">{p.awardedTo || p.category}{p.deliveredAt ? ` · delivered ${fmtDate(p.deliveredAt)}` : p.awardedAt ? ` · awarded ${fmtDate(p.awardedAt)}` : p.tenderedAt ? ` · tendered ${fmtDate(p.tenderedAt)}` : ''}</div>
                      <div className="flex flex-wrap gap-1 mt-1.5">{p.forItiCodes.map(c => <span key={c} className="text-[9px] px-1.5 py-0.5 rounded bg-surface-page text-txt-secondary">{c.replace('GJ-ITI-', '')}</span>)}</div>
                      {role === 'spv_ceo' && st !== 'closed' && <div className="mt-2"><Btn small tone="ghost" onClick={() => advance(p)}>→ {STAGES[idx(st) + 1]}</Btn></div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
