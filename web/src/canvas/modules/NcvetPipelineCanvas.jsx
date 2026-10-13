// NCVET pipeline — course approval: draft → submitted to CSTARI → NCVET
// review → approved. New-course launches are a weighted milestone.
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Stat, StatGrid, Pill, Loading, Btn, useLoad, titleCase } from './_ui.jsx'
import { useSaathiContext, brief } from '../CanvasSaathi.jsx'

const STAGES = ['draft', 'submitted_cstari', 'ncvet_review', 'approved']
const LABEL = { draft: 'Draft', submitted_cstari: 'With CSTARI', ncvet_review: 'NCVET review', approved: 'Approved' }

export default function NcvetPipelineCanvas() {
  const { role, showToast, openCanvas } = useApp()
  const { data, reload } = useLoad(() => api.lmsTrades())
  useSaathiContext(data ? brief(data) : '', ['Which launch gates depend on approvals in the pipeline?'])
  if (!data) return <Loading />
  const trades = data.trades.filter(t => t.kind !== 'aggregate' && t.kind !== 'existing_other')
  const by = s => trades.filter(t => t.status === s)
  async function advance(t) { const next = STAGES[Math.min(STAGES.indexOf(t.status) + 1, STAGES.length - 1)]; await api.tradeStatus(t.id, next); showToast({ kind: 'success', text: `${t.name} → ${LABEL[next]}` }); reload() }
  return (
    <div className="h-full overflow-y-auto">
      <Hero tone="amber" eyebrow="Course approval · CSTARI Kolkata → NCVET" title={`${by('approved').length} approved · ${trades.length - by('approved').length} in pipeline`} subtitle="Six new specialist programmes and one short course launch from Year 2. Approval opens the COURSE launch gate at each ITI; space, staff and students are separate gates." />
      <div className="p-4 space-y-4">
        <StatGrid>{STAGES.map(s => <Stat key={s} label={LABEL[s]} value={by(s).length} tone={s === 'approved' ? 'emerald' : s === 'draft' ? 'slate' : 'amber'} />)}</StatGrid>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
          {STAGES.map(s => (
            <div key={s} className="rounded-2xl bg-surface-page/60 border border-bdr-light p-2 min-h-[200px]">
              <div className="text-[10px] uppercase tracking-wider font-bold text-txt-secondary px-1 mb-2">{LABEL[s]}</div>
              <div className="space-y-2">{by(s).map(t => (
                <div key={t.id} className="rounded-xl bg-white border border-bdr-light p-2.5 shadow-card">
                  <div className="flex items-center gap-1.5 flex-wrap"><Pill kind={t.kind === 'new_specialist' ? 'info' : t.kind === 'short_term' ? 'violet' : 'ok'}>{titleCase(t.kind)}</Pill><span className="text-[10px] text-txt-tertiary">{t.durationValue} {t.durationUnit}</span></div>
                  <div className="text-[12px] font-bold text-txt-primary mt-1">{t.name}</div>
                  <div className="text-[10px] text-txt-secondary">{t.modules.length} modules · {t.modules.filter(m => m.status === 'approved').length} approved · {t._count.batches} batches</div>{t.itis.length > 0 && <div className="text-[10px] text-txt-tertiary mt-0.5">{t.itis.map(i => `${i.iti.code} ${i.launch}${i.gates?.length ? ` (${i.gates.filter(g => g.state === 'passed').length}/${i.gates.length} gates)` : ''}`).join(' · ')}</div>}
                  <div className="flex gap-1 mt-2"><Btn small tone="ghost" onClick={() => openCanvas({ type: 'course_builder', tradeId: t.id })}>Edit</Btn>{(role === 'curriculum_dev' || role === 'spv_ceo') && s !== 'approved' && <Btn small onClick={() => advance(t)}>→ {LABEL[STAGES[STAGES.indexOf(s) + 1]]}</Btn>}</div>
                </div>
              ))}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
