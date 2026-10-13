// CourseDetailCard — single-course deep-dive ("Show me Solar PV Installer
// course details at Patna centre"). Highlights badges + bullets + CTA chips.

import { Clock, BadgeCheck, MapPin, IndianRupee, Calendar, Sparkles } from 'lucide-react'

export default function CourseDetailCard({ card }) {
  const highlights = Array.isArray(card.highlights) ? card.highlights : []
  return (
    <div className="rounded-2xl border border-bdr-light bg-white shadow-card overflow-hidden">
      <div className="px-4 py-3 bg-gradient-to-br from-primary-light to-white border-b border-bdr-light">
        <div className="text-[11px] font-bold uppercase tracking-wider text-primary">Course detail</div>
        <div className="font-bold text-[16px] text-txt-primary mt-0.5">{card.name}</div>
        <div className="text-[11px] text-txt-tertiary mt-0.5">
          {card.code && <span>QP {card.code}</span>}
          {card.nsqf && <span> · NSQF L{card.nsqf}</span>}
        </div>
      </div>
      <div className="p-3 grid grid-cols-2 gap-2 text-[12px]">
        {card.hours      && <Field icon={Clock}       label="Duration"   value={`${card.hours} hrs`} />}
        {card.mode       && <Field icon={BadgeCheck}  label="Mode"       value={card.mode} />}
        {card.fee        && <Field icon={IndianRupee} label="Fee"        value={card.fee} tone="emerald" />}
        {card.scheme     && <Field icon={Sparkles}    label="Scheme"     value={card.scheme} />}
        {card.centre     && <Field icon={MapPin}      label="Centre"     value={card.centre} />}
        {card.nextBatch  && <Field icon={Calendar}    label="Next batch" value={card.nextBatch} />}
      </div>
      {highlights.length > 0 && (
        <div className="px-3 pb-3">
          <div className="text-[10px] uppercase tracking-wider font-bold text-txt-tertiary mb-1">Highlights</div>
          <ul className="space-y-1">
            {highlights.map((h, i) => (
              <li key={i} className="text-[12px] text-txt-secondary flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span><span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Field({ icon: Icon, label, value, tone }) {
  const cls = tone === 'emerald' ? 'text-emerald-700 font-bold' : 'text-txt-primary font-medium'
  return (
    <div className="bg-surface-page rounded-xl p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-txt-tertiary inline-flex items-center gap-1">
        <Icon className="w-3 h-3" />{label}
      </div>
      <div className={`text-[12px] mt-0.5 ${cls}`}>{value}</div>
    </div>
  )
}
