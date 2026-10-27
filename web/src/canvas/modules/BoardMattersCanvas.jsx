// Board & reserved matters — what the SHA reserves to Centre + State, what
// the board decides, what is delegated to the CEO.
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Pill, Section, Loading, Btn, useLoad, fmtDate, fmtCr, stateKind } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

const NEEDS = { 'centre+state': { label: 'Centre + State consent', kind: 'bad' }, state: { label: 'State consent', kind: 'warn' }, board: { label: 'Board resolution', kind: 'info' }, ceo: { label: 'Delegated to CEO', kind: 'ok' } }

export default function BoardMattersCanvas() {
  const { role, showToast } = useApp()
  const { data, reload } = useLoad(() => api.board())
  useSaathiContext(data ? brief(data) : '', ['Which items need Centre and State consent?'])
  if (!data) return <Loading />
  const items = data.items
  const groups = [['Reserved matters (SHA Part A/B)', items.filter(i => i.kind === 'reserved')], ['Delegated matters', items.filter(i => i.kind === 'delegated')]]
  async function decide(i, decision) { await api.boardDecide(i.id, { decision }); showToast({ kind: 'success', text: `${decision} · recorded in board minutes .` }); reload() }
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="violet" eyebrow="Governance · Shareholders' Agreement" title="Board agenda & reserved matters" subtitle="11 directors: AIP chair + 4, Centre 2, State 2, ITI leadership 1, CEO. Quorum for committees needs one Centre and one State director. Intra-envelope reallocations must be reported to SSC/NSC within 15 days." />
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          {Object.entries(NEEDS).map(([k, v]) => <div key={k} className="rounded-xl bg-white border border-bdr-light p-2"><Pill kind={v.kind}>{v.label}</Pill><div className="text-[18px] font-bold mt-1">{items.filter(i => i.needs === k && i.state === 'pending').length}<span className="text-[10px] text-txt-tertiary font-normal"> pending</span></div></div>)}
        </div>
        {groups.map(([title, rows]) => (
          <Section tone="indigo" key={title} title={title}>
            <ul className="divide-y divide-bdr-light/60">
              {rows.map(i => (
                <li key={i.id} className="py-2.5 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-txt-primary">{i.title}</div>
                    <div className="text-[11px] text-txt-secondary mt-0.5 flex flex-wrap gap-x-3"><span>{NEEDS[i.needs]?.label}</span>{i.amountCr != null && <span>{fmtCr(i.amountCr)}</span>}{i.meetingDate && <span>meeting {fmtDate(i.meetingDate)}</span>}</div>
                  </div>
                  <Pill kind={stateKind(i.state)}>{i.state}</Pill>
                  {role === 'spv_ceo' && i.state === 'pending' && i.needs === 'ceo' && <Btn small onClick={() => decide(i, 'approved')}>Approve</Btn>}
                  {role === 'spv_ceo' && i.state === 'pending' && i.needs !== 'ceo' && <Btn small tone="ghost" onClick={() => showToast({ kind: 'info', text: 'Added to next board agenda with consent request .' })}>Table for board</Btn>}
                </li>
              ))}
            </ul>
          </Section>
        ))}
      </div>
    </div>
  )
}
