// Official PM-SETU mark (image supplied by the team). `size` is the rendered height.
export default function GovBadge({ size = 24, showText = false }) {
  return (
    <div className="inline-flex items-center gap-2">
      <img src="/pm-setu-logo.webp" alt="PM-SETU — Pradhan Mantri Skilling and Employability Transformation through Upgraded ITIs"
        style={{ height: size, width: 'auto', borderRadius: Math.max(4, size * 0.12) }} className="object-contain" />
      {showText && (
        <div className="leading-tight">
          <div className="font-extrabold text-txt-primary" style={{ fontSize: Math.max(10, size * 0.42), letterSpacing: 1 }}>PM-SETU</div>
          <div className="text-txt-secondary font-semibold" style={{ fontSize: Math.max(8, size * 0.3) }}>Modernising ITIs across India</div>
        </div>
      )}
    </div>
  )
}
