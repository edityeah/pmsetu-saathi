export default function QuickReplies({ chips, onPick }) {
  if (!chips?.length) return null
  return (
    <div className="flex gap-2 overflow-x-auto px-3 py-2 no-scrollbar">
      {chips.map((c, i) => (
        <button key={i} onClick={() => onPick?.(c)} className="chip whitespace-nowrap">{c}</button>
      ))}
    </div>
  )
}
