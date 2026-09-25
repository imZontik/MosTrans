import { useEffect, useMemo, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '@/api/client'
import type { AchievementCatalogItem, Me, PublicProfile } from '@/api/types'
import { useAuth } from '@/auth/AuthContext'
import { useAsync } from '@/hooks/useAsync'
import { AchievementTile } from '@/components/AchievementBadge'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { NightPanel } from '@/components/NightPanel'
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
    <div className="space-y-8">
      <NightPanel aria-labelledby="profile-name" className="-mx-2 px-5 pb-5 pt-6 sm:mx-0">
        <div className="relative flex items-center gap-4">
          <Avatar name={profile.full_name} size="lg" onDark />
          <div className="min-w-0">
            <h1 id="profile-name" className="text-[26px] font-bold leading-[1.05]">
              {profile.full_name}
            </h1>
            <p className="mt-1 text-white/70">
              {profile.position_title}
              {profile.team ? `, ${profile.team}` : ''}
            </p>
          </div>
        </div>
        <div className="relative mt-6 border-t border-white/15 pt-4" aria-label="Маршрут">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-display text-2xl font-bold leading-none">{stationFor(profile.level).name}</p>
            <p className="shrink-0 text-white/70">
              Уровень {profile.level} из {STATIONS.length}
            </p>
          </div>
          <RouteTrack level={profile.level} progress={levelInfo?.progress ?? 0} dark className="mt-2" />
          <p className="mt-1 text-white/70">{profile.level_title}</p>
        </div>
      </NightPanel>

      <section>
        <dl className="divide-y divide-line border-y border-line">
          <Stat label="Очки компетенций">{fmtNumber(profile.points)}</Stat>
          <Stat label="Место в рейтинге">{profile.rank ?? '—'}</Stat>
          <Stat label="Завершено рейсов">{profile.stats.runs_finished}</Stat>
          <Stat label="Успешных">{fmtPercent(profile.stats.success_rate)}</Stat>
          <Stat label="Экстренных ситуаций">{profile.stats.emergencies_handled}</Stat>
        </dl>
        <div className="mt-4 flex gap-5">
          <SignalBar label="Пассажир" value={profile.stats.avg_loyalty} />
          <SignalBar label="Безопасность" value={profile.stats.avg_safety} />
        </div>
        <p className="mt-2 text-xs text-muted">Средние шкалы по завершённым рейсам</p>
      </section>

      <section>
        <SectionTitle>Освоение направлений</SectionTitle>
        <CompetencyBars items={profile.competencies} />
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
        </section>
      )}

      <section>
        <SectionTitle action={<span className="text-muted">{unlocked} из {achievements.length}</span>}>Достижения</SectionTitle>
        {achievements.length ? (
          <ul className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4">
            {achievements.map((a) => (
              <AchievementTile key={a.code} achievement={a} locked={!a.unlocked} />
            ))}
          </ul>
        ) : (
          <p className="text-muted">Достижений пока нет.</p>
        )}
      </section>

      {isMe && (
        <section>
          <SectionTitle>История рейсов</SectionTitle>
          {runs.loading ? <Loading rows={2} /> : <RunHistory items={runs.data ?? []} />}
        </section>
      )}

      {isMe && (
        <div className="lg:hidden">
          <Button variant="secondary" block onClick={logout}>
            Выйти из аккаунта
          </Button>
        </div>
      )}
    </div>
  )
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className="digits text-lg font-semibold">{children}</dd>
    </div>
  )
}
