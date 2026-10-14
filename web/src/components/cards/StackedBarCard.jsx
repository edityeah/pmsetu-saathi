// StackedBarCard — one bar per period (Y1…Y5), segments stacked by series
// (category or ITI). Used for spend phasing: each year's total split into
// its components, so the mix and the total read at a glance.
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const PALETTE = ['#386AF6', '#0EA5E9', '#10B981', '#F59E0B', '#F43F5E', '#8B5CF6', '#14B8A6', '#D946EF', '#6366F1', '#84CC16', '#F97316', '#64748B']

export default function StackedBarCard({ card, right }) {
  // card = { title, unit, annotation, keys: ['Civil', …], data: [{ label: 'Y1', Civil: 7.2, … }] }
  const keys = card.keys || []
  const data = card.data || []
  const fmt = v => typeof v === 'number' ? (card.unit === '₹ Cr' ? `₹${v.toFixed(2)} Cr` : v.toLocaleString('en-IN')) : v
  return (
    <div className="rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden">
      <div className="px-4 py-2.5 bg-gradient-to-r from-surface-page/50 to-white border-b border-bdr-light flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-0"><div className="text-[11px] font-bold uppercase tracking-wider text-primary">{card.title}</div>{card.unit && <div className="text-[10px] text-txt-tertiary">{card.unit}</div>}</div>
        {right}
      </div>
      {card.annotation && <div className="px-4 pt-2 text-[11px] text-txt-secondary">{card.annotation}</div>}
      <div className="px-2 pb-2" style={{ height: Math.max(240, 40 + data.length * 0) }}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} width={44} />
            <Tooltip formatter={(v, n) => [fmt(v), n]} labelFormatter={l => { const row = data.find(d => d.label === l); const t = row ? keys.reduce((s, k) => s + (row[k] || 0), 0) : 0; return `${l} · total ${fmt(+t.toFixed(2))}` }} contentStyle={{ fontSize: 11, borderRadius: 10 }} />
            <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
            {keys.map((k, i) => <Bar key={k} dataKey={k} stackId="a" fill={PALETTE[i % PALETTE.length]} radius={i === keys.length - 1 ? [4, 4, 0, 0] : 0} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
