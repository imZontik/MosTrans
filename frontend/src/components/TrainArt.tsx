import { cn } from '@/lib/cn'

/** Stylized high-speed train with animated speed lines. */
export function TrainArt({ className }: { className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[18, 34, 52, 70, 84].map((top, i) => (
          <span
            key={top}
            className="absolute left-0 h-[2px] w-1/3 animate-speed rounded-full bg-gradient-to-r from-transparent via-white/60 to-transparent"
            style={{ top: `${top}%`, animationDelay: `${i * 0.37}s`, animationDuration: `${1.4 + (i % 3) * 0.5}s` }}
          />
        ))}
      </div>
      <svg viewBox="0 0 600 170" className="relative w-full drop-shadow-[0_20px_30px_rgba(0,0,0,.45)]">
        <defs>
          <linearGradient id="train-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#d9dee8" />
          </linearGradient>
          <linearGradient id="train-glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2b3b63" />
            <stop offset="1" stopColor="#0a101e" />
          </linearGradient>
        </defs>
        <path d="M0 110 L430 110 C505 110 565 100 596 82 C566 60 505 44 440 42 L40 42 Q0 42 0 70 Z" fill="url(#train-body)" />
        <path d="M0 96 L452 96 C512 96 556 90 588 78 L596 82 C565 100 505 110 430 110 L0 110 Z" fill="#E21A1A" />
        <path d="M0 90 L440 90 C500 90 548 85 580 74" stroke="#0a101e" strokeOpacity=".25" strokeWidth="2" fill="none" />
        <path d="M470 50 C520 54 560 66 586 80 L545 80 C520 70 495 62 468 60 Z" fill="url(#train-glass)" />
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x={24 + i * 42} y={56} width={30} height={18} rx={6} fill="url(#train-glass)" />
        ))}
        <rect x="444" y="56" width="10" height="30" rx="3" fill="#0a101e" opacity=".2" />
        {[60, 130, 330, 400].map((x) => (
          <g key={x}>
            <rect x={x - 26} y={110} width={52} height={10} rx={3} fill="#1f2b47" />
            <circle cx={x - 14} cy={122} r={7} fill="#0a101e" />
            <circle cx={x + 14} cy={122} r={7} fill="#0a101e" />
          </g>
        ))}
        <rect x="0" y="130" width="600" height="4" rx="2" fill="#ffffff" opacity=".35" />
        <rect x="0" y="140" width="600" height="2" rx="1" fill="#ffffff" opacity=".15" />
        <text x="300" y="104" textAnchor="middle" fontFamily="'Fira Sans Extra Condensed', sans-serif" fontSize="12" fontWeight="700" fill="#fff" letterSpacing="4">
          МАГИСТРАЛЬ 400
        </text>
      </svg>
    </div>
  )
}
