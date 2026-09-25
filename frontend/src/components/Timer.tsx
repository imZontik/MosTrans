import { cn } from '@/lib/cn'

export type TimerTone = 'ok' | 'warn' | 'bad'

export function timerTone(remaining: number, total: number): TimerTone {
  if (remaining <= 5) return 'bad'
  if (total > 0 && remaining / total < 0.5) return 'warn'
  return 'ok'
}

const FILL = { ok: 'bar-ok', warn: 'bar-warn', bad: 'bar-bad' } as const
const TEXT = { ok: 'text-ink', warn: 'text-warn-ink', bad: 'text-bad' } as const

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
