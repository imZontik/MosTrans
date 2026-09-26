import { useId } from 'react'
import { cn } from '@/lib/cn'

export type MascotMood = 'happy' | 'thinking' | 'wink' | 'alarm'

/** «Вова-механик» — the friendly train electromechanic mascot. */
export function Mascot({ className, mood = 'happy' }: { className?: string; mood?: MascotMood }) {
  const id = useId().replace(/:/g, '')
  const eyes =
    mood === 'happy' ? (
      <>
        <path d="M47 58 q4 -5 8 0" stroke="#2b1a10" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <path d="M65 58 q4 -5 8 0" stroke="#2b1a10" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      </>
    ) : mood === 'wink' ? (
      <>
        <ellipse cx="51" cy="57" rx="2.8" ry="3.4" fill="#2b1a10" />
        <path d="M65 58 q4 -5 8 0" stroke="#2b1a10" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      </>
    ) : mood === 'alarm' ? (
      <>
        <circle cx="51" cy="57" r="4" fill="#fff" stroke="#2b1a10" strokeWidth="1.5" />
        <circle cx="69" cy="57" r="4" fill="#fff" stroke="#2b1a10" strokeWidth="1.5" />
        <circle cx="51" cy="57" r="1.8" fill="#2b1a10" />
        <circle cx="69" cy="57" r="1.8" fill="#2b1a10" />
      </>
    ) : (
      <>
        <ellipse cx="51" cy="57" rx="2.8" ry="3.4" fill="#2b1a10" />
        <ellipse cx="69" cy="57" rx="2.8" ry="3.4" fill="#2b1a10" />
        <path d="M64 49 l9 -2" stroke="#7a4a2a" strokeWidth="2.4" strokeLinecap="round" />
      </>
    )
  const mouth =
    mood === 'alarm' ? (
      <ellipse cx="60" cy="80" rx="4" ry="4.5" fill="#8a2b22" />
    ) : mood === 'thinking' ? (
      <path d="M55 80 q5 1 10 -1" stroke="#8a2b22" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    ) : (
      <path d="M52 78 q8 8 16 0" stroke="#8a2b22" strokeWidth="2.6" fill="#fff" strokeLinecap="round" />
    )

  return (
    <svg viewBox="0 0 120 120" className={cn('select-none', className)} role="img" aria-label="Вова-механик">
      <defs>
        <mask id={`jaw-${id}`}>
          <rect x="-20" y="-30" width="40" height="80" fill="#fff" />
          <rect x="-4" y="-18" width="8" height="12" fill="#000" />
        </mask>
      </defs>
      {/* body */}
      <path d="M20 120 C22 98 38 90 60 90 C82 90 98 98 100 120 Z" fill="#1C2430" />
      <path d="M48 90 L60 104 L72 90 Z" fill="#FFFFFF" />
      <path d="M56 97 L60 104 L64 97 L60 94 Z" fill="#E21A1A" />
      <rect x="36" y="104" width="10" height="12" rx="2" fill="#A7B0BA" />
      {/* ears */}
      <circle cx="32" cy="62" r="6" fill="#efb88c" />
      <circle cx="88" cy="62" r="6" fill="#efb88c" />
      {/* head */}
      <circle cx="60" cy="62" r="28" fill="#f7cda6" />
      {/* cheeks */}
      <circle cx="43" cy="68" r="4.5" fill="#f59f93" opacity=".55" />
      <circle cx="77" cy="68" r="4.5" fill="#f59f93" opacity=".55" />
      {eyes}
      {/* nose */}
      <ellipse cx="60" cy="65" rx="4.2" ry="3.6" fill="#e9a57c" />
      {mouth}
      {/* moustache */}
      <path d="M41 73 C46 66 55 67 60 71 C65 67 74 66 79 73 C73 77 66 76 60 73.5 C54 76 47 77 41 73 Z" fill="#7a4a2a" />
      {/* cap */}
      <path d="M31 52 C31 30 45 22 60 22 C75 22 89 30 89 52 Z" fill="#2B3646" />
      <path d="M31 52 C45 47 75 47 89 52 L89 49 C75 44 45 44 31 49 Z" fill="#E21A1A" />
      <path d="M27 54 C45 47 80 47 98 56 C96 60 92 60 88 58 C74 53 46 53 30 58 C27 58 26 56 27 54 Z" fill="#1C2430" />
      <circle cx="60" cy="36" r="6.5" fill="#fff" />
      <path d="M57 36.5 L61 31 L60.2 35.4 L63 35.4 L59 41 L59.8 36.5 Z" fill="#E21A1A" />
      {/* wrench */}
      <g transform="translate(96 86) rotate(28)">
        <g mask={`url(#jaw-${id})`}>
          <circle cx="0" cy="-10" r="9" fill="#A7B0BA" />
        </g>
        <rect x="-3.5" y="-3" width="7" height="30" rx="3.5" fill="#A7B0BA" />
        <rect x="-1.2" y="4" width="2.4" height="18" rx="1.2" fill="#7D8792" />
      </g>
      <circle cx="93" cy="97" r="7" fill="#f7cda6" />
    </svg>
  )
}
