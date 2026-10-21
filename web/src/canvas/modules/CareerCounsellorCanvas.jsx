// Career counsellor (student) — Karuna for ITI trainees, built the Disha way
// but grounded in the student's own record: a progressive profile (record 30,
// assessment 30, conversation 40), a 10-minute interest and personality
// assessment on ITI activities, and a career report whose pathways name
// cluster options. Chat stays the centre; the panel above tracks progress.
import { useEffect, useState } from 'react'
import { BarChart, Bar as RBar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, LabelList } from 'recharts'
import AvatarCall from '../../components/AvatarCall.jsx'
import { api } from '../../api/client.js'
import { useApp } from '../../context/AppContext.jsx'
import { useLoad, Loading, Hero, Stat, StatGrid, Section, Pill, Btn, Bar, fmtDate } from './_ui.jsx'
import { DetailPage, DetailCard, LabelGrid } from './_Detail.jsx'
import { ChevronRight } from 'lucide-react'

const tip = { background: 'white', border: '1px solid #CFD8E6', borderRadius: 8, fontSize: 11 }
const SRC = { record: { kind: 'info', label: 'From record' }, assessment: { kind: 'ok', label: 'Assessment' }, stated: { kind: 'warn', label: 'You said' } }

export default function CareerCounsellorCanvas({ context }) {
  const { meExtra, showToast, openCanvas } = useApp()
  const { data: d, reload } = useLoad(() => api.career())
  const [view, setView] = useState('chat') // chat | assessment | report
  const [pending, setPending] = useState(null), [onCall, setOnCall] = useState(false), [showKnown, setShowKnown] = useState(false), [busy, setBusy] = useState(false)
  useEffect(() => { const id = setInterval(reload, 20000); return () => clearInterval(id) }, [reload])
  if (!d) return <Loading />
  const t = meExtra?.trainee
  const c = d.completeness
  async function generate() {
    setBusy(true)
    try { await api.careerReport(); showToast({ kind: 'success', text: 'Your career report is ready.' }); reload(); setView('report') }
    catch (e) { showToast({ kind: 'warn', text: /assessment_required/.test(e.message) ? 'Take the psychometric assessment first; the report is built on it.' : e.message }) }
    finally { setBusy(false) }
  }
  function onCard(card) {
    if (card?.type === 'take_assessment') { setView('assessment'); return true }
    if (card?.type === 'generate_report') { generate(); return true }
    return false
  }
  if (view === 'assessment') return <Assessment onBack={() => setView('chat')} onDone={(a) => { reload(); setView('chat'); setPending({ text: `I finished the psychometric assessment. What does it say about me, and what does it mean for roles after ${d.trainee.trade || 'my trade'}?`, nonce: Date.now() }) }} />
  if (view === 'report') return <Report onBack={() => setView('chat')} openCanvas={openCanvas} onRegenerate={generate} busy={busy} />
  const ctx = `STUDENT RECORD: ${d.trainee.name}, ${d.record.education || ''} pass, ${d.trainee.trade || 'trade not set'} (${d.trainee.tradeCode || ''}), ${d.trainee.batch || ''}, ${d.trainee.iti}; ${d.record.current_stage}; attendance ${d.record.attendance ?? '—'}% (15 days), marks ${d.record.marks ?? '—'}% average, ${d.record.practicals} practicals demonstrated, ${d.record.modulesDone} modules done.
PROFILE SO FAR (${c.total} of 100; record ${c.record}, assessment ${c.assessment}, conversation ${c.conversation}; report ${c.reportUnlocked ? 'available' : 'available after the assessment'}): ${d.known.filter(k => k.source === 'stated' && k.value).map(k => `${k.label}: ${k.value}`).join('; ') || 'nothing stated yet'}.
ASSESSMENT: ${d.assessment ? `done on ${fmtDate(d.assessment.completed_at)} · Holland ${d.assessment.holland_code} · ${d.assessment.top.join(', ')}` : 'not taken'}.
STILL TO LEARN (ask one at a time, naturally): ${d.probes.join(' | ') || 'nothing; encourage the report'}.
ROLE MAP for ${d.trainee.tradeCode || 'this trade'}: ${d.roles.map(r => `${r.roleName}: ${r.summary}; progression ${r.progression}; entry ${r.entryPathway}`).join(' | ') || 'none in KB'}.
LIVE OPPORTUNITIES for this trade: ${d.opportunities.map(o => `${o.title} at ${o.employer} (${o.type}${o.pay ? ', ' + o.pay : ''}, ${o.location}, ${o.openings} open)`).join(' | ') || 'none right now'}.
READINESS: ${d.readiness.map(r => `${r.label} ${r.score}`).join(', ')}.`
  const chips = [
    { title: 'What should I focus on this month?', prompt: 'Looking at my attendance, marks, practicals and applications, what should I focus on this month to be placement-ready?' },
    { title: `Roles after ${d.trainee.tradeCode || 'my trade'}`, prompt: `${d.trainee.trade || 'Mere trade'} ke baad kaunse entry roles hain, kya kaam hota hai, aur Delhi NCR mein starting pay kya hoti hai?` },
    { title: 'Apprenticeship or job?', prompt: 'Apprenticeship pehle karun ya seedha wage job? Mere liye kya sahi hai?' },
    { title: 'Stay near home?', prompt: 'Ghar ke paas hi kaam karna hai. Kaunse live opportunities mere trade ke liye abhi hain?' },
  ]
  return (
    <div className="flex flex-col h-full">
      {!onCall && (
        <div className="px-4 pt-4 pb-3 bg-gradient-to-br from-fuchsia-50/70 to-white border-b border-bdr-light flex-shrink-0 max-h-[58vh] overflow-y-auto space-y-3">
          <div><div className="text-[11px] font-bold uppercase tracking-[2px] text-fuchsia-700">Karuna · Career counsellor for {d.trainee.trade || 'your trade'}</div><h2 className="text-[18px] font-bold text-txt-primary leading-tight mt-1">Hi {t?.name?.split(' ')[0] || 'there'}, let's plan after {d.trainee.trade || 'your course'}</h2></div>
          <div className="rounded-2xl border border-bdr-light bg-white p-3">
            <div className="flex items-center justify-between text-[11px]"><span className="font-bold text-txt-primary">Karuna knows you {c.total}%</span><button className="text-primary font-bold" onClick={() => setShowKnown(x => !x)}>{showKnown ? 'Hide' : 'What Karuna knows'} →</button></div>
            <div className="mt-1.5 h-2.5 rounded-full bg-surface-page overflow-hidden flex"><div className="h-full bg-sky-400" style={{ width: `${c.record}%` }} title="ITI record" /><div className="h-full bg-emerald-400" style={{ width: `${c.assessment}%` }} title="Assessment" /><div className="h-full bg-amber-400" style={{ width: `${c.conversation}%` }} title="Conversation" /></div>
            <div className="mt-1 flex gap-3 text-[10px] text-txt-tertiary"><span><span className="inline-block w-2 h-2 rounded-full bg-sky-400 mr-1" />Record {c.record}/30</span><span><span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1" />Assessment {c.assessment}/30</span><span><span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />Conversation {c.conversation}/40</span></div>
            {showKnown && <ul className="mt-2 divide-y divide-bdr-light/60">{d.known.filter(k => k.value).map(k => <li key={k.key} className="py-1.5 flex items-start gap-2 text-[11px]"><span className="w-36 text-txt-tertiary flex-shrink-0">{k.label}</span><span className="flex-1 text-txt-primary">{k.value}</span><Pill kind={SRC[k.source].kind}>{SRC[k.source].label}</Pill></li>)}{d.probes.length > 0 && <li className="py-1.5 text-[11px] text-txt-tertiary">Still to learn: {d.probes.join(' · ')}</li>}</ul>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button onClick={() => setView('assessment')} className="text-left rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 hover:border-emerald-400"><div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Psychometric assessment</div>{d.assessment ? <><div className="text-[13px] font-bold text-txt-primary mt-0.5">Completed</div><div className="text-[10px] text-txt-tertiary">done {fmtDate(d.assessment.completed_at)} · tap to retake</div></> : <><div className="text-[13px] font-bold text-txt-primary mt-0.5">Find out what work suits you</div><div className="text-[10px] text-txt-tertiary">10 minutes · 34 items</div></>}</button>
            <button onClick={() => d.report ? setView('report') : generate()} disabled={busy} className={`text-left rounded-2xl border p-3 ${c.reportUnlocked || d.report ? 'border-fuchsia-300 bg-fuchsia-50/60 hover:border-fuchsia-400' : 'border-bdr-light bg-surface-page/60'}`}><div className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-700">Career report</div>{d.report ? <><div className="text-[13px] font-bold text-txt-primary mt-0.5">Open my report</div><div className="text-[10px] text-txt-tertiary">generated {fmtDate(d.report.generatedAt)} · regenerate inside</div></> : c.reportUnlocked ? <><div className="text-[13px] font-bold text-txt-primary mt-0.5">{busy ? 'Writing your report…' : 'Generate my career report'}</div><div className="text-[10px] text-txt-tertiary">pathways with cluster options · next 3 actions</div></> : <><div className="text-[13px] font-bold text-txt-secondary mt-0.5">Available after the assessment</div><div className="text-[10px] text-txt-tertiary">built on your record, your answers and what you tell Karuna</div></>}</button>
          </div>
          <div className="grid grid-cols-2 gap-2">{chips.map((a, i) => <button key={i} onClick={() => setPending({ text: a.prompt, nonce: Date.now() })} className="text-left rounded-2xl border border-bdr-light bg-white hover:border-fuchsia-400 p-2.5 flex items-center gap-2"><div className="font-bold text-[12px] leading-tight flex-1">{a.title}</div><ChevronRight className="w-3 h-3 text-txt-tertiary" /></button>)}</div>
          {d.roles.length > 0 && <div className="flex gap-1.5 flex-wrap">{d.roles.slice(0, 4).map(r => <button key={r.id} onClick={() => setPending({ text: `I want to become a ${r.roleName}. Where am I now, what is the gap, and what is my next step this month?`, nonce: Date.now() })} className="text-[11px] px-2.5 py-1 rounded-pill bg-white border border-bdr hover:border-fuchsia-400">{r.roleName}</button>)}</div>}
        </div>
      )}
      <div className="flex-1 min-h-0">
        <AvatarCall persona="career-counsellor" title="Karuna" intro={d.assessment ? 'Assessment ho gaya. Ab batao, aage kya sochte ho?' : `${d.trainee.trade || 'Course'} ke baad kya karna hai, yeh saath mein plan karte hain. Pehla sawaal: course ke baad kaunse kaam ke baare mein socha hai?`} useWebSearch={false} extraSystem={ctx} pendingPrompt={pending} threadId={context?.threadId} onCallStateChange={(s) => setOnCall(s !== 'idle')} onCard={onCard}
          suggestions={[`${d.trainee.trade || 'Mere trade'} ke baad sabse pehla job kya hota hai?`, 'Mujhe placement ke liye kya kami hai?', 'Apprenticeship vs direct job?']} />
      </div>
    </div>
  )
}

// ── Assessment: ITI activities (interest) and statement pairs (personality) ──
function Assessment({ onBack, onDone }) {
  const { showToast } = useApp()
  const { data: items } = useLoad(() => api.careerItems())
  const [step, setStep] = useState(0), [answers, setAnswers] = useState({}), [busy, setBusy] = useState(false), [consent, setConsent] = useState(false)
  if (!items) return <Loading />
  const all = [...items.interest.map(i => ({ ...i, kind: 'interest' })), ...items.personality.map(p => ({ ...p, kind: 'personality' }))]
  const cur = all[step]
  const done = Object.keys(answers).length
  async function submit() {
    setBusy(true)
    try { const r = await api.careerAssess(Object.entries(answers).map(([itemId, value]) => ({ itemId, value }))); showToast({ kind: 'success', text: 'Assessment completed.' }); onDone(r.assessment) }
    catch (e) { showToast({ kind: 'danger', text: e.message }) } finally { setBusy(false) }
  }
  const pick = v => { setAnswers(a => ({ ...a, [cur.id]: v })); if (step < all.length - 1) setStep(step + 1) }
  return (
    <DetailPage onBack={onBack} eyebrow="Psychometric assessment" title={consent ? `${Math.min(step + 1, all.length)} of ${all.length}` : 'Get to know yourself better'} id={consent ? (cur.kind === 'interest' ? 'How interested would you be in doing this regularly at work?' : 'Which side is more like you, most of the time?') : '10 minutes · 34 items'} sub={consent ? (cur.kind === 'interest' ? 'Interest only: not whether you can do it or whether it is popular.' : 'There are no right answers.') : 'Your answers are used only for career guidance and stay with you.'}>
      {!consent ? (
        <DetailCard title="Before you start" icon="🧭">
          <p className="text-[13px] text-txt-primary leading-relaxed">Twenty-four ITI activities: say how interested you would be in doing each one regularly at work. Then ten pairs of statements: pick the side more like you. There are no right or wrong answers; answer as you are, not as you think a trainer wants.</p>
          <label className="mt-3 flex items-start gap-2 text-[12px] text-txt-secondary"><input type="checkbox" className="mt-0.5" onChange={e => setConsent(e.target.checked)} /> I understand this is for my own career guidance and I am taking it voluntarily.</label>
        </DetailCard>
      ) : (
        <>
          <Bar pct={Math.round(100 * done / all.length)} tone="emerald" height="h-2" />
          <DetailCard title={cur.kind === 'interest' ? 'Work activity' : 'Which is more like you?'} icon={cur.kind === 'interest' ? cur.icon : '⚖️'}>
            {cur.kind === 'interest' ? (
              <>
                <div className="text-[16px] font-bold text-txt-primary leading-snug">{cur.text}</div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-5 gap-2">{items.interestOptions.map((o, i) => <button key={o} onClick={() => pick(i + 1)} className={`rounded-xl border px-3 py-2.5 text-[12px] font-semibold ${answers[cur.id] === i + 1 ? 'bg-primary text-white border-primary' : 'bg-white border-bdr hover:border-primary'}`}>{o}</button>)}</div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-sky-50 p-3 text-[13px] font-semibold text-txt-primary">{cur.left}</div><div className="rounded-xl bg-amber-50 p-3 text-[13px] font-semibold text-txt-primary">{cur.right}</div></div>
                <div className="mt-4 grid grid-cols-5 gap-2">{items.personalityOptions.map((o, i) => <button key={i} onClick={() => pick(i + 1)} className={`rounded-xl border px-2 py-2.5 text-[11px] font-semibold ${answers[cur.id] === i + 1 ? 'bg-primary text-white border-primary' : 'bg-white border-bdr hover:border-primary'}`}>{i < 2 ? '◀ ' : i > 2 ? '▶ ' : ''}{o}</button>)}</div>
                <div className="mt-1 flex justify-between text-[10px] text-txt-tertiary"><span>left statement</span><span>right statement</span></div>
              </>
            )}
          </DetailCard>
          <div className="flex items-center justify-between gap-2 flex-wrap"><Btn tone="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>Previous</Btn><div className="text-[11px] text-txt-tertiary">{done} of {all.length} answered</div>{done >= all.length ? <Btn tone="ok" onClick={submit} disabled={busy}>{busy ? 'Scoring…' : 'See my results'}</Btn> : <Btn tone="ghost" onClick={() => setStep(Math.min(all.length - 1, step + 1))}>Skip for now</Btn>}</div>
        </>
      )}
    </DetailPage>
  )
}

// ── Report ─────────────────────────────────────────────────────────────────
function Report({ onBack, openCanvas, onRegenerate, busy }) {
  const { showToast } = useApp()
  const { data } = useLoad(() => api.careerReportGet())
  const [ticks, setTicks] = useState({})
  if (!data) return <Loading />
  const r = data.report
  if (!r) return <DetailPage onBack={onBack} eyebrow="Career report" title="No report yet" sub="Generate it from the counsellor panel once Karuna knows you well enough."><div /></DetailPage>
  const bars = (rows, color) => <div style={{ height: rows.length * 30 + 10 }}><ResponsiveContainer><BarChart data={rows} layout="vertical" margin={{ top: 2, right: 28, left: 4, bottom: 0 }} barCategoryGap={6}><XAxis type="number" domain={[0, 10]} hide /><YAxis type="category" dataKey="name" width={170} fontSize={10} stroke="#7383A5" interval={0} /><Tooltip contentStyle={tip} formatter={(v, n, p) => [`${v} of 10 · ${p.payload.level}`, 'Score']} /><RBar dataKey="sten" radius={[0, 6, 6, 0]}>{rows.map((x, i) => <Cell key={x.key} fill={color} opacity={0.45 + 0.55 * (x.sten / 10)} />)}<LabelList dataKey="sten" position="right" fontSize={10} fill="#1A1F36" /></RBar></BarChart></ResponsiveContainer></div>
  async function askHuman() { try { await api.createReferral({ kind: 'counselling', summary: 'Discuss my career report and next steps', toRole: 'trainer', share: { report: 'career report', nextActions: r.nextActions } }); showToast({ kind: 'success', text: 'Sent to your trainer. You will see the reply under Help from institute.' }) } catch (e) { showToast({ kind: 'danger', text: e.message }) } }
  return (
    <DetailPage onBack={onBack} eyebrow={`Career report · ${r.snapshot.trade || 'ITI'} · generated ${fmtDate(r.generatedAt)}`} title={r.snapshot.name} id={r.hollandCode ? 'Psychometric assessment completed' : 'Psychometric assessment pending'} sub={`${r.snapshot.stage} · ${r.snapshot.batch || ''} · ${r.snapshot.iti}`} pill={{ kind: r.source === 'model' ? 'ok' : 'warn', label: r.source === 'model' ? 'Written by Karuna' : 'Template (no model key)' }}>
      <DetailCard title="Snapshot" icon="🪪">
        <p className="text-[13px] text-txt-primary leading-relaxed">{r.summary}</p>
        <div className="mt-3"><StatGrid><Stat label="Attendance" value={r.snapshot.attendance != null ? `${r.snapshot.attendance}%` : '—'} sub="last 15 days" tone="indigo" /><Stat label="Marks" value={r.snapshot.marks != null ? `${r.snapshot.marks}%` : '—'} sub="average so far" tone="violet" /><Stat label="Practicals" value={r.snapshot.practicals} sub="demonstrated" tone="emerald" /><Stat label="Modules done" value={r.snapshot.modulesDone} sub="completed" tone="sky" /></StatGrid></div>
      </DetailCard>
      <DetailCard title="Interests and personality" icon="🧭">
        {r.interests ? <div className="grid grid-cols-1 lg:grid-cols-2 gap-4"><div><div className="text-[10px] uppercase tracking-wider font-bold text-txt-tertiary mb-1">Work interests (RIASEC)</div>{bars(r.interests, '#386AF6')}</div><div><div className="text-[10px] uppercase tracking-wider font-bold text-txt-tertiary mb-1">Personality (Big-5)</div>{bars(r.personality, '#8B5CF6')}</div></div> : <div className="text-[12px] text-txt-tertiary">Assessment not taken yet; the report uses your record and what you told Karuna.</div>}
        {r.interestNarrative && <p className="text-[12px] text-txt-secondary mt-3">{r.interestNarrative}</p>}
      </DetailCard>
      <DetailCard title="Readiness" icon="🎯">
        <ul className="space-y-2.5">{r.readiness.map(x => <li key={x.key} className="text-[12px]"><div className="flex justify-between"><span className="font-semibold">{x.label}</span><span className="text-txt-tertiary">{x.score}</span></div><Bar pct={x.score} tone="auto" /><div className="text-[10px] text-txt-tertiary mt-0.5">{x.why}</div></li>)}</ul>
        {r.readinessNote && <p className="text-[12px] text-txt-secondary mt-3">{r.readinessNote}</p>}
      </DetailCard>
      <DetailCard title="Pathways that fit" icon="🛤️">
        <ol className="space-y-3">{(r.pathways || []).map((p, i) => <li key={i} className="rounded-2xl border border-bdr-light bg-surface-page/40 p-3.5"><div className="flex items-start gap-3"><span className="w-7 h-7 rounded-full bg-primary text-white text-[12px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span><div className="flex-1 min-w-0"><div className="text-[13px] font-bold text-txt-primary">{p.title}</div><div className="text-[12px] text-txt-secondary mt-0.5">{p.fit}</div>{p.options?.length > 0 && <ul className="mt-2 flex flex-wrap gap-1.5">{p.options.map((o, j) => <li key={j} className="text-[11px] px-2.5 py-1 rounded-pill bg-white border border-bdr">{o}</li>)}</ul>}{p.firstStep && <div className="text-[11px] text-txt-primary mt-2">→ First step: {p.firstStep}</div>}{p.caution && <div className="text-[10px] text-amber-800 mt-1">⚠ {p.caution}</div>}</div></div></li>)}</ol>
      </DetailCard>
      <DetailCard title="Next 30 days" icon="✅">
        <ul className="space-y-2">{(r.nextActions || []).map((a, i) => <li key={i}><label className="flex items-start gap-2 text-[13px] text-txt-primary"><input type="checkbox" className="mt-1" checked={!!ticks[i]} onChange={e => setTicks(x => ({ ...x, [i]: e.target.checked }))} /><span className={ticks[i] ? 'line-through text-txt-tertiary' : ''}>{a}</span></label></li>)}</ul>
        {r.humanHelp && <div className="mt-3 rounded-xl bg-surface-page px-3 py-2 text-[12px] text-txt-secondary">{r.humanHelp}</div>}
        <div className="mt-3 flex gap-2 flex-wrap"><Btn onClick={askHuman}>Discuss with my trainer</Btn><Btn tone="ghost" onClick={() => openCanvas({ type: 'placement_journey' })}>Open my placement KPIs</Btn><Btn tone="ghost" onClick={() => openCanvas({ type: 'resume_builder' })}>Update my résumé</Btn><Btn tone="ghost" onClick={onRegenerate} disabled={busy}>{busy ? 'Writing…' : 'Regenerate'}</Btn></div>
      </DetailCard>
      <div className="text-[10px] text-txt-tertiary">Pathways name only options that exist in the cluster today: live opportunities, cluster employers, programmes and the role map. No wage or placement is promised.</div>
    </DetailPage>
  )
}
