export default function TypingIndicator() {
  return (
    <div className="chat-bubble-bot inline-flex gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-txt-tertiary animate-typing" style={{ animationDelay: '0s' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-txt-tertiary animate-typing" style={{ animationDelay: '0.2s' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-txt-tertiary animate-typing" style={{ animationDelay: '0.4s' }} />
    </div>
  )
}
