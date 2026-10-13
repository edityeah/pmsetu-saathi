// Tranche readiness — the money screen. Shows the guideline conditions for
// the next release, the cost-weighted KPI arithmetic, and a "what-if" panel
// where the CEO drags component progress / KPI values to see the score move.

import { useEffect, useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Bar, Pill, Section, Table, Loading, Btn, useLoad, fmtCr } from './_ui.jsx'
import { CheckCircle2, XCircle, Sliders, RotateCcw } from 'lucide-react'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

export default function TrancheReadinessCanvas() {
  const { role, showToast } = useApp()
  const { data, err } = useLoad(() => api.tranche())
  const [sim, setSim] = useState({ progress: {}, kpis: {} })
  const [simResult, setSimResult] = useState(null)

  useEffect(() => {
    if (!data) return
    const has = Object.keys(sim.progress).length || Object.keys(sim.kpis).length
    if (!has) { setSimResult(null); return }
    const t = setTimeout(() => api.trancheSimulate(sim).then(setSimResult).catch(() => {}), 250)
    return () => clearTimeout(t)
  }, [sim, data])

  if (err) return <div className="p-6 text-sm text-danger">{err.message}</div>
  useSaathiContext(data ? brief(data) : '', ['What closes the gap to the 80% gate fastest?', 'Explain the cost-weighted score in plain words.'])
  if (!data) return <Loading />
  const { cluster, year, nextYear, utilisation, score, firstTranche, secondTranche, budgetLines, kpis, milestoneProgressPct } = data
  const liveScore = simResult?.score || score
  const liveUtil = simResult?.utilisation || utilisation

  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="rose" eyebrow={`Guidelines §4.2 · ${cluster.name}`} title={`Year-${nextYear} first tranche: ${firstTranche.met} of 3 conditions met`}
        subtitle={`Years 2–5 release 50% at the start of the year and 50% mid-year. Each needs evidence the IMA accepts. ${role === 'ima_officer' ? 'You certify; the SPMU releases.' : 'Advance was 10%; the remaining 90% rides on this.'}`}
        right={<div className="text-right flex-shrink-0"><div className="text-[10px] uppercase font-bold text-txt-tertiary">KPI score</div><div className={`text-[30px] font-bold leading-none ${liveScore.score >= 80 ? 'text-emerald-600' : 'text-rose-600'}`}>{liveScore.score}%</div><div className="text-[10px] text-txt-secondary">gate 80%</div></div>} />
      <div className="p-4 space-y-4">
        <StatGrid>
          <Stat label="Utilised" value={`${liveUtil.utilisedPct}%`} sub={`${fmtCr(liveUtil.utilisedCr)} of ${fmtCr(liveUtil.budgetCr)} · gate 75%`} tone={liveUtil.utilisedPct >= 75 ? 'emerald' : 'amber'} />
          <Stat label="Committed" value={`${liveUtil.committedPct}%`} sub={fmtCr(liveUtil.committedCr)} tone="sky" />
          <Stat label="Component block" value={`${liveScore.componentScore}/${liveScore.componentWeight}`} sub="progress × budget share" tone="indigo" />
          <Stat label="Outcome block" value={`${liveScore.outcomeScore}/${liveScore.outcomeWeight}`} sub="KPIs with a source only" tone="violet" />
        </StatGrid>

        <Section title={`First tranche of Year ${nextYear} · start of year`} hint="All three must hold; otherwise release is deferred until compliance.">
          <ul className="space-y-3">
            {firstTranche.conditions.map(c => <Condition key={c.id} c={c} />)}
          </ul>
        </Section>

        <Section title={`Second tranche of Year ${nextYear} · mid-year`} hint="Industry and State shares must be in escrow; reports current.">
          <ul className="space-y-3">{secondTranche.conditions.map(c => <Condition key={c.id} c={c} />)}</ul>
        </Section>

        <Section title="Cost-weighted KPI arithmetic" hint="Each component contributes progress × its share of cost. ~10% is reserved for outcomes that do not track spend." right={<Pill kind="info">milestones {milestoneProgressPct}% verified</Pill>}>
          <Table columns={[
            { key: 'label', label: 'Component', render: r => <div><div className="font-semibold">{r.label}</div><div className="text-[10px] text-txt-tertiary">{fmtCr(r.utilisedCr)} of {fmtCr(r.budgetCr)}</div></div> },
            { key: 'weightPct', label: 'Weight', align: 'right', render: r => `${r.weightPct}%` },
            { key: 'progressPct', label: 'Progress', render: r => <div className="min-w-[140px]"><Bar pct={sim.progress[r.component] ?? r.progressPct} tone="auto" /></div> },
            { key: 'contributionPct', label: 'Contributes', align: 'right', render: r => <b>{(((sim.progress[r.component] ?? r.progressPct) * r.weightPct) / 100).toFixed(1)}</b> },
          ]} rows={liveScore.byComponent} />
        </Section>

        {role !== 'trainee' && (
          <Section title="What-if simulator" hint="Drag to see what closes the gap. Nothing is saved." right={<Btn tone="ghost" small onClick={() => setSim({ progress: {}, kpis: {} })}><RotateCcw className="w-3 h-3" /> Reset</Btn>}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] font-bold text-txt-secondary mb-2 inline-flex items-center gap-1"><Sliders className="w-3 h-3" /> Component progress</div>
                {budgetLines.map(l => (
                  <label key={l.id} className="block mb-2">
                    <div className="flex justify-between text-[11px]"><span className="truncate">{l.label.split(' (')[0]}</span><b>{sim.progress[l.component] ?? l.progressPct}%</b></div>
                    <input type="range" min="0" max="100" value={sim.progress[l.component] ?? l.progressPct} onChange={e => setSim(s => ({ ...s, progress: { ...s.progress, [l.component]: Number(e.target.value) } }))} className="w-full accent-primary" />
                  </label>
                ))}
              </div>
              <div>
                <div className="text-[11px] font-bold text-txt-secondary mb-2">Outcome KPIs</div>
                {kpis.filter(k => k.weight >= 0.08 && k.current != null && k.target != null).map(k => (
                  <label key={k.id} className="block mb-2">
                    <div className="flex justify-between text-[11px]"><span className="truncate">{k.code} {k.name}</span><b>{sim.kpis[k.code] ?? k.current}{k.unit === 'percent' ? '%' : ''} <span className="text-txt-tertiary font-normal">/ {k.target}{k.coverage ? ` · ${k.coverage}` : ''}</span></b></div>
                    <input type="range" min={Math.min(k.baseline ?? 0, k.target)} max={Math.max(k.baseline ?? 0, k.target) * 1.1} step={1} value={sim.kpis[k.code] ?? k.current} onChange={e => setSim(s => ({ ...s, kpis: { ...s.kpis, [k.code]: Number(e.target.value) } }))} className="w-full accent-primary" />
                  </label>
                ))}
                <div className={`mt-3 rounded-xl p-3 text-[12px] ${liveScore.score >= 80 ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                  Projected score <b>{liveScore.score}%</b> {liveScore.score >= 80 ? '— clears the 80% gate.' : `— still ${80 - liveScore.score} points short. Equipment installation and civil progress move it fastest.`}
                </div>
              </div>
            </div>
          </Section>
        )}
        {role === 'ima_officer' && (
          <div className="flex gap-2 justify-end">
            <Btn tone="ghost" onClick={() => showToast({ kind: 'warn', text: 'Observation letter drafted for the SPV.' })}>Issue observations</Btn>
            <Btn tone={firstTranche.ready ? 'ok' : 'primary'} disabled={!firstTranche.ready} onClick={() => showToast({ kind: 'success', text: 'Tranche certification sent to the SPMU.' })}>{firstTranche.ready ? 'Certify first tranche' : 'Cannot certify yet'}</Btn>
          </div>
        )}
      </div>
    </div>
  )
}

function Condition({ c }) {
  return (
    <li className="flex items-start gap-3">
      {c.ok ? <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold text-txt-primary">{c.label}</div>
        <div className="text-[11px] text-txt-secondary">{c.detail}</div>
        <div className="mt-1.5 max-w-md"><Bar pct={Math.min(100, 100 * c.value / c.threshold)} tone={c.ok ? 'emerald' : 'auto'} /></div>
      </div>
      <Pill kind={c.ok ? 'ok' : 'bad'}>{c.ok ? 'met' : 'not met'}</Pill>
    </li>
  )
}
