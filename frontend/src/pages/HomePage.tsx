import { useEffect, type ReactNode } from 'react'
import { Clock3 } from 'lucide-react'
import { api } from '@/api/client'
import type { LevelInfo, Me, Recommended } from '@/api/types'
import { useAuth } from '@/auth/AuthContext'
import { useAsync } from '@/hooks/useAsync'
import { useStartRun } from '@/hooks/useStartRun'
import { Button, ButtonLink } from '@/components/Button'
import { CategoryTag, CoverTile } from '@/components/Category'
import { CountUp } from '@/components/CountUp'
import { NightPanel, SpeedLines } from '@/components/NightPanel'
import { DifficultyDots } from '@/components/Progress'
import { RouteTrack } from '@/components/RouteTrack'
import { ScoreRing } from '@/components/ScoreRing'
import { TournamentBanner } from '@/components/TournamentBanner'
import { TrainArt } from '@/components/TrainArt'
import { VovaTip } from '@/components/VovaTip'
import { cn } from '@/lib/cn'
import { firstName, fmtNumber, scaleTone, TONE_TEXT } from '@/lib/format'
import { plural, pluralN, POINTS, SCENARIOS } from '@/lib/plural'
import { routePosition, STATIONS } from '@/lib/route'

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Доброй ночи'
  if (h < 12) return 'Доброе утро'
  if (h < 18) return 'Добрый день'
  return 'Добрый вечер'
}

/**
 * Home, «смена»: where I am on the line, the next run, Вова's tip and the tournament,
 * then my scales. Phones stack them in that order.
 */
export default function HomePage() {
  const { user, refresh } = useAuth()
  const recommended = useAsync(() => api.recommended(), [])
  const tournament = useAsync(() => api.currentTournament(), [])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (!user) return null
  const showTournament = !!tournament.data?.tournament && tournament.data.tournament.status !== 'finished'

  return (
    <div className="space-y-5 lg:space-y-6">
      <RouteHero user={user} li={user.level_info} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)] lg:gap-6">
        <NextRun loading={recommended.loading} rec={recommended.data} />
        {/* desktop: Вова's card stretches to the next run's height, the tournament strip sits under it */}
        <div className="flex min-w-0 flex-col gap-5 lg:gap-6">
          <VovaTip className="lg:flex-1" />
          {showTournament && <TournamentBanner data={tournament.data!} />}
        </div>
      </div>

      <Indicators user={user} />
    </div>
  )
}

/** «Маршрут» on the night line: the station, the points to the next one, the line to St Petersburg. */
function RouteHero({ user, li }: { user: Me; li: LevelInfo }) {
  const pos = routePosition(li.level, li.progress)
  const span = li.next_threshold !== null ? li.next_threshold - li.current_threshold : 0
  const done = li.next_threshold !== null ? li.points - li.current_threshold : 0
  const left = li.next_threshold !== null ? Math.max(0, li.next_threshold - li.points) : 0

  return (
    <NightPanel aria-labelledby="route-station" stripe className="-mx-2 px-5 py-5 sm:mx-0 sm:px-7 sm:py-6 lg:px-8">
      <SpeedLines rows={[16, 44]} />

      {/* the train heads for St Petersburg, into the red dawn */}
      <div className="pointer-events-none absolute -right-[3%] top-5 hidden w-[42%] max-w-[500px] md:block" aria-hidden>
        <div className="absolute -inset-x-[10%] -inset-y-[40%] -z-10 bg-[radial-gradient(55%_55%_at_65%_50%,rgb(226_26_26/.38),transparent_70%)]" />
        <TrainArt />
        <span className="headlight absolute -right-[6%] top-[30%] h-[34%] w-[20%] rounded-full blur-md" />
      </div>

      <div className="relative md:max-w-[54%]">
        <p className="text-white/70">
          {greeting()}, {firstName(user.full_name)}
        </p>
        <h1 id="route-station" className="mt-2 text-[40px] font-bold leading-[.95] tracking-[-0.01em] sm:text-[48px] lg:text-[56px]">
          {pos.station.name}
        </h1>
        <p className="mt-2 text-white/75">
          Уровень {pos.index + 1} из {STATIONS.length} · {li.title}
        </p>
      </div>

      {pos.next && li.next_threshold !== null ? (
        <div className="relative mt-5 max-w-lg">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-white/75">
              До {pos.next.to} <span className="font-medium text-white">{fmtNumber(left)} {plural(left, POINTS)}</span>
            </span>
            <span className="digits whitespace-nowrap text-white/60">
              <span className="font-semibold text-white">{fmtNumber(li.points)}</span> / {fmtNumber(li.next_threshold)}
            </span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[.12]"
            role="progressbar"
            aria-label={`До станции ${pos.next.name} ещё ${left} ${plural(left, POINTS)}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(li.progress * 100)}
          >
            <div className="bar-brand h-full rounded-full" style={{ width: `${Math.max(3, span ? (done / span) * 100 : li.progress * 100)}%` }} />
          </div>
        </div>
      ) : (
        <p className="relative mt-5 text-white/80">Вы прибыли в Санкт-Петербург: весь маршрут пройден.</p>
      )}

      <RouteTrack level={li.level} progress={li.progress} animate dark className="relative mt-5" />
    </NightPanel>
  )
}

/** The run the AI mentor picked: what it is, how long, why — and the one button. */
function NextRun({ loading, rec }: { loading: boolean; rec: Recommended | null | undefined }) {
  const { start, pending, error } = useStartRun()

  if (loading) return <div className="skeleton h-64" />

  if (!rec) {
    return (
      <section className="card p-5 sm:p-6" aria-labelledby="next-run">
        <h2 id="next-run" className="text-lg font-semibold">
          Следующий рейс
        </h2>
        <p className="mt-3 font-medium">Все рекомендованные рейсы пройдены.</p>
        <p className="mt-1 text-muted">Выберите сценарий в расписании или повторите сложный, чтобы поднять шкалы.</p>
        <ButtonLink to="/scenarios" variant="secondary" className="mt-4">
          Открыть расписание
        </ButtonLink>
      </section>
    )
  }

  const s = rec.scenario
  return (
    <section className="card flex flex-col p-5 sm:p-6" aria-labelledby="next-run">
      <div className="flex items-center justify-between gap-3">
        <h2 id="next-run" className="text-lg font-semibold">
          Следующий рейс
        </h2>
        <span className="flex items-center gap-1.5 text-sm text-muted">
          <Clock3 className="h-4 w-4" aria-hidden />
          {s.estimated_minutes} мин
        </span>
      </div>

      <div className="mt-4 flex items-start gap-4">
        <CoverTile cover={s.cover} category={s.category} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[22px] font-semibold leading-[1.1] sm:text-[26px]">{s.title}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <CategoryTag category={s.category} title={s.category_title} />
            <DifficultyDots value={s.difficulty} />
          </div>
        </div>
      </div>

      {s.description && <p className="mt-4 max-w-prose">{s.description}</p>}
      <p className="mt-3 max-w-prose border-l-2 border-line pl-3 text-sm text-muted">{rec.reason}</p>

      {error && (
        <p className="mt-3 text-brand" role="alert">
          {error}
        </p>
      )}
      <div className="mt-auto pt-5">
        <Button
          className="sm:w-auto sm:min-w-[240px]"
          block
          size="lg"
          data-testid="start-recommended"
          loading={pending === s.id}
          onClick={() => start(s.id)}
        >
          Начать рейс
        </Button>
      </div>
    </section>
  )
}

const ZONE = {
  ok: { chip: 'bg-ok-soft text-ok', name: 'Зелёная зона' },
  warn: { chip: 'bg-warn-soft text-warn-ink', name: 'Жёлтая зона' },
  bad: { chip: 'bg-brand-soft text-bad', name: 'Красная зона' },
} as const

/** The two scales and the promotion track: ring gauges that fill up as the page opens. */
function Indicators({ user }: { user: Me }) {
  const q = user.qualification
  const runs = user.stats.runs_finished
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="indicators">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="indicators" className="text-lg font-semibold">
          Мои показатели
        </h2>
        <p className="text-xs text-muted">{runs ? `Средние по ${fmtNumber(runs)} ${plural(runs, RUNS_DATIVE)}` : 'Появятся после первого рейса'}</p>
      </div>
      <div className={cn('mt-4 grid gap-3 sm:grid-cols-2', q && 'lg:grid-cols-3')}>
        <ScaleTile label="Лояльность пассажира" value={user.stats.avg_loyalty} />
        <ScaleTile label="Безопасность" value={user.stats.avg_safety} />
        {q && (
          <Tile className="sm:col-span-2 lg:col-span-1">
            <ScoreRing value={q.total ? q.passed / q.total : 0} tone="brand" segments={q.total} label={`Повышение: пройдено ${q.passed} из ${q.total}`}>
              <span className="digits text-[26px] font-bold leading-none">
                {q.passed}
                <span className="text-base font-semibold text-muted">/{q.total}</span>
              </span>
            </ScoreRing>
            <div className="min-w-0">
              <p className="font-medium leading-tight">Повышение до «{q.next_position_title}»</p>
              <Chip className={q.ready ? ZONE.ok.chip : 'bg-ink/[.06] text-ink'}>
                {q.ready ? 'Готов к повышению' : `Осталось ${pluralN(q.total - q.passed, SCENARIOS)}`}
              </Chip>
              <p className="mt-1.5 text-xs text-muted">{q.ready ? 'Руководитель может перевести вас' : 'Без провала, очки ×1,5'}</p>
            </div>
          </Tile>
        )}
      </div>
    </section>
  )
}

const RUNS_DATIVE: [string, string, string] = ['рейсу', 'рейсам', 'рейсам']

function Tile({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('flex items-center gap-4 rounded-2xl bg-ink/[.03] p-4 ring-1 ring-inset ring-line/60 dark:bg-white/[.025]', className)}>{children}</div>
}

function Chip({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn('mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', className)}>{children}</span>
}

/** One 0..100 scale: the ring in its semaphore colour, the zone, and how far to the next one. */
function ScaleTile({ label, value }: { label: string; value: number | null }) {
  if (value === null) {
    return (
      <Tile>
        <ScoreRing value={0} tone="ok" label={`${label}: пока нет данных`}>
          <span className="digits text-[26px] font-bold leading-none text-muted">—</span>
        </ScoreRing>
        <div className="min-w-0">
          <p className="font-medium leading-tight">{label}</p>
          <p className="mt-1.5 text-xs text-muted">Пройдите первый рейс</p>
        </div>
      </Tile>
    )
  }
  const tone = scaleTone(value)
  const hint = tone === 'ok' ? 'Держите выше 70' : tone === 'warn' ? `До зелёной зоны ${70 - value}` : `До жёлтой зоны ${40 - value}`
  return (
    <Tile>
      <ScoreRing value={value / 100} tone={tone} label={`${label}: ${value} из 100, ${ZONE[tone].name.toLowerCase()}`}>
        <CountUp value={value} duration={1200} className={cn('digits text-[26px] font-bold leading-none', TONE_TEXT[tone])} />
      </ScoreRing>
      <div className="min-w-0">
        <p className="font-medium leading-tight">{label}</p>
        <Chip className={ZONE[tone].chip}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
          {ZONE[tone].name}
        </Chip>
        <p className="mt-1.5 text-xs text-muted">{hint}</p>
      </div>
    </Tile>
  )
}
