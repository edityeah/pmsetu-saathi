// Cluster Registry — section 3: Student registry · Enrolment analytics ·
// Trainer registry. The headline cards open Students (gender = female,
// status = active, current year) and Enrolment (current year, all 5 ITIs).
import { useState } from 'react'
import BarChartCard from '../../components/cards/BarChartCard.jsx'
import DonutChartCard from '../../components/cards/DonutChartCard.jsx'
import FilterBar from './_FilterBar.jsx'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading, Hero, Stat, StatGrid, Bar, Section, Table, Tabs, Pill, fmtPct, fmtNum, NoFeed, Empty } from './_ui.jsx'
import { useSaathiContext } from '../CanvasSaathi.jsx'

const TABS = [{ id: 'students', label: 'Student registry' }, { id: 'enrolment', label: 'Enrolment analytics' }, { id: 'trainers', label: 'Trainer registry' }]

export default function ClusterRegistryCanvas({ context }) {
  const { role, openCanvas } = useApp()
  const f0 = context?.filters || {}
  const [tab, setTab] = useState(context?.tab || 'students')
  const { data: itis } = useLoad(() => api.itis())
  const [gender, setGender] = useState(f0.gender || 'all')
  const [status, setStatus] = useState(f0.status || 'active')
  const [scope, setScope] = useState(f0.scope || 'all')
  const st = useLoad(() => tab === 'students' ? api.studentsAnalytics({ gender, status, itiId: scope === 'all' ? undefined : scope }) : Promise.resolve(null), [tab, gender, status, scope])
  const en = useLoad(() => tab === 'enrolment' ? api.enrolmentAnalytics({ itiId: scope === 'all' ? undefined : scope }) : Promise.resolve(null), [tab, scope])
  const s = st.data, e = en.data
  useSaathiContext(tab === 'students' && s ? `Student registry (${s.coverage}; filters ${JSON.stringify(s.filters)}): ${s.matching} of ${s.base} (${s.pct}%), PwD ${s.pwd}; by ITI ${s.byIti.map(i => `${i.code} ${i.matching ?? 'no feed'}/${i.all ?? '—'}`).join(', ')}; top trades ${s.byTrade.slice(0, 5).map(t => `${t.name} ${t.n}`).join(', ')}.` : tab === 'enrolment' && e ? `Enrolment vs sanctioned seats (${e.coverage}): ${e.totals.enrolled} of ${e.totals.connectedSeats} connected seats (${e.totals.pct}%); total sanctioned ${e.totals.seats}; by ITI ${e.byIti.map(i => `${i.code} ${i.enrolled ?? 'no feed'}/${i.seats}`).join(', ')}.` : '', tab === 'students' ? ['Which ITI has the lowest share of women?', 'Which trades do women choose most?'] : ['Which ITI has the most empty seats?', 'What does connecting the other three ITIs change?'])
  const scopeOpts = [{ id: 'all', label: 'All 5 ITIs' }, ...((itis?.itis || []).map(i => ({ id: i.id, label: i.name })))]
  const canSwitch = role !== 'iti_principal' && role !== 'trainer'
  const genderLabel = gender === 'F' ? 'female' : gender === 'M' ? 'male' : 'all'

  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="violet" eyebrow="Cluster registry" title={tab === 'students' ? (gender === 'F' ? 'Female students' : gender === 'M' ? 'Male students' : 'Students') : tab === 'enrolment' ? 'Enrolment against sanctioned seats' : 'Trainer registry'} subtitle={tab === 'students' ? 'Registry records with the filters applied below. Counts are distinct active students from registry-connected ITIs.' : tab === 'enrolment' ? 'Enrolled students as a share of sanctioned seats, per ITI and for the cluster.' : 'Being set up for this cluster.'} />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'students' && (<>
        <FilterBar items={[{ label: 'Gender', value: gender, options: [{ id: 'all', label: 'All' }, { id: 'F', label: 'Female' }, { id: 'M', label: 'Male' }], onChange: setGender }, { label: 'Status', value: status, options: [{ id: 'active', label: 'Active' }, { id: 'all', label: 'All' }], onChange: setStatus }, { label: 'Academic year', value: s?.filters?.academicYear || 'Current year' }, ...(canSwitch ? [{ label: 'Scope', value: scope, options: scopeOpts, onChange: setScope }] : [])]} note={s ? s.coverage : ''} />
        {!s ? <Loading /> : (
          <div className="p-4 space-y-4">
            <StatGrid>
              <Stat label={`${gender === 'all' ? 'Students' : genderLabel + ' students'}`} value={fmtNum(s.matching)} sub={gender === 'all' ? `${status} · ${s.coverage}` : `${fmtPct(s.pct)} of ${fmtNum(s.base)} ${status} students`} tone="fuchsia" />
              <Stat label="Share" value={fmtPct(s.pct)} sub={gender === 'F' ? 'cluster target 15% women' : 'of the filtered base'} tone={gender === 'F' ? (s.pct >= 15 ? 'emerald' : 'amber') : 'indigo'} />
              <Stat label="PwD" value={fmtNum(s.pwd)} sub="within the filter" tone="sky" />
              <Stat label="ITIs reporting" value={s.coverage.split(' ITIs')[0]} sub="registry-connected" tone="slate" />
            </StatGrid>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <BarChartCard card={{ title: `${gender === 'all' ? 'Students' : genderLabel + ' students'} by ITI`, unit: 'students', data: s.byIti.filter(i => i.registryConnected).map(i => ({ label: i.code, value: i.matching || 0, color: 'fuchsia' })), annotation: s.byIti.some(i => !i.registryConnected) ? `${s.byIti.filter(i => !i.registryConnected).map(i => i.code).join(', ')} not shown: no registry feed.` : undefined }} />
              <BarChartCard card={{ title: 'By trade (top 10)', unit: 'students', orient: 'horizontal', data: s.byTrade.map(t => ({ label: t.name.slice(0, 26), value: t.n, color: 'violet' })) }} />
            </div>
            <Section title="By ITI" hint="Share within each ITI's own active students.">
              <Table columns={[
                { key: 'name', label: 'ITI', render: r => <div><div className="font-semibold">{r.name}</div><div className="text-[10px] text-txt-tertiary">{r.registryConnected ? 'registry connected' : 'no feed'}</div></div> },
                { key: 'matching', label: gender === 'all' ? 'Students' : titleCase(genderLabel), align: 'right', render: r => r.registryConnected ? fmtNum(r.matching) : <Pill kind="warn">no feed</Pill> },
                { key: 'all', label: 'All active', align: 'right', render: r => r.registryConnected ? fmtNum(r.all) : '—' },
                { key: 'pct', label: 'Share', render: r => r.registryConnected ? <div className="min-w-[120px]"><Bar pct={r.pct || 0} label={fmtPct(r.pct)} tone="auto" /></div> : '—' },
                { key: 'open', label: '', align: 'right', render: r => r.registryConnected ? <button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'batches', itiId: r.id })}>Roster →</button> : null },
              ]} rows={s.byIti} />
            </Section>
            {s.byYear.length > 0 && <Section title="By study year"><div className="flex gap-2 flex-wrap">{s.byYear.map(y => <span key={y.year} className="text-[11px] rounded-pill bg-surface-page px-2.5 py-1"><b>Year {y.year}</b> · {fmtNum(y.n)}</span>)}</div></Section>}
          </div>
        )}
      </>)}

      {tab === 'enrolment' && (<>
        <FilterBar items={[{ label: 'Academic year', value: e?.filters?.academicYear || 'Current year' }, ...(canSwitch ? [{ label: 'Scope', value: scope, options: scopeOpts, onChange: setScope }] : [])]} note={e ? e.coverage : ''} />
        {!e ? <Loading /> : (
          <div className="p-4 space-y-4">
            <StatGrid>
              <Stat label="Seat utilisation" value={fmtPct(e.totals.pct)} sub={`${fmtNum(e.totals.enrolled)} enrolled of ${fmtNum(e.totals.connectedSeats)} seats (connected ITIs)`} tone={e.totals.pct >= 70 ? 'emerald' : 'amber'} />
              <Stat label="Sanctioned seats" value={fmtNum(e.totals.seats)} sub={`across ${e.totals.itis} ITIs`} tone="indigo" />
              <Stat label="Empty seats (connected)" value={fmtNum(e.totals.connectedSeats - e.totals.enrolled)} sub="not yet filled" tone="rose" />
              <Stat label="Women" value={fmtPct(e.womenPct)} sub="of enrolled" tone="fuchsia" onClick={() => { setGender('F'); setTab('students') }} />
            </StatGrid>
            {e.totals.connected < e.totals.itis && <NoFeed>{e.byIti.filter(i => !i.registryConnected).map(i => i.name.replace('Government ITI ', '')).join(', ')}: no registry feed yet, so their enrolment is not available (not zero). Their {fmtNum(e.totals.seats - e.totals.connectedSeats)} seats are excluded from the percentage.</NoFeed>}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <BarChartCard card={{ title: 'Seat utilisation by ITI', unit: '% of sanctioned seats', data: e.byIti.filter(i => i.registryConnected).map(i => ({ label: i.code, value: i.pct || 0, color: (i.pct || 0) >= 70 ? 'emerald' : 'amber' })) }} />
              <DonutChartCard card={{ title: 'Sanctioned seats by ITI', unit: 'seats', data: e.byIti.map(i => ({ label: i.code, value: i.seats })) }} />
            </div>
            <Section title="By ITI" hint="Planned Year-1 enrolments from the SIP alongside the registry count.">
              <Table columns={[
                { key: 'name', label: 'ITI', render: r => <div><div className="font-semibold">{r.name}</div><div className="text-[10px] text-txt-tertiary">{r.kind} · {r.registryConnected ? 'registry connected' : 'no feed'}</div></div> },
                { key: 'seats', label: 'Sanctioned seats', align: 'right', render: r => fmtNum(r.seats) },
                { key: 'plannedEnrolments', label: 'Planned Y1', align: 'right', render: r => fmtNum(r.plannedEnrolments) },
                { key: 'enrolled', label: 'Enrolled', align: 'right', render: r => r.registryConnected ? fmtNum(r.enrolled) : <Pill kind="warn">no feed</Pill> },
                { key: 'pct', label: 'Utilisation', render: r => r.registryConnected ? <div className="min-w-[120px]"><Bar pct={r.pct || 0} label={fmtPct(r.pct)} tone="auto" /></div> : '—' },
                { key: 'open', label: '', align: 'right', render: r => <button className="text-[11px] text-primary font-bold" onClick={() => openCanvas({ type: 'iti_dashboard', itiId: r.id })}>Open ITI →</button> },
              ]} rows={e.byIti} />
            </Section>
          </div>
        )}
      </>)}

      {tab === 'trainers' && <div className="p-4"><Empty>The trainer registry is being set up. Until then, trainers per ITI are on the <button className="text-primary font-bold" onClick={() => openCanvas({ type: 'institute_profile', tab: 'staffing' })}>institute profile</button>.</Empty></div>}
    </div>
  )
}

const titleCase = s => String(s || '').replace(/\b\w/g, c => c.toUpperCase())
