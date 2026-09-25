import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** Thin white streaks sliding along the panel, same `speed` keyframes as the login train. Hidden with reduced motion. */
export function SpeedLines({ rows = [22, 48, 76], className }: { rows?: number[]; className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      {rows.map((top, i) => (
        <span
          key={top}
          className="absolute left-0 h-px w-1/3 animate-speed rounded-full bg-gradient-to-r from-transparent via-white/35 to-transparent"
          style={{ top: `${top}%`, animationDelay: `${i * 0.61}s`, animationDuration: `${2.2 + (i % 3) * 0.7}s` }}
        />
      ))}
    </div>
  )
}

/**
 * «Ночная линия»: the dark hero panel borrowed from the login screen.
 * `stripe` adds the running red line along the bottom edge.
 */
export function NightPanel({
  stripe = false,
  flat = false,
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLElement> & { stripe?: boolean; flat?: boolean }) {
  return (
    <section
      className={cn(flat ? 'night-line-flat' : 'night-line', 'relative isolate overflow-hidden rounded-sheet', stripe && 'running-stripe', className)}
      {...rest}
    >
      {children}
    </section>
  )
}
