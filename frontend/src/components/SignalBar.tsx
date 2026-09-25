import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { scaleTone, TONE_TEXT } from '@/lib/format'

const FILL = { ok: 'bar-ok', warn: 'bar-warn', bad: 'bar-bad' } as const
// On the night line the semaphore needs a little more light to read.
const FILL_DARK = {
  ok: 'bg-gradient-to-r from-[#1F9A5C] to-[#3FD58A]',
  warn: 'bg-gradient-to-r from-[#D99612] to-[#FFC940]',
  bad: 'bg-gradient-to-r from-[#D9262B] to-[#FF5A5A]',
} as const
const DELTA_DARK = { up: 'text-[#5FD39A]', down: 'text-[#FF7A7A]' } as const

/**
 * A thin 0..100 semaphore bar: ≥70 green, 40–69 yellow, <40 red.
 * When the value changes during play, the delta is shown next to the number for a moment.
 */
export function SignalBar({
  label,
  value,
  className,
  showDelta = false,
  dark = false,
}: {
  label: string
  value: number | null
  className?: string
  showDelta?: boolean
  /** White type on the night-line header. */
  dark?: boolean
}) {
  const prev = useRef(value)
  const [delta, setDelta] = useState<{ id: number; value: number } | null>(null)

  useEffect(() => {
    if (!showDelta || value === null || prev.current === null) {
      prev.current = value
      return
    }
    const diff = value - prev.current
    prev.current = value
    if (diff === 0) return
    const id = Date.now()
    setDelta({ id, value: diff })
    const t = window.setTimeout(() => setDelta((d) => (d?.id === id ? null : d)), 2200)
    return () => window.clearTimeout(t)
  }, [value, showDelta])

  const tone = value === null ? null : scaleTone(value)
  return (
    <div className={cn('min-w-0 flex-1', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn('truncate text-xs', dark ? 'text-white/70' : 'text-muted')}>{label}</span>
        <span className="flex items-baseline gap-1.5">
          {delta && (
            <span
              className={cn(
                'digits text-sm font-semibold',
                dark ? (delta.value > 0 ? DELTA_DARK.up : DELTA_DARK.down) : delta.value > 0 ? 'text-ok' : 'text-bad',
              )}
              aria-live="polite"
            >
              {delta.value > 0 ? `+${delta.value}` : `−${Math.abs(delta.value)}`}
            </span>
          )}
          <span
            className={cn(
              'digits text-base font-semibold leading-none',
              dark ? (tone ? 'text-white' : 'text-white/60') : tone ? TONE_TEXT[tone] : 'text-muted',
            )}
          >
            {value ?? '—'}
          </span>
        </span>
      </div>
      <div
        className={cn('mt-1.5 h-1.5 overflow-hidden rounded-full', dark ? 'bg-white/15' : 'track')}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value ?? 0}
      >
        {tone && (
          <div
            className={cn('h-full rounded-full transition-[width] duration-500 ease-out', dark ? FILL_DARK[tone] : FILL[tone])}
            style={{ width: `${Math.max(2, value ?? 0)}%` }}
          />
        )}
      </div>
    </div>
  )
}
