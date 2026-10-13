// ScoreCard — test result with pass/fail banner + breakdown.
// "Show my latest test marks" / "Did I pass the last test?"

export default function ScoreCard({ card }) {
  const passed = !!card.passed
  const pct = card.maxScore ? Math.round((Number(card.score) / Number(card.maxScore)) * 100) : null
  const breakdown = Array.isArray(card.breakdown) ? card.breakdown : []
  return (
    <div className="rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden">
      <div className={`px-4 py-3 ${passed ? 'bg-emerald-50' : 'bg-rose-50'} border-b border-bdr-light`}>
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-[11px] font-bold uppercase tracking-wider ${passed ? 'text-emerald-700' : 'text-rose-700'}`}>
              {passed ? 'Passed' : 'Did not pass'}{card.grade ? ` · Grade ${card.grade}` : ''}
            </div>
            <div className="font-bold text-[13px] text-txt-primary mt-0.5">{card.title || 'Test result'}</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className={`text-[24px] font-bold leading-none ${passed ? 'text-emerald-700' : 'text-rose-700'}`}>
              {card.score}<span className="text-[14px] text-txt-tertiary font-medium">/{card.maxScore}</span>
            </div>
            {pct !== null && <div className="text-[11px] text-txt-secondary mt-0.5">{pct}%</div>}
          </div>
        </div>
      </div>
      {breakdown.length > 0 && (
        <ul className="p-3 space-y-1.5">
          {breakdown.map((b, i) => {
            const p = b.of ? Math.round((Number(b.got) / Number(b.of)) * 100) : 0
            return (
              <li key={i} className="text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="text-txt-primary font-medium">{b.section}</span>
                  <span className="text-txt-secondary">{b.got}/{b.of}</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-page overflow-hidden mt-1">
                  <div className="h-full bg-primary" style={{ width: `${p}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
