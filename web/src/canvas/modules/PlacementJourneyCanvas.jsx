// My placement KPIs (student) — applications, interviews, offers and the
// résumé, one record per opportunity with its own stage history and
// provenance. An offer is not a join; a self-report is not a verified placement.
import { BarChart, Bar as RBar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, LabelList } from 'recharts'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading, Hero, Stat, StatGrid, Section, Pill, Btn, fmtDate, titleCase } from './_ui.jsx'
import { useSaathiContext } from '../CanvasSaathi.jsx'

const tip = { background: 'white', border: '1px solid #CFD8E6', borderRadius: 8, fontSize: 11 }
const STEPS = [['Interested', 1], ['Applied', 3], ['Interview', 4], ['Offered', 5], ['Joined', 6]]
const EV = { none: { kind: 'neutral', label: 'No evidence yet' }, student_reported: { kind: 'info', label: 'Student reported' }, document_supported: { kind: 'warn', label: 'Document on file' }, employer_confirmed: { kind: 'ok', label: 'Employer confirmed' }, independently_verified: { kind: 'ok', label: 'Independently verified' }, disputed: { kind: 'bad', label: 'Disputed' } }

export default function PlacementJourneyCanvas() {
  const { openCanvas } = useApp()
  const { data: d } = useLoad(() => api.placementJourney())
  useSaathiContext(d ? `Placement journey for ${d.trainee.name}: ${d.kpis.applications} live applications (${d.kpis.apprenticeship} apprenticeship or OJT, ${d.kpis.wage} wage), ${d.kpis.interviews} interviewed, ${d.kpis.offers} offers, ${d.kpis.joined} joined; résumé ${d.kpis.resumePct}% complete${d.kpis.resumeMissing.length ? ` (missing ${d.kpis.resumeMissing.join(', ')})` : ''}. Applications: ${d.applications.map(a => `${a.title} at ${a.employer}: ${titleCase(a.stage)}${a.nextAction ? ', next ' + a.nextAction : ''} (${a.evidenceLevel})`).join('; ') || 'none'}.` : '', ['Meri application kahan tak pahunchi?', 'Offer aur join mein farak kya hai?', 'Agla step kya hai?'])
  if (!d) return <Loading />
  const k = d.kpis
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="emerald" eyebrow="Placement journey · self-report is not a verified placement" title={`${k.applications} application${k.applications === 1 ? '' : 's'} · ${k.offers} offer${k.offers === 1 ? '' : 's'}`} subtitle="Prepare, apply, interview and track. One record per opportunity. Apprenticeship and wage roles stay separate; an offer is not a join." />
      <div className="p-4 space-y-5">
        <StatGrid>
          <Stat label="Applications" value={k.applications} sub={`${k.apprenticeship} apprenticeship · ${k.wage} wage`} tone="indigo" />
          <Stat label="Interviews" value={k.interviews} sub={k.interviewsScheduled ? `${k.interviewsScheduled} to schedule` : 'reached interview stage'} tone="sky" />
          <Stat label="Offers" value={k.offers} sub={k.joined ? `${k.joined} joined` : 'not yet joined'} tone="emerald" />
          <Stat label="Résumé" value={`${k.resumePct}%`} sub={k.resumeMissing.length ? `${k.resumeMissing.length} field${k.resumeMissing.length === 1 ? '' : 's'} to confirm` : 'complete'} tone={k.resumePct >= 90 ? 'emerald' : 'amber'} onClick={() => openCanvas({ type: 'resume_builder' })} />
        </StatGrid>
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-stretch">
          <div className="xl:col-span-3 rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden"><div className="px-4 py-2.5 bg-gradient-to-r from-surface-page/50 to-white border-b border-bdr-light"><div className="text-[11px] font-bold uppercase tracking-wider text-primary">Placement overview</div><div className="text-[10px] text-txt-tertiary">your pipeline · no response is unknown, not rejected</div></div>
            <div className="p-4"><div style={{ height: 200 }}><ResponsiveContainer><BarChart data={d.funnel} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }} barCategoryGap={8}><XAxis type="number" hide allowDecimals={false} /><YAxis type="category" dataKey="stage" width={84} fontSize={11} stroke="#7383A5" /><Tooltip contentStyle={tip} /><RBar dataKey="n" radius={[0, 6, 6, 0]}>{d.funnel.map((f, i) => <Cell key={f.stage} fill={f.n === 0 ? '#E2E8F0' : i >= 3 ? '#10B981' : i === 2 ? '#F59E0B' : '#386AF6'} />)}<LabelList dataKey="n" position="right" fontSize={11} fill="#1A1F36" /></RBar></BarChart></ResponsiveContainer></div></div>
          </div>
          <div className="xl:col-span-2 rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden"><div className="px-4 py-2.5 bg-gradient-to-r from-surface-page/50 to-white border-b border-bdr-light"><div className="text-[11px] font-bold uppercase tracking-wider text-primary">Interviews</div><div className="text-[10px] text-txt-tertiary">where you are in the process</div></div>
            <div className="p-4">{d.interviews.length === 0 ? <div className="text-[12px] text-txt-tertiary">No interviews yet. Apply to an opportunity to get one.</div> : <ul className="divide-y divide-bdr-light/60">{d.interviews.map(i => <li key={i.id} className="py-2.5 flex items-center gap-3"><div className="flex-1 min-w-0"><div className="text-[12px] font-semibold truncate">{i.employer}</div><div className="text-[10px] text-txt-tertiary truncate">{i.title}{i.nextAction ? ` · ${i.nextAction}` : ''}</div></div><Pill kind={i.status.startsWith('cleared') ? 'ok' : 'warn'}>{i.status.startsWith('cleared') ? 'Interviewed' : 'To schedule'}</Pill></li>)}</ul>}
              <div className="mt-3"><Btn onClick={() => openCanvas({ type: 'job_prep' })}>Practise for my interview</Btn></div>
            </div>
          </div>
        </div>
        <Section tone="indigo" title="My applications" hint="One record per opportunity. What you report is marked student reported until the employer or the ITI confirms it.">
          {d.applications.length === 0 ? <div className="text-[12px] text-txt-tertiary">No applications yet. <button className="text-primary font-bold" onClick={() => openCanvas({ type: 'jobs' })}>See opportunities →</button></div> : <div className="space-y-3">{d.applications.map(a => <div key={a.id} className="rounded-2xl border border-bdr-light bg-surface-page/40 p-3.5">
            <div className="flex items-start gap-3"><span className="w-9 h-9 rounded-xl bg-white border border-bdr-light flex items-center justify-center text-[12px] font-bold text-primary">{a.employer.split(' ').map(w => w[0]).slice(0, 2).join('')}</span><div className="flex-1 min-w-0"><div className="text-[13px] font-bold text-txt-primary">{a.title} · {a.employer}</div><div className="text-[10px] text-txt-tertiary">{a.type === 'wage' ? 'Wage role' : titleCase(a.type)}{a.pay ? ` · ${a.pay}` : ''}{a.checkedAt ? ` · checked ${fmtDate(a.checkedAt)}` : ''}</div></div><Pill kind={EV[a.evidenceLevel]?.kind || 'neutral'}>{EV[a.evidenceLevel]?.label || titleCase(a.evidenceLevel)}</Pill></div>
            <ol className="mt-3 grid grid-cols-5 gap-1">{STEPS.map(([label, r], i) => { const done = a.stageRank > r || a.stageRank === 6 && r === 6; const now = a.stageRank === r || (r === 3 && a.stageRank === 3); return <li key={label} className="text-center"><span className={`block w-2.5 h-2.5 rounded-full mx-auto mb-1 ${a.stageRank >= 6 || a.stageRank > r ? 'bg-emerald-500' : now ? 'bg-amber-500 ring-4 ring-amber-100' : 'bg-bdr'}`} /><span className={`text-[9px] font-semibold ${now ? 'text-amber-700' : 'text-txt-tertiary'}`}>{label}</span></li> })}</ol>
            <div className="mt-2 text-[11px] text-txt-secondary">{['declined', 'withdrawn', 'not_selected'].includes(a.stage) ? <span>{titleCase(a.stage)} · {fmtDate(a.lastEventAt)}</span> : a.stage === 'offered' ? <span>→ Offer is not a join. Confirm your start date and add proof.</span> : a.nextAction ? <span>→ Next: {a.nextAction}</span> : <span>{titleCase(a.stage)} · {fmtDate(a.lastEventAt)}</span>}</div>
          </div>)}</div>}
          <div className="pt-3 flex gap-2 flex-wrap"><Btn tone="ghost" onClick={() => openCanvas({ type: 'applications' })}>Report a stage or dispute a record</Btn><Btn tone="ghost" onClick={() => openCanvas({ type: 'jobs' })}>See opportunities</Btn></div>
        </Section>
      </div>
    </div>
  )
}
