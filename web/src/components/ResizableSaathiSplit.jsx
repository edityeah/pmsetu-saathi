// ResizableSaathiSplit — vertical split between a dashboard surface (top)
// and the Saathi chat (bottom) with a draggable handle in between.
//
// User can pinch the handle up to give the chat more room (good for reading
// long responses) or down to give the dashboard more room. Preference is
// persisted to localStorage so it survives reloads.
//
// Works with both mouse and touch.

import { useCallback, useEffect, useRef, useState } from 'react'
import { GripHorizontal } from 'lucide-react'

const STORAGE_KEY = 'pmsetu.analyst.chatHeight.v1'
const DEFAULT_HEIGHT = 380          // px — comfortable starting size
const MIN_HEIGHT = 140               // input + 2 message lines
const MIN_TOP   = 120                // never collapse dashboard below this

export default function ResizableSaathiSplit({ top, bottom, storageKey = STORAGE_KEY, defaultHeight = DEFAULT_HEIGHT }) {
  const containerRef = useRef(null)
  const draggingRef = useRef(false)
  const [chatHeight, setChatHeight] = useState(() => {
    if (typeof window === 'undefined') return defaultHeight
    const stored = +localStorage.getItem(storageKey)
    return stored && stored > 0 ? stored : defaultHeight
  })

  // Persist whenever the size settles.
  useEffect(() => {
    try { localStorage.setItem(storageKey, String(chatHeight)) } catch {}
  }, [chatHeight, storageKey])

  const onMove = useCallback((clientY) => {
    if (!draggingRef.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const wantedChatHeight = rect.bottom - clientY
    // Clamp so the dashboard always has at least MIN_TOP visible and the
    // chat always has at least MIN_HEIGHT.
    const max = Math.max(MIN_HEIGHT, rect.height - MIN_TOP)
    const clamped = Math.max(MIN_HEIGHT, Math.min(max, wantedChatHeight))
    setChatHeight(clamped)
  }, [])

  // Global listeners for mouse / touch — attached only while dragging.
  useEffect(() => {
    function onMouseMove(e) { onMove(e.clientY) }
    function onTouchMove(e) {
      if (e.touches && e.touches[0]) onMove(e.touches[0].clientY)
    }
    function endDrag() {
      if (!draggingRef.current) return
      draggingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup',   endDrag)
    window.addEventListener('mouseleave', endDrag)
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend',  endDrag)
    window.addEventListener('touchcancel', endDrag)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup',   endDrag)
      window.removeEventListener('mouseleave', endDrag)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend',  endDrag)
      window.removeEventListener('touchcancel', endDrag)
    }
  }, [onMove])

  function startDrag(e) {
    draggingRef.current = true
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
    if (e.preventDefault) e.preventDefault()
  }

  // Snap helpers — double-click handle to cycle small / medium / large.
  const snapCycle = useRef(0)
  function onDoubleClick() {
    if (!containerRef.current) return
    const h = containerRef.current.getBoundingClientRect().height
    const sizes = [Math.round(h * 0.30), Math.round(h * 0.55), Math.round(h * 0.80)]
    snapCycle.current = (snapCycle.current + 1) % sizes.length
    setChatHeight(sizes[snapCycle.current])
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden">
      {/* Top: dashboard (auto-fills the space the chat isn't using) */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {top}
      </div>

      {/* Drag handle — full-width, 14 px tall, with a hover affordance */}
      <div
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        onDoubleClick={onDoubleClick}
        title="Drag to resize — double-click to cycle sizes"
        className="flex-shrink-0 h-3.5 flex items-center justify-center bg-gradient-to-b from-surface-page/60 to-surface-page border-y border-bdr-strong cursor-ns-resize hover:bg-primary-light/40 group select-none"
        aria-label="Resize chat panel"
        role="separator"
      >
        <GripHorizontal className="w-5 h-5 text-txt-tertiary group-hover:text-primary transition" />
      </div>

      {/* Bottom: Saathi chat, height controlled by the drag */}
      <div className="flex-shrink-0 bg-white" style={{ height: `${chatHeight}px` }}>
        {bottom}
      </div>
    </div>
  )
}
