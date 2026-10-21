// Skill passport (student) — the cross-section spine: starts from stated
// interests, fills with verified skills from modules, practicals and
// assessments, and certificates from the document vault. Feeds the résumé.
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading, Hero, Stat, StatGrid, Section, Pill, Btn, Bar, fmtDate } from './_ui.jsx'
import { useSaathiContext } from '../CanvasSaathi.jsx'

const SRC = { module: { kind: 'ok', label: 'Module completed' }, practical: { kind: 'ok', label: 'Demonstrated' }, assessment: { kind: 'ok', label: 'Assessment' } }

export default function SkillPassportCanvas() {
  const { openCanvas } = useApp()
  const { data: d } = useLoad(() => api.passport())
  useSaathiContext(d ? `Skill passport for ${d.trainee.name} (${d.trainee.trade}, ${d.trainee.batch}): ${d.pct}% complete. Verified skills: ${d.verified.map(v => `${v.label} (${v.source})`).join(', ') || 'none yet'}. In progress: ${d.inProgress.map(x => `${x.label} ${x.pct}%`).join(', ') || 'none'}. Stated interests: ${d.stated.map(s => s.label).join(', ') || 'none'}. Certificates: ${d.certificates.map(c => `${c.name} ${c.state}`).join(', ') || 'none'}.` : '', ['Meri passport kaise poori hogi?', 'Kaunse skills verified hain?'])
  if (!d) return <Loading />
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="amber" eyebrow={`Skill passport · ${d.trainee.passportId}`} title={d.trainee.name} subtitle={`${d.trainee.trade || 'Course not set'} · ${d.trainee.batch || ''} · ${d.trainee.iti || ''}`} />
      <div className="p-4 space-y-5">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="flex items-center justify-between text-[12px]"><span className="font-bold text-amber-900">Passport {d.pct}% complete</span><span className="text-txt-tertiary">fills as you learn; nothing is added without a source</span></div>
          <div className="mt-2"><Bar pct={d.pct} tone="amber" height="h-2.5" /></div>
        </div>
        <StatGrid>
          <Stat label="Verified skills" value={d.verified.length} sub="from modules, practicals, assessments" tone="emerald" />
          <Stat label="In progress" value={d.inProgress.length} sub="modules under way" tone="indigo" onClick={() => openCanvas({ type: 'my_course' })} />
          <Stat label="Stated interests" value={d.stated.length} sub="what you told Saathi" tone="violet" />
          <Stat label="Certificates" value={d.certificates.length} sub={`${d.certificates.filter(c => c.state === 'verified').length} verified`} tone="sky" onClick={() => openCanvas({ type: 'document_vault' })} />
        </StatGrid>
        <Section title="Verified skills" hint="Each one names where it came from and when.">
          {d.verified.length === 0 ? <div className="text-[12px] text-txt-tertiary">No verified skills yet. Finish a module, demonstrate a practical, or pass an assessment and it appears here.</div> : <ul className="divide-y divide-bdr-light/60">{d.verified.map((v, i) => <li key={i} className="py-2.5 flex items-center gap-3"><div className="flex-1 min-w-0"><div className="text-[13px] font-semibold text-txt-primary">{v.label}</div><div className="text-[10px] text-txt-tertiary">{v.detail}{v.at ? ` · ${fmtDate(v.at)}` : ''}</div></div><Pill kind={SRC[v.source]?.kind || 'ok'}>{SRC[v.source]?.label || v.source}</Pill></li>)}</ul>}
        </Section>
        {d.inProgress.length > 0 && <Section title="In progress" hint="Modules that will add a verified skill when complete.">
          <ul className="space-y-2.5">{d.inProgress.map((x, i) => <li key={i} className="text-[12px]"><div className="flex justify-between"><span className="font-semibold">{x.label}</span><span className="text-txt-tertiary">{x.pct}%</span></div><Bar pct={x.pct} /></li>)}</ul>
        </Section>}
        <Section title="Stated interests and projects" hint="What you told Saathi. Marked as stated, not verified.">
          {d.stated.length === 0 ? <div className="text-[12px] text-txt-tertiary">Tell the career counsellor what you like doing and it appears here.</div> : <div className="flex flex-wrap gap-2">{d.stated.map((s, i) => <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-violet-50 text-violet-800 text-[11px] font-semibold">{s.label}<span className="text-[9px] uppercase tracking-wider text-violet-500">stated</span></span>)}</div>}
        </Section>
        <Section title="Certificates" hint="From the document vault.">
          {d.certificates.length === 0 ? <div className="text-[12px] text-txt-tertiary">No certificates yet.</div> : <ul className="divide-y divide-bdr-light/60">{d.certificates.map((c, i) => <li key={i} className="py-2 flex items-center gap-3"><span className="flex-1 text-[12px] font-semibold">{c.name}</span><Pill kind={c.state === 'verified' ? 'ok' : c.state === 'awaiting' ? 'warn' : 'neutral'}>{c.state === 'verified' ? `Verified${c.verifiedAt ? ' · ' + fmtDate(c.verifiedAt) : ''}` : c.state === 'awaiting' ? 'Awaiting institute check' : 'Self uploaded'}</Pill></li>)}</ul>}
        </Section>
        <div className="flex gap-2 flex-wrap"><Btn onClick={() => openCanvas({ type: 'resume_builder' })}>Build my résumé from this</Btn><Btn tone="ghost" onClick={() => openCanvas({ type: 'document_vault' })}>Open document vault</Btn></div>
      </div>
    </div>
  )
}
