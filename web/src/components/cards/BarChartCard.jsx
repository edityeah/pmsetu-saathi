// BarChartCard — vertical or horizontal bar chart for category comparisons
// (top sectors, top courses, TPs by enrolled, etc.). Optional annotation
// surfaces the "what to notice" insight beneath the title.

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList, Cell,
} from 'recharts'
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

function fmt(n) {
  if (typeof n !== 'number') return n
  if (n >= 1e7) return (n / 1e7).toFixed(1) + ' Cr'
  if (n >= 1e5) return (n / 1e5).toFixed(1) + ' L'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString('en-IN')
}

export default function BarChartCard({ card }) {
  const data = Array.isArray(card.data) ? card.data : []
  const horizontal = card.orient === 'horizontal'
  const color = COLORS[card.color] || COLORS.primary
  // If items use a `color` field per-bar, use that instead.
  const cellColors = data.map(d => d.color ? (COLORS[d.color] || d.color) : color)

  return (
    <div className="rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden">
      <div className="px-4 py-2.5 bg-gradient-to-r from-surface-page/50 to-white border-b border-bdr-light">
        <div className="text-[11px] font-bold uppercase tracking-wider text-primary">{card.title || 'Comparison'}</div>
        {card.unit && <div className="text-[10px] text-txt-tertiary mt-0.5">Unit: {card.unit}</div>}
      </div>
      <div className="p-3">
        {card.annotation && (
          <div className="mb-3 text-[12px] text-txt-secondary inline-flex items-start gap-1.5 px-2">
            <Sparkles className="w-3 h-3 mt-0.5 text-primary flex-shrink-0" />
            <span>{card.annotation}</span>
          </div>
        )}
        <div style={{ width: '100%', height: Math.max(180, data.length * (horizontal ? 32 : 0) + 240) }}>
          <ResponsiveContainer>
            <BarChart
              data={data}
              layout={horizontal ? 'vertical' : 'horizontal'}
              margin={{ top: 8, right: 16, bottom: horizontal ? 8 : 56, left: horizontal ? 110 : 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={!horizontal} horizontal={horizontal} />
              {horizontal ? (
                <>
                  <XAxis type="number" tickFormatter={fmt} fontSize={10} stroke="#7383A5" />
                  <YAxis type="category" dataKey="label" width={100} fontSize={10} stroke="#7383A5" interval={0} />
                </>
              ) : (
                <>
                  <XAxis dataKey="label" interval={0} angle={-25} textAnchor="end" fontSize={10} stroke="#7383A5" />
                  <YAxis tickFormatter={fmt} fontSize={10} stroke="#7383A5" />
                </>
              )}
              <Tooltip
                formatter={(v) => fmt(v)}
                contentStyle={{ background: 'white', border: '1px solid #CFD8E6', borderRadius: 8, fontSize: 11 }}
                cursor={{ fill: 'rgba(56,106,246,0.05)' }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {data.map((_, i) => <Cell key={i} fill={cellColors[i] || color} />)}
                <LabelList dataKey="value" formatter={fmt} position={horizontal ? 'right' : 'top'} fontSize={10} fill="#1A1F36" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
