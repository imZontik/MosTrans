import { useMemo, useState, type ReactNode } from 'react'
import type { Outcome, RunHistoryItem } from '@/api/types'
import { api } from '@/api/client'
import { useAuth } from '@/auth/AuthContext'
import { useAsync } from '@/hooks/useAsync'
import { BackLink } from '@/components/BackLink'
import { PageHeader } from '@/components/Card'
import { CountUp } from '@/components/CountUp'
import { RunHistory } from '@/components/RunHistory'
import { ScoreRing } from '@/components/ScoreRing'
import { Counted, Segmented } from '@/components/Segmented'
import { EmptyState, ErrorState, Loading } from '@/components/States'
import { scaleTone } from '@/lib/format'
import { plural, pluralN } from '@/lib/plural'

type Filter = 'all' | Outcome
const TRIPS: [string, string, string] = ['рейс', 'рейса', 'рейсов']
const RING_TONE = { ok: 'ok', warn: 'warn', bad: 'bad' } as const

/** «Сентябрь 2026» */
const monthOf = (iso: string | null) => {
  if (!iso) return 'Без даты'
  const s = new Date(iso).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Every finished run, moved out of the profile: how you do on average, a filter by outcome, and
 * the runs by month. A run opens its debrief.
 */
export default function RunHistoryPage() {
  const { user } = useAuth()
  const runs = useAsync(() => api.myRuns(), [])
  const [filter, setFilter] = useState<Filter>('all')

  const items = runs.data ?? []
  const count = (o: Outcome) => items.filter((r) => r.outcome === o).length
  const months = useMemo(() => {
    const shown = filter === 'all' ? items : items.filter((r) => r.outcome === filter)
    const groups: { title: string; items: RunHistoryItem[] }[] = []
    for (const r of shown) {
      const title = monthOf(r.finished_at)
      const last = groups[groups.length - 1]
      if (last?.title === title) last.items.push(r)
      else groups.push({ title, items: [r] })
    }
    return groups
  }, [items, filter])

  return (
    <div>
      <BackLink to="/profile">Профиль</BackLink>
      <PageHeader title="История рейсов" subtitle={runs.data ? `${pluralN(items.length, TRIPS)} · нажмите на рейс, чтобы открыть разбор` : undefined} />

      {runs.loading && !runs.data ? (
        <Loading rows={4} />
      ) : runs.error ? (
        <ErrorState message={runs.error} onRetry={runs.reload} />
      ) : !items.length ? (
        <EmptyState title="Рейсов пока нет" text="Пройдите любой сценарий из расписания, и он появится здесь с разбором." />
      ) : (
        <>
          {user && (
            <section className="card mb-6 grid grid-cols-2 gap-4 p-5 sm:p-6 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]" aria-label="Итоги">
              <Figure label="Рейсов">
                <CountUp value={user.stats.runs_finished} />
              </Figure>
              <Figure label="Успешных">{Math.round(user.stats.success_rate * 100)}%</Figure>
              <Figure label="Экстренных ситуаций">
                <CountUp value={user.stats.emergencies_handled} />
              </Figure>
              <div className="col-span-2 grid grid-cols-2 gap-4 border-t border-line/70 pt-4 sm:flex sm:gap-6 lg:col-span-1 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <Average label="Пассажир" value={user.stats.avg_loyalty} />
                <Average label="Безопасность" value={user.stats.avg_safety} />
              </div>
            </section>
          )}

          <div className="mb-5">
            <Segmented
              label="Исход"
              value={filter}
              onChange={setFilter}
              options={[
                ['all', <Counted key="all" text="Все" n={items.length} />],
                ['success', <Counted key="success" text="Успех" n={count('success')} />],
                ['partial', <Counted key="partial" text="Частично" n={count('partial')} />],
                ['fail', <Counted key="fail" text="Провал" n={count('fail')} />],
              ]}
            />
          </div>

          {months.length ? (
            <div className="space-y-6">
              {months.map((m) => (
                <section key={m.title} aria-label={m.title}>
                  <h2 className="mb-2 flex items-baseline justify-between px-1 text-sm font-semibold text-muted">
                    {m.title}
                    <span className="font-normal">
                      {m.items.length} {plural(m.items.length, TRIPS)}
                    </span>
                  </h2>
                  <div className="card row-in px-4 py-1 sm:px-5">
                    <RunHistory items={m.items} linked />
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <p className="text-muted">Таких рейсов нет.</p>
          )}
        </>
      )}
    </div>
  )
}

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-muted">{label}</p>
      <p className="digits mt-1 text-[32px] font-bold leading-none">{children}</p>
    </div>
  )
}

/** An average scale over finished runs as a ring in its signal colour. */
function Average({ label, value }: { label: string; value: number | null }) {
  const tone = value === null ? null : scaleTone(value)
  return (
    // narrow phones: the label goes under the ring
    <div className="flex min-w-0 flex-col items-center gap-2 text-center min-[400px]:flex-row min-[400px]:gap-3 min-[400px]:text-left">
      <ScoreRing value={(value ?? 0) / 100} tone={tone ? RING_TONE[tone] : 'brand'} size={60} stroke={6} label={`${label}: ${value ?? 'нет данных'}`}>
        <span className="digits text-lg font-semibold leading-none">{value ?? '—'}</span>
      </ScoreRing>
      <p className="text-sm leading-tight text-muted">
        {label}
        <span className="block text-xs">в среднем</span>
      </p>
    </div>
  )
}
