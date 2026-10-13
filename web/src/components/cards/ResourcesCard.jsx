// ResourcesCard — list of downloadable / linkable learning materials.
// "Show me today's notes" / "Download admit card".

import { FileText, Video, Link2, Download } from 'lucide-react'

const ICON = { pdf: FileText, video: Video, link: Link2, doc: FileText }

export default function ResourcesCard({ card, onChip }) {
  const items = Array.isArray(card.items) ? card.items : []
  return (
    <div className="rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden">
      <div className="px-4 py-2.5 bg-gradient-to-r from-primary-light/60 to-white border-b border-bdr-light">
        <div className="text-[11px] font-bold uppercase tracking-wider text-primary">{card.title || 'Resources'}</div>
      </div>
      <ul className="divide-y divide-bdr-light">
        {items.map((it, i) => {
          const Icon = ICON[it.kind] || FileText
          const href = it.url && it.url !== '#' ? it.url : undefined
          return (
            <li key={i} className="p-3 flex items-center gap-3 hover:bg-surface-page transition">
              <div className="w-9 h-9 rounded-xl bg-primary-light text-primary-dark flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[13px] text-txt-primary truncate">{it.name}</div>
                {it.kind && <div className="text-[10px] uppercase tracking-wider text-txt-tertiary mt-0.5">{it.kind}</div>}
              </div>
              {href ? (
                <a href={href} target="_blank" rel="noreferrer" className="text-primary p-1.5 rounded-full hover:bg-primary-light flex-shrink-0" title="Open">
                  <Download className="w-4 h-4" />
                </a>
              ) : (
                <button
                  onClick={() => onChip?.(`Download "${it.name}"`)}
                  className="text-primary p-1.5 rounded-full hover:bg-primary-light flex-shrink-0"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
