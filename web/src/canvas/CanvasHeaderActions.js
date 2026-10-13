// Context bus that lets a canvas module inject JSX into the CanvasPanel header
// (e.g. the WhatsApp-style voice / video call icons for Career Counsellor).
//
// Usage:
//   const { setActions } = useContext(CanvasHeaderActionsContext)
//   useEffect(() => { setActions(<MyIcons />); return () => setActions(null) }, [...deps])

import { createContext, useContext } from 'react'

export const CanvasHeaderActionsContext = createContext({
  setActions: () => {},
})

export function useCanvasHeader() {
  return useContext(CanvasHeaderActionsContext)
}
