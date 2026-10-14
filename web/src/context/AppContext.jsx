import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api, clearToken, getToken, setToken, SESSION_KEY } from '../api/client.js'
import { DEMO_PASSWORD, getDemoUser } from '../roles/demoUsers.js'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

function loadSession() {
  try { const j = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); return j?.role ? j : null } catch { return null }
}
function saveSession(s) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)) } catch {} }

// Persona slug (server) → canvas type that hosts that conversation.
export const PERSONA_TO_CANVAS = {
  'career-counsellor':  'career_counsellor',
  'learning-assistant': 'doubt_solver',
  'general':            'saathi_assistant',
}

export function AppProvider({ children }) {
  const persisted = getToken() ? loadSession() : null
  const [screen, setScreenRaw] = useState(persisted?.screen || 'splash')
  const [stack, setStack] = useState(persisted?.stack || ['splash'])
  const [role, setRole] = useState(persisted?.role || null)
  const [user, setUser] = useState(persisted?.user || null)
  const [lang, setLang] = useState(persisted?.lang || 'en')
  const [meExtra, setMeExtra] = useState(persisted?.meExtra || null)
  const [canvas, setCanvas] = useState(null)
  const [toast, setToast] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [threads, setThreads] = useState([])
  const signingOut = useRef(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!getToken()) return
      try { const me = await api.me(); if (cancelled) return; setUser(me.user); setRole(me.user.role); setMeExtra(stripUser(me)) }
      catch { clearToken(); setUser(null); setRole(null); setMeExtra(null); setScreenRaw('splash'); setStack(['splash']) }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => { if (signingOut.current || !role) return; saveSession({ screen, stack, role, user, meExtra, lang }) }, [screen, stack, role, user, meExtra, lang])

  useEffect(() => {
    if (!role) return
    let cancelled = false
    const loop = async () => { try { const r = await api.notifications(); if (!cancelled) setNotifications(r.notifications || []) } catch {} }
    loop(); const id = setInterval(loop, 8000)
    return () => { cancelled = true; clearInterval(id) }
  }, [role])

  const navigate = useCallback((id, replace = false) => { setScreenRaw(id); setStack(s => replace ? [...s.slice(0, -1), id] : [...s, id]) }, [])
  const goBack = useCallback(() => { setStack(s => { if (s.length <= 1) return s; const next = s.slice(0, -1); setScreenRaw(next[next.length - 1]); return next }) }, [])

  const refreshMe = useCallback(async () => { try { const me = await api.me(); setUser(me.user); setMeExtra(stripUser(me)) } catch {} }, [])

  const completeLogin = useCallback(async (token, u) => {
    setToken(token); setUser(u); setRole(u.role)
    try { const me = await api.me(); setMeExtra(stripUser(me)) } catch {}
    setScreenRaw('home'); setStack(['home'])
  }, [])

  const signOut = useCallback(() => {
    signingOut.current = true
    clearToken(); localStorage.removeItem(SESSION_KEY)
    setUser(null); setRole(null); setMeExtra(null); setCanvas(null); setNotifications([])
    setScreenRaw('splash'); setStack(['splash'])
    setTimeout(() => { signingOut.current = false }, 100)
  }, [])

  const switchRole = useCallback(async (targetRole) => {
    const demo = getDemoUser(targetRole)
    if (!demo) return false
    if (targetRole === role) return true
    try {
      const r = await api.roleLogin(demo.loginId, DEMO_PASSWORD)
      if (!r?.token || !r?.user) throw new Error('bad login response')
      setCanvas(null); setNotifications([]); setMeExtra(null)
      setToken(r.token); setUser(r.user); setRole(r.user.role)
      try { const me = await api.me(); setMeExtra(stripUser(me)) } catch {}
      setScreenRaw('home'); setStack(['home'])
      return true
    } catch (e) { console.error('[switchRole]', e?.message || e); return false }
  }, [role])

  const openCanvas = useCallback((ctx) => setCanvas(ctx), [])
  const closeCanvas = useCallback(() => setCanvas(null), [])
  const updateCanvas = useCallback((patch) => setCanvas(c => c ? { ...c, ...patch } : c), [])

  const refreshThreads = useCallback(async () => { try { const r = await api.listThreads(); setThreads(r.threads || []) } catch {} }, [])
  useEffect(() => { if (!role) { setThreads([]); return } refreshThreads() }, [role, refreshThreads])
  const newChat = useCallback(() => { setCanvas(null); refreshThreads() }, [refreshThreads])
  const openThread = useCallback((thread) => {
    if (!thread?.id) return
    let about = null
    try { about = JSON.parse(thread.canvasState || '{}').about || null } catch {}
    setCanvas({ type: PERSONA_TO_CANVAS[thread.bot] || thread.bot || 'saathi_assistant', threadId: thread.id, about })
  }, [])
  // Start a Saathi thread about a screen. `about` = { canvasType, title,
  // subtitle, context, quickAsks }; `prompt` is sent as the first message.
  // The screen the user came from is kept so Back returns to it.
  const askSaathi = useCallback(({ about, prompt } = {}) => {
    setCanvas(c => ({ type: 'saathi_assistant', about: about || null, from: c && c.type !== 'saathi_assistant' ? c : (c?.from || null), pendingPrompt: prompt ? { text: prompt, nonce: Date.now() } : undefined }))
  }, [])

  const showToast = useCallback((t) => { setToast(t); setTimeout(() => setToast(null), 3000) }, [])

  const value = useMemo(() => ({
    screen, stack, navigate, goBack, role, user, meExtra, lang, setLang, isAuthenticated: !!role,
    completeLogin, signOut, switchRole, refreshMe,
    canvas, openCanvas, closeCanvas, updateCanvas, toast, showToast,
    notifications, refreshNotifications: async () => { try { const r = await api.notifications(); setNotifications(r.notifications || []) } catch {} },
    threads, refreshThreads, newChat, openThread, askSaathi,
  }), [screen, stack, navigate, goBack, role, user, meExtra, lang, canvas, toast, notifications, threads, completeLogin, signOut, switchRole, refreshMe, openCanvas, closeCanvas, updateCanvas, showToast, refreshThreads, newChat, openThread, askSaathi])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

function stripUser(me) { const { user, ...rest } = me; return rest }
