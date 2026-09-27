import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '@/api/client'
import type { AchievementCatalogItem } from '@/api/types'
import { useAuth } from '@/auth/AuthContext'
import { useAsync } from '@/hooks/useAsync'
import { Medallion } from '@/components/AchievementBadge'
import { BackLink } from '@/components/BackLink'
import { PageHeader } from '@/components/Card'
import { ScoreRing } from '@/components/ScoreRing'
import { Counted, Segmented } from '@/components/Segmented'
import { EmptyState, ErrorState } from '@/components/States'
import { BadgesSkeleton } from '@/components/Skeleton'
import { cn } from '@/lib/cn'
import { fmtDate, RARITY_ORDER, rarityMeta } from '@/lib/format'

type Filter = 'all' | 'got' | 'ahead'
const RARITIES = ['legendary', 'epic', 'rare', 'common'] as const
const RARITY_PLURAL: Record<string, string> = { legendary: 'Легендарные', epic: 'Эпические', rare: 'Редкие', common: 'Обычные' }
// light in the rarity's colour falling on an earned badge's card
const GLOW: Record<string, string> = {
  legendary: 'bg-[radial-gradient(120%_70%_at_50%_0%,rgb(var(--rarity-legendary)/.24),transparent_62%)]',
  epic: 'bg-[radial-gradient(120%_70%_at_50%_0%,rgb(var(--rarity-epic)/.2),transparent_62%)]',
  rare: 'bg-[radial-gradient(120%_70%_at_50%_0%,rgb(var(--rarity-rare)/.16),transparent_62%)]',
  common: '',
}

const sortBadges = (items: AchievementCatalogItem[]) =>
  [...items].sort(
    (a, b) =>
      Number(b.unlocked) - Number(a.unlocked) ||
      (RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9) ||
      (b.awarded_at ?? '').localeCompare(a.awarded_at ?? ''),
  )

/**
 * The whole collection, moved out of the profile. Yours: how much is collected by rarity, and every
 * badge with how to earn the ones ahead. Someone else's: the badges they have.
 */
export default function AchievementsPage() {
  const { userId } = useParams()
  const { user: me } = useAuth()
  const isMe = !userId || Number(userId) === me?.id
  const [filter, setFilter] = useState<Filter>('all')

  const data = useAsync(async () => {
    if (isMe) return { name: null, items: await api.achievements() }
    const p = await api.user(Number(userId))
    return { name: p.full_name, items: p.achievements.map((a) => ({ ...a, unlocked: true })) }
  }, [userId, isMe])

  const items = useMemo(() => sortBadges(data.data?.items ?? []), [data.data])
  const got = items.filter((a) => a.unlocked)
  const shown = filter === 'got' ? got : filter === 'ahead' ? items.filter((a) => !a.unlocked) : items
  const back = isMe ? '/profile' : `/users/${userId}`

  return (
    <div>
      <BackLink to={back}>{isMe ? 'Профиль' : data.data?.name ?? 'Профиль'}</BackLink>
      <PageHeader
        title="Достижения"
        subtitle={
          !data.data ? undefined : isMe ? `Получено ${got.length} из ${items.length}` : `${data.data.name}, ${got.length} получено`
        }
      />

      {data.loading && !data.data ? (
        <BadgesSkeleton count={8} cards />
      ) : data.error ? (
        <ErrorState message={data.error} onRetry={data.reload} />
      ) : !items.length ? (
        <EmptyState title="Достижений пока нет" text="Они появляются за рейсы, турниры и повышение квалификации." />
      ) : (
        <>
          {isMe && <Collection items={items} />}
          {isMe && (
            <div className="mb-5">
              <Segmented
                label="Показать"
                value={filter}
                onChange={setFilter}
                options={[
                  ['all', <Counted key="all" text="Все" n={items.length} />],
                  ['got', <Counted key="got" text="Получены" n={got.length} />],
                  ['ahead', <Counted key="ahead" text="Впереди" n={items.length - got.length} />],
                ]}
              />
            </div>
          )}
          {shown.length ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {shown.map((a, i) => (
                <BadgeCard key={a.code} a={a} index={i} />
              ))}
            </ul>
          ) : (
            <p className="text-muted">{filter === 'got' ? 'Пока ничего не получено.' : 'Всё уже получено.'}</p>
          )}
        </>
      )}
    </div>
  )
}

/** How much of the collection is yours: a ring and the count per rarity. */
function Collection({ items }: { items: AchievementCatalogItem[] }) {
  const got = items.filter((a) => a.unlocked).length
  const pct = Math.round((got / items.length) * 100)
  return (
    <section className="card mb-6 flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:gap-7 sm:p-6" aria-label="Коллекция">
      <ScoreRing value={got / items.length} tone="brand" size={96} stroke={9} label={`Получено ${got} из ${items.length}`} className="self-center">
        <span className="digits text-2xl font-bold leading-none">
          {got}
          <span className="text-base font-semibold text-muted">/{items.length}</span>
        </span>
      </ScoreRing>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold">{got === items.length ? 'Коллекция собрана' : `Собрано ${pct}% коллекции`}</p>
        <ul className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {RARITIES.map((r) => {
            const all = items.filter((a) => a.rarity === r)
            if (!all.length) return null
            return (
              <li key={r} className="rounded-xl bg-ink/[.035] px-3 py-2 ring-1 ring-inset ring-line/60">
                <span className={cn('block text-xs font-medium', rarityMeta(r).text)}>{RARITY_PLURAL[r]}</span>
                <span className="digits text-lg font-semibold">
                  {all.filter((a) => a.unlocked).length}
                  <span className="text-sm font-medium text-muted">/{all.length}</span>
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

/** One badge: earned ones glow in their rarity, the ones ahead say how to earn them. */
function BadgeCard({ a, index }: { a: AchievementCatalogItem; index: number }) {
  const meta = rarityMeta(a.rarity)
  const locked = !a.unlocked
  return (
    <li
      className={cn(
        'card row-in relative isolate flex flex-col items-center overflow-hidden px-3 pb-4 pt-5 text-center sm:px-4',
        locked && 'border-dashed bg-transparent bg-none shadow-none',
      )}
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      {!locked && GLOW[a.rarity] && <span className={cn('pointer-events-none absolute inset-0 -z-10', GLOW[a.rarity])} aria-hidden />}
      <Medallion achievement={a} locked={locked} size="lg" />
      <p className={cn('mt-3 text-sm font-semibold leading-tight', locked && 'text-muted')}>{a.title}</p>
      <p className={cn('mt-1 text-xs font-medium', locked ? 'text-muted/80' : meta.text)}>{meta.label}</p>
      <p className="mt-2 text-xs leading-snug text-muted">{a.description}</p>
      {a.awarded_at && <p className="mt-auto pt-3 text-[11px] text-muted">Получено {fmtDate(a.awarded_at)}</p>}
    </li>
  )
}
