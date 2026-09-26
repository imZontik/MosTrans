import { useEffect, useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type RingTone = 'ok' | 'warn' | 'bad' | 'brand'

// Gradient stops per tone: the arc brightens towards its head
const STOPS: Record<RingTone, [string, string]> = {
  ok: ['rgb(var(--ok) / .55)', 'rgb(var(--ok))'],
  warn: ['rgb(var(--warn) / .55)', 'rgb(var(--warn))'],
  bad: ['rgb(var(--brand) / .55)', 'rgb(var(--brand))'],
  brand: ['#FF6A3D', '#E21A1A'],
}
// In dark the arc glows a little in its own colour
const GLOW: Record<RingTone, string> = {
  ok: 'dark:[filter:drop-shadow(0_0_6px_rgb(var(--ok)/.45))]',
  warn: 'dark:[filter:drop-shadow(0_0_6px_rgb(var(--warn)/.45))]',
  bad: 'dark:[filter:drop-shadow(0_0_6px_rgb(var(--brand)/.45))]',
  brand: 'dark:[filter:drop-shadow(0_0_6px_rgb(226_26_26/.5))]',
}

/**
 * A ring gauge, 0..1, with anything in the middle. The arc fills from zero when it appears
 * (instant with reduced motion). `segments` splits the ring into equal parts, e.g. one per scenario.
 */
export function ScoreRing({
  value,
  tone,
  segments = 1,
  size = 88,
  stroke = 8,
  label,
  children,
  className,
}: {
  value: number
  tone: RingTone
  segments?: number
  size?: number
  stroke?: number
  /** Accessible description, e.g. «Безопасность 83 из 100». */
  label: string
  children?: ReactNode
  className?: string
}) {
  const id = useId().replace(/:/g, '')
  const [shown, setShown] = useState(0)

  // two frames: let the empty ring paint first, so the CSS transition has somewhere to start from
  useEffect(() => {
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setShown(Math.max(0, Math.min(1, value))))
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [value])

  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const parts = Math.max(1, Math.round(segments))
  // gaps between segments: the round caps eat stroke/2 on each side, so leave ~8px of air on top of that
  const gap = parts > 1 ? stroke + 8 : 0
  const part = c / parts
  const arc = part - gap
  const filled = shown * parts // how many segments are lit, fractional

  const circle = { cx: size / 2, cy: size / 2, r, fill: 'none', strokeWidth: stroke, strokeLinecap: 'round' as const }
  const motion = { transition: 'stroke-dasharray 1.2s cubic-bezier(.22,.8,.26,1)' }

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }} role="img" aria-label={label}>
      {/* overflow-visible: the dark-theme glow spills past the square instead of being cut into a box */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={`ring-${id}`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={STOPS[tone][0]} />
            <stop offset="100%" stopColor={STOPS[tone][1]} />
          </linearGradient>
        </defs>
        {Array.from({ length: parts }, (_, i) => {
          const lit = Math.max(0, Math.min(1, filled - i)) * arc
          const offset = -(i * part + gap / 2)
          return (
            <g key={i}>
              <circle {...circle} className="stroke-ink/[.08] dark:stroke-white/[.08]" strokeDasharray={`${arc} ${c - arc}`} strokeDashoffset={offset} />
              {/* a zero-length arc would still draw its round cap: hide it until there is something to show */}
              <circle
                {...circle}
                stroke={`url(#ring-${id})`}
                className={cn(GLOW[tone], lit < 0.5 && 'opacity-0')}
                strokeDasharray={`${lit} ${c - lit}`}
                strokeDashoffset={offset}
                style={motion}
              />
            </g>
          )
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}
