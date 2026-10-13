// Footer mark: scheme lineage + technology partner.
export default function PoweredBy({ size = 22, className = '', layout = 'row' }) {
  const Badge = () => (
    <div className="inline-flex items-center gap-2">
      <img src="/pm-setu-logo.webp" alt="PM-SETU" style={{ height: size * 1.6, width: 'auto', borderRadius: 4 }} className="object-contain" />
      <span className="text-[11px] font-bold text-txt-secondary" style={{ fontSize: Math.max(10, size * 0.5) }}>PM-SETU · MSDE · DGT</span>
      <span className="text-txt-tertiary">·</span>
      <span className="text-[11px] font-semibold text-primary" style={{ fontSize: Math.max(10, size * 0.5) }}>Technology partner ConveGenius</span>
    </div>
  )
  if (layout === 'stack') {
    return (
      <div className={`inline-flex flex-col items-center gap-1.5 ${className}`}>
        <div className="text-[10px] uppercase tracking-wider text-txt-tertiary font-semibold">Under</div>
        <Badge />
      </div>
    )
  }
  return <div className={`inline-flex items-center ${className}`}><Badge /></div>
}
