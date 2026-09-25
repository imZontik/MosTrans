import type { HTMLAttributes, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Top-lit plate with a hairline and a soft shadow. Use for things that are one object, not to wrap every section. */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card', className)} {...rest} />
}

/** Small icon plate used in section headers. `tint` is a bg class, `tone` the icon colour class. */
export function IconPlate({ icon: Icon, tint = 'bg-ink/[.06]', tone = 'text-ink', className }: { icon: LucideIcon; tint?: string; tone?: string; className?: string }) {
  return (
    <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-[10px] ring-1 ring-inset ring-ink/[.06]', tint, className)} aria-hidden>
      <Icon className={cn('h-[18px] w-[18px]', tone)} />
    </span>
  )
}

export function SectionTitle({
  children,
  action,
  icon,
  tint,
  tone,
  id,
  className,
}: {
  children: ReactNode
  action?: ReactNode
  icon?: LucideIcon
  tint?: string
  tone?: string
  id?: string
  className?: string
}) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-3', className)}>
      <h2 id={id} className="flex min-w-0 items-center gap-2.5 text-lg font-semibold">
        {icon && <IconPlate icon={icon} tint={tint} tone={tone} />}
        <span className="min-w-0">{children}</span>
      </h2>
      {action && <div className="shrink-0 whitespace-nowrap">{action}</div>}
    </div>
  )
}

export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-[-0.005em] lg:text-[40px] lg:leading-[1.05]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-prose text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
