import { useEffect, useMemo, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Award, ChevronRight, CircleHelp, Compass, GraduationCap, History, Target } from 'lucide-react'
import { api } from '@/api/client'
import type { AchievementCatalogItem, Competency, LevelInfo, Me, PublicProfile, Qualification } from '@/api/types'
import { useAuth } from '@/auth/AuthContext'
import { useAsync } from '@/hooks/useAsync'
import { Medallion } from '@/components/AchievementBadge'
import { Avatar } from '@/components/Avatar'
import { Button, ButtonLink } from '@/components/Button'
import { IconPlate } from '@/components/Card'
import { CompetencyBars } from '@/components/Competencies'
import { CountUp } from '@/components/CountUp'
import { NightPanel, SpeedLines } from '@/components/NightPanel'
import { Progress } from '@/components/Progress'
import { RouteTrack } from '@/components/RouteTrack'
import { Disclosure } from '@/components/Disclosure'
import { RunHistory } from '@/components/RunHistory'
import { ThemeSwitch } from '@/components/ThemeToggle'
import { openTour } from '@/components/onboarding/Tours'
import { ErrorState } from '@/components/States'
import { BadgesSkeleton, ProfileSkeleton } from '@/components/Skeleton'
import { cn } from '@/lib/cn'
import { fmtNumber, RARITY_ORDER, teamName } from '@/lib/format'
import { plural, POINTS, SCENARIOS } from '@/lib/plural'
import { routePosition, STATIONS, stationFor } from '@/lib/route'

// the showcase: this many of your best badges; the whole collection is on its own page
const SHOWCASE = 4
const TRIPS: [string, string, string] = ['рейс', 'рейса', 'рейсов']

/**
 * Profile: who and where on the route, four numbers, and then only what helps next: the promotion,
 * the skills with the weakest one to train, the best badges and the last runs. The full collection
 * and the whole history live on their own pages (Duolingo / Strava: a summary and «Все →»).
 */
export default function ProfilePage() {
  const { userId } = useParams()
  const { user: me, refresh, logout } = useAuth()
  const isMe = !userId || Number(userId) === me?.id

  const other = useAsync<PublicProfile | null>(() => (isMe ? Promise.resolve(null) : api.user(Number(userId))), [userId, isMe])
  const catalog = useAsync<AchievementCatalogItem[] | null>(() => (isMe ? api.achievements() : Promise.resolve(null)), [isMe])
  const runs = useAsync(() => (isMe ? api.myRuns() : Promise.resolve([])), [isMe])

  useEffect(() => {
    if (isMe) refresh()
  }, [isMe, refresh])

  const profile: Me | PublicProfile | null | undefined = isMe ? me : other.data

  const achievements = useMemo<AchievementCatalogItem[]>(() => {
    const all = isMe && catalog.data ? catalog.data : (profile?.achievements ?? []).map((a) => ({ ...a, unlocked: true }))
    return [...all].sort(
      (a, b) =>
        Number(b.unlocked) - Number(a.unlocked) ||
        (RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9) ||
        (b.awarded_at ?? '').localeCompare(a.awarded_at ?? ''),
    )
  }, [isMe, catalog.data, profile])

  if (!isMe && other.error) return <ErrorState message={other.error} onRetry={other.reload} />
  if (!profile) return <ProfileSkeleton />

  const base = isMe ? '/profile' : `/users/${userId}`
  const q = profile.qualification

  return (
    <div className="space-y-6 lg:space-y-7">
      <Hero profile={profile} levelInfo={(profile as Partial<Me>).level_info ?? null} isMe={isMe} />

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start xl:gap-7">
        <div className="min-w-0 space-y-6">
          {q && <Promotion q={q} isMe={isMe} />}
          <Skills items={profile.competencies} isMe={isMe} />
        </div>
        <div className="min-w-0 space-y-6">
          <Showcase
            items={achievements}
            loading={isMe && catalog.loading && !catalog.data}
            total={isMe ? achievements.length : null}
            to={`${base}/achievements`}
          />
          {isMe && <RecentRuns runs={runs.data ?? []} loading={runs.loading && !runs.data} />}
          {isMe && (
            <section className="card space-y-4 p-5 lg:hidden" aria-labelledby="look">
              <div>
                <h2 id="look" className="text-lg font-semibold">
                  Оформление
                </h2>
                <p className="mt-0.5 text-muted">«Системная» повторяет настройку телефона</p>
              </div>
              <ThemeSwitch labels />
              <Button variant="secondary" block onClick={() => openTour('employee')} icon={<CircleHelp className="h-4 w-4" aria-hidden />}>
                Как устроено приложение
              </Button>
              <Button variant="secondary" block onClick={logout}>
                Выйти из аккаунта
              </Button>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

// --- hero ------------------------------------------------------------------------

/** Name and post, the route with the train where the level is, and a departure board with the four numbers. */
function Hero({ profile, levelInfo, isMe }: { profile: Me | PublicProfile; levelInfo: LevelInfo | null; isMe: boolean }) {
  const pos = routePosition(profile.level, levelInfo?.progress ?? 0)
  const left = levelInfo?.next_threshold != null ? Math.max(0, levelInfo.next_threshold - levelInfo.points) : null
  const where = [profile.position_title, profile.team && teamName(profile.team), profile.depot].filter(Boolean).join(' · ')

  return (
    <NightPanel aria-labelledby="profile-name" className="-mx-2 px-5 pb-5 pt-6 sm:mx-0 sm:px-7 sm:pb-7 lg:px-8 lg:pt-8">
      <SpeedLines rows={[18, 60]} />
      <div className="relative flex items-center gap-4 sm:gap-5">
        <Avatar name={profile.full_name} size="lg" onDark className="lg:h-20 lg:w-20 lg:text-2xl" />
        <div className="min-w-0">
          <h1 id="profile-name" className="text-[26px] font-bold leading-[1.05] lg:text-[36px]">
            {profile.full_name}
          </h1>
          <p className="mt-1.5 text-white/70">{where}</p>
        </div>
      </div>

      <div className="relative mt-6 lg:mt-7" aria-label="Маршрут">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <p className="leading-none">
            <span className="font-display text-[28px] font-bold lg:text-[32px]">{stationFor(profile.level).name}</span>
            <span className="ml-3 text-white/60">{profile.level_title}</span>
          </p>
          <p className="text-sm text-white/60">
            Уровень {profile.level} из {STATIONS.length}
          </p>
        </div>
        <RouteTrack
          level={profile.level}
          progress={levelInfo?.progress ?? 0}
          allNames
          hereLabel={isMe ? 'вы здесь' : 'сейчас здесь'}
          nextHint={pos.next && left !== null ? `ещё ${fmtNumber(left)} ${plural(left, POINTS)}` : undefined}
          className="mt-2"
        />
      </div>

      {/* departure board: the four numbers that used to be a card of their own */}
      <dl className="relative mt-5 grid grid-cols-2 overflow-hidden rounded-2xl bg-white/[.05] ring-1 ring-inset ring-white/10 sm:grid-cols-4">
        <BoardCell label="Очки" className="border-b border-r border-white/10 sm:border-b-0">
          <CountUp value={profile.points} />
        </BoardCell>
        <BoardCell label="Место" className="border-b border-white/10 sm:border-b-0 sm:border-r">
          {profile.rank ?? '—'}
          {profile.rank && <span className="ml-1 font-sans text-sm font-medium text-white/50">в компании</span>}
        </BoardCell>
        <BoardCell label="Рейсов" className="border-r border-white/10">
          <CountUp value={profile.stats.runs_finished} />
        </BoardCell>
        <BoardCell label="Успешных">
          {profile.stats.runs_finished ? `${Math.round(profile.stats.success_rate * 100)}%` : '—'}
        </BoardCell>
      </dl>
    </NightPanel>
  )
}

function BoardCell({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn('min-w-0 px-4 py-3', className)}>
      <dt className="text-[11px] font-medium uppercase tracking-[.08em] text-white/50">{label}</dt>
      <dd className="digits mt-1 whitespace-nowrap text-2xl font-semibold leading-tight text-white">{children}</dd>
    </div>
  )
}

// --- promotion -----------------------------------------------------------------

/** The next post: one segment per qualification scenario, and the way to them. */
function Promotion({ q, isMe }: { q: Qualification; isMe: boolean }) {
  const left = Math.max(0, q.total - q.passed)
  return (
    <section className="card relative isolate overflow-hidden p-5 sm:p-6" aria-labelledby="promotion">
      <div
        className="pointer-events-none absolute -right-16 -top-20 -z-10 h-56 w-56 rounded-full bg-[radial-gradient(closest-side,rgb(var(--cat-service)/.16),transparent)]"
        aria-hidden
      />
      <div className="flex items-center gap-3.5">
        <IconPlate icon={GraduationCap} tint="bg-cat-service-soft" tone="text-cat-service" className="h-11 w-11 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">Следующая должность</p>
          <h2 id="promotion" className="truncate text-lg font-semibold leading-tight">
            {q.next_position_title}
          </h2>
        </div>
        <p className="digits shrink-0 text-2xl font-bold leading-none">
          {q.passed}
          <span className="text-base font-semibold text-muted">/{q.total}</span>
        </p>
      </div>
      <div className="mt-4 flex gap-1.5" aria-hidden>
        {Array.from({ length: Math.max(1, q.total) }, (_, i) => (
          <span key={i} className={cn('h-2 flex-1 rounded-full', i < q.passed ? 'bg-cat-service' : 'track')} />
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">
        {q.ready
          ? 'Сценарии повышения пройдены.'
          : `Осталось пройти ${left} ${plural(left, SCENARIOS)} повышения квалификации.`}
      </p>
      {isMe && !q.ready && (
        <ButtonLink to="/scenarios" variant="secondary" size="sm" className="mt-4" icon={<ArrowRight className="order-last h-4 w-4" aria-hidden />}>
          К сценариям повышения
        </ButtonLink>
      )}
    </section>
  )
}

// --- skills ----------------------------------------------------------------------

/** Mastery per direction, and the weakest one as a shortcut to its scenarios. */
function Skills({ items, isMe }: { items: Competency[]; isMe: boolean }) {
  const weakest = [...items].sort((a, b) => a.mastery - b.mastery)[0]
  const train = isMe && weakest && weakest.mastery < 0.7 ? weakest : null
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="skills">
      <h2 id="skills" className="mb-4 flex items-center gap-2.5 text-lg font-semibold">
        <IconPlate icon={Compass} tint="bg-cat-medical-soft" tone="text-cat-medical" />
        Навыки
      </h2>
      <CompetencyBars items={items} />
      {train && (
        <Link
          to={`/scenarios?category=${train.category}`}
          className="group mt-5 flex items-center gap-3 rounded-xl bg-ink/[.035] px-4 py-3 ring-1 ring-inset ring-line/70 transition-colors hover:bg-ink/[.06]"
        >
          <Target className="h-5 w-5 shrink-0 text-brand" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-muted">Подтянуть</span>
            <span className="block truncate font-medium">{train.title}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-muted group-hover:text-ink">
            <span className="hidden min-[400px]:inline">Тренировать</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </Link>
      )}
    </section>
  )
}

// --- achievements showcase ------------------------------------------------------

function Showcase({ items, loading, total, to }: { items: AchievementCatalogItem[]; loading: boolean; total: number | null; to: string }) {
  const unlocked = items.filter((a) => a.unlocked)
  const best = unlocked.slice(0, SHOWCASE)
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="badges">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="badges" className="flex items-center gap-2.5 text-lg font-semibold">
          <IconPlate icon={Award} tint="bg-rarity-legendary-soft" tone="text-rarity-legendary-ink" />
          Достижения
        </h2>
        <AllLink to={to}>Все</AllLink>
      </div>
      {loading ? (
        <BadgesSkeleton count={4} />
      ) : (
        <>
          {total !== null && total > 0 && (
            <div className="mb-5">
              <div className="mb-1.5 flex items-baseline justify-between text-sm">
                <span className="text-muted">Коллекция</span>
                <span>
                  <span className="digits text-base font-semibold">{unlocked.length}</span>
                  <span className="text-muted"> из {total}</span>
                </span>
              </div>
              <Progress value={unlocked.length / total} barClassName="bar-brand" />
            </div>
          )}
          {best.length ? (
            <ul className="grid grid-cols-4 gap-2">
              {best.map((a) => (
                <li key={a.code} className="flex min-w-0 flex-col items-center text-center" title={a.description}>
                  <Medallion achievement={a} locked={false} size="md" />
                  <p className="mt-2 line-clamp-2 text-xs font-medium leading-tight">{a.title}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted">Первое достижение ждёт после первого рейса.</p>
          )}
        </>
      )}
    </section>
  )
}

// --- recent runs -----------------------------------------------------------------

/**
 * Your runs, folded by default: the header says how many and how they went, and opens the whole
 * list right here (no separate page). A run opens its debrief.
 */
function RecentRuns({ runs, loading }: { runs: Parameters<typeof RunHistory>[0]['items']; loading: boolean }) {
  const success = runs.filter((r) => r.outcome === 'success').length
  return (
    <Disclosure
      icon={History}
      title="История рейсов"
      disabled={loading || !runs.length}
      summary={loading ? 'Загружаем' : runs.length ? `${runs.length} ${plural(runs.length, TRIPS)} · ${success} успешных` : 'Завершённых рейсов пока нет'}
    >
      <RunHistory items={runs} linked />
    </Disclosure>
  )
}

function AllLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="-mr-2 inline-flex min-h-[40px] shrink-0 items-center gap-0.5 rounded-lg px-2 text-sm font-medium text-muted transition-colors hover:bg-ink/[.05] hover:text-ink coarse:min-h-[44px]"
    >
      {children}
      <ChevronRight className="h-4 w-4" aria-hidden />
    </Link>
  )
}
