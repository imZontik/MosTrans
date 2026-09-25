import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/api/client'
import { useAuth } from '@/auth/AuthContext'
import { useAsync } from '@/hooks/useAsync'
import { useStartRun } from '@/hooks/useStartRun'
import { Button, ButtonLink } from '@/components/Button'
import { SectionTitle } from '@/components/Card'
import { AchievementBadge } from '@/components/AchievementBadge'
import { CategoryTag, CoverTile } from '@/components/Category'
import { NightPanel, SpeedLines } from '@/components/NightPanel'
import { MascotTip } from '@/components/Mascot'
import { Progress } from '@/components/Progress'
import { RouteTrack } from '@/components/RouteTrack'
import { SignalBar } from '@/components/SignalBar'
import { TournamentBanner } from '@/components/TournamentBanner'
import { firstName } from '@/lib/format'
import { routeSentence, stationFor } from '@/lib/route'
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

  return (
    <div className="space-y-8">
      <div>
        <p className="mb-3 text-muted">
          {greeting()}, {firstName(user.full_name)}
        </p>

        {/* «Маршрут» on the night line — the one bold element */}
        <NightPanel aria-labelledby="route-station" stripe className="-mx-2 px-5 pb-6 pt-6 sm:mx-0">
          <SpeedLines rows={[14, 30, 58]} />
          <RouteTrack level={li.level} progress={li.progress} animate dark className="relative" />
          <h1 id="route-station" className="relative mt-7 text-[44px] font-bold leading-[.95] tracking-[-0.01em] sm:text-[56px]">
            {stationFor(li.level).name}
          </h1>
          <p className="relative mt-3 text-base text-white">{routeSentence(li)}</p>
          <p className="relative mt-0.5 text-white/70">{li.title}</p>
        </NightPanel>
      </div>

      {/* next run, picked by the AI mentor */}
      <section>
        <SectionTitle>Следующий рейс</SectionTitle>
        {recommended.loading ? (
          <div className="skeleton h-40" />
        ) : rec ? (
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-start gap-3">
              <CoverTile cover={rec.scenario.cover} category={rec.scenario.category} size="lg" />
              <div className="min-w-0 flex-1">
                <h3 className="font-sans text-base font-semibold leading-snug">{rec.scenario.title}</h3>
                <CategoryTag className="mt-1.5" category={rec.scenario.category} title={rec.scenario.category_title} />
              </div>
              <span className="digits shrink-0 text-xl font-semibold leading-none">
                {rec.scenario.estimated_minutes}
                <span className="ml-0.5 text-base font-medium text-muted">мин</span>
              </span>
            </div>
            <p className="mt-4 border-t border-line pt-3 text-muted">{rec.reason}</p>
            {error && (
              <p className="mt-3 text-brand" role="alert">
                {error}
              </p>
            )}
            <Button
              className="mt-4"
              block
              size="lg"
              data-testid="start-recommended"
              loading={pending === rec.scenario.id}
              onClick={() => start(rec.scenario.id)}
            >
              Начать рейс
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="font-medium">Все рекомендованные рейсы пройдены.</p>
            <p className="mt-1 text-muted">Выберите сценарий в расписании или повторите сложный, чтобы поднять шкалы.</p>
            <ButtonLink to="/scenarios" variant="secondary" className="mt-3">
              Открыть расписание
            </ButtonLink>
          </div>
        )}
      </section>

      {tournament.data && <TournamentBanner data={tournament.data} />}

      <section>
        <SectionTitle>Средние шкалы</SectionTitle>
        <div className="flex gap-5">
          <SignalBar label="Пассажир" value={user.stats.avg_loyalty} />
          <SignalBar label="Безопасность" value={user.stats.avg_safety} />
        </div>
      </section>

      {q && (
        <section>
          <SectionTitle
            action={
              <span className="digits text-lg font-semibold">
                {q.passed}
                <span className="text-muted"> из {q.total}</span>
              </span>
            }
          >
            Повышение до «{q.next_position_title}»
          </SectionTitle>
          <Progress value={q.total ? q.passed / q.total : 0} />
          <p className="mt-2 text-muted">
            {q.ready
              ? 'Все сценарии пройдены. Руководитель может повысить вас в должности.'
              : 'Пройдите без провала все сценарии следующей должности. Они дают в 1,5 раза больше очков.'}
          </p>
        </section>
      )}

      <section>
        <SectionTitle
          action={
            <Link to="/profile" className="flex min-h-[44px] items-center text-sm font-medium text-ink underline decoration-line underline-offset-4">
              Все достижения
            </Link>
          }
        >
          Достижения
        </SectionTitle>
        {recentAchievements.length ? (
          <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {recentAchievements.map((a) => (
              <AchievementBadge key={a.code} achievement={a} />
            ))}
          </div>
        ) : (
          <p className="text-muted">Завершите первый рейс, чтобы получить достижение «Первый рейс».</p>
        )}
      </section>

      <MascotTip text={tipOfTheDay()} />
    </div>
  )
}
