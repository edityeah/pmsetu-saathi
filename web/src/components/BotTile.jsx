export default function BotTile({ bot, onClick, compact = false }) {
  return (
    <button onClick={onClick}
      className={`text-left rounded-card border border-bdr-light bg-white hover:border-primary hover:shadow-card transition ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-start gap-3">
        <div className="text-2xl">{bot.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{bot.name}</div>
          <div className="text-xs text-txt-secondary mt-0.5">{bot.sub}</div>
        </div>
      </div>
    </button>
  )
}
