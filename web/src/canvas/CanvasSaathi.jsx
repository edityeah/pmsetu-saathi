// CanvasSaathi — lets any canvas publish "what is on screen" so the Saathi
// dock under it can answer about the live data and propose actions.
//
//   const { data } = useLoad(...)
//   useSaathiContext(data ? `Open tasks: ${...}` : '', ['What is overdue?'])
//
// Call the hook unconditionally (before any early return). Canvases that
// embed their own AvatarCall (analyst shells, companion personas) do not use
// the dock; see HAS_OWN_CHAT in CanvasPanel.jsx.
import { createContext, useContext, useEffect, useState, useMemo } from 'react'

const Ctx = createContext(null)

// What the user is looking at right now, for live calls and screen share:
// the open canvas's title, tab and the data it published. One global store
// so the call layer (above the canvas tree) can read it and subscribe.
export const screenStore = {
  current: null,
  listeners: new Set(),
  set(next) { this.current = next; for (const l of this.listeners) { try { l(next) } catch {} } },
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn) },
}

export function CanvasSaathiProvider({ children, screen }) {
  const [published, setPublished] = useState({ context: '', quickAsks: [] })
  const value = useMemo(() => ({ published, setPublished }), [published])
  useEffect(() => {
    screenStore.set(screen ? { ...screen, context: published.context, quickAsks: published.quickAsks } : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen?.type, screen?.title, screen?.tab, published.context])
  useEffect(() => () => screenStore.set(null), [])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSaathiContext(context, quickAsks) {
  const ctx = useContext(Ctx)
  const asks = JSON.stringify(quickAsks || [])
  useEffect(() => {
    if (!ctx) return
    ctx.setPublished({ context: context || '', quickAsks: quickAsks || [] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, asks])
}

export function usePublishedSaathi() {
  return useContext(Ctx)?.published || { context: '', quickAsks: [] }
}

// Compact JSON of a canvas's loaded data for the dock prompt (bounded size).
export function brief(obj, max = 3500) {
  try {
    const seen = new WeakSet()
    const s = JSON.stringify(obj, (k, v) => {
      if (['timeline', 'lessons', 'checklist', 'logbook', 'profile', 'passwordHash', 'rubric', 'scores', 'embedding'].includes(k)) return undefined
      if (v && typeof v === 'object') { if (seen.has(v)) return undefined; seen.add(v); if (Array.isArray(v) && v.length > 40) return v.slice(0, 40) }
      return v
    })
    return s.length > max ? s.slice(0, max) + '…(truncated)' : s
  } catch { return '' }
}
