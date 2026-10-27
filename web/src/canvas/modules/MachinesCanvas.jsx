// Machines & labs — the asset register. "Verifiable technology adoption" is a
// License Agreement KPI; installed-but-not-commissioned is the usual gap.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Pill, Section, Table, Loading, useLoad, fmtDate, stateKind, titleCase } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

const STATUSES = ['functional', 'awaiting_commissioning', 'ordered', 'non_functional', 'baseline_obsolete']

export default function MachinesCanvas({ context }) {
  const { role, showToast } = useApp()
  const { data: itis } = useLoad(() => api.itis())
  const [itiId, setItiId] = useState(context?.itiId || 'mine')
  const { data, reload } = useLoad(() => api.itiDashboard(itiId), [itiId])
  const [filter, setFilter] = useState('all')
  useSaathiContext(data ? brief(data) : '', ['Which machines are not functional and what is affected?'])
  if (!data) return <Loading />
  const { iti, machines, machineStats } = data
  const list = machines.filter(m => filter === 'all' || m.status === filter)
  const canEdit = ['iti_principal', 'spv_ceo', 'trainer'].includes(role)
  async function set(m, status) { await api.machineStatus(m.id, status); showToast({ kind: 'success', text: `${m.name}: ${titleCase(status)}` }); reload() }
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="teal" eyebrow="Asset register · verifiable technology adoption" title={`${iti.name} · ${machineStats.total} assets`} subtitle="Baseline machines, SIP procurements and industry donations. Status changes here feed the equipment component of the KPI score."
        right={role !== 'iti_principal' && role !== 'trainer' && itis ? <select value={itiId} onChange={e => setItiId(e.target.value)} className="text-[12px] rounded-lg border border-bdr px-2 py-1.5 bg-white">{itis.itis.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select> : null} />
      <div className="p-4 space-y-4">
        <StatGrid>
          <Stat label="Functional" value={machineStats.functional} tone="emerald" onClick={() => setFilter('functional')} />
          <Stat label="Awaiting commissioning" value={machineStats.awaiting} sub="delivered, not usable" tone="amber" onClick={() => setFilter('awaiting_commissioning')} />
          <Stat label="Ordered" value={machineStats.ordered} tone="sky" onClick={() => setFilter('ordered')} />
          <Stat label="Non-functional / obsolete" value={machineStats.nonFunctional} tone="rose" onClick={() => setFilter('non_functional')} />
        </StatGrid>
        <div className="flex gap-2 flex-wrap">{['all', ...STATUSES].map(f => <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-pill text-[11px] font-bold border ${filter === f ? 'bg-primary text-white border-primary' : 'bg-white border-bdr text-txt-secondary'}`}>{titleCase(f)}</button>)}</div>
        <Section tone="indigo" title="Register">
          <Table tone="indigo" columns={[
            { key: 'name', label: 'Asset', render: r => <div><div className="font-semibold">{r.name}</div><div className="text-[10px] text-txt-tertiary">{r.trade?.name || titleCase(r.category)} · {titleCase(r.source)}</div></div> },
            { key: 'status', label: 'Status', render: r => <Pill kind={stateKind(r.status)}>{titleCase(r.status)}</Pill> },
            { key: 'installedAt', label: 'Installed', render: r => fmtDate(r.installedAt) },
            { key: 'lastServiceAt', label: 'Last service', render: r => fmtDate(r.lastServiceAt) },
            { key: 'act', label: '', align: 'right', render: r => canEdit ? <select value={r.status} onChange={e => set(r, e.target.value)} className="text-[11px] rounded-lg border border-bdr px-1.5 py-1 bg-white">{STATUSES.map(s => <option key={s} value={s}>{titleCase(s)}</option>)}</select> : null },
          ]} rows={list} />
        </Section>
      </div>
    </div>
  )
}
