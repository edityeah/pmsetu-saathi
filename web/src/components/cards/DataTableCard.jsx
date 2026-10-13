// DataTableCard — sortable tabular drill-down (TP table, sector breakdown).
// Columns are typed (number / percent / currency / text) so we can format
// per-cell without per-row work in the prompt.

import { useState } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, Sparkles, AlertTriangle } from 'lucide-react'

function formatCell(value, type) {
  if (value == null || value === '') return '—'
  if (type === 'number')   return Number(value).toLocaleString('en-IN')
  if (type === 'percent')  return `${Number(value).toFixed(1)}%`
  if (type === 'currency') return `₹${Number(value).toLocaleString('en-IN')}`
  return value
}

export default function DataTableCard({ card }) {
  const columns = Array.isArray(card.columns) ? card.columns : []
  const rows = Array.isArray(card.rows) ? card.rows : []
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('desc')

  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey]
        if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av
        return sortDir === 'asc'
          ? String(av || '').localeCompare(String(bv || ''))
          : String(bv || '').localeCompare(String(av || ''))
      })
    : rows

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  return (
    <div className="rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden">
      <div className="px-4 py-2.5 bg-gradient-to-r from-surface-page/50 to-white border-b border-bdr-light">
        <div className="text-[11px] font-bold uppercase tracking-wider text-primary">{card.title || 'Data'}</div>
        <div className="text-[10px] text-txt-tertiary mt-0.5">{rows.length} row{rows.length === 1 ? '' : 's'}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-surface-page/50 border-b border-bdr-light">
              {columns.map(col => (
                <th key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className="px-3 py-2 text-left font-bold text-txt-secondary uppercase tracking-wider text-[10px] cursor-pointer hover:bg-surface-page select-none">
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key
                      ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
                      : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} className="border-b border-bdr-light/60 last:border-b-0 hover:bg-surface-page/40">
                {columns.map(col => (
                  <td key={col.key} className={`px-3 py-2 text-txt-primary ${col.type === 'number' || col.type === 'percent' || col.type === 'currency' ? 'tabular-nums text-right' : ''}`}>
                    {formatCell(row[col.key], col.type)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {card.highlight && (
        <div className="px-4 py-2.5 border-t border-bdr-light bg-amber-50/50 text-[12px] text-amber-800 inline-flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>{card.highlight}</span>
        </div>
      )}
    </div>
  )
}
