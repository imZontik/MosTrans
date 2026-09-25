import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Plain white panel with a hairline. Use for things that are one object, not to wrap every section. */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card', className)} {...rest} />
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-2 flex items-baseline justify-between gap-3', className)}>
      <h2 className="min-w-0 text-lg font-semibold">{children}</h2>
      {action && <div className="shrink-0 whitespace-nowrap">{action}</div>}
    </div>
  )
}

export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-prose text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
