// Placement for my batches (Module D, trainer) — who in my batches needs a
// résumé review, a mock interview, or a referral; what is live for them.
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Pill, Section, Table, Loading, Btn, useLoad, fmtDate, fmtInr, stateKind, titleCase } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

export default function ForMyBatchesCanvas() {
  const { showToast, openCanvas } = useApp()
  const { data, reload } = useLoad(() => api.forMyBatches())
  useSaathiContext(data ? brief(data) : '', ['Who needs a résumé review this week?', 'Which live opportunities match my students?'])
  if (!data) return <Loading />
  const { applications, needPreparation, mockInterviews, liveOpportunities } = data
  async function prepared(a) { await api.applicationStage(a.id, { stage: 'prepared', preparation: 'Résumé reviewed by trainer · checklist ready' }); showToast({ kind: 'success', text: `${a.trainee.name} marked prepared; placement cell can refer.` }); reload() }
  async function mock(r, state) { await api.respondReferral(r.id, { state, response: state === 'action_agreed' ? 'Mock interview Friday 3 pm in the workshop.' : 'Done; feedback shared.' }); showToast({ kind: 'success', text: `Mock interview: ${state.replace(/_/g, ' ')}` }); reload() }
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="emerald" eyebrow="Placement · my batches" title={`${needPreparation.length} need a résumé review · ${mockInterviews.filter(m => m.state !== 'resolved').length} mock interviews`} subtitle="You prepare; the placement cell refers; the employer confirms. Your part is the résumé, the trade task and the mock interview." />
      <div className="p-4 space-y-4">
        <StatGrid>
          <Stat label="Interested, not prepared" value={needPreparation.length} tone="amber" />
          <Stat label="Referred or beyond" value={applications.filter(a => ['referred', 'applied', 'interviewed', 'offered'].includes(a.stage)).length} tone="sky" />
          <Stat label="Joined" value={applications.filter(a => ['joined', 'follow_up'].includes(a.stage)).length} tone="emerald" />
          <Stat label="Live opportunities" value={liveOpportunities.length} tone="teal" />
        </StatGrid>
        <Section title="Needs preparation" hint="Review the résumé and checklist, then mark prepared.">
          <Table columns={[
            { key: 'trainee', label: 'Student', render: r => <button className="font-semibold text-primary" onClick={() => openCanvas({ type: 'student_profile', traineeId: r.trainee.id })}>{r.trainee.name}</button> },
            { key: 'opp', label: 'Wants', render: r => <div>{r.opportunity.title}<div className="text-[10px] text-txt-tertiary">{r.opportunity.employer.name} · {r.opportunity.type}</div></div> },
            { key: 'since', label: 'Since', render: r => fmtDate(r.lastEventAt) },
            { key: 'act', label: '', align: 'right', render: r => <Btn small onClick={() => prepared(r)}>Mark prepared</Btn> },
          ]} rows={needPreparation} empty="Nobody waiting." />
        </Section>
        <Section title="Mock interview requests">
          <ul className="space-y-1.5 text-[12px]">{mockInterviews.map(m => <li key={m.id} className="flex items-center gap-2 flex-wrap"><Pill kind={stateKind(m.state)}>{m.state.replace(/_/g, ' ')}</Pill><span className="flex-1"><b>{m.trainee.name}</b>: {m.summary}</span>{m.state !== 'resolved' && <><Btn small tone="ghost" onClick={() => mock(m, 'action_agreed')}>Schedule</Btn><Btn small tone="ok" onClick={() => mock(m, 'resolved')}>Done</Btn></>}</li>)}{mockInterviews.length === 0 && <li className="text-txt-tertiary">None.</li>}</ul>
        </Section>
        <Section title="All applications from my batches">
          <Table columns={[
            { key: 'trainee', label: 'Student', render: r => r.trainee.name },
            { key: 'opp', label: 'Opportunity', render: r => `${r.opportunity.title} · ${r.opportunity.employer.name}` },
            { key: 'stage', label: 'Stage', render: r => <Pill kind={stateKind(r.stage)}>{r.stage.replace(/_/g, ' ')}</Pill> },
            { key: 'evidenceLevel', label: 'Evidence', render: r => <span className="text-[11px]">{r.evidenceLevel.replace(/_/g, ' ')}</span> },
            { key: 'nextAction', label: 'Next', render: r => <span className="text-[11px]">{r.nextAction || '—'}</span> },
          ]} rows={applications} empty="No applications yet." />
        </Section>
        <Section title="Live opportunities for your trades" hint="What students can see now.">
          <ul className="space-y-1.5 text-[12px]">{liveOpportunities.map(o => <li key={o.id} className="flex items-center gap-2"><Pill kind="neutral">{o.type}</Pill><span className="flex-1 truncate"><b>{o.title}</b> · {o.employer.name} · trades {o.tradeCodes.join(', ') || 'any'}</span><span className="text-[10px] text-txt-tertiary">{o.wageMin ? `${fmtInr(o.wageMin)}–${fmtInr(o.wageMax)}` : o.stipend ? `stipend ${fmtInr(o.stipend)}` : ''}{o.closingAt ? ` · closes ${fmtDate(o.closingAt)}` : ''}</span></li>)}</ul>
        </Section>
      </div>
    </div>
  )
}
