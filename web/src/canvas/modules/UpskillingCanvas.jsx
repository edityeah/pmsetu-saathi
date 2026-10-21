// Future upskilling and next roles (student, after experience) — programmes
// and roles from the cluster catalogue and the companion knowledge base. A
// route is suggested only where provider and entry facts exist; otherwise
// the student gets questions to take to a counsellor.
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading, Hero, Stat, StatGrid, Section, Pill, Btn, fmtDate, titleCase } from './_ui.jsx'
import { useSaathiContext } from '../CanvasSaathi.jsx'

export default function UpskillingCanvas() {
  const { openCanvas } = useApp()
  const { data: d } = useLoad(() => api.upskilling())
  useSaathiContext(d ? `Upskilling for ${d.trainee.name} (${d.trainee.trade}). Current job: ${d.current ? `${d.current.role} at ${d.current.employer} since ${fmtDate(d.current.startAt)} (${d.current.evidenceLevel})` : 'none yet'}. Programmes: ${d.programmes.map(p => `${p.title} (${p.verified ? 'verified' : 'entry facts to confirm'})`).join('; ') || 'none'}. Next roles: ${d.nextRoles.map(r => `${r.roleName}: ${r.progression}`).join('; ') || 'none'}.` : '', ['Mere trade ke baad kaunsi job?', 'Kaunsa short course mere liye sahi hai?'])
  if (!d) return <Loading />
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="teal" eyebrow="Future upskilling and next roles · after experience" title={d.current ? `Working · ${d.current.role} · ${d.current.employer}` : 'Plan the step after your first job'} subtitle={d.current ? `Since ${fmtDate(d.current.startAt)} · ${titleCase(d.current.evidenceLevel)} · programmes and roles that build on this experience` : 'Programmes and roles that build on your trade once you have some experience.'} />
      <div className="p-4 space-y-5">
        <StatGrid>
          <Stat label="Programmes" value={d.programmes.length} sub={`${d.programmes.filter(p => p.verified).length} with verified provider`} tone="emerald" />
          <Stat label="Next roles" value={d.nextRoles.length} sub="from the role map for your trade" tone="indigo" />
          <Stat label="Experience" value={d.current ? `${Math.max(0, Math.round((Date.now() - new Date(d.current.startAt)) / (30 * 86400000)))} mo` : '—'} sub={d.current ? 'in the current role' : 'not working yet'} tone="sky" />
          <Stat label="Questions ready" value={d.questions.length} sub="to take to a counsellor" tone="amber" onClick={() => openCanvas({ type: 'career_counsellor' })} />
        </StatGrid>
        <Section title="Programmes you could take next" hint="Shown only with the provider and entry facts we hold; otherwise the entry facts need confirming first.">
          {d.programmes.length === 0 ? <div className="text-[12px] text-txt-tertiary">No programmes in the catalogue for your trade yet.</div> : <div className="space-y-3">{d.programmes.map(p => <div key={p.id} className="rounded-2xl border border-bdr-light bg-surface-page/40 p-3.5"><div className="flex items-start gap-3"><span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-[16px]" aria-hidden>⚡</span><div className="flex-1 min-w-0"><div className="text-[13px] font-bold text-txt-primary">{p.title}</div><div className="text-[11px] text-txt-secondary mt-0.5">{p.why ? `${p.why}. ` : ''}Entry: {p.entry}.{p.duration ? ` Duration ${p.duration}.` : ''}</div><div className="text-[10px] text-txt-tertiary mt-1">Provider: {p.provider}</div></div><Pill kind={p.verified ? 'ok' : 'warn'}>{p.verified ? 'Verified provider' : 'Entry facts need confirming'}</Pill></div><div className="mt-2.5 flex gap-2 flex-wrap"><Btn small tone="ghost" onClick={() => openCanvas({ type: 'course_selection' })}>See provider and entry facts</Btn><Btn small tone="ghost" onClick={() => openCanvas({ type: 'career_counsellor' })}>Ask the counsellor</Btn>{p.checkedAt && <span className="text-[10px] text-txt-tertiary self-center">{p.checkedAt}</span>}</div></div>)}</div>}
        </Section>
        <Section title="Next roles in your trade" hint="From the companion's role map: what the role does, how people progress, and what to build.">
          {d.nextRoles.length === 0 ? <div className="text-[12px] text-txt-tertiary">No role map for your trade yet.</div> : <div className="space-y-3">{d.nextRoles.map(r => <div key={r.id} className="rounded-2xl border border-bdr-light bg-white p-3.5"><div className="flex items-start gap-3"><span className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center text-[16px]" aria-hidden>🏅</span><div className="flex-1 min-w-0"><div className="text-[13px] font-bold text-txt-primary">{r.roleName}</div><div className="text-[10px] text-txt-tertiary">{r.sector}{r.workplace ? ` · ${r.workplace}` : ''}</div></div></div><dl className="mt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2 text-[11px]"><div><dt className="text-[10px] uppercase tracking-wider font-bold text-txt-tertiary">Progression</dt><dd className="text-txt-secondary">{r.progression || '—'}</dd></div><div><dt className="text-[10px] uppercase tracking-wider font-bold text-txt-tertiary">Skills to build</dt><dd className="text-txt-secondary">{r.skillsToBuild || '—'}</dd></div><div><dt className="text-[10px] uppercase tracking-wider font-bold text-txt-tertiary">Entry pathway</dt><dd className="text-txt-secondary">{r.entryPathway || '—'}</dd></div></dl></div>)}</div>}
        </Section>
        <Section title="Questions for a counsellor" hint="Where the facts are not confirmed, take these instead of a confident route.">
          <ul className="list-disc pl-5 text-[12px] text-txt-secondary space-y-1">{d.questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
          <div className="pt-3"><Btn onClick={() => openCanvas({ type: 'career_counsellor', pendingPrompt: { text: `I am thinking about the next step after my ${d.trainee.trade || ''} training. ${d.questions[0]}` } })}>Prepare questions with the counsellor</Btn></div>
        </Section>
      </div>
    </div>
  )
}
