// OJT / apprenticeship tracker — employment spells of type ojt or
// apprenticeship: hours, logbook, mentor and ITI sign-off, follow-ups.
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Bar, Pill, Section, Loading, Btn, useLoad, fmtDate, fmtInr, stateKind, titleCase } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

export default function OjtTrackerCanvas() {
  const { role, showToast } = useApp()
  const { data, reload } = useLoad(() => api.spells({}))
  useSaathiContext(data ? brief(data) : '', ['Which spells need a mentor sign-off?'])
  if (!data) return <Loading />
  const spells = data.spells.filter(s => s.type === 'ojt' || s.type === 'apprenticeship')
  const hours = spells.reduce((s, x) => s + x.hoursLogged, 0)
  async function sign(s) { await api.spellSign(s.id); showToast({ kind: 'success', text: role === 'employer' ? 'Mentor sign-off recorded; evidence now employer-confirmed.' : 'ITI sign-off recorded.' }); reload() }
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="amber" eyebrow="OJT & apprenticeships" title={`${spells.length} active spells · ${hours} hours logged`} subtitle="150-hour OJT for 12-month batches; apprenticeships under NAPS. A spell completes when both the mentor and the ITI sign." />
      <div className="p-4 space-y-4">
        <StatGrid>
          <Stat label="OJT" value={spells.filter(s => s.type === 'ojt').length} tone="amber" />
          <Stat label="Apprenticeships" value={spells.filter(s => s.type === 'apprenticeship').length} tone="indigo" />
          <Stat label="Mentor-signed" value={spells.filter(s => s.mentorSignedAt).length} tone="emerald" />
          <Stat label="Completed" value={spells.filter(s => s.state === 'completed').length} tone="sky" />
        </StatGrid>
        <ul className="space-y-2.5">{spells.map(s => (
          <li key={s.id} className="rounded-2xl border border-bdr-light bg-white shadow-card p-3.5">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-2 flex-wrap"><div className="text-[13px] font-bold">{s.trainee.name}</div><Pill kind="neutral">{s.type}</Pill><Pill kind={stateKind(s.state)}>{s.state}</Pill><Pill kind={s.evidenceLevel === 'employer_confirmed' ? 'ok' : 'info'}>{s.evidenceLevel.replace(/_/g, ' ')}</Pill></div>
                <div className="text-[11px] text-txt-secondary">{s.role} · {s.employer.name} · {s.trainee.iti.name} · {s.trainee.batch?.name}</div>
                <div className="text-[10px] text-txt-tertiary">Started {fmtDate(s.startAt)} · mentor {s.mentorName || '—'}{s.stipend ? ` · stipend ${fmtInr(s.stipend)}` : ''} · mentor sign {s.mentorSignedAt ? fmtDate(s.mentorSignedAt) : 'pending'} · ITI sign {s.itiSignedAt ? fmtDate(s.itiSignedAt) : 'pending'}</div>
                {s.logbook.length > 0 && <div className="text-[10px] text-txt-secondary mt-1">Last entry: {s.logbook[s.logbook.length - 1].date} · {s.logbook[s.logbook.length - 1].task}</div>}
              </div>
              {s.hoursTarget && <div className="w-full sm:w-[180px]"><Bar pct={100 * s.hoursLogged / s.hoursTarget} label={`${s.hoursLogged}/${s.hoursTarget} h`} tone="auto" /></div>}
            </div>
            <div className="mt-2 flex gap-1.5 flex-wrap">
              {role === 'employer' && !s.mentorSignedAt && <Btn small tone="ok" onClick={() => sign(s)}>Mentor sign-off</Btn>}
              {(role === 'iti_principal' || role === 'trainer') && !s.itiSignedAt && <Btn small onClick={() => sign(s)}>ITI sign-off</Btn>}
              {s.followUps?.map(f => <Pill key={f.id} kind={f.respondedAt ? 'ok' : new Date(f.dueAt) < new Date() ? 'bad' : 'neutral'}>follow-up {fmtDate(f.dueAt)}{f.status ? ` · ${f.status}` : ''}</Pill>)}
            </div>
          </li>))}{spells.length === 0 && <li className="text-[12px] text-txt-tertiary">No OJT or apprenticeship spells in your scope.</li>}</ul>
      </div>
    </div>
  )
}
