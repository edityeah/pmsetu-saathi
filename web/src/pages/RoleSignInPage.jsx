// Role sign-in — plain cluster sign-in (ID + password). Demo credentials prefilled per role.
import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { api } from '../api/client.js'
import { ShieldCheck, ChevronLeft } from 'lucide-react'
import GovBadge from '../components/GovBadge.jsx'
import Logo from '../components/Logo.jsx'
import { DEMO_USERS, DEMO_PASSWORD } from '../roles/demoUsers.js'

export default function RoleSignInPage() {
  const { navigate, goBack, showToast, completeLogin } = useApp()
  const roleMap = sessionStorage.getItem('pmsetu.roleMap') || 'spv_ceo'
  const roleLabel = sessionStorage.getItem('pmsetu.roleLabel') || 'SPV CEO'
  const demo = DEMO_USERS[roleMap] || DEMO_USERS.spv_ceo
  const [loginId, setLoginId] = useState(demo.loginId)
  const [password, setPassword] = useState(DEMO_PASSWORD)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e?.preventDefault?.()
    if (!loginId || !password) { showToast({ kind: 'warn', text: 'Enter ID and password' }); return }
    setBusy(true)
    try {
      const r = await api.roleLogin(loginId, password)
      sessionStorage.setItem('pmsetu.signin.token', r.token)
      sessionStorage.setItem('pmsetu.signin.user', JSON.stringify(r.user))
      navigate('signin_success', true)
    } catch { showToast({ kind: 'danger', text: 'Invalid credentials' }); navigate('signin_fail', true) }
    finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-[#F4F6FA] flex flex-col" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      <div className="bg-white border-b border-bdr-light px-6 py-3 flex items-center gap-3">
        <button onClick={goBack} className="p-1.5 rounded hover:bg-slate-100" aria-label="Back"><ChevronLeft className="w-5 h-5 text-txt-secondary" /></button>
        <Logo size={32} showText />
        <div className="ml-auto"><GovBadge size={34} /></div>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <form onSubmit={submit} className="bg-white rounded-card shadow-card w-full max-w-md border border-bdr-light">
          <div className="px-6 py-5 border-b border-bdr-light flex items-center justify-between gap-2">
            <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary-dark" /><div className="font-semibold">Cluster sign-in</div></div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-pill bg-primary-light text-primary">{roleLabel}</span>
          </div>
          <div className="p-6 space-y-3">
            <div className="text-[12px] text-txt-secondary">Delhi ITI Cluster CL-DL-01 · {demo.contextLabel}</div>
            <div><label className="block text-xs font-medium text-txt-secondary mb-1">User ID</label>
              <input value={loginId} onChange={e => setLoginId(e.target.value.toUpperCase())} className="w-full px-3 py-2 border border-bdr-light rounded outline-none focus:border-primary" /></div>
            <div><label className="block text-xs font-medium text-txt-secondary mb-1">Password</label>
              <input value={password} onChange={e => setPassword(e.target.value)} type="password" className="w-full px-3 py-2 border border-bdr-light rounded outline-none focus:border-primary" /></div>
            <button type="submit" disabled={busy} className="w-full py-2.5 rounded bg-primary text-white font-medium hover:bg-primary-dark">{busy ? 'Signing in…' : `Sign in as ${demo.name}`}</button>
            <div className="text-[11px] text-txt-tertiary text-center">Demo password <span className="font-mono font-bold">{DEMO_PASSWORD}</span></div>
            <button type="button" onClick={goBack} className="w-full py-1 text-xs text-txt-secondary hover:text-txt-primary">← Change role</button>
          </div>
        </form>
      </div>
    </div>
  )
}
