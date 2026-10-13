export default function ChatBubble({ role, text, html, actions, onAction }) {
  const isUser = role === 'user'
  return (
    <div className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
      <div className={isUser ? 'chat-bubble-user' : 'chat-bubble-bot'}>
        {html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <div className="whitespace-pre-wrap text-sm">{text}</div>}
      </div>
      {actions && actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((a, i) => (
            <button key={i} onClick={() => onAction?.(a)}
              className="px-3 py-1.5 text-xs rounded-pill bg-white border border-primary text-primary-dark hover:bg-primary-50">
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
