// InfoCard — generic "explainer" card with title + body + chips. Used both as
// an explicit card type for conceptual explanations ("How does RPL work?") and
// as a fallback for any unknown card type the LLM emits.

import { Info } from 'lucide-react'

export default function InfoCard({ card }) {
  return (
    <div className="rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden">
      <div className="p-4 flex gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary-light text-primary-dark flex items-center justify-center flex-shrink-0">
          <Info className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          {card.title && <div className="font-bold text-[13px] text-txt-primary leading-tight">{card.title}</div>}
          {card.body && <div className="text-[12px] text-txt-secondary mt-1 whitespace-pre-line">{card.body}</div>}
        </div>
      </div>
    </div>
  )
}
