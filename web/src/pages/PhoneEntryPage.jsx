// KSK Phone Entry — mobile single-column + desktop split.
// desktop split with illustration). Retargeted copy + KSK demo accounts list.

import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { api } from '../api/client.js'
import GovBadge from '../components/GovBadge.jsx'

export default function PhoneEntryPage() {
  const { navigate, goBack, showToast } = useApp()
  const [phone, setPhone] = useState('')
  const [busy, setBusy]   = useState(false)
  const [demoUsers, setDemoUsers] = useState([])

  useEffect(() => { api.demoUsers().then(r => setDemoUsers(r.users || [])).catch(() => {}) }, [])

  const onChange = e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 8))
  const canProceed = phone.length === 10

  async function submit() {
    if (!canProceed) return
    setBusy(true)
    try {
      const r = await api.requestPhoneOtp(phone)
      sessionStorage.setItem('pmsetu.pendingPhone', phone)
      sessionStorage.setItem('pmsetu.pendingRole', r.role || '')
      navigate('phone_otp')
    } catch (e) {
      showToast({ kind: 'danger', text: e.payload?.error === 'phone_not_registered' ? 'Phone not registered. Try a demo account below.' : 'Could not send OTP.' })
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden bg-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {/* Desktop left illustration */}
      <div className="hidden md:flex flex-col items-center justify-center overflow-hidden"
        style={{ flex: '1 1 0', background: 'linear-gradient(135deg, #EEF3FF 0%, #F5F0FF 100%)' }}>
        <div className="relative flex flex-col items-center justify-center gap-6 px-10 text-center w-full h-full">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full" style={{ background: 'rgba(56,106,246,0.07)', transform: 'translate(30%,-30%)' }} />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full" style={{ background: 'rgba(124,58,237,0.06)', transform: 'translate(-30%,30%)' }} />
          <div className="text-[120px] leading-none">👋</div>
          <div>
            <h3 className="text-[18px] font-bold text-txt-primary mb-1">Stay Connected</h3>
            <p className="text-[13px] text-txt-secondary max-w-[260px] leading-relaxed mx-auto">
              Trainees, instructors, principals, industry — the whole cluster on one platform.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Pill icon="🏛️" text="Govt. Approved" />
            <Pill icon="🔒" text="Secure OTP" />
            <Pill icon="🪪" text="DPDP-A" />
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 md:flex-none flex flex-col overflow-y-auto bg-white" style={{ width: '100%' }}>
        {/* Mobile */}
        <div className="md:hidden w-full flex flex-col">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <button onClick={goBack} className="inline-flex items-center gap-1 text-[13px] font-semibold text-txt-secondary hover:text-txt-primary px-2 py-1 rounded-lg hover:bg-slate-100">
              ‹ Back
            </button>
            <div className='flex items-center gap-3'><GovBadge size={22} showText={false} /></div>
          </div>
          <FormBody phone={phone} onChange={onChange} canProceed={canProceed} submit={submit} busy={busy} goBack={goBack} demoUsers={demoUsers} onPickDemo={setPhone} />
          <div className="flex justify-center pb-6 px-6 text-[100px]">📱</div>
        </div>
        {/* Desktop */}
        <div className="hidden md:flex flex-col justify-center h-full"
          style={{ width: 'clamp(340px, 38%, 460px)', marginLeft: 'auto', marginRight: 'auto', padding: '0 32px' }}>
          <div className="mb-8 flex items-center justify-between">
            <button onClick={goBack} className="inline-flex items-center gap-1 text-[13px] font-semibold text-txt-secondary hover:text-txt-primary px-2 py-1 rounded-lg hover:bg-slate-100">
              ‹ Back
            </button>
            <div className='flex items-center gap-3'><GovBadge size={24} showText={false} /></div>
          </div>
          <FormBody phone={phone} onChange={onChange} canProceed={canProceed} submit={submit} busy={busy} goBack={goBack} demoUsers={demoUsers} onPickDemo={setPhone} />
        </div>
      </div>
    </div>
  )
}

function Pill({ icon, text }) {
  return (
    <div className="flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 shadow-sm">
      <span className="text-[14px]">{icon}</span>
      <span className="text-[11px] font-semibold text-txt-secondary">{text}</span>
    </div>
  )
}

function FormBody({ phone, onChange, canProceed, submit, busy, goBack, demoUsers, onPickDemo }) {
  return (
    <div className="px-6 pb-6">
      <div className="mb-8">
        <h1 className="text-[28px] font-bold text-txt-primary leading-tight mb-2">
          Namaste!<br />
          <span style={{ color: '#386AF6' }}>Welcome to PM-SETU Saathi</span>
        </h1>
        <p className="text-[14px] text-txt-secondary leading-relaxed">
          Please enter your phone number. We'll send you an OTP so we know you're real.
        </p>
      </div>

      <div className="mb-6">
        <label className="text-[12px] font-semibold text-txt-secondary uppercase tracking-[0.5px] mb-2 block">Mobile Number</label>
        <div className="flex items-center rounded-2xl border-[1.5px] overflow-hidden transition-colors"
          style={{ borderColor: phone.length > 0 ? '#386AF6' : '#E2E8F0' }}>
          <div className="flex items-center gap-1.5 px-4 py-3.5 border-r border-[#E2E8F0] bg-[#F8FAFC] flex-shrink-0">
            <span className="text-[18px]">🇮🇳</span>
            <span className="text-[14px] font-bold text-txt-primary">+91</span>
            <span className="text-[10px] text-txt-tertiary">▾</span>
          </div>
          <input type="tel" inputMode="numeric" value={phone} onChange={onChange} placeholder="98765 43210"
            className="flex-1 px-4 py-3.5 text-[16px] font-semibold text-txt-primary bg-white outline-none" />
          {phone.length === 10 && (
            <div className="px-3">
              <div className="w-5 h-5 rounded-full bg-ok flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
          )}
        </div>
        <p className="text-[11px] text-txt-tertiary mt-2">
          By continuing, I agree to the <span className="text-primary cursor-pointer font-medium">Terms of Service</span> and <span className="text-primary cursor-pointer font-medium">DPDP-A Policy</span>
        </p>
      </div>

      <button onClick={submit} disabled={!canProceed || busy}
        className="w-full py-4 rounded-2xl font-bold text-[16px] text-white transition-all disabled:opacity-40 disabled:pointer-events-none"
        style={{
          background: canProceed ? 'linear-gradient(135deg, #386AF6 0%, #5B85F8 100%)' : '#CBD5E1',
          boxShadow: canProceed ? '0 4px 16px rgba(56,106,246,0.35)' : 'none',
        }}>
        {busy ? 'Sending…' : 'Send OTP'}
      </button>

      <button onClick={goBack} className="mt-4 text-[13px] text-txt-secondary text-center w-full">← Back to login options</button>

      {demoUsers.length > 0 && (
        <div className="mt-6">
          <div className="text-[11px] font-semibold text-txt-tertiary uppercase tracking-wider mb-2">Demo accounts</div>
          <div className="grid grid-cols-2 gap-1.5">
            {demoUsers.filter(u => u.phone).slice(0, 8).map(u => (
              <button key={u.id} onClick={() => onPickDemo(u.phone)}
                className="text-left px-2.5 py-1.5 rounded-lg bg-[#F8FAFC] hover:bg-primary-light border border-bdr-light">
                <div className="text-[11px] font-semibold text-txt-primary truncate">{u.role.replace(/_/g, ' ')}</div>
                <div className="text-[10px] text-txt-secondary truncate">{u.name}</div>
              </button>
            ))}
          </div>
          <div className="text-[10px] text-txt-tertiary text-center mt-2">Demo OTP is <span className="font-mono font-bold">1234</span></div>
        </div>
      )}
    </div>
  )
}
