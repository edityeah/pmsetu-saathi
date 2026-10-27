// Shared canvas primitives — hero band, stat tiles, progress bars, pills,
// tables, empty/loading states. Every PM-SETU canvas composes these so the
// prototype reads as one product.

import { useEffect, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'

export const TONE_BG = {
  indigo: 'from-indigo-50/80', emerald: 'from-emerald-50/80', amber: 'from-amber-50/80', rose: 'from-rose-50/80',
  sky: 'from-sky-50/80', violet: 'from-violet-50/80', teal: 'from-teal-50/80', orange: 'from-orange-50/80', fuchsia: 'from-fuchsia-50/80', lime: 'from-lime-50/80',
}
export const TONE_TXT = {
  indigo: 'text-indigo-700', emerald: 'text-emerald-700', amber: 'text-amber-700', rose: 'text-rose-700', sky: 'text-sky-700',
  violet: 'text-violet-700', teal: 'text-teal-700', orange: 'text-orange-700', fuchsia: 'text-fuchsia-700', lime: 'text-lime-700',
}

export function Hero({ eyebrow, title, subtitle, tone = 'indigo', right }) {
  return (
    <div className={`px-4 md:px-5 pt-4 md:pt-5 pb-4 bg-gradient-to-br ${TONE_BG[tone]} via-white to-white border-b border-bdr-light flex flex-wrap items-start gap-3`}>
      <div className="flex-1 min-w-[220px]">
        {eyebrow && <div className={`text-[11px] font-bold uppercase tracking-[2px] ${TONE_TXT[tone]}`}>{eyebrow}</div>}
        <h2 className="text-[18px] md:text-[22px] font-bold text-txt-primary leading-tight mt-1 break-words">{title}</h2>
        {subtitle && <div className="text-[12px] text-txt-secondary mt-1">{subtitle}</div>}
      </div>
      {right}
    </div>
  )
}

export function Stat({ label, value, sub, tone = 'indigo', onClick }) {
  const bg = { indigo: 'from-indigo-50 to-indigo-100/70 border-indigo-200 text-indigo-800', emerald: 'from-emerald-50 to-emerald-100/70 border-emerald-200 text-emerald-800', amber: 'from-amber-50 to-amber-100/70 border-amber-200 text-amber-800', rose: 'from-rose-50 to-rose-100/70 border-rose-200 text-rose-800', sky: 'from-sky-50 to-sky-100/70 border-sky-200 text-sky-800', violet: 'from-violet-50 to-violet-100/70 border-violet-200 text-violet-800', teal: 'from-teal-50 to-teal-100/70 border-teal-200 text-teal-800', fuchsia: 'from-fuchsia-50 to-fuchsia-100/70 border-fuchsia-200 text-fuchsia-800', orange: 'from-orange-50 to-orange-100/70 border-orange-200 text-orange-800', slate: 'from-slate-50 to-slate-100/70 border-slate-200 text-slate-700' }[tone] || 'from-indigo-50 to-indigo-100/70 border-indigo-200 text-indigo-800'
  const W = onClick ? 'button' : 'div'
  return (
    <W onClick={onClick} className={`text-left rounded-xl border bg-gradient-to-br p-3 ${bg} ${onClick ? 'hover:shadow-card cursor-pointer' : ''}`}>
      <div className="text-[10px] uppercase tracking-wider font-bold opacity-80 leading-tight">{label}</div>
      <div className="text-[20px] md:text-[22px] font-bold leading-tight mt-0.5">{value}</div>
      {sub && <div className="text-[10px] mt-1 opacity-90 leading-snug">{sub}</div>}
    </W>
  )
}

export function StatGrid({ children, cols = 4 }) {
  return <div className={`grid grid-cols-2 ${cols >= 3 ? 'sm:grid-cols-3' : ''} ${cols >= 4 ? 'lg:grid-cols-4' : ''} gap-2`}>{children}</div>
}

export function Bar({ pct, tone = 'primary', height = 'h-2', label }) {
  const p = Math.max(0, Math.min(100, Math.round(pct || 0)))
  const color = { primary: 'bg-primary', emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500', sky: 'bg-sky-500', violet: 'bg-violet-500', auto: p >= 80 ? 'bg-emerald-500' : p >= 50 ? 'bg-amber-500' : 'bg-rose-500' }[tone]
  return (
    <div className="w-full">
      {label && <div className="flex justify-between text-[10px] text-txt-secondary mb-0.5"><span>{label}</span><span className="font-bold text-txt-primary">{p}%</span></div>}
      <div className={`${height} rounded-full bg-surface-page overflow-hidden`}><div className={`h-full ${color}`} style={{ width: `${p}%` }} /></div>
    </div>
  )
}

const PILL = {
  ok: 'bg-emerald-100 text-emerald-800', warn: 'bg-amber-100 text-amber-800', bad: 'bg-rose-100 text-rose-800', info: 'bg-sky-100 text-sky-800', neutral: 'bg-slate-100 text-slate-700', violet: 'bg-violet-100 text-violet-800',
}
export function Pill({ kind = 'neutral', children }) { return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-[10px] font-bold uppercase tracking-wide ${PILL[kind] || PILL.neutral}`}>{children}</span> }

// Map common state strings → pill kinds
export function stateKind(s) {
  if (!s) return 'neutral'
  if (/verified|approved|complete|closed|installed|deposited|accepted|resolved|functional|responded|employed|running|upgraded|delivered/.test(s)) return 'ok'
  if (/submitted|in_progress|awarded|tendered|awaiting|review|investigating|trainee_confirmed|employer_confirmed|mentor_signed|ima_reviewed|design_review|ordered|planned/.test(s)) return 'warn'
  if (/rejected|delayed|disputed|overdue|returned|non_functional|obsolete|dropped|not_employed|failed|conflicted/.test(s)) return 'bad'
  if (/pending|draft|declared|open/.test(s)) return 'info'
  return 'neutral'
}
export const titleCase = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
export const fmtDate = (x) => x ? new Date(x).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
export const fmtCr = (n) => n == null ? '—' : `₹${Number(n).toFixed(2)} Cr`
export const fmtInr = (n) => n == null ? '—' : `₹${Number(n).toLocaleString('en-IN')}`

// Section header tones: a coloured strip and a matching eyebrow so a page
// of sections reads as distinct blocks rather than one grey column.
const SECTION_TONE = {
  indigo: 'from-indigo-50 to-white border-indigo-100 text-indigo-700', emerald: 'from-emerald-50 to-white border-emerald-100 text-emerald-700', amber: 'from-amber-50 to-white border-amber-100 text-amber-700',
  rose: 'from-rose-50 to-white border-rose-100 text-rose-700', sky: 'from-sky-50 to-white border-sky-100 text-sky-700', violet: 'from-violet-50 to-white border-violet-100 text-violet-700',
  teal: 'from-teal-50 to-white border-teal-100 text-teal-700', fuchsia: 'from-fuchsia-50 to-white border-fuchsia-100 text-fuchsia-700', orange: 'from-orange-50 to-white border-orange-100 text-orange-700',
}
export function Section({ title, hint, children, right, tone = 'indigo' }) {
  const t = SECTION_TONE[tone] || SECTION_TONE.indigo
  return (
    <section className="rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden">
      <div className={`px-4 py-2.5 bg-gradient-to-r ${t} border-b flex items-center gap-2`}>
        <div className="flex-1 min-w-0"><div className="text-[11px] font-bold uppercase tracking-wider">{title}</div>{hint && <div className="text-[10px] text-txt-secondary mt-0.5">{hint}</div>}</div>
        {right}
      </div>
      <div className="p-3">{children}</div>
    </section>
  )
}

// Tables: a coloured header row, zebra stripes and a bold first column.
const TABLE_TONE = {
  indigo: 'bg-indigo-100/80 text-indigo-900', emerald: 'bg-emerald-100/80 text-emerald-900', amber: 'bg-amber-100/80 text-amber-900', rose: 'bg-rose-100/80 text-rose-900',
  sky: 'bg-sky-100/80 text-sky-900', violet: 'bg-violet-100/80 text-violet-900', teal: 'bg-teal-100/80 text-teal-900', fuchsia: 'bg-fuchsia-100/80 text-fuchsia-900', orange: 'bg-orange-100/80 text-orange-900',
}
export function Table({ columns, rows, empty = 'Nothing here yet.', tone = 'indigo' }) {
  if (!rows?.length) return <div className="text-[12px] text-txt-tertiary px-2 py-3">{empty}</div>
  const head = TABLE_TONE[tone] || TABLE_TONE.indigo
  return (
    <div className="overflow-x-auto rounded-xl border border-bdr-light">
      <table className="w-full text-[12px]">
        <thead><tr className={head}>{columns.map(c => <th key={c.key} className={`px-2.5 py-2 text-left font-bold uppercase tracking-wider text-[10px] ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={r.id || i} className={`border-b border-bdr-light/60 last:border-b-0 align-top hover:bg-primary-light/40 ${i % 2 ? 'bg-surface-page/50' : 'bg-white'}`}>
            {columns.map((c, j) => <td key={c.key} className={`px-2.5 py-2 text-txt-primary ${j === 0 ? 'font-semibold' : ''} ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}>{c.render ? c.render(r) : r[c.key]}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

export function Loading({ text = 'Loading…' }) { return <div className="p-6 text-[13px] text-txt-secondary inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{text}</div> }
export function Empty({ children }) { return <div className="rounded-2xl border border-dashed border-bdr-light bg-surface-page/40 p-6 text-center text-[13px] text-txt-secondary">{children}</div> }

export function Btn({ children, onClick, tone = 'primary', small, disabled, type = 'button' }) {
  const css = { primary: 'bg-primary text-white hover:opacity-90', ok: 'bg-emerald-600 text-white hover:opacity-90', danger: 'bg-rose-600 text-white hover:opacity-90', ghost: 'bg-white border border-bdr text-txt-primary hover:bg-surface-page', amber: 'bg-amber-500 text-white hover:opacity-90' }[tone]
  return <button type={type} disabled={disabled} onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-pill font-bold ${small ? 'px-3 py-1.5 text-[11px]' : 'px-4 py-2 text-[12px]'} ${css} disabled:opacity-50 disabled:cursor-not-allowed transition`}>{children}</button>
}

// Hook: load once with a reload handle.
export function useLoad(fn, deps = []) {
  const [data, setData] = useState(null); const [err, setErr] = useState(null); const [tick, setTick] = useState(0)
  useEffect(() => { let c = false; setErr(null); fn().then(d => { if (!c) setData(d) }).catch(e => { if (!c) setErr(e) }); return () => { c = true } }, [tick, ...deps])
  return { data, err, reload: () => setTick(t => t + 1), setData }
}

export function AskChip({ onClick, children }) {
  return <button onClick={onClick} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-primary-light text-primary text-[11px] font-bold hover:bg-primary hover:text-white transition"><Sparkles className="w-3 h-3" />{children}</button>
}

// ── Added for the PRD modules ─────────────────────────────────────────────
// Tabs row (also used for 7-tab institute profile).
export function Tabs({ tabs, active, onChange, right }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-bdr-light px-2">
      {tabs.map(t => {
        const id = typeof t === 'string' ? t : t.id, label = typeof t === 'string' ? titleCase(t) : t.label
        const badge = typeof t === 'object' ? t.badge : null
        return <button key={id} onClick={() => onChange(id)} className={`flex-shrink-0 px-3 py-2.5 text-[12px] font-bold border-b-2 -mb-px inline-flex items-center gap-1.5 ${active === id ? 'border-primary text-primary' : 'border-transparent text-txt-secondary hover:text-txt-primary'}`}>{label}{badge != null && <span className={`text-[10px] px-1.5 py-0.5 rounded-pill ${active === id ? 'bg-primary text-white' : 'bg-surface-page text-txt-secondary'}`}>{badge}</span>}</button>
      })}
      {right && <div className="ml-auto pr-2">{right}</div>}
    </div>
  )
}
// Filter chips (single select).
export function Chips({ options, value, onChange }) {
  return <div className="flex gap-1.5 flex-wrap">{options.map(o => { const id = typeof o === 'string' ? o : o.id, label = typeof o === 'string' ? titleCase(o) : o.label; return <button key={id} onClick={() => onChange(id)} className={`px-3 py-1.5 rounded-pill text-[11px] font-bold border ${value === id ? 'bg-primary text-white border-primary' : 'bg-white border-bdr text-txt-secondary'}`}>{label}</button> })}</div>
}
// "—" for missing values: a dashboard never shows 0 for "not reported".
export const nil = (v, suffix = '') => (v == null || v === '' || Number.isNaN(v)) ? '—' : `${v}${suffix}`
export const fmtPct = v => v == null ? '—' : `${Math.round(v)}%`
export const fmtNum = v => v == null ? '—' : Number(v).toLocaleString('en-IN')
export function Field({ label, children, className = '' }) { return <label className={`block text-[12px] ${className}`}><span className="font-bold text-txt-secondary">{label}</span><div className="mt-1">{children}</div></label> }
export const inputCls = 'w-full rounded-lg border border-bdr px-2 py-2 bg-white text-[12px]'
// Small "coverage" banner used wherever an ITI has no registry feed.
export function NoFeed({ children }) { return <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-4 text-[12px] text-amber-900">{children || 'No registry feed yet for this ITI. Operations data is not available — not zero.'}</div> }
// Timeline list for application / task histories.
export function Timeline({ items }) {
  if (!items?.length) return <div className="text-[11px] text-txt-tertiary">No events yet.</div>
  return <ol className="relative border-l border-bdr-light ml-2 space-y-2">{items.map((e, i) => <li key={i} className="ml-3 text-[11px]"><span className="absolute -left-[5px] mt-1 w-2 h-2 rounded-full bg-primary" /><span className="text-txt-tertiary">{e.at}</span> · <b>{e.actor}</b> — {e.event}</li>)}</ol>
}
