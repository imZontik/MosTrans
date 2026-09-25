import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import type { LeaderEntry } from '@/api/types'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/Card'
import { Avatar } from '@/components/Avatar'
import { NightPanel, SpeedLines } from '@/components/NightPanel'
import { EmptyState, ErrorState, Loading } from '@/components/States'
import { cn } from '@/lib/cn'
import { fmtNumber } from '@/lib/format'
import { plural, pluralN, PEOPLE, POINTS } from '@/lib/plural'

type Period = 'week' | 'all'
// gold / silver / bronze tiles for the top three
const MEDAL_TILE = [
  'bg-gradient-to-br from-[#FFE9A8] to-[#E9BE45] text-[#5C4200] ring-1 ring-[#D4A017]/60',
  'bg-gradient-to-br from-[#F4F6F8] to-[#C3CAD3] text-[#39424E] ring-1 ring-[#A7B0BA]/70',
  'bg-gradient-to-br from-[#F6D9C0] to-[#C98A55] text-[#4E2C0F] ring-1 ring-[#B7743F]/60',
]

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<Period>('week')
  const board = useAsync(() => api.leaderboard(period), [period])
  const navigate = useNavigate()
  const open = (e: LeaderEntry) => navigate(e.is_me ? '/profile' : `/users/${e.id}`)

  const entries = board.data?.entries ?? []
  const me = board.data?.me
  const meVisible = entries.some((e) => e.is_me)

  const ahead = me?.rank && me.rank > 1 ? entries.find((e) => e.rank === me.rank! - 1) : null
  const podium = entries.filter((e) => e.rank && e.rank <= 3)

  return (
    <div>
      <PageHeader
        title="Рейтинг"
        subtitle={board.data ? `Очки компетенций, ${pluralN(board.data.participants, PEOPLE)}` : 'Очки компетенций'}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start xl:grid-cols-[minmax(0,1fr)_400px] xl:gap-8">
        <aside className="space-y-5 lg:sticky lg:top-8 lg:order-2">
          {me && (
            <NightPanel className="-mx-2 px-5 py-5 sm:mx-0 lg:px-6 lg:py-6" aria-label="Ваше место">
              <SpeedLines rows={[30, 72]} />
              <div className="relative flex items-center gap-4">
                <Avatar name={me.full_name} size="md" onDark />
                <div className="min-w-0 flex-1">
                  <p className="text-white/70">{period === 'week' ? 'Ваше место на этой неделе' : 'Ваше место за всё время'}</p>
                  <p className="digits text-[44px] font-bold leading-none">{me.rank ?? '—'}</p>
                </div>
                <p className="text-right text-white/70">
                  <span className="digits block text-2xl font-semibold leading-none text-white">{fmtNumber(me.value)}</span>
                  {plural(me.value, POINTS)}
                </p>
              </div>
              {ahead && (
                <p className="relative mt-4 border-t border-white/15 pt-3 text-sm text-white/70">
                  До {ahead.rank}-го места{' '}
                  <span className="digits text-base font-semibold text-white">{fmtNumber(Math.max(1, ahead.value - me.value + 1))}</span>{' '}
                  {plural(Math.max(1, ahead.value - me.value + 1), POINTS)}
                </p>
              )}
            </NightPanel>
          )}
          {podium.length >= 3 && <Podium entries={podium} onOpen={open} />}
        </aside>

        <div className="min-w-0 lg:order-1">
          <div className="mb-5 inline-flex rounded-xl bg-ink/[.05] p-1 ring-1 ring-inset ring-line/70" role="tablist" aria-label="Период">
            {(
              [
                ['week', 'Эта неделя'],
                ['all', 'Всё время'],
              ] as const
            ).map(([p, label]) => (
              <button
                key={p}
                role="tab"
                aria-selected={period === p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'min-h-[40px] rounded-lg px-4 font-medium transition-[color,background-color,box-shadow]',
                  period === p ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {board.loading && !board.data ? (
            <Loading rows={5} />
          ) : board.error ? (
            <ErrorState message={board.error} onRetry={board.reload} />
          ) : entries.length === 0 ? (
            <EmptyState
              title="На этой неделе очков ещё нет"
              text="Пройдите любой рейс из расписания, и вы откроете рейтинг недели."
            />
          ) : (
            <ol className="card divide-y divide-line/70 overflow-hidden">
              {entries.map((e) => (
                <Row key={e.id} e={e} onOpen={open} />
              ))}
            </ol>
          )}

          {me && !meVisible && (
            <div className="sticky bottom-[calc(80px+env(safe-area-inset-bottom))] z-10 mt-3 lg:bottom-6">
              <ol className="glass overflow-hidden rounded-2xl border border-brand/40 shadow-lift">
                <Row e={me} onOpen={open} />
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Top three on pedestals: silver, gold, bronze. */
function Podium({ entries, onOpen }: { entries: LeaderEntry[]; onOpen: (e: LeaderEntry) => void }) {
  const byRank = (r: number) => entries.find((e) => e.rank === r)
  const order = [byRank(2), byRank(1), byRank(3)]
  const height = ['h-16', 'h-24', 'h-12']
  return (
    <section className="card hidden px-4 pb-0 pt-5 lg:block" aria-labelledby="podium-title">
      <h2 id="podium-title" className="px-1 text-lg font-semibold">
        Тройка лидеров
      </h2>
      <ol className="mt-4 grid grid-cols-3 items-end gap-2">
        {order.map((e, i) =>
          e ? (
            <li key={e.id} className="flex min-w-0 flex-col items-center text-center">
              <button onClick={() => onOpen(e)} className="press group flex min-w-0 flex-col items-center rounded-xl px-1 pb-2">
                <Avatar name={e.full_name} size={i === 1 ? 'lg' : 'md'} className={cn(e.is_me && 'ring-2 ring-brand ring-offset-2 ring-offset-surface')} />
                <span className="mt-2 line-clamp-2 text-xs font-medium leading-tight group-hover:underline">{e.full_name}</span>
                <span className="digits mt-0.5 text-base font-semibold">{fmtNumber(e.value)}</span>
              </button>
              <span
                className={cn('digits grid w-full place-items-center rounded-t-xl text-2xl font-bold', height[i], MEDAL_TILE[e.rank! - 1])}
                aria-label={`${e.rank}-е место`}
              >
                {e.rank}
              </span>
            </li>
          ) : (
            <li key={i} />
          ),
        )}
      </ol>
    </section>
  )
}

function Row({ e, onOpen }: { e: LeaderEntry; onOpen: (e: LeaderEntry) => void }) {
  const medal = e.rank && e.rank <= 3 ? MEDAL_TILE[e.rank - 1] : null
  return (
    <li>
      <button
        onClick={() => onOpen(e)}
        className={cn(
          'flex min-h-[64px] w-full items-center gap-3 py-2.5 pr-4 text-left transition-colors',
          e.is_me ? 'border-l-[3px] border-l-brand bg-brand-soft/70 pl-2.5 hover:bg-brand-soft' : 'pl-3 hover:bg-surface-2',
        )}
      >
        <span
          className={cn(
            'digits grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl font-bold',
            medal ? cn(medal, 'shadow-[0_4px_10px_-4px_rgb(0_0_0/.35)]') : 'text-ink/70',
          )}
          aria-label={`${e.rank ?? '—'}-е место`}
        >
          {e.rank ?? '—'}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate', e.is_me ? 'font-semibold' : 'font-medium')}>
            {e.full_name}
            {e.is_me && <span className="font-normal text-muted">, вы</span>}
          </span>
          <span className="block truncate text-xs text-muted">
            {e.position_title}, уровень {e.level}
          </span>
        </span>
        <span className="digits shrink-0 text-xl font-semibold">{fmtNumber(e.value)}</span>
      </button>
    </li>
  )
}
