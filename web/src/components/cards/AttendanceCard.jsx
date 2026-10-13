// AttendanceCard — % gauge + sparkline of last 4 weeks + per-module breakdown.
// Covers "How much is my attendance?" / "What's my attendance for the past 4
// weeks?" / "How many sessions of Module 4 have I missed?".

export default function AttendanceCard({ card }) {
  const pct = clamp(card.percent ?? 0)
  const trend = Array.isArray(card.trend) ? card.trend : []
  const modules = Array.isArray(card.byModule) ? card.byModule : []
  const tone = pct >= 80 ? 'emerald' : pct >= 65 ? 'amber' : 'rose'
  const toneBg  = { emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500' }[tone]
  const toneTxt = { emerald: 'text-emerald-700', amber: 'text-amber-700', rose: 'text-rose-700' }[tone]
  return (
    <div className="rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden">
      <div className="p-4 flex items-center gap-4">
        <Gauge pct={pct} toneBg={toneBg} />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wider font-bold text-txt-tertiary">Your attendance</div>
          <div className={`text-[22px] font-bold leading-tight ${toneTxt}`}>{pct}%</div>
          <div className="text-[11px] text-txt-secondary mt-0.5">
            {pct >= 80 ? 'On track — keep it up.' : pct >= 65 ? 'Slipping — try not to miss more.' : 'Below threshold — could risk certification.'}
          </div>
        </div>
      </div>
      {trend.length > 0 && (
        <div className="px-4 pb-3">
          <div className="text-[10px] uppercase tracking-wider font-bold text-txt-tertiary mb-1.5">Last {trend.length} weeks</div>
          <div className="flex items-end gap-2 h-16">
            {trend.map((t, i) => {
              const h = clamp(t.pct)
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                  <div className={`w-full rounded-t ${toneBg} opacity-80`} style={{ height: `${h}%` }} title={`${t.week}: ${h}%`} />
                  <div className="text-[10px] text-txt-tertiary">{t.week}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {modules.length > 0 && (
        <div className="px-4 pb-4 border-t border-bdr-light pt-3">
          <div className="text-[10px] uppercase tracking-wider font-bold text-txt-tertiary mb-1.5">By module</div>
          <ul className="space-y-1.5">
            {modules.map((m, i) => {
              const p = m.total ? Math.round((m.attended / m.total) * 100) : 0
              return (
                <li key={i} className="text-[12px]">
                  <div className="flex items-center justify-between">
                    <span className="text-txt-primary font-medium">{m.module}</span>
                    <span className="text-txt-secondary">{m.attended}/{m.total} · {p}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-page overflow-hidden mt-1">
                    <div className="h-full bg-primary" style={{ width: `${p}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function clamp(v) { return Math.max(0, Math.min(100, Math.round(Number(v) || 0))) }

function Gauge({ pct, toneBg }) {
  // simple circular meter via conic-gradient
  return (
    <div className="relative w-16 h-16 flex-shrink-0">
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: `conic-gradient(currentColor ${pct}%, #e2e8f0 ${pct}% 100%)` }}
      />
      <div className={`absolute inset-0 rounded-full ${toneBg} opacity-100`}
        style={{ WebkitMask: `radial-gradient(circle 18px at center, transparent 99%, #000 100%)`,
                 mask:         `radial-gradient(circle 18px at center, transparent 99%, #000 100%)` }} />
      <div className="absolute inset-[5px] rounded-full bg-white flex items-center justify-center font-bold text-[14px] text-txt-primary">
        {pct}%
      </div>
    </div>
  )
}
