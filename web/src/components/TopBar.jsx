import { useApp } from '../context/AppContext.jsx'
import { ROLE_LABELS, ROLE_SCOPES } from '../roles/roleConfig.js'
import { Bell, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import RoleSwitcher from './RoleSwitcher.jsx'

export default function TopBar() {
  const { user, role, notifications } = useApp()
  const [open, setOpen] = useState(false)
  const popoverRef = useRef(null)
  const unread = notifications.filter(n => !n.readAt).length

  // Close the dropdown when clicking outside it.
  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <div className="bg-white border-b border-bdr-light flex items-center px-4 py-2.5 sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded bg-primary text-white flex items-center justify-center text-xs font-bold">PMS</div>
        <div className="text-sm font-semibold hidden md:block">PM-SETU Saathi</div>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <button className="relative p-2 rounded hover:bg-slate-100">
          <Bell className="w-5 h-5 text-txt-secondary" />
          {unread > 0 && <span className="absolute -top-0.5 -right-0.5 bg-danger text-white text-[10px] rounded-pill w-4 h-4 flex items-center justify-center">{unread}</span>}
        </button>
        <div className="relative" ref={popoverRef}>
          <button onClick={() => setOpen(o => !o)}
            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100">
            <div className="w-7 h-7 rounded-pill bg-primary-light text-primary-dark flex items-center justify-center text-xs font-semibold">
              {(user?.name || '?').split(' ').map(s => s[0]).slice(0, 2).join('')}
            </div>
            <div className="text-left hidden md:block">
              <div className="text-sm font-medium leading-tight">{user?.name}</div>
              <div className="text-xs text-txt-secondary leading-tight">{ROLE_LABELS[role]} · {ROLE_SCOPES[role]}</div>
            </div>
            <ChevronDown className="w-4 h-4 text-txt-secondary" />
          </button>
          {open && (
            <div className="absolute right-0 mt-1 z-40">
              <RoleSwitcher onClose={() => setOpen(false)} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
