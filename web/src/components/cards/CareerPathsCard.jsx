// CareerPathsCard — top role recommendations for a learner. Each row carries
// role name, salary band, "why this fits you" rationale, and required skills
// as small chips. Used for "What career paths should I consider?", "Salary
// benchmarks", "What jobs can I get after this course?".

import { TrendingUp, IndianRupee, Sparkles } from 'lucide-react'

export default function CareerPathsCard({ card, onChip }) {
  const items = Array.isArray(card.items) ? card.items : []
  return (
    <div className="rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden">
      <div className="px-4 py-2.5 bg-gradient-to-r from-rose-50 to-white border-b border-bdr-light">
        <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700 inline-flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" />{card.title || 'Top career paths for you'}
        </div>
      </div>
      <ul className="divide-y divide-bdr-light">
        {items.map((p, i) => {
          const skills = Array.isArray(p.skills) ? p.skills : []
          return (
            <li key={i} className="p-3.5 hover:bg-surface-page transition">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-[13px] font-bold flex-shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="font-bold text-[14px] text-txt-primary leading-tight">{p.role}</div>
                    {p.salary && (
                      <span className="inline-flex items-center gap-1 text-[12px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-pill flex-shrink-0">
                        <IndianRupee className="w-3 h-3" />{p.salary}
                      </span>
                    )}
                  </div>
                  {p.nsqf && (
                    <div className="text-[10px] uppercase tracking-wider text-txt-tertiary mt-0.5">NSQF L{p.nsqf}</div>
                  )}
                  {p.why && (
                    <div className="text-[12px] text-txt-secondary mt-1.5 inline-flex items-start gap-1.5">
                      <Sparkles className="w-3 h-3 text-rose-400 mt-0.5 flex-shrink-0" />
                      <span>{p.why}</span>
                    </div>
                  )}
                  {skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {skills.map((s, j) => (
                        <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-100">{s}</span>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => onChip?.(`Tell me more about ${p.role}`)}
                    className="text-[11px] text-primary hover:underline font-medium mt-2"
                  >
                    More about this role →
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
