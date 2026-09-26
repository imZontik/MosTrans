import { useEffect, useMemo, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { Award, BarChart3, Compass, GraduationCap, History } from 'lucide-react'
import { api } from '@/api/client'
import type { AchievementCatalogItem, Me, PublicProfile } from '@/api/types'
import { useAuth } from '@/auth/AuthContext'
import { useAsync } from '@/hooks/useAsync'
import { AchievementTile } from '@/components/AchievementBadge'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { NightPanel, SpeedLines } from '@/components/NightPanel'
import { ThemeSwitch } from '@/components/ThemeToggle'
import { SectionTitle } from '@/components/Card'
import { CompetencyBars } from '@/components/Competencies'
import { Progress } from '@/components/Progress'
import { RouteTrack } from '@/components/RouteTrack'
import { RunHistory } from '@/components/RunHistory'
import { SignalBar } from '@/components/SignalBar'
import { ErrorState, Loading } from '@/components/States'
import { fmtNumber, fmtPercent } from '@/lib/format'
import { STATIONS, stationFor } from '@/lib/route'

const RARITY_ORDER: Record<string, number> = { legendary: 0, epic: 1, rare: 2, common: 3 }

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
    if (isMe && catalog.data) {
      return [...catalog.data].sort(
        (a, b) => Number(b.unlocked) - Number(a.unlocked) || (RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9),
      )
    }
    return (profile?.achievements ?? []).map((a) => ({ ...a, unlocked: true }))
  }, [isMe, catalog.data, profile])

  if (!isMe && other.error) return <ErrorState message={other.error} onRetry={other.reload} />
  if (!profile) return <Loading rows={3} />

  const levelInfo = (profile as Partial<Me>).level_info ?? null
  const unlocked = achievements.filter((a) => a.unlocked).length
  const q = profile.qualification

  return (
    <div className="space-y-6 lg:space-y-7">
      <NightPanel aria-labelledby="profile-name" className="-mx-2 px-5 pb-5 pt-6 sm:mx-0 sm:px-7 lg:px-8 lg:py-8">
        <SpeedLines rows={[20, 64]} />
        <div className="relative">
          <div className="flex items-center gap-4">
            <Avatar name={profile.full_name} size="lg" onDark className="lg:h-20 lg:w-20 lg:text-2xl" />
            <div className="min-w-0">
              <h1 id="profile-name" className="text-[26px] font-bold leading-[1.05] lg:text-[34px]">
                {profile.full_name}
              </h1>
              <p className="mt-1 text-white/70">
                {profile.position_title}
                {profile.team ? `, ${profile.team}` : ''}
                {profile.depot ? `, ${profile.depot}` : ''}
              </p>
              <p className="mt-2 hidden gap-4 text-white/70 sm:flex">
                <span>
                  <span className="digits text-lg font-semibold text-white">{fmtNumber(profile.points)}</span> очков
                </span>
                {profile.rank && (
                  <span>
                    <span className="digits text-lg font-semibold text-white">{profile.rank}</span>-е место
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="mt-6 border-t border-white/15 pt-4 lg:mt-7 lg:pt-5" aria-label="Маршрут">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display text-2xl font-bold leading-none lg:text-[30px]">{stationFor(profile.level).name}</p>
              <p className="shrink-0 text-white/70">
                Уровень {profile.level} из {STATIONS.length}
              </p>
            </div>
            <RouteTrack level={profile.level} progress={levelInfo?.progress ?? 0} allNames className="mt-2" />
            <p className="mt-1 text-white/70">{profile.level_title}</p>
          </div>
        </div>
      </NightPanel>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start xl:gap-7">
        <div className="min-w-0 space-y-6">
          <section className="card p-5">
            <SectionTitle icon={BarChart3} tint="bg-cat-safety-soft" tone="text-cat-safety">
              Статистика
            </SectionTitle>
            <dl className="divide-y divide-line/70">
              <Stat label="Очки компетенций">{fmtNumber(profile.points)}</Stat>
              <Stat label="Место в рейтинге">{profile.rank ?? '—'}</Stat>
              <Stat label="Завершено рейсов">{profile.stats.runs_finished}</Stat>
              <Stat label="Успешных">{fmtPercent(profile.stats.success_rate)}</Stat>
              <Stat label="Экстренных ситуаций">{profile.stats.emergencies_handled}</Stat>
            </dl>
            <div className="mt-4 flex gap-5 border-t border-line/70 pt-4">
              <SignalBar label="Пассажир" value={profile.stats.avg_loyalty} />
              <SignalBar label="Безопасность" value={profile.stats.avg_safety} />
            </div>
            <p className="mt-2 text-xs text-muted">Средние шкалы по завершённым рейсам</p>
          </section>

          <section className="card p-5">
            <SectionTitle icon={Compass} tint="bg-cat-medical-soft" tone="text-cat-medical">
              Освоение направлений
            </SectionTitle>
            <CompetencyBars items={profile.competencies} />
          </section>

          {q && (
            <section className="card p-5">
              <SectionTitle
                icon={GraduationCap}
                tint="bg-cat-service-soft"
                tone="text-cat-service"
                action={
                  <span className="digits text-lg font-semibold">
                    {q.passed}
                    <span className="text-muted"> из {q.total}</span>
                  </span>
                }
              >
                Повышение до «{q.next_position_title}»
              </SectionTitle>
              <Progress value={q.total ? q.passed / q.total : 0} height="h-2" />
            </section>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <section className="card p-5">
            <SectionTitle
              icon={Award}
              tint="bg-rarity-legendary-soft"
              tone="text-rarity-legendary-ink"
              action={<span className="text-muted">{unlocked} из {achievements.length}</span>}
            >
              Достижения
            </SectionTitle>
            {achievements.length ? (
              <ul className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
                {achievements.map((a) => (
                  <AchievementTile key={a.code} achievement={a} locked={!a.unlocked} />
                ))}
              </ul>
            ) : (
              <p className="text-muted">Достижений пока нет.</p>
            )}
          </section>

          {isMe && (
            <section className="card p-5">
              <SectionTitle icon={History} tint="bg-ink/[.06]" tone="text-ink">
                История рейсов
              </SectionTitle>
              {runs.loading ? <Loading rows={2} /> : <RunHistory items={runs.data ?? []} />}
            </section>
          )}

          {isMe && (
            <section className="card space-y-4 p-5 lg:hidden">
              <div>
                <h2 className="text-lg font-semibold">Оформление</h2>
                <p className="mt-0.5 text-muted">«Системная» повторяет настройку телефона</p>
              </div>
              <ThemeSwitch labels />
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

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0">
      <dt className="text-muted">{label}</dt>
      <dd className="digits text-lg font-semibold">{children}</dd>
    </div>
  )
}
