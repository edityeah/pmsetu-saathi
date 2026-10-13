// DonutChartCard — share-of-whole donut. Used for TP-type breakdown, batch
// stage split, mode-of-assessment, etc. Includes a side legend with absolute
// values + percentage labels.

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { Sparkles } from 'lucide-react'

const COLORS = {
  primary:  '#386AF6',
  sky:      '#0EA5E9',
  emerald:  '#10B981',
  amber:    '#F59E0B',
  rose:     '#F43F5E',
  violet:   '#8B5CF6',
  indigo:   '#6366F1',
  teal:     '#14B8A6',
  fuchsia:  '#D946EF',
}
const PALETTE = [COLORS.primary, COLORS.emerald, COLORS.amber, COLORS.rose, COLORS.violet, COLORS.sky, COLORS.teal, COLORS.fuchsia, COLORS.indigo]

function fmt(n) {
  if (typeof n !== 'number') return n
  if (n >= 1e7) return (n / 1e7).toFixed(1) + ' Cr'
  if (n >= 1e5) return (n / 1e5).toFixed(1) + ' L'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString('en-IN')
}

export default function DonutChartCard({ card }) {
  const raw = Array.isArray(card.data) ? card.data : []
  const total = raw.reduce((s, d) => s + (Number(d.value) || 0), 0) || 1
  const data = raw.map((d, i) => ({
    name: d.label,
    value: Number(d.value) || 0,
    pct: ((Number(d.value) || 0) / total) * 100,
    color: COLORS[d.color] || d.color || PALETTE[i % PALETTE.length],
  }))

  return (
    <div className="rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden">
      <div className="px-4 py-2.5 bg-gradient-to-r from-surface-page/50 to-white border-b border-bdr-light">
        <div className="text-[11px] font-bold uppercase tracking-wider text-primary">{card.title || 'Breakdown'}</div>
        {card.unit && <div className="text-[10px] text-txt-tertiary mt-0.5">Unit: {card.unit}</div>}
      </div>
      <div className="p-3">
        {card.annotation && (
          <div className="mb-3 text-[12px] text-txt-secondary inline-flex items-start gap-1.5 px-2">
            <Sparkles className="w-3 h-3 mt-0.5 text-primary flex-shrink-0" />
            <span>{card.annotation}</span>
          </div>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <div style={{ width: 200, height: 200 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip
                  formatter={(v, n) => [fmt(v), n]}
                  contentStyle={{ background: 'white', border: '1px solid #CFD8E6', borderRadius: 8, fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex-1 min-w-[180px] space-y-1.5">
            {data.map((d, i) => (
              <li key={i} className="flex items-center gap-2 text-[12px]">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.color }} />
                <span className="flex-1 text-txt-primary truncate">{d.name}</span>
                <span className="font-bold text-txt-primary tabular-nums">{fmt(d.value)}</span>
                <span className="text-txt-tertiary tabular-nums w-12 text-right">{d.pct.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
