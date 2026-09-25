import { Lock } from 'lucide-react'
import type { Achievement } from '@/api/types'
import { cn } from '@/lib/cn'
import { rarityMeta } from '@/lib/format'

const SIZES = {
  sm: 'h-12 w-12 text-2xl',
  md: 'h-14 w-14 text-[28px]',
}

/** Round badge: emoji on a tinted plate with a rarity-coloured ring. */
export function Medallion({ achievement, locked, size = 'sm' }: { achievement: Achievement; locked: boolean; size?: keyof typeof SIZES }) {
  const meta = rarityMeta(achievement.rarity)
  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center rounded-full',
        SIZES[size],
        locked ? 'border border-dashed border-line bg-ink/[.03]' : cn(meta.plate, meta.ring),
      )}
      aria-hidden
    >
      <span className={cn('leading-none', locked && 'opacity-30 grayscale')}>{achievement.icon}</span>
      {locked && <Lock className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-surface p-1 text-muted ring-1 ring-line" />}
    </span>
  )
}

/** Compact: medallion with the title under it (home row, admin). */
export function AchievementBadge({
  achievement,
  locked = false,
  className,
}: {
  achievement: Achievement
  locked?: boolean
  compact?: boolean
  animate?: boolean
  delay?: number
  className?: string
}) {
  return (
    <div className={cn('flex w-[80px] shrink-0 flex-col items-center pt-1 text-center', className)} title={achievement.description}>
      <Medallion achievement={achievement} locked={locked} />
      <p className={cn('mt-2 line-clamp-2 text-xs leading-tight', locked ? 'text-muted' : 'text-ink')}>{achievement.title}</p>
    </div>
  )
}

/** Grid cell: medallion, title, and either the rarity word or how to earn it. */
export function AchievementTile({ achievement, locked = false }: { achievement: Achievement; locked?: boolean }) {
  const meta = rarityMeta(achievement.rarity)
  return (
    <li className="flex flex-col items-center px-1 pb-1 pt-2 text-center" title={achievement.description}>
      <Medallion achievement={achievement} locked={locked} size="md" />
      <p className={cn('mt-2.5 line-clamp-2 text-xs font-medium leading-tight', locked ? 'text-muted' : 'text-ink')}>{achievement.title}</p>
      <p className={cn('mt-0.5 text-[12px] leading-tight', locked ? 'text-muted' : meta.text)}>
        {locked ? achievement.description : meta.label}
      </p>
    </li>
  )
}

/** Full row: medallion, title, description, rarity word. */
export function AchievementRow({ achievement, locked = false }: { achievement: Achievement; locked?: boolean }) {
  const meta = rarityMeta(achievement.rarity)
  return (
    <li className="flex items-start gap-3 py-3">
      <Medallion achievement={achievement} locked={locked} />
      <div className="min-w-0 flex-1">
        <p className={cn('font-medium', locked && 'text-muted')}>{achievement.title}</p>
        <p className="mt-0.5 text-xs text-muted">{achievement.description}</p>
      </div>
      <span className={cn('shrink-0 pt-0.5 text-xs font-medium', locked ? 'text-muted' : meta.text)}>{locked ? 'Не получено' : meta.label}</span>
    </li>
  )
}
