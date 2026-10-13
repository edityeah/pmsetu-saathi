// Grievance register (SPV / principal). The SPV must run an accessible,
// responsive grievance mechanism — it is an E&S obligation and a KPI input.
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Pill, Section, Loading, Btn, useLoad, fmtDate, stateKind, titleCase } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

export default function GrievancesAdminCanvas() {
  const { role, showToast } = useApp()
  const { data, reload } = useLoad(() => api.grievances())
  useSaathiContext(data ? brief(data) : '', ['Which grievances are open the longest?'])
  if (!data) return <Loading />
  const g = data.grievances
  const open = g.filter(x => x.status === 'open'), inv = g.filter(x => x.status === 'investigating'), res = g.filter(x => x.status === 'resolved')
  const ageDays = (x) => Math.floor((Date.now() - new Date(x.createdAt).getTime()) / 86400000)
  async function set(x, status) { const note = status === 'resolved' ? window.prompt('Resolution note', 'Resolved with the ITI principal.') || 'Resolved.' : undefined; await api.grievanceStatus(x.id, { status, resolutionNote: note }); showToast({ kind: 'success', text: `Marked ${status}.` }); reload() }
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="rose" eyebrow="Grievance redressal · E&S obligation" title={`${open.length + inv.length} open grievances`} subtitle="Trainees and staff raise issues through Saathi; the ITI and SPV must resolve within SLA. Patterns feed the quarterly report." />
      <div className="p-4 space-y-4">
        <StatGrid cols={3}>
          <Stat label="Open" value={open.length} sub={open.some(x => ageDays(x) > 7) ? 'some older than 7 days' : 'within SLA'} tone={open.some(x => ageDays(x) > 7) ? 'rose' : 'amber'} />
          <Stat label="Investigating" value={inv.length} tone="sky" />
          <Stat label="Resolved" value={res.length} tone="emerald" />
        </StatGrid>
        <Section title="Register">
          <ul className="divide-y divide-bdr-light/60">
            {g.map(x => (
              <li key={x.id} className="py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap"><Pill kind="violet">{titleCase(x.category)}</Pill><Pill kind={stateKind(x.status)}>{x.status}</Pill><span className="text-[10px] text-txt-tertiary">{ageDays(x)}d · {x.iti?.name || 'cluster'}</span></div>
                  <div className="text-[13px] text-txt-primary mt-1">{x.note}</div>
                  <div className="text-[10px] text-txt-tertiary mt-0.5">by {x.raisedBy.name} ({titleCase(x.raisedBy.role)}) · {fmtDate(x.createdAt)}{x.resolutionNote ? ` · resolution: ${x.resolutionNote}` : ''}</div>
                </div>
                {(role === 'spv_ceo' || role === 'iti_principal') && x.status !== 'resolved' && (
                  <div className="flex gap-1 flex-shrink-0">{x.status === 'open' && <Btn small tone="ghost" onClick={() => set(x, 'investigating')}>Investigate</Btn>}<Btn small tone="ok" onClick={() => set(x, 'resolved')}>Resolve</Btn></div>
                )}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  )
}
