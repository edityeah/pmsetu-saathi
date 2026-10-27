// Report review (IMA / State PMU) — quarterly reports and AOPs submitted by
// the SPV. IMA reviews within 14 days; the SSC approves AOPs.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Pill, Section, Table, Loading, Btn, useLoad, fmtDate, stateKind, titleCase } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

export default function ReportReviewCanvas() {
  const { role, showToast } = useApp()
  const { data, reload } = useLoad(() => api.reports())
  const [pack, setPack] = useState(null)
  useSaathiContext(data ? brief(data) : '', ['Which reports are awaiting SSC approval?'])
  if (!data) return <Loading />
  async function review(r, decision) {
    const note = decision === 'returned' ? window.prompt('Observations', 'Placement figures not reconciled with register; resubmit.') : undefined
    if (decision === 'returned' && note === null) return
    await api.reportReview(r.id, { decision, note }); showToast({ kind: 'success', text: `${r.period}: ${decision}` }); reload()
  }
  const pending = data.reports.filter(r => ['submitted', 'ima_reviewed'].includes(r.state))
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="sky" eyebrow={role === 'state_pmu' ? 'State Steering Committee · secretariat' : 'IMA review'} title={`${pending.length} report${pending.length === 1 ? '' : 's'} awaiting action`} subtitle="Quarterly reports: IMA reviews, SSC notes. Annual Operational Plan: IMA comments within 14 days, SSC approves within 14 days — else deemed approved." />
      <div className="p-4 space-y-4">
        <Section tone="indigo" title="Submissions">
          <Table tone="indigo" columns={[
            { key: 'period', label: 'Report', render: r => <div><div className="font-semibold">{r.period}</div><div className="text-[10px] text-txt-tertiary">{titleCase(r.kind)}</div></div> },
            { key: 'dueAt', label: 'Due', render: r => fmtDate(r.dueAt) },
            { key: 'submittedAt', label: 'Submitted', render: r => fmtDate(r.submittedAt) },
            { key: 'state', label: 'Status', render: r => <Pill kind={stateKind(r.state)}>{r.state.replace(/_/g, ' ')}</Pill> },
            { key: 'act', label: '', align: 'right', render: r => (
              <div className="flex gap-1 justify-end flex-wrap">
                {r.state !== 'draft' && <Btn small tone="ghost" onClick={async () => setPack(await api.reportPack())}>View pack</Btn>}
                {role === 'ima_officer' && r.state === 'submitted' && <><Btn small onClick={() => review(r, 'reviewed')}>Mark reviewed</Btn><Btn small tone="danger" onClick={() => review(r, 'returned')}>Return</Btn></>}
                {role === 'state_pmu' && ['submitted', 'ima_reviewed'].includes(r.state) && <Btn small tone="ok" onClick={() => review(r, 'approved')}>SSC approve</Btn>}
              </div>) },
          ]} rows={data.reports} />
        </Section>
        {pack && (
          <Section tone="emerald" title={`Live pack · ${pack.period}`} hint="Assembled from the cluster database at review time.">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[12px]">
              {[['Active enrolment', pack.sections.operations.enrolmentActive], ['Dropouts', pack.sections.operations.dropouts], ['OJT hours', pack.sections.operations.ojtHours], ['KPI score', `${pack.sections.score.score}%`], ['Utilised', `${pack.sections.finance.utilisation.utilisedPct}%`], ['Verified placements', pack.sections.operations.placementsByState.find(p => p.state === 'verified')?.count || 0], ['Disputed', pack.sections.operations.placementsByState.find(p => p.state === 'disputed')?.count || 0], ['Civil works', pack.sections.upgradation.civil.length]].map(([l, v]) => <div key={l} className="rounded-xl bg-surface-page p-2.5"><div className="text-[10px] uppercase font-bold text-txt-tertiary">{l}</div><div className="text-[18px] font-bold">{v}</div></div>)}
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}
