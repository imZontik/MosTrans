import { useEffect, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Award, Clock3, Gauge, GraduationCap, Sparkles, TrainFront } from 'lucide-react'
import { api } from '@/api/client'
import type { LevelInfo, Me } from '@/api/types'
import { useAuth } from '@/auth/AuthContext'
import { useAsync } from '@/hooks/useAsync'
import { useStartRun } from '@/hooks/useStartRun'
import { Button, ButtonLink } from '@/components/Button'
import { SectionTitle } from '@/components/Card'
import { AchievementBadge } from '@/components/AchievementBadge'
import { CategoryTag, CoverTile } from '@/components/Category'
import { NightPanel, SpeedLines } from '@/components/NightPanel'
import { MascotTip } from '@/components/Mascot'
import { DifficultyDots, Progress } from '@/components/Progress'
import { RouteTrack } from '@/components/RouteTrack'
import { SignalBar } from '@/components/SignalBar'
import { TournamentBanner } from '@/components/TournamentBanner'
import { TrainArt } from '@/components/TrainArt'
import { categoryKey } from '@/lib/category'
import { firstName, fmtNumber } from '@/lib/format'
import { plural, POINTS } from '@/lib/plural'
import { routePosition, routeSentence, stationFor } from '@/lib/route'
import { tipOfTheDay } from '@/lib/tips'

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Доброй ночи'
  if (h < 12) return 'Доброе утро'
  if (h < 18) return 'Добрый день'
  return 'Добрый вечер'
}

export default function HomePage() {
  const { user, refresh } = useAuth()
  const recommended = useAsync(() => api.recommended(), [])
  const tournament = useAsync(() => api.currentTournament(), [])
  const { start, pending, error } = useStartRun()

  useEffect(() => {
    refresh()
  }, [refresh])

  if (!user) return null
  const li = user.level_info
  const recentAchievements = [...user.achievements]
    .sort((a, b) => (b.awarded_at ?? '').localeCompare(a.awarded_at ?? ''))
    .slice(0, 4)
  const q = user.qualification
  const rec = recommended.data
  const showTournament = !!tournament.data?.tournament && tournament.data.tournament.status !== 'finished'

  const achievements = (
    <section className="card p-5">
      <SectionTitle
        icon={Award}
        tint="bg-rarity-legendary-soft"
        tone="text-rarity-legendary-ink"
        action={
          <Link to="/profile" className="flex min-h-[44px] items-center text-sm font-medium text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
            Все достижения
          </Link>
        }
      >
        Достижения
      </SectionTitle>
      {recentAchievements.length ? (
        <div className="grid grid-cols-4 gap-1 sm:gap-3">
          {recentAchievements.map((a) => (
            <AchievementBadge key={a.code} achievement={a} className="w-auto" />
          ))}
        </div>
      ) : (
        <p className="text-muted">Завершите первый рейс, чтобы получить достижение «Первый рейс».</p>
      )}
    </section>
  )

  return (
    <div className="space-y-6 lg:space-y-7">
      <RouteHero user={user} li={li} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)] xl:gap-7">
        <div className="min-w-0 space-y-6">
          {/* next run, picked by the AI mentor */}
          {recommended.loading ? (
            <div className="skeleton h-56" />
          ) : rec ? (
            <section
              className="card relative overflow-hidden p-5 sm:p-6"
              aria-labelledby="next-run"
              style={{ '--cat': `var(--cat-${categoryKey(rec.scenario.category)}-soft)` } as CSSProperties}
            >
              {/* the category's tint washes down from the top edge */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgb(var(--cat)/.9),transparent)]" aria-hidden />
              <div className="relative">
                <SectionTitle
                  id="next-run"
                  icon={TrainFront}
                  tint="bg-brand-soft"
                  tone="text-brand"
                  action={
                    <span className="flex items-center gap-1.5 text-muted">
                      <Clock3 className="h-4 w-4" aria-hidden />
                      <span className="digits text-xl font-semibold leading-none text-ink">{rec.scenario.estimated_minutes}</span>
                      мин
                    </span>
                  }
                >
                  Следующий рейс
                </SectionTitle>
                <div className="mt-4 flex items-start gap-4">
                  <CoverTile cover={rec.scenario.cover} category={rec.scenario.category} size="lg" className="sm:h-16 sm:w-16 sm:rounded-[18px] sm:text-[32px]" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[22px] font-semibold leading-[1.1] sm:text-[26px]">{rec.scenario.title}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <CategoryTag category={rec.scenario.category} title={rec.scenario.category_title} />
                      <DifficultyDots value={rec.scenario.difficulty} />
                    </div>
                    {rec.scenario.description && <p className="mt-2 line-clamp-2 hidden max-w-prose text-muted sm:block">{rec.scenario.description}</p>}
                  </div>
                </div>
                <p className="mt-5 flex gap-2.5 rounded-xl bg-ink/[.04] px-3.5 py-3 text-ink/85 ring-1 ring-inset ring-line/60">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-cat-service" aria-hidden />
                  <span>{rec.reason}</span>
                </p>
                {error && (
                  <p className="mt-3 text-brand" role="alert">
                    {error}
                  </p>
                )}
                <Button
                  className="mt-5 sm:w-auto sm:min-w-[240px]"
                  block
                  size="lg"
                  data-testid="start-recommended"
                  loading={pending === rec.scenario.id}
                  onClick={() => start(rec.scenario.id)}
                >
                  Начать рейс
                </Button>
              </div>
            </section>
          ) : (
            <section className="card p-5 sm:p-6">
              <SectionTitle icon={TrainFront} tint="bg-brand-soft" tone="text-brand">
                Следующий рейс
              </SectionTitle>
              <p className="font-medium">Все рекомендованные рейсы пройдены.</p>
              <p className="mt-1 text-muted">Выберите сценарий в расписании или повторите сложный, чтобы поднять шкалы.</p>
              <ButtonLink to="/scenarios" variant="secondary" className="mt-4">
                Открыть расписание
              </ButtonLink>
            </section>
          )}

          {showTournament && <TournamentBanner data={tournament.data!} className="lg:hidden" />}

          <div className="grid gap-6 md:grid-cols-2">
            <section className={q ? 'card p-5' : 'card p-5 md:col-span-2'}>
              <SectionTitle icon={Gauge} tint="bg-ok-soft" tone="text-ok">
                Средние шкалы
              </SectionTitle>
              <div className="flex gap-5">
                <SignalBar label="Пассажир" value={user.stats.avg_loyalty} />
                <SignalBar label="Безопасность" value={user.stats.avg_safety} />
              </div>
              <p className="mt-3 text-xs text-muted">Зелёная зона от 70, красная ниже 40.</p>
            </section>

            {q && (
              <section className="card p-5">
                <SectionTitle icon={GraduationCap} tint="bg-cat-safety-soft" tone="text-cat-safety">
                  Повышение до «{q.next_position_title}»
                </SectionTitle>
                <div className="flex items-baseline gap-1.5">
                  <span className="digits text-[34px] font-bold leading-none">{q.passed}</span>
                  <span className="text-muted">из {q.total} сценариев</span>
                </div>
                <Progress value={q.total ? q.passed / q.total : 0} className="mt-3" height="h-2" />
                <p className="mt-3 text-muted">
                  {q.ready
                    ? 'Все сценарии пройдены. Руководитель может повысить вас в должности.'
                    : 'Пройдите без провала все сценарии следующей должности. Они дают в 1,5 раза больше очков.'}
                </p>
              </section>
            )}
          </div>

          <div className="lg:hidden">{achievements}</div>

          <MascotTip text={tipOfTheDay()} />
        </div>

        {/* desktop side column */}
        <div className="hidden min-w-0 space-y-6 lg:block">
          {showTournament && <TournamentBanner data={tournament.data!} variant="card" />}
          {achievements}
        </div>
      </div>
    </div>
  )
}

/** «Маршрут» on the night line — the one bold element: station, train, the line to St Petersburg. */
function RouteHero({ user, li }: { user: Me; li: LevelInfo }) {
  const pos = routePosition(li.level, li.progress)
  const span = li.next_threshold !== null ? li.next_threshold - li.current_threshold : 0
  const done = li.next_threshold !== null ? li.points - li.current_threshold : 0
  const left = li.next_threshold !== null ? Math.max(0, li.next_threshold - li.points) : 0

  return (
    <NightPanel aria-labelledby="route-station" stripe className="-mx-2 px-5 pb-5 pt-5 sm:mx-0 sm:px-7 sm:pb-6 sm:pt-6 lg:px-9 lg:pb-7 lg:pt-8">
      <SpeedLines rows={[14, 30, 58]} />

      {/* the train heads for St Petersburg, into the red dawn */}
      <div className="pointer-events-none absolute -right-[4%] top-8 hidden w-[50%] max-w-[640px] md:block lg:top-10 xl:w-[46%]" aria-hidden>
        <div className="absolute -inset-x-[10%] -inset-y-[40%] -z-10 bg-[radial-gradient(55%_55%_at_65%_50%,rgb(226_26_26/.42),transparent_70%)]" />
        <TrainArt />
        <span className="headlight absolute -right-[6%] top-[30%] h-[34%] w-[20%] rounded-full blur-md" />
      </div>

      <div className="relative md:max-w-[48%] xl:max-w-[52%]">
        <p className="text-white/70">
          {greeting()}, {firstName(user.full_name)}
        </p>
        <h1 id="route-station" className="mt-4 text-[44px] font-bold leading-[.95] tracking-[-0.01em] sm:text-[56px] lg:text-[72px]">
          {stationFor(li.level).name}
        </h1>
        <p className="mt-3 text-base text-white">{routeSentence(li)}</p>
        <p className="mt-0.5 text-white/70">{li.title}</p>
      </div>

      {/* progress to the next station */}
      {pos.next && li.next_threshold !== null && (
        <div className="relative mt-6 max-w-xl lg:mt-8">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-white/70">
              {pos.station.name} <span className="text-white/40">→</span> <span className="font-medium text-white">{pos.next.name}</span>
            </span>
            <span className="digits whitespace-nowrap text-white/70">
              <span className="text-lg font-semibold text-white">{fmtNumber(li.points)}</span> / {fmtNumber(li.next_threshold)}
            </span>
          </div>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-white/[.12] ring-1 ring-inset ring-white/10"
            role="progressbar"
            aria-label={`До станции ${pos.next.name} ещё ${left} ${plural(left, POINTS)}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(li.progress * 100)}
          >
            <div
              className="bar-brand h-full rounded-full shadow-[0_0_12px_rgb(255_90_61/.6)]"
              style={{ width: `${Math.max(3, span ? (done / span) * 100 : li.progress * 100)}%` }}
            />
          </div>
        </div>
      )}

      <RouteTrack level={li.level} progress={li.progress} animate dark allNames className="relative mt-6 lg:mt-8" />
    </NightPanel>
  )
}
