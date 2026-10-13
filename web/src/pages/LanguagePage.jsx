import { useApp } from '../context/AppContext.jsx'

const LANGS = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'or', label: 'Odia', native: 'ଓଡ଼ିଆ' },
]

export default function LanguagePage() {
  const { setLang, navigate } = useApp()
  function pick(code) { setLang(code); navigate('login') }
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="tricolor-strip" />
      <div className="p-6 pt-10">
        <div className="text-xs text-txt-secondary uppercase tracking-wider">Step 1 of 2</div>
        <h1 className="text-2xl font-semibold mt-2">Choose your language</h1>
        <p className="text-sm text-txt-secondary mt-1">Saathi will speak to you in this language.</p>
      </div>
      <div className="flex-1 grid grid-cols-2 gap-3 px-6 pb-8 content-start">
        {LANGS.map(l => (
          <button key={l.code} onClick={() => pick(l.code)}
            className="rounded-card border border-bdr-light p-4 text-left hover:border-primary hover:shadow-card transition">
            <div className="text-lg font-medium">{l.native}</div>
            <div className="text-xs text-txt-secondary mt-0.5">{l.label}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
