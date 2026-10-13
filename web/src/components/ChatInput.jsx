import { useState } from 'react'
import { Send, Mic } from 'lucide-react'

export default function ChatInput({ onSend, placeholder = 'Type a message…' }) {
  const [v, setV] = useState('')
  function submit(e) {
    e?.preventDefault?.()
    const text = v.trim()
    if (!text) return
    setV('')
    onSend?.(text)
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-2 px-3 py-2 bg-white border-t border-bdr-light">
      <button type="button" className="p-2 rounded-pill hover:bg-slate-100 text-txt-secondary"><Mic className="w-5 h-5" /></button>
      <input value={v} onChange={e => setV(e.target.value)} placeholder={placeholder}
        className="flex-1 px-3 py-2 rounded-pill bg-slate-100 outline-none text-sm" />
      <button type="submit" disabled={!v.trim()}
        className="p-2 rounded-pill bg-primary text-white disabled:bg-slate-300">
        <Send className="w-5 h-5" />
      </button>
    </form>
  )
}
