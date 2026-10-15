// FilterBar — the filters a view opened with, as controls the reader can
// change. One line on a laptop or desktop (controls keep a fixed width and
// the row scrolls sideways rather than wrapping); on a phone a "Filters"
// button opens a stacked panel.
import { useState } from 'react'
import { SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react'

const ctl = 'text-[12px] rounded-lg border border-bdr px-2 py-1.5 bg-white'

function Control({ f, full }) {
  const w = full ? 'w-full' : f.type === 'date' ? 'w-[132px]' : 'w-[150px] max-w-[150px] truncate'
  if (f.type === 'date') return <input type="date" className={`${ctl} ${w}`} value={f.value || ''} onChange={e => f.onChange?.(e.target.value)} />
  if (f.options) return <select className={`${ctl} ${w}`} value={f.value ?? ''} onChange={e => f.onChange?.(e.target.value)} title={String(f.options.find(o => String(o.id) === String(f.value))?.label ?? '')}>{f.options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
  return <span className={`px-2 py-1.5 rounded-lg bg-surface-page text-txt-primary text-[12px] inline-block ${full ? 'w-full' : 'max-w-[150px] truncate'}`} title={String(f.value)}>{f.value}</span>
}

export default function FilterBar({ items = [], note }) {
  const [open, setOpen] = useState(false)
  const active = items.filter(f => f.onChange && f.value != null && !['all', '', 'All', 'active'].includes(String(f.value)) && f.type !== 'date').length
  return (
    <div className="bg-white border-b border-bdr-light">
      {/* Laptop and desktop: one line, never wraps. */}
      <div className="hidden md:flex items-center gap-3 px-4 py-2.5 overflow-x-auto whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-txt-tertiary flex-shrink-0"><SlidersHorizontal className="w-3 h-3" /> Filters</span>
        {items.map(f => <label key={f.label} className="inline-flex items-center gap-1.5 text-[11px] flex-shrink-0"><span className="font-bold text-txt-secondary">{f.label}</span><Control f={f} /></label>)}
        {note && <span className="text-[11px] text-txt-tertiary ml-auto pl-3 flex-shrink-0 hidden xl:inline">{note}</span>}
      </div>
      {/* Phone: a toggle and a stacked panel. */}
      <div className="md:hidden px-4 py-2">
        <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 text-[12px] font-bold text-txt-primary">
          <SlidersHorizontal className="w-3.5 h-3.5 text-primary" /> Filters{active ? <span className="px-1.5 py-0.5 rounded-pill bg-primary text-white text-[10px]">{active}</span> : null}
          <span className="ml-auto text-[11px] text-txt-tertiary font-normal truncate max-w-[55%]">{open ? '' : (note || '')}</span>
          {open ? <ChevronUp className="w-4 h-4 text-txt-secondary" /> : <ChevronDown className="w-4 h-4 text-txt-secondary" />}
        </button>
        {open && (
          <div className="grid grid-cols-2 gap-2 pt-2">
            {items.map(f => <label key={f.label} className="block text-[11px] min-w-0"><span className="font-bold text-txt-secondary">{f.label}</span><div className="mt-0.5"><Control f={f} full /></div></label>)}
            {note && <div className="col-span-2 text-[11px] text-txt-tertiary">{note}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
