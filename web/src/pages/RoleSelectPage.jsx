// Role picker — who are you in the cluster? Eight personas across the three layers.
import { useApp } from '../context/AppContext.jsx'
import { ChevronLeft, Info } from 'lucide-react'
import GovBadge from '../components/GovBadge.jsx'
import Logo from '../components/Logo.jsx'
import { ROLE_LABELS, ROLE_SCOPES } from '../roles/roleConfig.js'
import { DEMO_USERS } from '../roles/demoUsers.js'

const GROUPS = [
  { title: 'Administration stack', subtitle: 'SPV compliance · cluster operations · verification', roles: ['spv_ceo', 'iti_principal', 'ima_officer', 'state_pmu', 'employer'] },
  { title: 'Learning stack', subtitle: 'CMS for curriculum · mobile LMS + companion', roles: ['curriculum_dev', 'trainer', 'trainee'] },
]
const ICON = { spv_ceo: '🏗️', iti_principal: '🏫', trainer: '👨‍🏫', trainee: '🧑‍🎓', ima_officer: '🛡️', employer: '🏭', curriculum_dev: '🧱', state_pmu: '🗺️' }
const DESC = {
  spv_ceo: 'Track the transformation: SIP, tranche readiness, civil, procurement, escrow, IMA evidence, board.',
  iti_principal: 'Run one ITI: seats, attendance, trainers, machines, OJT, placements, grievances.',
  trainer: 'Mark attendance, teach the 240-hour module, record practical assessments.',
  trainee: 'Learn, log OJT, confirm placement, check in from the job. Mobile-first, Indic.',
  ima_officer: 'Verify milestones and KPIs, review reports, certify tranche conditions.',
  employer: 'Host OJT, confirm hires with salary evidence, post openings.',
  curriculum_dev: 'Build modules and lessons; move courses through CSTARI and NCVET.',
  state_pmu: 'Compare clusters, approve AOPs, prepare the MSDE scorecard.',
}

export default function RoleSelectPage() {
  const { navigate, goBack } = useApp()
  function pick(role) {
    sessionStorage.setItem('pmsetu.roleMap', role)
    sessionStorage.setItem('pmsetu.roleLabel', ROLE_LABELS[role])
    navigate('role_signin')
  }
  return (
    <div className="min-h-screen flex flex-col bg-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      <div className="bg-white border-b border-bdr-light px-6 py-3 flex items-center gap-3">
        <button onClick={goBack} className="p-1.5 rounded hover:bg-slate-100" aria-label="Back"><ChevronLeft className="w-5 h-5 text-txt-secondary" /></button>
        <Logo size={32} showText />
        <div className="ml-auto"><GovBadge size={40} /></div>
      </div>
      <div className="max-w-6xl w-full mx-auto px-6 pt-8 pb-4">
        <div className="text-[12px] font-bold uppercase tracking-wider text-primary">Delhi ITI Cluster · Pusa hub + Shahdara, Narela, Rohini, Okhla</div>
        <h1 className="text-[28px] md:text-[34px] font-bold text-txt-primary mt-1 leading-tight">Who are you <span className="text-primary">in the cluster?</span></h1>
        <p className="text-[14px] text-txt-secondary mt-1.5 max-w-2xl">One platform, eight personas. Each sees only its layer of the cluster. Demo accounts are pre-filled on the next screen.</p>
      </div>
      <div className="flex-1 max-w-6xl w-full mx-auto px-6 pb-10 space-y-8">
        {GROUPS.map(g => (
          <section key={g.title}>
            <div className="mb-3"><div className="text-[13px] font-bold text-txt-primary">{g.title}</div><div className="text-[12px] text-txt-secondary">{g.subtitle}</div></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {g.roles.map(r => (
                <button key={r} onClick={() => pick(r)} className="text-left rounded-2xl border-2 border-[#E8EDF5] hover:border-primary bg-white p-4 transition-all active:scale-[0.98] hover:shadow-card flex flex-col gap-2" style={{ minHeight: 170 }}>
                  <div className="w-11 h-11 rounded-2xl bg-primary-light flex items-center justify-center text-[22px]">{ICON[r]}</div>
                  <div className="font-bold text-[15px] text-txt-primary leading-tight">{ROLE_LABELS[r]}</div>
                  <div className="text-[11px] text-txt-secondary leading-snug">{DESC[r]}</div>
                  <div className="mt-auto text-[11px] font-semibold text-primary">{DEMO_USERS[r]?.name} · {ROLE_SCOPES[r]} →</div>
                </button>
              ))}
            </div>
          </section>
        ))}
        <div className="rounded-2xl border border-bdr-light bg-[#F4F6FA] px-4 py-3 text-[12px] text-txt-secondary flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
          <div><b className="text-txt-primary">Students and instructors</b> can also sign in with phone OTP (any registry phone, OTP 1234). <button onClick={() => navigate('login')} className="text-primary font-bold ml-1">← Back to login options</button></div>
        </div>
      </div>
      <div className="text-center py-3 text-[11px] text-txt-tertiary border-t border-bdr-light">PM-SETU Saathi · prototype · ConveGenius technical-partner stack</div>
    </div>
  )
}
