// My Institute — the principal's section: profile, campus facilities, trade
// offerings, students, trainers, batches. Six tabs on one institute, reusing
// the profile and registry components so the data and record pages match
// what the SPV sees.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading, Hero, Stat, StatGrid, Section, Table, Tabs, Pill, Btn, fmtCr, titleCase, fmtDate } from './_ui.jsx'
import { LabelGrid } from './_Detail.jsx'
import { TradeOfferings, CourseDetail, FacilitiesDirectory, FacilityDetail } from './InstituteProfileCanvas.jsx'
import { Students, Trainers, StudentRecord, TrainerRecord } from './ClusterRegistryCanvas.jsx'
import BatchesCanvas from './BatchesCanvas.jsx'
import { useSaathiContext } from '../CanvasSaathi.jsx'

const TABS = [{ id: 'profile', label: 'Institute profile' }, { id: 'facilities', label: 'Campus facilities' }, { id: 'trades', label: 'Trade offerings' }, { id: 'students', label: 'Students' }, { id: 'trainers', label: 'Trainers' }, { id: 'batches', label: 'Trades & batches' }]
const FAC = { in_use: { kind: 'ok', label: 'In use' }, partly_down: { kind: 'warn', label: 'Partly down' }, being_set_up: { kind: 'info', label: 'Being set up' }, planned: { kind: 'neutral', label: 'Planned' } }
const KIND_LABEL = { existing_core: 'Long-term trade', new_specialist: 'New specialist programme', short_term: 'Short-term programme', aggregate: 'Portfolio' }
const TAB_ALIAS = { overview: 'profile', infrastructure: 'facilities' }

export default function MyInstituteCanvas({ context }) {
  const { openCanvas } = useApp()
  const f0 = context?.filters || {}
  const [tab, setTab] = useState(TAB_ALIAS[context?.tab] || (TABS.some(t => t.id === context?.tab) ? context.tab : 'profile'))
  const [course, setCourse] = useState(null), [facility, setFacility] = useState(null), [facilityPick, setFacilityPick] = useState(null)
  const [student, setStudent] = useState(null), [trainer, setTrainer] = useState(null)
  const { data } = useLoad(() => api.itiProfile('mine'))
  useSaathiContext(data ? `My institute ${data.iti.name} (${data.iti.kind}, ${data.iti.district}): ${data.students.active} active students (${data.students.women} women, ${data.students.pwd} PwD), ${data.staffing.registryTrainers} trainers, rooms ${data.iti.roomsWorking} of ${data.iti.roomsBaseline} working, ${data.trades.length} courses (${data.trades.map(t => `${t.trade.name}: ${t.enrolledNow ?? '—'} enrolled, ${t.runningBatches} batches, launch ${t.launch}`).join('; ')}), facilities ${(data.facilities || []).map(f => `${f.name} ${f.status}`).join(', ')}.` : '', ['Which courses do we offer and how full are they?', 'Which facilities are being set up?', 'How many trainers teach each programme?'])
  if (!data) return <Loading />
  const { iti, students, trades, otherTrades, staffing, infrastructure, tasks, gates, facilities = [], kb = {}, contacts = {} } = data
  const periods = ['Baseline', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5']
  const scopeProps = { scope: iti.id, setScope: () => {}, scopeOpts: [{ id: iti.id, label: iti.name }], canSwitch: false }
  const openFacilityFor = code => { const f = facilities.find(x => x.linkedTrades.includes(code) && x.kind !== 'space') || facilities.find(x => x.linkedTrades.includes(code)); setCourse(null); setTab('facilities'); if (f) setFacility(f) }
  const openCoursesFor = f => { setFacility(null); setTab('trades'); setFacilityPick(f) }

  if (course) return <CourseDetail t={course} kb={kb[course.trade.code]} facility={facilities.find(f => f.linkedTrades.includes(course.trade.code) && f.kind !== 'space')} iti={iti} periods={periods} onBack={() => setCourse(null)} onBatches={() => { setCourse(null); setTab('batches') }} onWorkshop={() => openFacilityFor(course.trade.code)} />
  if (facility) return <FacilityDetail f={facility} trades={trades} iti={iti} onBack={() => setFacility(null)} onCourses={() => openCoursesFor(facility)} onMachines={() => openCanvas({ type: 'daily_operations', tab: 'infrastructure' })} />
  if (student) return <StudentRecord id={student} onBack={() => setStudent(null)} openCanvas={openCanvas} />
  if (trainer) return <TrainerRecord id={trainer} onBack={() => setTrainer(null)} openCanvas={openCanvas} />

  const y1 = t => t.plans?.find(p => p.period === 'Y1')
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="violet" eyebrow={`My institute · ${iti.kind === 'hub' ? 'Hub' : 'Spoke'} · ${iti.district}`} title={iti.name} subtitle={`Institute code ${iti.code} · ${iti.sectorFocus} · academic year 2026–27 · ${iti.registryConnected ? 'registry connected' : 'no registry feed'}`} />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'profile' && (
        <div className="p-4 space-y-5">
          <Section tone="indigo" title="Institute snapshot">
            <LabelGrid items={[['Institute name', iti.name], ['Academic year', '2026–27'], ['Role', iti.kind === 'hub' ? 'Hub ITI' : 'Spoke ITI'], ['Current operating status', 'Active'], ['Locality', `${iti.district}, Delhi`], ['Registry', iti.registryConnected ? 'Connected' : 'Not connected'], ['Institute code', iti.code], ['Principal', iti.principal?.name || '—'], ['Sector focus', iti.sectorFocus], ['Five-year plan', `${fmtCr(iti.fiveYearCr)} · civil ${fmtCr(iti.civilCr)} · digital ${fmtCr(iti.digitalCr)}`]]} />
          </Section>
          <StatGrid>
            <Stat label="Active students" value={students.registryConnected ? students.active.toLocaleString('en-IN') : '—'} sub={`${students.women} women · ${students.pwd} PwD`} tone="indigo" onClick={() => setTab('students')} />
            <Stat label="Trainers" value={staffing.registryTrainers || '—'} sub={`baseline ${staffing.baseline} · Y1 plan ${staffing.plan?.Y1}`} tone="emerald" onClick={() => setTab('trainers')} />
            <Stat label="Rooms working" value={`${iti.roomsWorking} / ${iti.roomsBaseline}`} sub={`Year-5 target ${iti.roomsY5}`} tone="amber" onClick={() => setTab('facilities')} />
            <Stat label="Year-1 tasks" value={`${tasks.filter(t => ['completed', 'reviewed'].includes(t.state)).length} / ${tasks.length}`} sub={`${tasks.filter(t => t.overdue).length} overdue · ${gates.filter(g => g.state === 'passed').length} of ${gates.length} launch gates passed`} tone={tasks.some(t => t.overdue) ? 'rose' : 'teal'} onClick={() => openCanvas({ type: 'budget_analytics', tab: 'packages' })} />
          </StatGrid>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
            <Section tone="emerald" title="Campus facilities" hint={`${facilities.length} workshops, labs and spaces.`} right={<button className="text-[11px] text-primary font-bold" onClick={() => setTab('facilities')}>Open facilities →</button>}>
              <Table tone="emerald" columns={[
                { key: 'name', label: 'Facility', render: f => <button className="text-left hover:text-primary" onClick={() => { setTab('facilities'); setFacility(f) }}><div className="font-semibold">{f.name}</div><div className="text-[10px] text-txt-tertiary">{titleCase(f.kind)}{f.linkedTrades?.length ? ` · ${f.linkedTrades.join(', ')}` : ''}</div></button> },
                { key: 'status', label: 'Condition', render: f => <Pill kind={FAC[f.status]?.kind || 'neutral'}>{FAC[f.status]?.label || titleCase(f.status)}</Pill> },
                { key: 'machines', label: 'Machines', align: 'right', render: f => f.machines?.total ?? f.machineCount ?? '—' },
              ]} rows={facilities.slice(0, 5)} empty="No facilities recorded." />
            </Section>
            <Section tone="amber" title="Trade offerings" hint={`${trades.length} courses in the plan.`} right={<button className="text-[11px] text-primary font-bold" onClick={() => setTab('trades')}>Open trade offerings →</button>}>
              <Table tone="amber" columns={[
                { key: 'trade', label: 'Trade / course', render: t => <button className="text-left hover:text-primary" onClick={() => setCourse(t)}><div className="font-semibold">{t.trade.name}</div><div className="text-[10px] text-txt-tertiary">{KIND_LABEL[t.trade.kind] || titleCase(t.trade.kind)} · NSQF {t.trade.nsqfLevel || '—'}</div></button> },
                { key: 'places', label: 'Places (Y1)', align: 'right', render: t => y1(t)?.places ?? '—' },
                { key: 'batches', label: 'Running batches', align: 'right', render: t => t.runningBatches },
                { key: 'launch', label: 'Launch', render: t => <span className="text-[11px]">{t.launch}</span> },
              ]} rows={trades.slice(0, 5)} empty="No courses planned." />
            </Section>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[['🎓', 'Students', 'Search the institute student registry by trade and batch', 'students', 'indigo'], ['👩‍🏫', 'Trainers', 'Review trainer assignments and batch coverage', 'trainers', 'emerald'], ['🗂️', 'Trades & batches', 'See every active batch and its assigned trainer', 'batches', 'violet']].map(([icon, title, desc, id, tone]) => (
              <button key={id} onClick={() => setTab(id)} className="rounded-2xl border border-bdr-light bg-white shadow-card p-4 text-left hover:border-primary/40 transition"><div className="text-[22px] mb-1">{icon}</div><div className="text-[14px] font-bold text-txt-primary">{title}</div><div className="text-[11px] text-txt-secondary mt-0.5 mb-3">{desc}</div><span className="inline-flex items-center px-3 py-1.5 rounded-pill bg-primary text-white text-[11px] font-bold">Open {title.toLowerCase()} →</span></button>
            ))}
          </div>
          {(contacts.principal || contacts.placement) && <Section tone="violet" title="Contacts">
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">{[contacts.principal, contacts.placement].filter(Boolean).map(c => <li key={c.role} className="flex items-center gap-3"><span className="w-9 h-9 rounded-full bg-primary-light text-primary-dark font-bold flex items-center justify-center text-[12px]">{c.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</span><div><div className="font-semibold text-txt-primary">{c.name}</div><div className="text-[10px] text-txt-tertiary">{c.role}{c.phone ? ` · ${c.phone}` : ''}</div></div></li>)}</ul>
          </Section>}
        </div>
      )}
      {tab === 'facilities' && <div className="p-4"><FacilitiesDirectory facilities={facilities} iti={iti} infrastructure={infrastructure} onOpen={setFacility} openCanvas={openCanvas} /></div>}
      {tab === 'trades' && <div className="p-4"><TradeOfferings trades={trades} otherTrades={otherTrades} kb={kb} facilities={facilities} iti={iti} periods={periods} facilityPick={facilityPick} onClearPick={() => setFacilityPick(null)} onOpen={setCourse} /></div>}
      {tab === 'students' && <Students {...scopeProps} f0={f0} onOpen={setStudent} />}
      {tab === 'trainers' && <Trainers {...scopeProps} f0={f0} onOpen={setTrainer} />}
      {tab === 'batches' && <BatchesCanvas context={{ itiId: iti.id, embedded: true }} />}
    </div>
  )
}
