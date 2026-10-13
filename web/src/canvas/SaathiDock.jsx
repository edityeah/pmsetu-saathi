// SaathiDock — the chat that sits under every operational canvas. Desktop:
// a resizable split (screen on top, Saathi below). Phone: a bottom bar that
// expands into the chat so the screen keeps its full height until asked.
import { useEffect, useState } from 'react'
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import AvatarCall from '../components/AvatarCall.jsx'
import ResizableSaathiSplit from '../components/ResizableSaathiSplit.jsx'
import { useApp } from '../context/AppContext.jsx'
import { usePublishedSaathi } from './CanvasSaathi.jsx'

const KEY = 'pmsetu.canvasChat.open.v1'
const isPhone = () => typeof window !== 'undefined' && window.innerWidth < 768

export default function SaathiDock({ meta, canvas, children }) {
  const { role } = useApp()
  const { context, quickAsks } = usePublishedSaathi()
  const [open, setOpen] = useState(() => { try { const v = localStorage.getItem(KEY); return v == null ? !isPhone() : v === '1' } catch { return !isPhone() } })
  useEffect(() => { try { localStorage.setItem(KEY, open ? '1' : '0') } catch {} }, [open])

  const title = meta?.title || canvas?.type
  const extraSystem = [
    `You are Saathi inside the "${title}" screen (${meta?.subtitle || ''}) of PM-SETU Saathi, talking to a ${role}.`,
    'Answer about what is on this screen first, using the live data below; be concrete and short. When the user asks to do something the screen supports (update a task, submit attendance, confirm marks, refer a student, change a state), explain exactly which control to use and what it will record. Never invent numbers that are not in the data; if something is missing say it is not reported.',
    context ? `LIVE DATA ON SCREEN:\n${context}` : 'The screen has not published its data yet; answer from role context and say so.',
  ].join('\n\n')
  const asks = quickAsks?.length ? quickAsks : [`What should I do first on ${title}?`, 'Explain this screen in two lines.', 'What is pending or overdue here?']

  const chat = <AvatarCall persona="general" title={`Saathi · ${title}`} useWebSearch={false} extraSystem={extraSystem} quickAsks={asks} threadId={canvas?.threadId} />
  const bar = (
    <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-light/60 to-white border-t border-bdr-strong text-left" title={open ? 'Hide Saathi' : 'Ask Saathi about this screen'}>
      <Sparkles className="w-4 h-4 text-primary" />
      <span className="text-[12px] font-bold text-primary flex-1">{open ? `Saathi · ${title}` : 'Ask Saathi about this screen'}</span>
      {open ? <ChevronDown className="w-4 h-4 text-txt-secondary" /> : <ChevronUp className="w-4 h-4 text-txt-secondary" />}
    </button>
  )
  if (!open) return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
      {bar}
    </div>
  )
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0">
        <ResizableSaathiSplit storageKey="pmsetu.canvasChat.height.v1" defaultHeight={isPhone() ? 300 : 320} top={<div className="h-full overflow-y-auto">{children}</div>} bottom={<div className="flex flex-col h-full">{bar}<div className="flex-1 min-h-0">{chat}</div></div>} />
      </div>
    </div>
  )
}
