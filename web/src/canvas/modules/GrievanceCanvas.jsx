// Grievance (trainee / instructor) — quick categories + a form that files to
// the ITI and SPV register, plus Saathi to talk it through.
import { useState } from 'react'
import AvatarCall from '../../components/AvatarCall.jsx'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Pill, Btn, useLoad, fmtDate, stateKind, titleCase } from './_ui.jsx'
import { UserX, Wrench, ShieldAlert, CalendarX, Building, Briefcase, ChevronRight } from 'lucide-react'

const CATS = [
  { id: 'trainer_absent', icon: UserX, tone: 'bg-rose-100 text-rose-700', title: 'Instructor absent', desc: 'No classes for days' },
  { id: 'equipment', icon: Wrench, tone: 'bg-amber-100 text-amber-700', title: 'Machine / lab issue', desc: 'Broken, not commissioned, no consumables' },
  { id: 'safety', icon: ShieldAlert, tone: 'bg-fuchsia-100 text-fuchsia-700', title: 'Safety', desc: 'Unsafe workshop, no PPE' },
  { id: 'attendance', icon: CalendarX, tone: 'bg-violet-100 text-violet-700', title: 'Attendance wrong', desc: 'Marked absent when I was there' },
  { id: 'facilities', icon: Building, tone: 'bg-sky-100 text-sky-700', title: 'Facilities / transport', desc: 'Washroom, water, commute' },
  { id: 'placement', icon: Briefcase, tone: 'bg-emerald-100 text-emerald-700', title: 'OJT / placement', desc: 'Stipend, mentor, wrong record' },
]

export default function GrievanceCanvas({ context }) {
  const { showToast, user } = useApp()
  const { data, reload } = useLoad(() => api.grievances())
  const [cat, setCat] = useState(null)
  const [note, setNote] = useState('')
  const [onCall, setOnCall] = useState(false)
  async function file(e) { e.preventDefault(); if (!cat || !note) return; await api.raiseGrievance({ category: cat, note }); showToast({ kind: 'success', text: 'Filed. The principal and SPV see it now.' }); setCat(null); setNote(''); reload() }
  return (
    <div className="flex flex-col h-full">
      {!onCall && (
        <div className="px-4 pt-4 pb-3 bg-gradient-to-br from-rose-50/70 to-white border-b border-bdr-light flex-shrink-0 space-y-3">
          <div><div className="text-[11px] font-bold uppercase tracking-[2px] text-rose-700">Grievance</div><h2 className="text-[18px] font-bold text-txt-primary leading-tight mt-1">Kya problem hai, {user?.name?.split(' ')[0]}?</h2></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CATS.map(c => { const Icon = c.icon; return <button key={c.id} onClick={() => setCat(c.id)} className={`text-left rounded-2xl border p-2.5 flex items-start gap-2 ${cat === c.id ? 'border-rose-400 bg-white' : 'border-bdr-light bg-white'}`}><div className={`w-8 h-8 rounded-xl ${c.tone} flex items-center justify-center flex-shrink-0`}><Icon className="w-4 h-4" /></div><div className="min-w-0"><div className="font-bold text-[12px] leading-tight">{c.title}</div><div className="text-[10px] text-txt-secondary">{c.desc}</div></div></button> })}
          </div>
          {cat && <form onSubmit={file} className="flex gap-2"><input autoFocus value={note} onChange={e => setNote(e.target.value)} placeholder="Thoda detail likho…" className="flex-1 rounded-xl border border-bdr px-3 py-2 text-[12px]" /><Btn type="submit" tone="danger">File</Btn></form>}
          {data?.grievances?.length > 0 && <div className="flex gap-1.5 overflow-x-auto">{data.grievances.map(g => <span key={g.id} className="flex-shrink-0 inline-flex items-center gap-1.5 text-[10px] rounded-pill bg-white border border-bdr-light px-2 py-1"><Pill kind={stateKind(g.status)}>{g.status}</Pill>{titleCase(g.category)} · {fmtDate(g.createdAt)}</span>)}</div>}
        </div>
      )}
      <div className="flex-1 min-h-0">
        <AvatarCall persona="general" title="Saathi · Grievance" intro="Batao kya hua — main help karunga aur file bhi kar sakta hoon." useWebSearch={false} threadId={context?.threadId} onCallStateChange={(s) => setOnCall(s !== 'idle')}
          extraSystem="You are the grievance helper in a PM-SETU ITI cluster. Listen, ask 2-3 questions (since when, who, evidence), classify (instructor absent, equipment, safety, attendance, hostel, OJT/placement), and propose the next step. If they want to file formally, emit a `ticket` card with a subject and timeline. Warm, factual, never blame the trainee. Hinglish is fine." suggestions={['Absent mark ho gaya, main class mein tha', 'Wiring board kharab hai', 'OJT ka stipend nahi mila']} />
      </div>
    </div>
  )
}
