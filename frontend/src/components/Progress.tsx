import { cn } from '@/lib/cn'

/** A plain progress line. */
export function Progress({
  value,
  className,
  barClassName,
  height = 'h-1.5',
}: {
  value: number // 0..1
  className?: string
  barClassName?: string
  height?: string
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  return (
    <div
      className={cn('w-full overflow-hidden rounded-full bg-ink/10', height, className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div className={cn('h-full rounded-full bg-ink', barClassName)} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function DifficultyDots({ value, max = 3, className }: { value: number; max?: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)} title={`Сложность ${value} из ${max}`} aria-label={`Сложность ${value} из ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={cn('h-1.5 w-1.5 rounded-full', i < value ? 'bg-ink' : 'bg-ink/20')} />
      ))}
    </span>
  )
}
