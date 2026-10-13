import { Sparkles } from 'lucide-react'

export default function GenericCanvas({ context }) {
  const type = context?.type || 'unknown'
  return (
    <div className="p-6">
      <div className="rounded-card border border-dashed border-bdr-light p-6 text-center bg-slate-50">
        <Sparkles className="w-7 h-7 text-primary mx-auto mb-2" />
        <div className="font-medium">Module preview · <span className="font-mono text-sm bg-white px-1.5 py-0.5 rounded">{type}</span></div>
        <p className="text-xs text-txt-secondary mt-2 max-w-md mx-auto">
          The full UI for this module is part of the next build slice. Saathi routed your request here correctly — the
          scaffold, role-gating, and canvas dispatch are all working end-to-end.
        </p>
      </div>
      <details className="mt-4 text-xs text-txt-secondary">
        <summary className="cursor-pointer">Show canvas context</summary>
        <pre className="mt-2 p-3 bg-slate-900 text-slate-100 rounded overflow-auto text-[11px]">{JSON.stringify(context, null, 2)}</pre>
      </details>
    </div>
  )
}
