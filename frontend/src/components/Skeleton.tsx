import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Shimmer skeletons: the shapes of a page while its data loads, so nothing jumps when it arrives.
 * `Sk` is one block; the rest are the recurring shapes (a night hero, a card with a title, rows,
 * tiles). Page skeletons at the bottom compose them to match each page's real layout.
 */
export function Sk({ className, night = false, style }: { className?: string; night?: boolean; style?: CSSProperties }) {
  return <div className={cn('skeleton', night && 'skeleton-night', className)} style={style} aria-hidden />
}

/** A screen-reader announcement once per loading area; the shapes themselves are hidden. */
export function Loading({ label = 'Загрузка', className, children }: { label?: string; className?: string; children: ReactNode }) {
  return (
    <div className={className} role="status" aria-busy aria-label={label}>
      {children}
    </div>
  )
}

/** Lines of text; the last one shorter, like a real paragraph. */
export function SkText({ lines = 2, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Sk key={i} className={cn('h-3.5 rounded-md', i === lines - 1 && lines > 1 ? 'w-3/5' : 'w-full')} />
      ))}
    </div>
  )
}

/** The dark hero panel: a label, a big title, a line, and a strip of numbers. */
export function SkHero({ cells = 3, tall = false }: { cells?: number; tall?: boolean }) {
  return (
    <div className={cn('night-line night-panel relative overflow-hidden rounded-sheet px-5 py-5 sm:px-7 sm:py-6 -mx-2 sm:mx-0', tall && 'pb-7')}>
      <Sk night className="h-3.5 w-36 rounded-md" />
      <Sk night className="mt-3 h-9 w-2/3 max-w-sm rounded-lg sm:h-11" />
      <Sk night className="mt-3 h-3.5 w-1/2 max-w-xs rounded-md" />
      {tall && <Sk night className="mt-6 h-2 w-full rounded-full" />}
      <div className={cn('mt-6 grid gap-px overflow-hidden rounded-2xl', cells === 4 ? 'grid-cols-2 lg:grid-cols-4' : cells === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
        {Array.from({ length: cells }, (_, i) => (
          <div key={i} className="bg-white/[.04] px-4 py-4">
            <Sk night className="h-2.5 w-16 rounded" />
            <Sk night className="mt-3 h-7 w-20 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** A card with an icon plate and a title, then its body. */
export function SkCard({ children, className, title = true }: { children?: ReactNode; className?: string; title?: boolean }) {
  return (
    <div className={cn('card p-5 sm:p-6', className)}>
      {title && (
        <div className="mb-5 flex items-center gap-2.5">
          <Sk className="h-8 w-8 rounded-[10px]" />
          <Sk className="h-5 w-40 rounded-md" />
        </div>
      )}
      {children}
    </div>
  )
}

/** List rows: an avatar or a tile, two lines, a number on the right. */
export function SkRows({ rows = 4, avatar = 'round', value = true, className }: { rows?: number; avatar?: 'round' | 'tile' | false; value?: boolean; className?: string }) {
  return (
    <ul className={cn('divide-y divide-line/60', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 py-3">
          {avatar && <Sk className={cn('h-10 w-10 shrink-0', avatar === 'round' ? 'rounded-full' : 'rounded-xl')} />}
          <div className="min-w-0 flex-1">
            <Sk className={cn('h-4 rounded-md', ['w-3/4', 'w-2/3', 'w-4/5', 'w-1/2'][i % 4])} />
            <Sk className={cn('mt-2 h-3 rounded-md', ['w-2/5', 'w-1/2', 'w-1/3', 'w-3/5'][i % 4])} />
          </div>
          {value && <Sk className="h-6 w-12 shrink-0 rounded-md" />}
        </li>
      ))}
    </ul>
  )
}

/** Bars with a label and a value, like skills or directions. */
export function SkBars({ rows = 5 }: { rows?: number }) {
  return (
    <ul className="space-y-4">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3">
          <Sk className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="flex justify-between gap-3">
              <Sk className={cn('h-4 rounded-md', ['w-44', 'w-32', 'w-40', 'w-28', 'w-36'][i % 5])} />
              <Sk className="h-4 w-10 rounded-md" />
            </div>
            <Sk className="mt-2 h-1.5 w-full rounded-full" />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** A grid of tall tiles (scenario cards, badges). */
export function SkTiles({ count = 4, className, tile = 'h-40' }: { count?: number; className?: string; tile?: string }) {
  return (
    <div className={cn('grid gap-3 md:grid-cols-2 md:gap-4', className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cn('card flex flex-col p-4 sm:p-5', tile)}>
          <div className="flex items-start gap-3.5">
            <Sk className="h-12 w-12 shrink-0 rounded-[14px]" />
            <div className="min-w-0 flex-1">
              <Sk className={cn('h-5 rounded-md', ['w-3/4', 'w-1/2', 'w-2/3', 'w-3/5'][i % 4])} />
              <Sk className="mt-2 h-3.5 w-1/3 rounded-md" />
            </div>
          </div>
          <div className="mt-auto flex items-center justify-between pt-4">
            <Sk className="h-4 w-24 rounded-md" />
            <Sk className="h-9 w-28 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** A chart area: bars of different heights on a baseline. */
export function SkChart({ bars = 14, className }: { bars?: number; className?: string }) {
  const heights = [30, 45, 38, 60, 35, 52, 70, 40, 58, 48, 80, 55, 95, 30]
  return (
    <div className={cn('flex h-56 items-end gap-2 border-b border-line/60 pb-px sm:h-64', className)}>
      {Array.from({ length: bars }, (_, i) => (
        <Sk key={i} className="flex-1 rounded-b-none rounded-t-md" style={{ height: `${heights[i % heights.length]}%` }} />
      ))}
    </div>
  )
}

/** Segmented tabs / chips row. */
export function SkTabs({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('flex gap-2', className)}>
      {Array.from({ length: count }, (_, i) => (
        <Sk key={i} className={cn('h-11 rounded-xl', i === 0 ? 'w-24' : 'w-28')} />
      ))}
    </div>
  )
}

// --- page skeletons -------------------------------------------------------------------

/** Generic: a few rows in a card (lists, feeds). */
export function ListSkeleton({ rows = 5, avatar = 'round' as 'round' | 'tile' | false, label }: { rows?: number; avatar?: 'round' | 'tile' | false; label?: string }) {
  return (
    <Loading label={label}>
      <div className="card px-4 py-1 sm:px-5">
        <SkRows rows={rows} avatar={avatar} />
      </div>
    </Loading>
  )
}

export function ScenariosSkeleton() {
  return (
    <Loading label="Загружаем расписание" className="space-y-7">
      <div className="flex flex-wrap gap-2">
        {[20, 44, 40, 32, 48].map((w, i) => (
          <Sk key={i} className="h-11 rounded-full" style={{ width: w * 4 }} />
        ))}
      </div>
      <SkTabs count={4} />
      <div>
        <div className="mb-4 flex items-center gap-2.5">
          <Sk className="h-9 w-9 rounded-xl" />
          <Sk className="h-6 w-36 rounded-md" />
        </div>
        <SkTiles count={4} />
      </div>
    </Loading>
  )
}

export function LeaderboardSkeleton() {
  return (
    <Loading label="Загружаем рейтинг" className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="night-line night-panel -mx-2 flex h-[380px] items-end gap-3 rounded-sheet px-6 pb-6 sm:mx-0 sm:gap-5">
          {[70, 100, 50].map((h, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-3">
              <Sk night className={cn('rounded-full', i === 1 ? 'h-20 w-20' : 'h-14 w-14')} />
              <Sk night className="h-3.5 w-20 rounded-md" />
              <Sk night className="w-full rounded-b-none rounded-t-xl" style={{ height: h * 1.2 }} />
            </div>
          ))}
        </div>
        <SkCard className="h-[380px]">
          <Sk className="h-16 w-28 rounded-lg" />
          <Sk className="mt-10 h-2 w-full rounded-full" />
          <SkRows rows={3} avatar={false} className="mt-4" />
        </SkCard>
      </div>
      <div className="card px-4 py-1 sm:px-5">
        <SkRows rows={6} />
      </div>
    </Loading>
  )
}

export function TournamentSkeleton() {
  return (
    <Loading label="Загружаем турнир" className="space-y-6 xl:grid xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,1fr)] xl:items-start xl:gap-7 xl:space-y-0">
      <SkHero cells={2} tall />
      <SkCard>
        <div className="grid grid-cols-3 items-end gap-3">
          {[60, 90, 42].map((h, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Sk className="h-12 w-12 rounded-full" />
              <Sk className="w-full rounded-b-none rounded-t-xl" style={{ height: h }} />
            </div>
          ))}
        </div>
        <SkRows rows={4} className="mt-4" />
      </SkCard>
    </Loading>
  )
}

export function ProfileSkeleton() {
  return (
    <Loading label="Загружаем профиль" className="space-y-6">
      <div className="night-line night-panel -mx-2 rounded-sheet px-5 py-6 sm:mx-0 sm:px-7">
        <div className="flex items-center gap-4">
          <Sk night className="h-16 w-16 rounded-full" />
          <div className="flex-1">
            <Sk night className="h-7 w-52 rounded-md" />
            <Sk night className="mt-2.5 h-3.5 w-64 max-w-full rounded-md" />
          </div>
        </div>
        <Sk night className="mt-8 h-2 w-full rounded-full" />
        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="bg-white/[.04] px-4 py-4">
              <Sk night className="h-2.5 w-14 rounded" />
              <Sk night className="mt-3 h-7 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <SkCard>
          <SkBars rows={6} />
        </SkCard>
        <SkCard>
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <Sk className="h-14 w-14 rounded-full" />
                <Sk className="h-3 w-14 rounded" />
              </div>
            ))}
          </div>
        </SkCard>
      </div>
    </Loading>
  )
}

export function DashboardSkeleton() {
  return (
    <Loading label="Загружаем дашборд" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Sk className="h-9 w-72 max-w-full rounded-lg lg:h-11" />
          <Sk className="mt-2.5 h-4 w-60 max-w-full rounded-md" />
        </div>
        <Sk className="h-11 w-44 rounded-xl" />
      </div>
      <SkHero cells={4} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <SkCard>
          <SkChart />
        </SkCard>
        <SkCard>
          <SkRows rows={5} value={false} />
        </SkCard>
      </div>
    </Loading>
  )
}

export function EmployeeSkeleton() {
  return (
    <Loading label="Загружаем сотрудника" className="space-y-6">
      <Sk className="h-5 w-32 rounded-md" />
      <div className="flex items-center gap-4">
        <Sk className="h-20 w-20 rounded-full" />
        <div className="flex-1">
          <Sk className="h-8 w-60 max-w-full rounded-lg" />
          <Sk className="mt-2.5 h-4 w-72 max-w-full rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="card p-4">
            <Sk className="h-3 w-20 rounded" />
            <Sk className="mt-3 h-7 w-12 rounded-md" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <SkCard>
          <SkBars rows={6} />
        </SkCard>
        <SkCard>
          <SkRows rows={5} avatar="tile" />
        </SkCard>
      </div>
    </Loading>
  )
}

export function EditorSkeleton() {
  return (
    <Loading label="Загружаем сценарий" className="space-y-5">
      <Sk className="h-5 w-40 rounded-md" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Sk className="h-9 w-64 max-w-full rounded-lg" />
        <div className="flex gap-2">
          <Sk className="h-11 w-32 rounded-xl" />
          <Sk className="h-11 w-32 rounded-xl" />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <SkCard>
          <SkText lines={3} />
          <Sk className="mt-5 h-11 w-full rounded-xl" />
          <Sk className="mt-3 h-11 w-full rounded-xl" />
        </SkCard>
        <SkCard>
          <SkRows rows={5} avatar="tile" value={false} />
        </SkCard>
      </div>
    </Loading>
  )
}

/** The play screen before the run arrives: header strip, a few bubbles, the answer dock. */
export function PlaySkeleton() {
  return (
    <Loading label="Загружаем рейс" className="flex min-h-screen flex-col">
      <div className="night-line-flat px-4 pb-3 pt-3">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3">
            <Sk night className="h-9 w-9 rounded-xl" />
            <div className="flex-1">
              <Sk night className="h-4 w-40 rounded-md" />
              <Sk night className="mt-2 h-3 w-28 rounded" />
            </div>
            <Sk night className="h-11 w-14 rounded-xl" />
          </div>
          <div className="mt-3 flex gap-5">
            <Sk night className="h-1.5 flex-1 rounded-full" />
            <Sk night className="h-1.5 flex-1 rounded-full" />
          </div>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-end gap-4 px-4 py-6">
        <Sk className="h-20 w-full rounded-2xl" />
        <div className="flex items-end gap-2.5">
          <Sk className="h-10 w-10 shrink-0 rounded-full" />
          <Sk className="h-16 w-3/4 rounded-[20px]" />
        </div>
        <Sk className="ml-auto h-12 w-2/3 rounded-[20px]" />
      </div>
      <div className="mx-auto w-full max-w-3xl space-y-2 rounded-t-[24px] border border-b-0 border-line/70 bg-surface/80 px-4 pb-6 pt-4">
        {[0, 1, 2].map((i) => (
          <Sk key={i} className="h-14 w-full rounded-2xl" />
        ))}
      </div>
    </Loading>
  )
}

/** Round badges with a caption; `cards` puts each in its own card (the achievements page). */
export function BadgesSkeleton({ count = 4, cards = false }: { count?: number; cards?: boolean }) {
  return (
    <Loading label="Загружаем достижения">
      <div className={cn('grid gap-3', cards ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5' : 'grid-cols-4')}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className={cn('flex flex-col items-center gap-2.5', cards && 'card px-3 pb-4 pt-5')}>
            <Sk className={cn('rounded-full', cards ? 'h-16 w-16' : 'h-14 w-14')} />
            <Sk className="h-3.5 w-3/4 rounded-md" />
            {cards && <SkText lines={2} className="w-full" />}
          </div>
        ))}
      </div>
    </Loading>
  )
}

/** Chip groups of a form (broadcast segments). */
export function ChipsSkeleton({ groups = 3 }: { groups?: number }) {
  return (
    <Loading label="Загружаем варианты" className="space-y-4">
      {Array.from({ length: groups }, (_, g) => (
        <div key={g}>
          <Sk className="h-3 w-20 rounded" />
          <div className="mt-2 flex flex-wrap gap-2">
            {[28, 36, 24, 32].map((w, i) => (
              <Sk key={i} className="h-10 rounded-full" style={{ width: w * 4 }} />
            ))}
          </div>
        </div>
      ))}
    </Loading>
  )
}

/** Any page while its code loads: a title, a line, a card of rows. */
export function PageSkeleton() {
  return (
    <Loading label="Загружаем страницу" className="space-y-6">
      <div>
        <Sk className="h-9 w-56 rounded-lg lg:h-11" />
        <Sk className="mt-2.5 h-4 w-72 max-w-full rounded-md" />
      </div>
      <div className="card px-4 py-1 sm:px-5">
        <SkRows rows={5} />
      </div>
    </Loading>
  )
}

/** Home, «Следующий рейс»: the card's header, a cover with a title, a reason, the button. */
export function NextRunSkeleton() {
  return (
    <Loading label="Подбираем рейс">
      <div className="card p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <Sk className="h-6 w-44 rounded-md" />
          <Sk className="h-5 w-16 rounded-md" />
        </div>
        <div className="mt-5 flex items-center gap-4">
          <Sk className="h-16 w-16 shrink-0 rounded-2xl" />
          <div className="flex-1">
            <Sk className="h-6 w-2/3 rounded-md" />
            <Sk className="mt-2.5 h-7 w-32 rounded-lg" />
          </div>
        </div>
        <SkText lines={2} className="mt-5" />
        <Sk className="mt-6 h-[52px] w-full rounded-xl" />
      </div>
    </Loading>
  )
}
