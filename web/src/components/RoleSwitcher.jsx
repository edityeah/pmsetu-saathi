// RoleSwitcher — dropdown that lets a logged-in user hot-swap to any other
// role using the seeded demo credentials in roles/demoUsers.js. Used inside
// both TopBar (desktop) and ProfilePill (mobile-frame home) so the same
// list of roles is reachable from either layout.
//
// Demo-only affordance. In production this should be gated by a feature
// flag — real users never see "switch to a different role" buttons.

import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { ROLE_LABELS, ROLE_SCOPES } from '../roles/roleConfig.js'
import { DEMO_USERS, DEMO_USER_ORDER } from '../roles/demoUsers.js'
import { LogOut, Loader2 } from 'lucide-react'

// Per-role avatar styling — a coloured initial bubble similar to the
// reference screenshot the user shared. Keeps the dropdown scannable when
// a row's text is truncated.
const ROLE_AVATAR_TONE = {
  spv_ceo:        { bg: 'bg-indigo-100',  text: 'text-indigo-700' },
  iti_principal:  { bg: 'bg-violet-100',  text: 'text-violet-700' },
  trainer:        { bg: 'bg-amber-100',   text: 'text-amber-700' },
  trainee:        { bg: 'bg-sky-100',     text: 'text-sky-700' },
  ima_officer:    { bg: 'bg-rose-100',    text: 'text-rose-700' },
  employer:       { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  curriculum_dev: { bg: 'bg-teal-100',    text: 'text-teal-700' },
  state_pmu:      { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700' },
}

function initial(name) {
  return (name || '?').split(' ').map(s => s[0]).filter(Boolean).slice(0, 1).join('').toUpperCase()
}

export default function RoleSwitcher({ onClose }) {
  const { role, switchRole, signOut, showToast } = useApp()
  const [switching, setSwitching] = useState(null)   // the role currently being switched to

  async function pickRole(targetRole) {
    if (targetRole === role) { onClose?.(); return }
    setSwitching(targetRole)
    const ok = await switchRole(targetRole)
    setSwitching(null)
    if (!ok) {
      showToast?.({ kind: 'danger', text: `Couldn't switch to ${ROLE_LABELS[targetRole]} — check seeded user.` })
      return
    }
    onClose?.()
  }

  return (
    <div className="bg-white rounded-2xl shadow-modal border border-bdr-light p-1.5 min-w-[280px]" style={{ fontFamily: 'inherit' }}>
      <div className="px-3 py-2 text-[10px] uppercase tracking-[2px] font-bold text-txt-tertiary border-b border-bdr-light">
        Switch user
      </div>
      <div className="py-1">
        {DEMO_USER_ORDER.map((r) => {
          const demo = DEMO_USERS[r]
          if (!demo) return null
          const active = r === role
          const isSwitchingHere = switching === r
          const tone = ROLE_AVATAR_TONE[r] || { bg: 'bg-slate-100', text: 'text-slate-700' }
          return (
            <button
              key={r}
              onClick={() => pickRole(r)}
              disabled={!!switching}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition ${
                active ? 'bg-primary-light/40' : 'hover:bg-surface-page'
              } disabled:opacity-60 disabled:cursor-wait`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0 ${tone.bg} ${tone.text}`}>
                {initial(demo.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-txt-primary leading-tight">{ROLE_LABELS[r]}</div>
                <div className="text-[11px] text-txt-secondary truncate">{demo.contextLabel || ROLE_SCOPES[r]}</div>
              </div>
              {isSwitchingHere && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary flex-shrink-0" />}
              {active && !isSwitchingHere && (
                <span className="text-[11px] font-bold text-primary flex-shrink-0">Active</span>
              )}
            </button>
          )
        })}
      </div>
      <div className="border-t border-bdr-light mt-1 pt-1">
        <button
          onClick={() => { signOut(); onClose?.() }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-bold text-danger hover:bg-rose-50"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </div>
  )
}
