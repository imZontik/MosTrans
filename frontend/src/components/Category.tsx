import { cn } from '@/lib/cn'
import { categoryStyle } from '@/lib/category'

const TILE = {
  sm: 'h-10 w-10 rounded-xl text-xl',
  md: 'h-12 w-12 rounded-[14px] text-2xl',
  lg: 'h-14 w-14 rounded-2xl text-[28px]',
}

/** Scenario cover emoji on a soft tint of its category colour. */
export function CoverTile({
  cover,
  category,
  size = 'md',
  muted = false,
  className,
}: {
  cover: string | null | undefined
  category: string | null | undefined
  size?: keyof typeof TILE
  muted?: boolean
  className?: string
}) {
  const c = categoryStyle(category)
  return (
    <span
      className={cn(
        'tile-sheen grid shrink-0 place-items-center leading-none ring-1 ring-inset',
        TILE[size],
        muted ? 'bg-ink/[.06] ring-ink/[.06]' : cn(c.soft, c.ring),
        className,
      )}
      aria-hidden
    >
      <span className={cn(muted && 'opacity-40 grayscale')}>{cover || '🚆'}</span>
    </span>
  )
}

/** Small category label with its icon; shows the short name, the full title goes to assistive tech and the tooltip. */
export function CategoryTag({ category, title, className }: { category: string; title: string; className?: string }) {
  const c = categoryStyle(category)
  const Icon = c.icon
  return (
    <span
      className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium leading-none text-ink ring-1 ring-inset', c.soft, c.ring, className)}
      title={title}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0', c.text)} aria-hidden />
      <span aria-hidden>{c.short}</span>
      <span className="sr-only">{title}</span>
    </span>
  )
}
