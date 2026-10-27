// Joined records — every application at 'joined' or 'follow_up' with its
// evidence level. The IMA samples here (independently verified / disputed);
// employers see their own; the SPV sees the cluster. "Verified placement"
// under the License Agreement means employer-confirmed or better.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Pill, Section, Table, Loading, Btn, useLoad, Chips, fmtDate, fmtInr, titleCase } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

const EV = ['student_reported', 'document_supported', 'employer_confirmed', 'independently_verified', 'disputed']
const EV_KIND = { none: 'neutral', student_reported: 'info', document_supported: 'warn', employer_confirmed: 'ok', independently_verified: 'ok', disputed: 'bad' }

export default function PlacementsCanvas() {
  const { role, showToast } = useApp()
  const { data, reload } = useLoad(() => api.applications({}))
  const [filter, setFilter] = useState('all')
  useSaathiContext(data ? brief(data) : '', ['How many joined records are employer-confirmed?', 'Which records should the IMA sample?'])
  if (!data) return <Loading />
  const joined = data.applications.filter(a => ['joined', 'follow_up'].includes(a.stage))
  const list = joined.filter(a => filter === 'all' || a.evidenceLevel === filter)
  const counts = Object.fromEntries(EV.map(e => [e, joined.filter(a => a.evidenceLevel === e).length]))
  const wages = joined.map(a => a.offerWage).filter(Boolean).sort((a, b) => a - b)
  async function ima(a, evidenceLevel) { await api.applicationStage(a.id, { evidenceLevel, note: evidenceLevel === 'disputed' ? 'IMA sample: employer could not confirm joining' : 'IMA sample: employer HR and attendance register seen' }); showToast({ kind: 'success', text: evidenceLevel === 'disputed' ? 'Flagged as disputed.' : 'Marked independently verified.' }); reload() }
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="pink" eyebrow="Joined records · evidence levels" title={`${joined.length} joined · ${counts.employer_confirmed + counts.independently_verified} employer-confirmed or better`} subtitle="Student-reported and document-supported records are leads, not placements. The employer's confirmation makes them count; the IMA samples a share each quarter." />
      <div className="p-4 space-y-4">
        <StatGrid>
          <Stat label="Student-reported" value={counts.student_reported} tone="sky" onClick={() => setFilter('student_reported')} />
          <Stat label="Document-supported" value={counts.document_supported} tone="amber" onClick={() => setFilter('document_supported')} />
          <Stat label="Employer-confirmed" value={counts.employer_confirmed} tone="emerald" onClick={() => setFilter('employer_confirmed')} />
          <Stat label="Independently verified" value={counts.independently_verified} sub={`${counts.disputed} disputed`} tone={counts.disputed ? 'rose' : 'teal'} onClick={() => setFilter('independently_verified')} />
          <Stat label="Median wage (reported)" value={wages.length ? fmtInr(wages[Math.floor(wages.length / 2)]) : '—'} sub="Y1 target band ₹12–14k" tone="violet" />
        </StatGrid>
        <Chips options={[{ id: 'all', label: `All (${joined.length})` }, ...EV.map(e => ({ id: e, label: `${titleCase(e)} ${counts[e]}` }))]} value={filter} onChange={setFilter} />
        <Section tone="indigo" title="Records">
          <Table tone="indigo" columns={[
            { key: 'trainee', label: 'Student', render: r => <div><div className="font-semibold">{r.trainee.name}</div><div className="text-[10px] text-txt-tertiary">{r.trainee.iti.code} · {r.trainee.batch?.tradeId}{r.trainee.batch?.cohortLabel?.includes('Pre-scheme') ? ' · pre-scheme' : ''} · {r.trainee.gender}</div></div> },
            { key: 'opp', label: 'Role · employer', render: r => <div>{r.opportunity.title}<div className="text-[10px] text-txt-tertiary">{r.opportunity.employer.name} · {r.opportunity.type}</div></div> },
            { key: 'joinedAt', label: 'Joined', render: r => fmtDate(r.joinedAt) },
            { key: 'offerWage', label: 'Wage', align: 'right', render: r => r.offerWage ? fmtInr(r.offerWage) : '—' },
            { key: 'evidenceLevel', label: 'Evidence', render: r => <div><Pill kind={EV_KIND[r.evidenceLevel]}>{r.evidenceLevel.replace(/_/g, ' ')}</Pill>{r.evidenceNote && <div className="text-[10px] text-txt-tertiary max-w-[220px]">{r.evidenceNote}</div>}</div> },
            { key: 'act', label: '', align: 'right', render: r => role === 'ima_officer' && r.evidenceLevel !== 'independently_verified' ? <div className="flex gap-1 justify-end"><Btn small tone="ok" onClick={() => ima(r, 'independently_verified')}>Verify</Btn><Btn small tone="danger" onClick={() => ima(r, 'disputed')}>Dispute</Btn></div> : null },
          ]} rows={list} empty="No records in this filter." />
        </Section>
      </div>
    </div>
  )
}
