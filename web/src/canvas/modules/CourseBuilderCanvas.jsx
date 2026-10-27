// Course builder (CMS) — trades → 240-hour modules → lessons. Three core
// modules are fixed nationally; the two specific modules, OJT and add-on are
// the SPV's to design. Saathi drafts lessons; the developer edits and saves.
import { useState } from 'react'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { Hero, Pill, Section, Loading, Btn, useLoad, titleCase, stateKind } from './_ui.jsx'
import { Plus, Trash2, Save, Sparkles } from 'lucide-react'
import AvatarCall from '../../components/AvatarCall.jsx'

export default function CourseBuilderCanvas({ context }) {
  const { showToast } = useApp()
  const { data, reload } = useLoad(() => api.lmsTrades())
  const [tradeId, setTradeId] = useState(context?.tradeId || null)
  const [moduleId, setModuleId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [pending, setPending] = useState(null)
  const [creating, setCreating] = useState(false)
  if (!data) return <Loading />
  const trade = data.trades.find(t => t.id === tradeId) || data.trades.find(t => t.code === 'AUT') || data.trades[0]
  const mod = trade.modules.find(m => m.id === moduleId) || trade.modules.find(m => m.kind === 'specific') || trade.modules[0]
  const lessons = draft?.moduleId === mod.id ? draft.lessons : mod.lessons
  const hours = lessons.reduce((s, l) => s + (l.minutes || 0), 0) / 60
  function edit(i, patch) { setDraft({ moduleId: mod.id, lessons: lessons.map((l, k) => k === i ? { ...l, ...patch } : l) }) }
  function add() { setDraft({ moduleId: mod.id, lessons: [...lessons, { title: 'New lesson', type: 'practical', minutes: 120 }] }) }
  function remove(i) { setDraft({ moduleId: mod.id, lessons: lessons.filter((_, k) => k !== i) }) }
  async function save() { await api.updateModule(mod.id, { lessons, status: mod.status === 'approved' ? 'review' : mod.status }); showToast({ kind: 'success', text: 'Module saved · marked for review.' }); setDraft(null); reload() }
  async function createTrade(e) {
    e.preventDefault(); const f = new FormData(e.target)
    const t = await api.createTrade({ code: f.get('code'), name: f.get('name'), sector: f.get('sector'), nsqfLevel: Number(f.get('nsqf')), kind: f.get('kind'), totalHours: Number(f.get('hours') || 240) })
    showToast({ kind: 'success', text: 'Programme scaffolded with 240-hour modules + OJT.' }); setCreating(false); setTradeId(t.trade.id); reload()
  }
  const ctx = `Curriculum developer is editing ${trade.name} (${titleCase(trade.kind)}, NSQF ${trade.nsqfLevel}), module ${mod.index} "${mod.title}" (${mod.kind}, ${mod.hours} h). Current lessons: ${lessons.map(l => `${l.title} [${l.type}, ${l.minutes} min]`).join('; ')}. Propose lesson sequences with learning outcomes aligned to NOS/NSQF, practical:theory ≈ 70:30, assessment checklists, and Delhi industry context (contractors, fabrication units, machine shops, HVAC service). Launch gates (COURSE) for new programmes open only when the trade is approved. Keep ITI learner level (10th pass).`
  return (
    <div className="h-full flex flex-col">
      <Hero tone="indigo" eyebrow="CMS · 240-hour modules · 8 credits each" title={trade.name} subtitle={`${titleCase(trade.kind)} · ${trade.durationValue} ${trade.durationUnit} · ${trade.modules.length} modules · status ${trade.status.replace(/_/g, ' ')} · ${trade.itis.length ? `offered at ${trade.itis.map(i => i.iti.code).join(', ')}` : 'registry programme (OTH)'}`}
        right={<div className="flex gap-1.5 items-center"><select value={trade.id} onChange={e => { setTradeId(e.target.value); setModuleId(null); setDraft(null) }} className="text-[12px] rounded-lg border border-bdr px-2 py-1.5 bg-white max-w-[220px]">{data.trades.filter(t => t.kind !== 'aggregate').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select><Btn small tone="ghost" onClick={() => setCreating(c => !c)}><Plus className="w-3 h-3" /> Trade</Btn></div>} />
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_380px]">
        <div className="overflow-y-auto p-4 space-y-3">
          {creating && (
            <form onSubmit={createTrade} className="rounded-2xl border border-primary/30 bg-primary-light/30 p-3 grid grid-cols-2 md:grid-cols-3 gap-2 text-[12px]">
              <input name="code" required placeholder="Code (e.g. DRONE)" className="rounded-lg border border-bdr px-2 py-2 bg-white" /><input name="name" required placeholder="Trade name" className="rounded-lg border border-bdr px-2 py-2 bg-white md:col-span-2" />
              <input name="sector" required placeholder="Sector" className="rounded-lg border border-bdr px-2 py-2 bg-white" /><input name="nsqf" type="number" defaultValue="4" className="rounded-lg border border-bdr px-2 py-2 bg-white" />
              <select name="kind" className="rounded-lg border border-bdr px-2 py-2 bg-white"><option value="new_specialist">New specialist programme</option><option value="existing_core">Existing core trade</option><option value="existing_other">Existing (other)</option><option value="short_term">Short-term</option></select>
              <div className="md:col-span-3 flex justify-end"><Btn type="submit" small>Scaffold modules</Btn></div>
            </form>
          )}
          <div className="flex gap-1.5 overflow-x-auto pb-1">{trade.modules.map(m => <button key={m.id} onClick={() => { setModuleId(m.id); setDraft(null) }} className={`flex-shrink-0 text-left rounded-xl border px-3 py-2 ${m.id === mod.id ? 'border-primary bg-primary-light/40' : 'border-bdr-light bg-white'}`}><div className="text-[10px] font-bold text-primary">M{m.index} · {m.kind}{m.kind === 'core' ? ' · fixed' : ''}</div><div className="text-[12px] font-bold truncate max-w-[180px]">{m.title}</div><div className="text-[10px] text-txt-tertiary">{m.hours} h · {m.credits} cr · <span className={stateKind(m.status) === 'ok' ? 'text-emerald-700' : 'text-amber-700'}>{m.status}</span></div></button>)}</div>
          <Section tone="indigo" title={`M${mod.index} · ${mod.title}`} hint={mod.kind === 'core' ? 'Core module: content fixed nationally by DGT/CSTARI; you may add local examples only.' : 'SPV-designed: tailor to the AIP and cluster industry.'} right={<div className="flex gap-1"><Btn small tone="ghost" onClick={add}><Plus className="w-3 h-3" /> Lesson</Btn><Btn small onClick={save} disabled={!draft}><Save className="w-3 h-3" /> Save</Btn></div>}>
            <div className="text-[11px] text-txt-secondary mb-2">{lessons.length} lessons · {hours.toFixed(1)} h planned of {mod.hours} h · <Pill kind={hours > mod.hours ? 'bad' : 'ok'}>{hours > mod.hours ? 'over budget' : 'within hours'}</Pill></div>
            <ul className="space-y-1.5">
              {lessons.map((l, i) => (
                <li key={i} className="flex items-center gap-2">
                  <input value={l.title} onChange={e => edit(i, { title: e.target.value })} className="flex-1 rounded-lg border border-bdr-light px-2 py-1.5 text-[12px]" />
                  <select value={l.type} onChange={e => edit(i, { type: e.target.value })} className="rounded-lg border border-bdr-light px-1.5 py-1.5 text-[11px] bg-white">{['video', 'text', 'practical', 'quiz'].map(t => <option key={t}>{t}</option>)}</select>
                  <input type="number" value={l.minutes} onChange={e => edit(i, { minutes: Number(e.target.value) })} className="w-20 rounded-lg border border-bdr-light px-2 py-1.5 text-[12px]" />
                  <span className="text-[10px] text-txt-tertiary">min</span>
                  <button onClick={() => remove(i)} className="p-1 text-txt-tertiary hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </li>
              ))}
            </ul>
            <div className="mt-2"><button onClick={() => setPending({ text: `Draft a full lesson sequence for module ${mod.index} "${mod.title}" of ${trade.name}: 6-8 lessons with type (video/text/practical/quiz), minutes totalling ~${mod.hours * 60} minutes, and one learning outcome each.`, nonce: Date.now() })} className="inline-flex items-center gap-1 text-[11px] font-bold text-primary"><Sparkles className="w-3 h-3" /> Ask Saathi to draft this module</button></div>
          </Section>
        </div>
        <div className="border-l border-bdr-light min-h-[320px]"><AvatarCall persona="general" title="Saathi · Curriculum" useWebSearch extraSystem={ctx} pendingPrompt={pending} threadId={context?.threadId} suggestions={['Write learning outcomes for this module', 'Suggest a practical job sheet', 'Map lessons to NOS codes']} /></div>
      </div>
    </div>
  )
}
