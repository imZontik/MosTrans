import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import type { LeaderEntry } from '@/api/types'
import { useAsync } from '@/hooks/useAsync'
import { PageHeader } from '@/components/Card'
import { Avatar } from '@/components/Avatar'
import { NightPanel } from '@/components/NightPanel'
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

  return (
    <div>
      <PageHeader
        title="Рейтинг"
        subtitle={board.data ? `Очки компетенций, ${pluralN(board.data.participants, PEOPLE)}` : 'Очки компетенций'}
      />

      {me && (
        <NightPanel className="-mx-2 mb-5 px-5 py-5 sm:mx-0" aria-label="Ваше место">
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
        </NightPanel>
      )}

      <div className="mb-5 inline-flex rounded-xl border border-line bg-surface p-1" role="tablist" aria-label="Период">
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
              'min-h-[40px] rounded-lg px-4 font-medium transition-colors',
              period === p ? 'bg-ink text-white' : 'text-muted hover:text-ink',
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
        <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {entries.map((e) => (
            <Row key={e.id} e={e} onOpen={open} />
          ))}
        </ol>
      )}

      {me && !meVisible && (
        <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] z-10 mt-3 lg:bottom-6">
          <ol className="overflow-hidden rounded-2xl border border-ink bg-surface shadow-dock">
            <Row e={me} onOpen={open} />
          </ol>
        </div>
      )}
    </div>
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
          e.is_me ? 'border-l-[3px] border-l-brand bg-brand-soft/70 pl-2.5 hover:bg-brand-soft' : 'pl-3 hover:bg-bg/60',
        )}
      >
        <span
          className={cn(
            'digits grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl font-bold',
            medal ?? 'text-ink/70',
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
