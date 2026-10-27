// Cluster operations (Module B, CEO) — per-ITI coverage, attendance,
// assessments, practicals, issues. ITIs without a registry feed are shown as
// such, never as zeros.
import KpiGridCard from '../../components/cards/KpiGridCard.jsx'
import BarChartCard from '../../components/cards/BarChartCard.jsx'
import AnalystCanvasShell from './_AnalystCanvasShell.jsx'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading, Section, Table, Pill, Btn, fmtPct, nil } from './_ui.jsx'

export default function ClusterOperationsCanvas({ context }) {
  const { openCanvas } = useApp()
  const { data } = useLoad(() => api.clusterOperations())
  if (!data) return <Loading />
  const { cluster, rows, coverage } = data
  const on = rows.filter(r => r.registryConnected)
  const sum = k => on.reduce((s, r) => s + (r[k] || 0), 0)
  const wavg = (k, w) => { const t = on.reduce((s, r) => s + (r[w] || 0), 0); return t ? Math.round(on.reduce((s, r) => s + (r[k] || 0) * (r[w] || 0), 0) / t) : null }
  const grid = { title: `${coverage.connected} of ${coverage.total} ITIs reporting operations data`, items: [
    { label: 'Students (connected)', value: sum('students').toLocaleString('en-IN'), hint: `${sum('batches')} batches · ${sum('trainers')} trainers`, tone: 'indigo' },
    { label: 'Coverage (15 days)', value: fmtPct(wavg('coveragePct', 'sessionsScheduled')), hint: `${sum('sessionsReported')} of ${sum('sessionsScheduled')} sessions reported`, tone: 'sky' },
    { label: 'Attendance (reported)', value: fmtPct(wavg('attendancePct', 'sessionsReported')), hint: 'weighted by reported sessions', tone: 'emerald' },
    { label: 'Silent batches', value: sum('batchesSilent'), hint: 'with unreported sessions', tone: sum('batchesSilent') ? 'rose' : 'emerald' },
    { label: 'Marks awaiting review', value: on.reduce((s, r) => s + (r.assessments.needs_review || 0) + (r.assessments.submitted || 0), 0), hint: `${on.reduce((s, r) => s + (r.assessments.marks_pending || 0), 0)} plans without marks`, tone: 'amber' },
    { label: 'Practical observations', value: sum('practicalObservations'), tone: 'teal' },
    { label: 'Open issues / findings', value: `${sum('openIssues')} / ${sum('openFindings')}`, tone: 'rose' },
    { label: 'Support actions open', value: sum('supportOpen'), hint: `${sum('trainersOnLeave')} trainers on leave today`, tone: 'violet' },
  ] }
  const table = (
    <Section tone="indigo" title="By ITI" hint="Only registry-connected ITIs have operations data.">
      <Table tone="indigo" columns={[
        { key: 'iti', label: 'ITI', render: r => <div><div className="font-semibold">{r.iti.name}</div><div className="text-[10px] text-txt-tertiary">{r.iti.kind} · {r.registryConnected ? 'registry connected' : 'no feed'}</div></div> },
        { key: 'students', label: 'Students', align: 'right', render: r => nil(r.students) },
        { key: 'coveragePct', label: 'Coverage', align: 'right', render: r => r.registryConnected ? <b className={r.coveragePct < 90 ? 'text-amber-700' : 'text-emerald-700'}>{fmtPct(r.coveragePct)}</b> : <Pill kind="warn">no feed</Pill> },
        { key: 'attendancePct', label: 'Attendance', align: 'right', render: r => fmtPct(r.attendancePct) },
        { key: 'cancelledPct', label: 'Cancelled', align: 'right', render: r => r.registryConnected ? `${r.cancelledPct}%` : '—' },
        { key: 'batchesSilent', label: 'Silent batches', align: 'right', render: r => nil(r.batchesSilent) },
        { key: 'assess', label: 'Assessments', render: r => r.registryConnected ? <span className="text-[11px]">{r.assessments.confirmed || 0} confirmed · {(r.assessments.needs_review || 0) + (r.assessments.submitted || 0)} to review · {r.assessments.marks_pending || 0} pending</span> : '—' },
        { key: 'issues', label: 'Issues', align: 'right', render: r => r.registryConnected ? `${r.openIssues} / ${r.openFindings}` : '—' },
        { key: 'act', label: '', align: 'right', render: r => <Btn small tone="ghost" onClick={() => openCanvas({ type: 'institute_today', itiId: r.iti.id })}>Open</Btn> },
      ]} rows={rows} />
    </Section>
  )
  const bars = { title: 'Coverage and attendance by ITI (reported sessions, 15 days)', unit: '%', data: on.flatMap(r => [{ label: `${r.iti.code} coverage`, value: r.coveragePct || 0, color: 'sky' }, { label: `${r.iti.code} attendance`, value: r.attendancePct || 0, color: 'emerald' }]), annotation: rows.filter(r => !r.registryConnected).length ? `${rows.filter(r => !r.registryConnected).map(r => r.iti.code).join(', ')} not shown: no registry feed.` : undefined }
  const saathiContext = `Cluster operations: ${rows.map(r => r.registryConnected ? `${r.iti.code}: ${r.students} students, coverage ${r.coveragePct}%, attendance ${r.attendancePct}%, silent batches ${r.batchesSilent}, assessments ${JSON.stringify(r.assessments)}, issues ${r.openIssues}, support ${r.supportOpen}, trainers on leave ${r.trainersOnLeave}` : `${r.iti.code}: no registry feed`).join('; ')}.`
  return (
    <AnalystCanvasShell eyebrow={`${cluster.name} · operations`} title="How the institutes are running." subtitle="Coverage before averages. ITIs without a registry feed show as not reporting, never as zero." toneClass="from-fuchsia-50/60 via-white to-white" refreshedOn={new Date().toLocaleDateString('en-IN')} saathiTitle="Saathi · Operations" saathiContext={saathiContext} threadId={context?.threadId}
      cells={[
        { node: <KpiGridCard card={grid} />, prompt: 'Give me the operations headline for the week and the one thing to escalate.' },
        { node: table, prompt: 'Compare Pusa and Shahdara on coverage and attendance. What explains the gap?' },
        { node: <BarChartCard card={bars} />, prompt: 'Is low coverage a trainer problem or a device problem? What would tell us?' },
      ]}
      quickAsks={['Which batches have gone silent and for how long?', 'How many marks are waiting for principal review?', 'What will it take to connect Narela, Rohini and Okhla?']} />
  )
}
