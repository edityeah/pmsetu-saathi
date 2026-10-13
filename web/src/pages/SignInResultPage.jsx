// Sign-in result — success completes the login; failure offers a retry.
import { useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { CheckCircle2, XCircle } from 'lucide-react'
import Logo from '../components/Logo.jsx'

export default function SignInResultPage({ ok }) {
  const { navigate, completeLogin } = useApp()
  useEffect(() => {
    if (!ok) return
    const token = sessionStorage.getItem('pmsetu.signin.token')
    const userStr = sessionStorage.getItem('pmsetu.signin.user')
    const t = setTimeout(() => {
      try { if (token && userStr) completeLogin(token, JSON.parse(userStr)); else navigate('login', true) } catch { navigate('login', true) }
      sessionStorage.removeItem('pmsetu.signin.token'); sessionStorage.removeItem('pmsetu.signin.user')
    }, 700)
    return () => clearTimeout(t)
  }, [ok])
  return (
    <div className="min-h-screen bg-[#F4F6FA] flex flex-col" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      <div className="bg-white border-b border-bdr-light px-6 py-3"><Logo size={32} showText /></div>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className={`bg-white rounded-card shadow-card w-full max-w-md border-t-4 ${ok ? 'border-ok' : 'border-danger'} p-8 text-center`}>
          {ok ? <CheckCircle2 className="w-12 h-12 text-ok mx-auto" /> : <XCircle className="w-12 h-12 text-danger mx-auto" />}
          <div className="text-[18px] font-bold mt-3">{ok ? 'Signed in' : 'Sign-in failed'}</div>
          <div className="text-[13px] text-txt-secondary mt-1">{ok ? 'Opening PM-SETU Saathi…' : 'We could not verify those credentials.'}</div>
          {!ok && <button onClick={() => navigate('role_signin', true)} className="mt-5 px-5 py-2.5 rounded-pill bg-primary text-white font-bold text-[13px]">Try again</button>}
        </div>
      </div>
    </div>
  )
}
