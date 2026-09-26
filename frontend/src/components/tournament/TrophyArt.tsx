import { useId } from 'react'
import { cn } from '@/lib/cn'

const SPARKLES = [
  { x: 15, y: 17, s: 5, delay: 0 },
  { x: 105, y: 22, s: 4, delay: 0.9 },
  { x: 103, y: 70, s: 3.5, delay: 1.7 },
  { x: 18, y: 74, s: 3, delay: 2.3 },
]

/** A four-pointed glint: concave sides drawn through its centre. */
const sparkle = (x: number, y: number, s: number) =>
  `M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z`

/** The tournament cup: polished gold on a dark plinth with a red plate, glints around it and light running over it. */
export function TrophyArt({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 120 120" className={cn('overflow-visible', className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#9A6512" />
          <stop offset=".22" stopColor="#E0A93A" />
          <stop offset=".45" stopColor="#FFE7A1" />
          <stop offset=".62" stopColor="#F2C04E" />
          <stop offset=".88" stopColor="#B57B17" />
          <stop offset="1" stopColor="#8A5A0E" />
        </linearGradient>
        <linearGradient id={`${id}-rim`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#C8912A" />
          <stop offset=".5" stopColor="#FFF1BF" />
          <stop offset="1" stopColor="#D9A23A" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-cup`}>
          <path d="M31 20H89V38C89 60 76 73 60 75C44 73 31 60 31 38Z" />
          <rect x="27" y="14" width="66" height="9" rx="4.5" />
        </clipPath>
      </defs>

      {/* handles */}
      <g fill="none" stroke={`url(#${id}-gold)`} strokeWidth="5.5" strokeLinecap="round">
        <path d="M33 28H24C15 28 13 37 16 44C19 51 26 55 34 57" />
        <path d="M87 28H96C105 28 107 37 104 44C101 51 94 55 86 57" />
      </g>
      {/* stem, knot and foot */}
      <path d="M54 73H66L64 86H56Z" fill="#A8700F" />
      <rect x="50" y="84" width="20" height="6" rx="3" fill={`url(#${id}-gold)`} />
      <path d="M40 90H80L84 100H36Z" fill={`url(#${id}-gold)`} />
      {/* the bowl with its rim, a star and a glossy edge */}
      <path d="M31 20H89V38C89 60 76 73 60 75C44 73 31 60 31 38Z" fill={`url(#${id}-gold)`} />
      <rect x="27" y="14" width="66" height="9" rx="4.5" fill={`url(#${id}-rim)`} />
      <path
        d="M60 33L62.2 38.9L68.6 39.2L63.6 43.2L65.3 49.3L60 45.8L54.7 49.3L56.4 43.2L51.4 39.2L57.8 38.9Z"
        fill="#9A6512"
        fillOpacity=".55"
      />
      <path d="M38 25C37 40 40 54 48 64" fill="none" stroke="#fff" strokeOpacity=".4" strokeWidth="3" strokeLinecap="round" />
      <g clipPath={`url(#${id}-cup)`}>
        <rect className="trophy-shine" x="0" y="8" width="18" height="72" fill={`url(#${id}-shine)`} />
      </g>
      {/* plinth with the line's red plate */}
      <rect x="30" y="100" width="60" height="14" rx="3" fill="#1B2438" stroke="#fff" strokeOpacity=".14" />
      <rect x="47" y="104" width="26" height="6" rx="1.5" fill="#E21A1A" />

      {SPARKLES.map((s) => (
        <path key={s.x} className="twinkle" d={sparkle(s.x, s.y, s.s)} fill="#FFF3C4" style={{ animationDelay: `${s.delay}s` }} />
      ))}
    </svg>
  )
}
