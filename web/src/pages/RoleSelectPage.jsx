// Role picker — choose how you sign in.
import { useApp } from '../context/AppContext.jsx'
import { ChevronLeft, Info } from 'lucide-react'
import GovBadge from '../components/GovBadge.jsx'
import Logo from '../components/Logo.jsx'
import { ROLE_LABELS, ROLE_SCOPES } from '../roles/roleConfig.js'

const GROUPS = [
  { title: 'Cluster and institute', subtitle: 'Planning, operations, verification and industry', roles: ['spv_ceo', 'iti_principal', 'ima_officer', 'state_pmu', 'employer'] },
  { title: 'Teaching and learning', subtitle: 'Curriculum, instructors and students', roles: ['curriculum_dev', 'trainer', 'trainee'] },
]
const ICON = { spv_ceo: '🏗️', iti_principal: '🏫', trainer: '👨‍🏫', trainee: '🧑‍🎓', ima_officer: '🛡️', employer: '🏭', curriculum_dev: '🧱', state_pmu: '🗺️' }
const DESC = {
  spv_ceo: 'Plan the five years, run the cluster, and prove it: annual plan, milestones, tranche readiness, placements.',
  iti_principal: 'Run your institute: today\'s coverage, attendance and marks review, profile, tasks, student voice, placements.',
  trainer: 'Your day: sessions, attendance, marks, practicals, students who need support.',
  trainee: 'Your course, your plan, help from your institute, opportunities and applications.',
  ima_officer: 'Verify milestones and KPIs, review reports, sample placements, certify tranche conditions.',
  employer: 'Post opportunities, host OJT and apprentices, confirm interviews and joiners.',
  curriculum_dev: 'Build modules and lessons; move programmes through CSTARI and NCVET.',
  state_pmu: 'Compare clusters, approve annual plans, prepare the state scorecard.',
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
        <h1 className="text-[28px] md:text-[34px] font-bold text-txt-primary mt-1 leading-tight">Sign in <span className="text-primary">to your role</span></h1>
        <p className="text-[14px] text-txt-secondary mt-1.5 max-w-2xl">Choose your role to continue.</p>
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
                  <div className="mt-auto text-[11px] font-semibold text-primary">{ROLE_SCOPES[r]} →</div>
                </button>
              ))}
            </div>
          </section>
        ))}
        <div className="rounded-2xl border border-bdr-light bg-[#F4F6FA] px-4 py-3 text-[12px] text-txt-secondary flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
          <div><b className="text-txt-primary">Students and instructors</b> can also sign in with their registered phone number. <button onClick={() => navigate('login')} className="text-primary font-bold ml-1">← Back to sign-in options</button></div>
        </div>
      </div>
      <div className="text-center py-3 text-[11px] text-txt-tertiary border-t border-bdr-light">PM-SETU Saathi · Technology partner ConveGenius</div>
    </div>
  )
}
