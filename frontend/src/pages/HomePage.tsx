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
import { HeroRide } from '@/components/HeroRide'
import { NightPanel, SpeedLines } from '@/components/NightPanel'
import { DifficultyDots } from '@/components/Progress'
import { RouteTrack } from '@/components/RouteTrack'
import { ScoreRing } from '@/components/ScoreRing'
import { TournamentBanner } from '@/components/TournamentBanner'
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

/** «Маршрут» on the night line: the station, a departure board for the next one, the line to St Petersburg. */
function RouteHero({ user, li }: { user: Me; li: LevelInfo }) {
  const pos = routePosition(li.level, li.progress)
  const left = li.next_threshold !== null ? Math.max(0, li.next_threshold - li.points) : 0
  const onTheWay = !!pos.next && li.next_threshold !== null

  return (
    <NightPanel aria-labelledby="route-station" stripe className="-mx-2 px-5 py-5 sm:mx-0 sm:px-7 sm:py-6 lg:px-8">
      <SpeedLines rows={[16, 44]} />

      <div className="relative">
        <p className="text-white/70">
          {greeting()}, {firstName(user.full_name)}
        </p>
        {/* the station name, and the track leaving it for St Petersburg with the train on it */}
        <div className="mt-2 flex items-end gap-4">
          <h1 id="route-station" className="shrink-0 whitespace-nowrap text-[40px] font-bold leading-[.95] tracking-[-0.01em] sm:text-[48px] lg:text-[56px]">
            {pos.station.name}
          </h1>
          {/* negative bottom margin: the upper rail lands on the name's baseline (measured per font size) */}
          <HeroRide className="-mb-1 -mr-5 min-w-0 flex-1 sm:-mb-0.5 sm:-mr-7 lg:-mr-8" />
        </div>
        <p className="mt-2 text-white/75">
          Уровень {pos.index + 1} из {STATIONS.length} · {li.title}
        </p>
      </div>

      {/* departure board: the next stop, how far to it, the points */}
      {/* phones: the station gets its own row, the two numbers share the one below */}
      <dl className="relative mt-5 grid max-w-xl grid-cols-2 rounded-2xl bg-white/[.05] ring-1 ring-inset ring-white/10 sm:grid-cols-[1.4fr_1fr_1fr]">
        <BoardCell label={onTheWay ? 'Следующая' : 'Маршрут'} className="col-span-2 border-b border-white/10 sm:col-span-1 sm:border-b-0">
          {onTheWay ? pos.next!.name : 'Пройден'}
        </BoardCell>
        <BoardCell label="Осталось" className="sm:border-l sm:border-white/10">
          {onTheWay ? (
            <>
              {fmtNumber(left)} <span className="text-sm font-medium text-white/55">{plural(left, POINTS)}</span>
            </>
          ) : (
            '—'
          )}
        </BoardCell>
        <BoardCell label="Очки" className="border-l border-white/10">
          {fmtNumber(li.points)}
          {onTheWay && <span className="text-sm font-medium text-white/45"> / {fmtNumber(li.next_threshold!)}</span>}
        </BoardCell>
      </dl>

      <RouteTrack
        level={li.level}
        progress={li.progress}
        animate
        allNames
        nextHint={onTheWay ? `ещё ${fmtNumber(left)} ${plural(left, POINTS)}` : undefined}
        className="relative mt-3"
      />
    </NightPanel>
  )
}

function BoardCell({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn('min-w-0 px-4 py-2.5 sm:py-3', className)}>
      <dt className="text-[11px] font-medium uppercase tracking-[.08em] text-white/50">{label}</dt>
      <dd className="digits mt-1 whitespace-nowrap text-lg font-semibold leading-tight text-white">{children}</dd>
    </div>
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
