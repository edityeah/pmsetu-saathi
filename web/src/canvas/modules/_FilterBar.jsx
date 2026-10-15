// FilterBar — the filters a view opened with, shown as controls at the top
// so the reader sees what is applied and can change it.
import { SlidersHorizontal } from 'lucide-react'

const sel = 'text-[12px] rounded-lg border border-bdr px-2 py-1.5 bg-white'

export default function FilterBar({ items = [], note }) {
  // items: [{ label, value, options?: [{id,label}], onChange?, type?: 'date'|'select'|'text' }]
  return (
    <div className="px-4 py-2.5 bg-white border-b border-bdr-light flex items-center gap-3 flex-wrap">
      <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-txt-tertiary"><SlidersHorizontal className="w-3 h-3" /> Filters</span>
      {items.map(f => (
        <label key={f.label} className="inline-flex items-center gap-1.5 text-[11px]">
          <span className="font-bold text-txt-secondary">{f.label}</span>
          {f.type === 'date' ? <input type="date" className={sel} value={f.value || ''} onChange={e => f.onChange?.(e.target.value)} />
            : f.options ? <select className={sel} value={f.value ?? ''} onChange={e => f.onChange?.(e.target.value)}>{f.options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
            : <span className="px-2 py-1 rounded-lg bg-surface-page text-txt-primary">{f.value}</span>}
        </label>
      ))}
      {note && <span className="text-[11px] text-txt-tertiary ml-auto">{note}</span>}
    </div>
  )
}
