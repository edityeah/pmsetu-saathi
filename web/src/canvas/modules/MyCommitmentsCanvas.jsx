// My commitments (trainer, Module A) — what the plan expects of me: batches
// and subjects I hold, assessments due, rechecks, support actions, referrals,
// issues I raised, and the institute's technical tasks this quarter.
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Pill, Section, Table, Loading, useLoad, fmtDate, stateKind, titleCase } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

export default function MyCommitmentsCanvas() {
  const { openCanvas, user } = useApp()
  const { data } = useLoad(() => api.myCommitments())
  useSaathiContext(data ? brief(data) : '', ['What is due from me in the next two weeks?', 'Which referrals have I not answered?'])
  if (!data) return <Loading />
  const { iti, assignments, assessments, rechecks, support, referrals, issues, instituteTasks } = data
  const batches = [...new Map(assignments.map(a => [a.batch.id, a.batch])).values()]
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="sky" eyebrow={`${iti?.name || ''} · ${user?.profile?.programme || ''}`} title={`${batches.length} batches · ${assignments.length} subject assignments`} subtitle="Assignments from the trainer mapping. You can only submit for classes assigned to you." />
      <div className="p-4 space-y-4">
        <StatGrid>
          <Stat label="Assessments due" value={assessments.length} sub="next 30 days or marks pending" tone="violet" onClick={() => openCanvas({ type: 'assessments' })} />
          <Stat label="Rechecks" value={rechecks.length} sub="needs re-practice" tone="amber" onClick={() => openCanvas({ type: 'practical_bot' })} />
          <Stat label="Support actions" value={support.length} sub="I own" tone="rose" onClick={() => openCanvas({ type: 'support_queue' })} />
          <Stat label="Referrals" value={referrals.length} sub="from students" tone="emerald" onClick={() => openCanvas({ type: 'support_queue' })} />
        </StatGrid>
        <Section tone="indigo" title="My batches and subjects">
          <Table tone="indigo" columns={[
            { key: 'batch', label: 'Batch', render: r => <div><div className="font-semibold">{r.batch.name}</div><div className="text-[10px] text-txt-tertiary">{r.batch.tradeId} · {r.batch._count.trainees}/{r.batch.capacity} students</div></div> },
            { key: 'subject', label: 'Subject', render: r => <div>{r.subject.name}<div className="text-[10px] text-txt-tertiary">{r.subject.type} · {r.subject.scope}</div></div> },
            { key: 'responsibility', label: 'Role', render: r => <Pill kind={r.responsibility.startsWith('Batch lead') ? 'ok' : 'neutral'}>{r.responsibility}</Pill> },
            { key: 'effectiveTo', label: 'Until', render: r => fmtDate(r.effectiveTo) },
            { key: 'act', label: '', align: 'right', render: r => <button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'batches', batchId: r.batch.id })}>Roster →</button> },
          ]} rows={assignments} />
        </Section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section tone="emerald" title="Assessments" hint="Planned in the next 30 days, or marks still pending.">
            <ul className="space-y-1.5 text-[12px]">{assessments.map(a => <li key={a.id} className="flex items-center gap-2"><Pill kind={stateKind(a.state)}>{a.state.replace(/_/g, ' ')}</Pill><span className="flex-1 truncate">{a.title} · {a.batch.name}</span><span className="text-[10px] text-txt-tertiary">{fmtDate(a.date)}</span></li>)}{assessments.length === 0 && <li className="text-txt-tertiary">None.</li>}</ul>
          </Section>
          <Section tone="amber" title="Rechecks due" hint="Students marked 'needs re-practice'.">
            <ul className="space-y-1.5 text-[12px]">{rechecks.map(r => <li key={r.id} className="flex items-center gap-2"><span className="flex-1 truncate"><b>{r.trainee.name}</b> · {r.task.title}</span><span className={`text-[10px] ${new Date(r.recheckAt) < new Date() ? 'text-rose-700 font-bold' : 'text-txt-tertiary'}`}>{fmtDate(r.recheckAt)}</span></li>)}{rechecks.length === 0 && <li className="text-txt-tertiary">None.</li>}</ul>
          </Section>
          <Section tone="violet" title="Support actions I own">
            <ul className="space-y-1.5 text-[12px]">{support.map(s => <li key={s.id} className="flex items-center gap-2"><Pill kind={stateKind(s.state)}>{s.state.replace(/_/g, ' ')}</Pill><span className="flex-1 truncate"><b>{s.trainee.name}</b> · {titleCase(s.reason)} · {s.nextAction}</span><span className="text-[10px] text-txt-tertiary">{fmtDate(s.dueAt)}</span></li>)}{support.length === 0 && <li className="text-txt-tertiary">None.</li>}</ul>
          </Section>
          <Section tone="sky" title="Referrals from students">
            <ul className="space-y-1.5 text-[12px]">{referrals.map(r => <li key={r.id} className="flex items-center gap-2"><Pill kind={stateKind(r.state)}>{r.state.replace(/_/g, ' ')}</Pill><span className="flex-1 truncate"><b>{r.trainee.name}</b> · {titleCase(r.kind)}: {r.summary}</span></li>)}{referrals.length === 0 && <li className="text-txt-tertiary">None.</li>}</ul>
          </Section>
        </div>
        <Section tone="rose" title="Institute Year-1 tasks (technical)" hint="Tasks owned by the technical lead at my ITI; I contribute evidence." right={<button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'annual_plan' })}>Annual plan →</button>}>
          <ul className="space-y-1.5 text-[12px]">{instituteTasks.map(t => <li key={t.id} className="flex items-center gap-2"><Pill kind={stateKind(t.state)}>{t.state.replace(/_/g, ' ')}</Pill><span className="flex-1 truncate">{t.id} · {t.title}</span><span className="text-[10px] text-txt-tertiary">due {fmtDate(t.dueAt)}{t.overdue ? ' · overdue' : ''}</span></li>)}</ul>
        </Section>
        {issues.length > 0 && <Section tone="teal" title="Issues I raised"><ul className="space-y-1 text-[12px]">{issues.map(i => <li key={i.id}><Pill kind={stateKind(i.state)}>{i.state}</Pill> {i.title}</li>)}</ul></Section>}
      </div>
    </div>
  )
}
