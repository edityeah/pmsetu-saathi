// LineChartCard — multi-series line / area chart for time-series trends.
// Series: [{ name, color, data: [{x, y}] }]
//
// First series renders with a soft area fill; remaining series as lines.
// Tooltips show all series at the hovered x-value.

import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { Sparkles } from 'lucide-react'

const COLORS = {
  primary:  '#386AF6',
  sky:      '#0EA5E9',
  emerald:  '#10B981',
  amber:    '#F59E0B',
  rose:     '#F43F5E',
  violet:   '#8B5CF6',
}

function fmt(n) {
  if (typeof n !== 'number') return n
  if (n >= 1e7) return (n / 1e7).toFixed(1) + ' Cr'
  if (n >= 1e5) return (n / 1e5).toFixed(1) + ' L'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString('en-IN')
}

export default function LineChartCard({ card }) {
  const series = Array.isArray(card.series) ? card.series : []
  if (series.length === 0) return null

  // Pivot {series}.data into a single rows array keyed by x.
  const allX = []
  series.forEach(s => (s.data || []).forEach(p => { if (!allX.includes(p.x)) allX.push(p.x) }))
  const rows = allX.map(x => {
    const row = { x }
    series.forEach(s => {
      const found = (s.data || []).find(p => p.x === x)
      row[s.name] = found ? found.y : null
    })
    return row
  })

  return (
    <div className="rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden">
      <div className="px-4 py-2.5 bg-gradient-to-r from-surface-page/50 to-white border-b border-bdr-light">
        <div className="text-[11px] font-bold uppercase tracking-wider text-primary">{card.title || 'Trend'}</div>
      </div>
      <div className="p-3">
        {card.annotation && (
          <div className="mb-3 text-[12px] text-txt-secondary inline-flex items-start gap-1.5 px-2">
            <Sparkles className="w-3 h-3 mt-0.5 text-primary flex-shrink-0" />
            <span>{card.annotation}</span>
          </div>
        )}
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="x" fontSize={10} stroke="#7383A5" label={card.xAxis ? { value: card.xAxis, position: 'insideBottom', offset: -2, fontSize: 10, fill: '#7383A5' } : undefined} />
              <YAxis tickFormatter={fmt} fontSize={10} stroke="#7383A5" label={card.yAxis ? { value: card.yAxis, angle: -90, position: 'insideLeft', fontSize: 10, fill: '#7383A5' } : undefined} />
              <Tooltip
                formatter={(v, n) => [fmt(v), n]}
                contentStyle={{ background: 'white', border: '1px solid #CFD8E6', borderRadius: 8, fontSize: 11 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
              {series.map((s, i) => {
                const color = COLORS[s.color] || s.color || COLORS.primary
                if (i === 0) {
                  return (
                    <Area key={s.name} type="monotone" dataKey={s.name} stroke={color}
                      fill={color} fillOpacity={0.12} strokeWidth={2} dot={{ r: 3 }} />
                  )
                }
                return (
                  <Line key={s.name} type="monotone" dataKey={s.name} stroke={color}
                    strokeWidth={2} dot={{ r: 3 }} />
                )
              })}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
