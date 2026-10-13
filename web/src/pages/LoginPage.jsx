// Login — 3-slide carousel + two entry points: role sign-in or phone OTP.
import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import Logo from '../components/Logo.jsx'
import GovBadge from '../components/GovBadge.jsx'
import PoweredBy from '../components/PoweredBy.jsx'

const SLIDES = [
  { id: 0, headline: 'Built for', bold: '200 Hub-and-Spoke ITI clusters under PM-SETU', visual: 'cluster' },
  { id: 1, headline: 'Proves', bold: 'utilisation, KPIs and milestones the IMA can verify', visual: 'shield' },
  { id: 2, headline: 'Serves', bold: 'SPV · Principal · Instructor · Trainee · Industry · IMA · State', visual: 'people' },
]

function SlideVisual({ type }) {
  if (type === 'shield') {
    return (
      <div className="relative flex items-center justify-center w-full h-full">
        <div className="absolute w-[220px] h-[220px] rounded-full bg-primary opacity-10" />
        <svg width="150" height="180" viewBox="0 0 150 180" xmlns="http://www.w3.org/2000/svg" className="relative z-10">
          <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5B89FF" /><stop offset="100%" stopColor="#2755E3" /></linearGradient></defs>
          <path d="M75 4 L138 26 V92 C138 130 113 162 75 176 C37 162 12 130 12 92 V26 L75 4 Z" fill="url(#sg)" stroke="#fff" strokeWidth="2" />
          <path d="M50 90 L68 108 L102 70" stroke="#fff" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    )
  }
  if (type === 'people') {
    return (
      <div className="relative flex items-center justify-center w-full h-full">
        <div className="grid grid-cols-4 gap-3 text-[34px]">
          {['🏗️', '🏫', '👨‍🏫', '🧑‍🎓', '🛡️', '🏭', '📚', '🗺️'].map((e, i) => (
            <div key={i} className="w-14 h-14 rounded-2xl bg-white shadow-card flex items-center justify-center">{e}</div>
          ))}
        </div>
      </div>
    )
  }
  // cluster: hub + 4 spokes
  return (
    <div className="relative flex items-center justify-center w-full h-full">
      <svg width="260" height="220" viewBox="0 0 260 220" xmlns="http://www.w3.org/2000/svg">
        {[[40, 50], [220, 50], [40, 170], [220, 170]].map(([x, y], i) => (
          <g key={i}>
            <line x1="130" y1="110" x2={x} y2={y} stroke="#C5CBDC" strokeWidth="3" strokeDasharray="6 6" />
            <rect x={x - 26} y={y - 20} width="52" height="40" rx="10" fill="#EEF2FF" stroke="#386AF6" strokeWidth="2" />
            <text x={x} y={y + 5} textAnchor="middle" fontSize="11" fontWeight="700" fill="#2755E3" fontFamily="Montserrat">Spoke</text>
          </g>
        ))}
        <rect x="92" y="82" width="76" height="56" rx="14" fill="#386AF6" />
        <text x="130" y="106" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" fontFamily="Montserrat">HUB ITI</text>
        <text x="130" y="122" textAnchor="middle" fontSize="9" fontWeight="600" fill="#DCE6FF" fontFamily="Montserrat">₹81 Cr · SPV</text>
      </svg>
    </div>
  )
}

function Dots({ slide, total }) {
  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: total }).map((_, i) => <div key={i} className="transition-all duration-300 rounded-full" style={{ width: i === slide.id ? 24 : 8, height: 8, background: i === slide.id ? '#386AF6' : '#C5CBDC' }} />)}
    </div>
  )
}

function LoginPanel({ navigate }) {
  return (
    <div className="flex flex-col bg-white px-8 md:px-10 pt-8 pb-6 gap-4">
      <div className="mb-2">
        <p className="text-[15px] text-txt-secondary">Namaste! Welcome to</p>
        <h1 className="text-[32px] font-bold text-txt-primary leading-tight">PM-SETU Saathi</h1>
        <p className="text-[12px] text-txt-secondary mt-1">The cluster platform for Anchor Industry Partners, ITIs and trainees.</p>
      </div>
      <button onClick={() => navigate('role_select')} className="w-full bg-primary text-white font-bold text-[15px] py-3.5 rounded-pill shadow-modal active:opacity-80 transition-opacity">
        Sign in by role (SPV · ITI · IMA · Industry)
      </button>
      <div className="flex items-center gap-3"><div className="flex-1 h-px bg-bdr" /><span className="text-[11px] font-semibold text-txt-tertiary">or</span><div className="flex-1 h-px bg-bdr" /></div>
      <button onClick={() => navigate('phone_entry')} className="w-full border-[1.5px] border-primary text-primary font-semibold text-[14px] h-12 rounded-pill bg-white active:bg-primary-light transition-colors">
        Continue with Phone Number (trainee / instructor)
      </button>
      <p className="text-center text-[11px] text-txt-tertiary mt-1 leading-relaxed">By continuing, I agree to the <span className="text-primary cursor-pointer">Terms of Service</span> and <span className="text-primary cursor-pointer">DPDP-A Policy</span></p>
      <div className="mt-3 pt-4 border-t border-bdr-light flex items-center justify-center"><PoweredBy size={20} /></div>
    </div>
  )
}

export default function LoginPage() {
  const { navigate } = useApp()
  const [slideIdx, setSlideIdx] = useState(0)
  const advance = useCallback(() => setSlideIdx(i => (i + 1) % SLIDES.length), [])
  useEffect(() => { const t = setInterval(advance, 3500); return () => clearInterval(t) }, [advance])
  const slide = SLIDES[slideIdx]
  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      <div className="hidden md:flex flex-col h-screen overflow-hidden relative" style={{ background: '#F4F6FA', flex: '1 1 0' }}>
        <div className="p-8 flex items-center justify-between gap-4 relative z-10"><Logo size={40} showText /><GovBadge size={64} /></div>
        <div className="flex-1 flex items-center justify-center px-10 z-10 overflow-hidden"><div className="w-[min(340px,60%)] aspect-square relative"><SlideVisual type={slide.visual} /></div></div>
        <div className="px-10 z-10 text-center pb-10">
          <p className="text-[13px] font-semibold text-txt-secondary uppercase tracking-wider">{slide.headline}</p>
          <p className="text-[18px] font-bold text-txt-primary mt-1.5 leading-snug max-w-[460px] mx-auto">{slide.bold}</p>
          <div className="mt-4"><Dots slide={slide} total={SLIDES.length} /></div>
        </div>
      </div>
      <div className="md:hidden flex-1 flex flex-col overflow-hidden min-h-screen">
        <div className="relative flex-1 overflow-hidden" style={{ background: '#F4F6FA' }}>
          <div className="absolute top-6 left-5 z-10"><Logo size={36} /></div>
          <div className="absolute top-8 right-5 text-right z-10 pointer-events-none" style={{ maxWidth: 190 }}>
            <p className="text-[12px] font-medium text-txt-secondary leading-snug">{slide.headline}</p>
            <p className="text-[13px] font-bold text-txt-secondary leading-snug mt-0.5">{slide.bold}</p>
          </div>
          <SlideVisual type={slide.visual} />
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2"><Dots slide={slide} total={SLIDES.length} /></div>
        </div>
        <div className="rounded-t-3xl" style={{ boxShadow: '0 -4px 24px rgba(56,106,246,0.10)' }}><LoginPanel navigate={navigate} /></div>
      </div>
      <div className="hidden md:flex flex-col justify-center flex-shrink-0" style={{ width: 'clamp(360px, 40%, 480px)', background: '#fff', borderLeft: '1px solid #E8EDF5' }}>
        <LoginPanel navigate={navigate} />
      </div>
    </div>
  )
}
