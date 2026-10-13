// Splash — language picker. Indic-first: Hindi leads for the Delhi cluster.
import { useState } from 'react'
import { Check } from 'lucide-react'
import { useApp } from '../context/AppContext.jsx'
import PoweredBy from '../components/PoweredBy.jsx'
import Logo from '../components/Logo.jsx'

const LANGS = [
  { code: 'hi', native: 'हिन्दी',   english: 'Hindi' },
  { code: 'en', native: 'English', english: 'English' },
  { code: 'pa', native: 'ਪੰਜਾਬੀ',  english: 'Punjabi' },
  { code: 'ur', native: 'اردو',    english: 'Urdu' },
  { code: 'mr', native: 'मराठी',   english: 'Marathi' },
  { code: 'te', native: 'తెలుగు',  english: 'Telugu' },
  { code: 'ta', native: 'தமிழ்',   english: 'Tamil' },
  { code: 'bn', native: 'বাংলা',   english: 'Bengali' },
  { code: 'or', native: 'ଓଡ଼ିଆ',   english: 'Odia' },
]

export default function SplashPage() {
  const { navigate, lang, setLang, isAuthenticated } = useApp()
  const [selected, setSelected] = useState(lang || 'en')
  const handleContinue = () => { setLang(selected); navigate(isAuthenticated ? 'home' : 'login') }
  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      <div className="w-full max-w-[480px] mx-auto h-full flex flex-col justify-evenly px-5 py-4">
        <div className="flex flex-col items-center text-center flex-shrink-0">
          <Logo size={110} />
          <div className="text-[12px] font-bold uppercase tracking-[3px] text-primary mt-5">PM-SETU Saathi</div>
          <h1 className="text-[24px] font-bold text-txt-primary leading-tight mt-1">Choose your language</h1>
          <p className="text-[13px] text-txt-secondary mt-1">Saathi speaks to students, instructors and the SPV in this language.</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 w-full max-w-[400px] mx-auto flex-shrink-0">
          {LANGS.map(l => {
            const active = selected === l.code
            return (
              <button key={l.code} onClick={() => setSelected(l.code)}
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 py-3 px-2 transition-all active:scale-[0.97] ${active ? 'bg-ok-light border-ok' : 'bg-white border-bdr hover:border-primary'}`}>
                {active && <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-ok flex items-center justify-center"><Check size={10} color="#fff" strokeWidth={3} /></span>}
                <span className={`text-[16px] font-bold leading-tight ${active ? 'text-ok' : 'text-txt-primary'}`} style={{ fontFamily: 'Noto Sans, sans-serif' }}>{l.native}</span>
                {l.code !== 'en' && <span className="text-[10px] text-txt-tertiary leading-tight mt-0.5">{l.english}</span>}
              </button>
            )
          })}
        </div>
        <div className="w-full max-w-[400px] mx-auto flex flex-col items-center gap-3 flex-shrink-0">
          <button onClick={handleContinue} className="w-full bg-primary text-white font-bold text-[16px] py-3.5 rounded-pill shadow-modal active:opacity-80 transition-opacity">Continue</button>
          <PoweredBy size={24} />
        </div>
      </div>
    </div>
  )
}
