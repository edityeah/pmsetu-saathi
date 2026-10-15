// Record-page primitives shared by the registry and institute profile:
// a full-screen page inside the canvas with a back arrow and breadcrumb on
// the top left, the name, an id line, a status pill, then sectioned cards
// with label-over-value pairs.
import { ArrowLeft } from 'lucide-react'
import { Pill } from './_ui.jsx'

// A full-screen record page inside the canvas: back arrow and breadcrumb on
// the top left, name, id line, status pill on the right, then sectioned cards.
export function DetailPage({ onBack, eyebrow, title, id, sub, pill, children }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-3"><button onClick={onBack} className="w-9 h-9 rounded-xl border border-bdr-light bg-surface-page flex items-center justify-center hover:bg-white" title="Back"><ArrowLeft className="w-4 h-4 text-txt-secondary" /></button><div className="text-[11px] font-bold uppercase tracking-[2px] text-txt-secondary">{eyebrow}</div></div>
        <div className="mt-3 flex items-start gap-3 flex-wrap"><div className="flex-1 min-w-0"><h2 className="text-[24px] font-bold text-txt-primary leading-tight">{title}</h2>{id && <div className="text-[12px] text-txt-secondary mt-1 font-mono">{id}</div>}{sub && <div className="text-[12px] text-txt-secondary">{sub}</div>}</div>{pill && <Pill kind={pill.kind}>{pill.label}</Pill>}</div>
      </div>
      <div className="px-4 pb-6 space-y-4">{children}</div>
    </div>
  )
}

export function DetailCard({ title, icon, children }) {
  return (
    <div className="rounded-2xl border border-bdr-light bg-white shadow-card p-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-txt-primary mb-3 inline-flex items-center gap-2"><span aria-hidden>{icon}</span>{title}</div>
      {children}
    </div>
  )
}

// Label over value, in one or two columns, as on a record page.
export function LabelGrid({ items, cols = 2 }) {
  return (
    <dl className={`grid grid-cols-1 ${cols === 2 ? 'sm:grid-cols-2' : ''} gap-x-8 gap-y-3`}>
      {items.map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-[10px] uppercase tracking-wider font-bold text-txt-tertiary">{k}</dt><dd className="text-[13px] font-semibold text-txt-primary mt-0.5 break-words">{v}</dd></div>)}
    </dl>
  )
}
