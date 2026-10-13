// PM-SETU Saathi mark — a bridge ("setu") arch over a chat-bubble base.
export default function Logo({ size = 64, showText = false, textColor = '#1A1F36' }) {
  return (
    <div className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="pmsg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5B89FF" />
            <stop offset="100%" stopColor="#2755E3" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#pmsg)" />
        {/* bridge arch */}
        <path d="M12 40 C 20 22, 44 22, 52 40" stroke="#FFFFFF" strokeWidth="4.5" fill="none" strokeLinecap="round" />
        <rect x="11" y="40" width="42" height="4" rx="2" fill="#FFFFFF" />
        <rect x="20" y="31" width="3.5" height="9" rx="1" fill="#FFFFFF" opacity="0.9" />
        <rect x="30.25" y="27" width="3.5" height="13" rx="1" fill="#FFFFFF" opacity="0.9" />
        <rect x="40.5" y="31" width="3.5" height="9" rx="1" fill="#FFFFFF" opacity="0.9" />
        {/* spark */}
        <circle cx="48" cy="17" r="3.2" fill="#FFD166" />
      </svg>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className="font-extrabold text-[15px]" style={{ color: textColor, fontFamily: 'Montserrat, sans-serif' }}>PM-SETU Saathi</span>
          <span className="text-[10px] font-medium mt-0.5" style={{ color: '#7383A5' }}>Cluster transformation platform</span>
        </div>
      )}
    </div>
  )
}
