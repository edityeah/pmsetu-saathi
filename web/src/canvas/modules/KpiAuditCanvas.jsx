// KPI audit — every KPI with baseline / target / current, achievement, and
// an IMA verification flag. Unverified values do not count for tranches.
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Bar, Pill, Section, Table, Loading, Btn, useLoad, titleCase } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

export default function KpiAuditCanvas() {
  const { role, showToast, openCanvas } = useApp()
  const { data, reload } = useLoad(() => api.kpis())
  useSaathiContext(data ? brief(data) : '', ['Which KPIs have a real source today?', 'What coverage caveats apply to enrolment?'])
  if (!data) return <Loading />
  const k = data.kpis
  const verified = k.filter(x => x.verified).length
  const withValue = k.filter(x => x.current != null)
  async function flag(x, verified) { await api.kpiVerify(x.id, { verified }); showToast({ kind: 'success', text: `${x.name}: ${verified ? 'verified' : 'flagged unverified'}` }); reload() }
  const areas = [...new Set(k.map(x => x.area))]
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="rose" eyebrow="Annexure 7 + License Agreement KPIs" title={`${withValue.length} of ${k.length} KPIs have a value · ${verified} verified`} subtitle="Each KPI shows its source and coverage (2 of 5 ITIs feed the registry). Plan-only KPIs are blank, not zero. The IMA verifies from primary data before a value counts." />
      <div className="p-4 space-y-4">
        <StatGrid>
          <Stat label="Verified" value={verified} tone="emerald" />
          <Stat label="Unverified" value={k.length - verified} tone="amber" />
          <Stat label="Plan-only (no source yet)" value={k.length - withValue.length} tone="slate" />
          <Stat label="At / above Y1 target" value={withValue.filter(x => x.achievementPct >= 100).length} sub={`${withValue.filter(x => x.achievementPct < 50).length} below half-way`} tone="sky" />
        </StatGrid>
        {areas.map(a => (
          <Section key={a} title={titleCase(a)}>
            <Table columns={[
              { key: 'name', label: 'KPI', render: r => <div><div className="font-semibold">{r.code} · {r.name}</div><div className="text-[10px] text-txt-tertiary">{r.unit} · weight {Math.round(r.weight * 100)}% · {r.actualSource || 'source tbd'}</div></div> },
              { key: 'baseline', label: 'Baseline', align: 'right', render: r => r.baseline ?? <span className="text-txt-tertiary">{r.baselineText || '—'}</span> },
              { key: 'current', label: 'Current', align: 'right', render: r => r.current == null ? <span className="text-txt-tertiary">—</span> : <b>{r.current}</b> },
              { key: 'target', label: 'Y1 target', align: 'right', render: r => r.target ?? '—' },
              { key: 'achievementPct', label: 'Progress', render: r => <div className="min-w-[120px]">{r.achievementPct == null ? <span className="text-[10px] text-txt-tertiary">{r.valueStatus}</span> : <Bar pct={r.achievementPct} tone="auto" />}</div> },
              { key: 'coverage', label: 'Coverage', render: r => <span className="text-[10px] text-txt-secondary">{r.coverage || (r.current != null ? 'cluster' : '')}</span> },
              { key: 'verified', label: 'IMA', render: r => <Pill kind={r.verified ? 'ok' : 'warn'}>{r.verified ? 'verified' : 'unverified'}</Pill> },
              { key: 'act', label: '', align: 'right', render: r => role === 'ima_officer' && r.current != null ? (r.verified ? <Btn small tone="ghost" onClick={() => flag(r, false)}>Flag</Btn> : <Btn small tone="ok" onClick={() => flag(r, true)}>Verify</Btn>) : null },
            ]} rows={k.filter(x => x.area === a)} />
          </Section>
        ))}
        <div className="text-[11px] text-txt-secondary">Evidence sources: <button className="text-primary font-bold" onClick={() => openCanvas({ type: 'placements_cluster' })}>joined records</button> · <button className="text-primary font-bold" onClick={() => openCanvas({ type: 'cluster_operations' })}>operations coverage</button> · <button className="text-primary font-bold" onClick={() => openCanvas({ type: 'machines_infra' })}>asset register</button></div>
      </div>
    </div>
  )
}
