// Chips — horizontal row of tappable follow-up prompts attached to a card.
// Tapping a chip fires the chip text as the user's next message (one-tap
// drill-down). Used by every card type, hence factored out here.

export default function Chips({ chips, onChip }) {
  if (!Array.isArray(chips) || chips.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {chips.map((c, i) => (
        <button
          key={i}
          onClick={() => onChip?.(c)}
          className="text-[12px] px-3 py-1.5 rounded-pill bg-primary-light/60 hover:bg-primary-light text-primary-dark font-medium border border-primary/15 transition active:scale-95"
        >
          {c}
        </button>
      ))}
    </div>
  )
}
