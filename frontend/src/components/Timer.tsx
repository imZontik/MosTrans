import { cn } from '@/lib/cn'

export type TimerTone = 'ok' | 'warn' | 'bad'

export function timerTone(remaining: number, total: number): TimerTone {
  if (remaining <= 5) return 'bad'
  if (total > 0 && remaining / total < 0.5) return 'warn'
  return 'ok'
}

const FILL = { ok: 'bar-ok', warn: 'bar-warn', bad: 'bar-bad' } as const
const TEXT = { ok: 'text-ink', warn: 'text-warn-ink', bad: 'text-bad' } as const
const STROKE = { ok: 'stroke-ok', warn: 'stroke-warn', bad: 'stroke-brand' } as const

/** A line that shrinks from full width to nothing, green → yellow → red. */
export function TimerLine({ remaining, total, className }: { remaining: number; total: number; className?: string }) {
  const share = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0
  const tone = timerTone(remaining, total)
  return (
    <div className={cn('track h-1 w-full overflow-hidden', className)} aria-hidden>
      <div className={cn('h-full transition-colors', FILL[tone])} style={{ width: `${share * 100}%`, transition: 'width .1s linear' }} />
    </div>
  )
}

/** Seconds left in big condensed digits. */
export function TimerDigits({ remaining, total, className }: { remaining: number; total: number; className?: string }) {
  const tone = timerTone(remaining, total)
  return (
    <span className={cn('digits text-2xl font-semibold leading-none', TEXT[tone], className)} role="timer" aria-label={`Осталось ${Math.ceil(remaining)} секунд`}>
      {Math.ceil(remaining)}
      <span className="ml-0.5 text-base font-medium text-muted">с</span>
    </span>
  )
}

/** Seconds left inside a ring that runs down with them, green → yellow → red. */
export function RingTimer({ remaining, total, className }: { remaining: number; total: number; className?: string }) {
  const r = 22
  const c = 2 * Math.PI * r
  const share = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0
  const tone = timerTone(remaining, total)
  return (
    <div className={cn('relative grid h-14 w-14 shrink-0 place-items-center', className)} role="timer" aria-label={`Осталось ${Math.ceil(remaining)} секунд`}>
      <svg viewBox="0 0 52 52" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="26" cy="26" r={r} fill="none" strokeWidth="4" className="stroke-ink/10" />
        <circle
          cx="26"
          cy="26"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - share)}
          className={cn(STROKE[tone], 'transition-[stroke-dashoffset,stroke] duration-100 ease-linear')}
        />
      </svg>
      <span className={cn('digits text-xl font-semibold leading-none', TEXT[tone])} aria-hidden>
        {Math.ceil(remaining)}
      </span>
    </div>
  )
}
