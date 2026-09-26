import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, TriangleAlert } from 'lucide-react'
import { api } from '@/api/client'
import type { LeaderboardScope, LeaderEntry } from '@/api/types'
import { useAuth } from '@/auth/AuthContext'
import { useAsync } from '@/hooks/useAsync'
import { useFlip } from '@/hooks/useFlip'
import { usePresence } from '@/hooks/usePresence'
import { Avatar } from '@/components/Avatar'
import { ButtonLink } from '@/components/Button'
import { PageHeader } from '@/components/Card'
import { CountUp } from '@/components/CountUp'
import { NightPanel } from '@/components/NightPanel'
import { Podium } from '@/components/Podium'
import { EmptyState, ErrorState, Loading } from '@/components/States'
import { cn } from '@/lib/cn'
import { fmtNumber } from '@/lib/format'
import { plural, pluralN, PEOPLE, POINTS, points } from '@/lib/plural'

type Period = 'week' | 'all'
const PERIOD_TEXT: Record<Period, string> = { week: 'эта неделя', all: 'всё время' }
// the list opens with this many places after the podium; the rest behind «Показать всех»
const FOLD = 20

// «Бригада 3, Москва — Санкт-Петербург» → «Бригада 3», «Москва — Санкт-Петербург», «бр. 3»
const teamName = (team: string) => team.split(',')[0].trim()
const teamRoute = (team: string) => team.split(',').slice(1).join(',').trim()
const shortTeam = (team: string) => teamName(team).replace(/^Бригада\s*/i, 'бр. ')

export default function LeaderboardPage() {
  const { user } = useAuth()
  const [period, setPeriod] = useState<Period>('week')
  const [scope, setScope] = useState<LeaderboardScope>('company')
  // '' — the user's own depot/brigade (or the first one for leads, who have none)
  const [picked, setPicked] = useState('')
  const [unfolded, setUnfolded] = useState(false)
  const units = useAsync(() => api.leaderboardUnits(), [])

  const options = scope === 'depot' ? units.data?.depots ?? [] : scope === 'team' ? units.data?.teams ?? [] : []
  const own = scope === 'depot' ? user?.depot : scope === 'team' ? user?.team : ''
  const unit = scope === 'company' ? '' : picked || own || options[0]?.name || ''

  const board = useAsync(() => api.leaderboard(period, scope, unit || undefined), [period, scope, unit])
  const navigate = useNavigate()
  const open = (e: LeaderEntry) => navigate(e.is_me ? '/profile' : `/users/${e.id}`)

  const entries = board.data?.entries ?? []
  const me = board.data?.me ?? null
  const rest = entries.slice(3)
  const shown = unfolded ? rest : rest.slice(0, FOLD)
  const meShown = entries.slice(0, 3).some((e) => e.is_me) || shown.some((e) => e.is_me)
  const leader = entries[0]?.value ?? 0
  const showTeam = scope !== 'team'
  // what this board is: «Компания · эта неделя», «Бригада 3 · всё время»
  const where = scope === 'company' ? 'Компания' : scope === 'team' ? teamName(board.data?.unit ?? unit) : board.data?.unit ?? unit
  const caption = `${where} · ${PERIOD_TEXT[period]}`

  // «Ваше место» leaves when you are not on this board (another depot or brigade) and comes back
  // with you; while it leaves it keeps showing the board it was about
  const card = me && board.data ? { me, entries, participants: board.data.participants, caption } : null
  const lastCard = useRef(card)
  if (card) lastCard.current = card
  const place = usePresence(!!card, { enterMs: 850, exitMs: 700 })

  const changeScope = (s: LeaderboardScope) => {
    setScope(s)
    setPicked('')
  }

  return (
    <div>
      <PageHeader
        title="Рейтинг"
        subtitle={board.data ? `Очки компетенций · ${pluralN(board.data.participants, PEOPLE)}` : 'Очки компетенций'}
      />

      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <Segmented
          label="Период"
          value={period}
          onChange={setPeriod}
          options={[
            ['week', 'Эта неделя'],
            ['all', 'Всё время'],
          ]}
        />
        <Segmented
          label="Масштаб"
          value={scope}
          onChange={changeScope}
          options={[
            ['company', 'Компания'],
            ['depot', 'Депо'],
            ['team', 'Бригада'],
          ]}
        />
        {scope !== 'company' && options.length > 0 && (
          <label className="relative block sm:w-auto">
            <span className="sr-only">{scope === 'depot' ? 'Депо' : 'Бригада'}</span>
            <select
              className="input h-12 w-full appearance-none bg-surface py-2 pr-10 font-medium sm:min-w-[300px] sm:text-base"
              value={unit}
              onChange={(e) => setPicked(e.target.value)}
            >
              {options.map((o) => (
                <option key={o.name} value={o.name}>
                  {o.name}
                  {o.name === own ? ' (моё)' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
          </label>
        )}
      </div>

      {board.loading && !board.data ? (
        <Loading rows={5} />
      ) : board.error ? (
        <ErrorState message={board.error} onRetry={board.reload} />
      ) : scope !== 'company' && !unit ? (
        <EmptyState
          title={scope === 'depot' ? 'Депо пока не заданы' : 'Бригады пока не заданы'}
          text="Руководитель может указать депо и бригаду в карточке сотрудника."
        />
      ) : entries.length === 0 ? (
        <EmptyState
          title={period === 'week' ? 'На этой неделе очков ещё нет' : 'Очков пока нет'}
          text="Пройдите любой рейс из расписания, и вы откроете рейтинг."
        />
      ) : (
        // while another board loads, the current one dims instead of blinking away
        <div className={cn('space-y-6 transition-opacity duration-200', board.loading && 'opacity-60')}>
          {/* phones: your place above the stage, the row folds away; xl: beside it, the stage widens into its column */}
          <div className="place-row" data-me={place.on ? 'on' : 'off'}>
            <Stage entries={entries.slice(0, 3)} caption={caption} className="row-start-2 xl:col-start-1 xl:row-start-1" />
            {place.mounted && lastCard.current && (
              <div className={cn('row-start-1 min-h-0 min-w-0 xl:col-start-2', !place.settled && 'overflow-hidden')}>
                <MyPlace {...lastCard.current} className="place-card h-full" />
              </div>
            )}
          </div>

          {rest.length > 0 && (
            <Board
              rows={shown}
              leader={leader}
              showTeam={showTeam}
              scope={scope}
              onOpen={open}
              more={rest.length > FOLD ? { open: unfolded, total: entries.length, toggle: () => setUnfolded((v) => !v) } : null}
            />
          )}

          {/* you are below the fold or beyond the first hundred: your row floats at the bottom */}
          {me && me.rank && !meShown && (
            <div className="sticky bottom-[calc(66px+env(safe-area-inset-bottom))] z-10 lg:bottom-4">
              <ol className="card overflow-hidden shadow-lift ring-1 ring-brand/30">
                <Row e={me} leader={leader} showTeam={showTeam} scope={scope} onOpen={open} />
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --- the stage -------------------------------------------------------------------

/** Top three on a night stage under two swaying lights. */
function Stage({ entries, caption, className }: { entries: LeaderEntry[]; caption: string; className?: string }) {
  return (
    <NightPanel className={cn('flex flex-col px-5 pb-6 pt-5 sm:px-7 sm:pt-6', className)} aria-labelledby="stage-title">
      <span className="stage-light left-0" aria-hidden />
      <span className="stage-light right-0 [animation-delay:-4s] [animation-direction:alternate-reverse]" aria-hidden />
      {/* warm light pooling on the winner's step */}
      <span
        className="pointer-events-none absolute bottom-0 left-1/2 h-48 w-80 -translate-x-1/2 translate-y-1/3 rounded-full bg-[radial-gradient(closest-side,rgb(242_201_76/.22),transparent)]"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 id="stage-title" className="text-lg font-semibold">
          Тройка лидеров
        </h2>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/75 ring-1 ring-inset ring-white/15">{caption}</span>
      </div>
      <Podium
        variant="stage"
        entries={entries.map((e) => ({ id: e.id, full_name: e.full_name, score: e.value, is_me: e.is_me }))}
        className="relative mx-auto mt-auto w-full max-w-[640px] pt-6 sm:pt-8"
      />
    </NightPanel>
  )
}

// --- your place ------------------------------------------------------------------

/**
 * Your rank climbs to its place, and a meter shows where you stand between the one behind
 * and the one ahead (Strava-style gaps).
 */
function MyPlace({
  me,
  entries,
  participants,
  caption,
  className,
}: {
  me: LeaderEntry
  entries: LeaderEntry[]
  participants: number
  caption: string
  className?: string
}) {
  if (!me.rank) {
    return (
      <section className={cn('card flex flex-col p-5 sm:p-6', className)} aria-labelledby="my-place">
        <h2 id="my-place" className="text-lg font-semibold">
          Ваше место
        </h2>
        <p className="text-sm text-muted">{caption}</p>
        <p className="mt-4 font-medium">Вас пока нет в этой таблице.</p>
        <p className="mt-1 text-muted">Очки появятся после первого рейса, и вы сразу увидите своё место.</p>
        <ButtonLink to="/scenarios" className="mt-auto self-start">
          К расписанию
        </ButtonLink>
      </section>
    )
  }

  const rank = me.rank
  const above = entries.find((e) => e.rank === rank - 1)
  const below = entries.find((e) => e.rank === rank + 1)
  const toOvertake = above ? Math.max(1, above.value - me.value + 1) : 0
  const cushion = below ? me.value - below.value : null
  const top = participants >= 5 ? Math.max(1, Math.ceil((rank / participants) * 100)) : null
  // the meter runs from the one behind (or zero) to the one ahead (or you, when you lead)
  const lo = below?.value ?? 0
  const hi = above?.value ?? me.value
  const share = hi > lo ? Math.min(1, Math.max(0, (me.value - lo) / (hi - lo))) : 1

  return (
    <section className={cn('card relative isolate flex flex-col overflow-hidden p-5 sm:p-6', className)} aria-labelledby="my-place">
      <div
        className="pointer-events-none absolute -right-20 -top-24 -z-10 h-64 w-64 rounded-full bg-[radial-gradient(closest-side,rgb(var(--brand)/.14),transparent)]"
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="my-place" className="text-lg font-semibold">
            Ваше место
          </h2>
          <p className="text-sm text-muted">{caption}</p>
        </div>
        {top !== null && top <= 50 && (
          <span className="shrink-0 rounded-full bg-ok-soft px-2.5 py-1 text-xs font-semibold text-ok ring-1 ring-inset ring-ok/20">топ {top}%</span>
        )}
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <p className="flex items-baseline gap-2 leading-none">
          <CountUp value={rank} initial={participants} className="digits text-[64px] font-bold leading-[.8] tracking-tight" />
          <span className="text-muted">из {participants}</span>
        </p>
        <p className="text-right leading-tight">
          <CountUp value={me.value} className="digits block text-2xl font-semibold" />
          <span className="text-sm text-muted">{plural(me.value, POINTS)}</span>
        </p>
      </div>

      {/* beside the stage there is room for your neighbours; on narrower screens the list right below shows them */}
      {(above || below) && (
        <ol className="mt-5 hidden space-y-1 xl:block" aria-label="Соседи по рейтингу">
          {[above, me, below].map(
            (e) =>
              e && (
                <li
                  key={e.id}
                  className={cn(
                    'flex min-h-[40px] items-center gap-3 rounded-xl px-3',
                    e.is_me ? 'bg-brand-soft ring-1 ring-inset ring-brand/25' : 'bg-ink/[.03]',
                  )}
                >
                  <span className={cn('digits w-6 shrink-0 text-center text-lg font-semibold', e.is_me ? 'text-brand' : 'text-muted')}>{e.rank}</span>
                  <span className={cn('min-w-0 flex-1 truncate text-sm', e.is_me ? 'font-semibold' : 'font-medium')}>{e.is_me ? 'Вы' : e.full_name}</span>
                  {!e.is_me && (
                    <span className="shrink-0 text-xs text-muted">
                      {e.value >= me.value ? '+' : '−'}
                      {fmtNumber(Math.abs(e.value - me.value))}
                    </span>
                  )}
                  <span className="digits w-12 shrink-0 text-right text-lg font-semibold">{fmtNumber(e.value)}</span>
                </li>
              ),
          )}
        </ol>
      )}

      <div className="mt-auto pt-6">
        <p className="font-medium">
          {above ? (
            <>
              До {above.rank}-го места <span className="digits text-lg font-semibold text-brand">{points(toOvertake)}</span>
            </>
          ) : cushion !== null ? (
            <>
              Вы лидер, отрыв <span className="digits text-lg font-semibold text-ok">{points(cushion)}</span>
            </>
          ) : (
            'Вы лидер'
          )}
        </p>
        <div className="relative mt-3 h-2 rounded-full track" aria-hidden>
          <div className="bar-brand bar-grow absolute inset-y-0 left-0 rounded-full transition-[width] duration-700" style={{ width: `${share * 100}%` }} />
          <span
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface shadow-card ring-[3px] ring-brand transition-[left] duration-700"
            style={{ left: `${share * 100}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between gap-3 text-xs text-muted">
          <span className="truncate">{below ? `${below.rank}-е · ${fmtNumber(below.value)}` : '0'}</span>
          <span className="truncate text-right">{above ? `${above.rank}-е · ${fmtNumber(above.value)}` : 'вы'}</span>
        </div>
        {above && cushion !== null && cushion <= 10 && (
          <p className="mt-3 flex items-center gap-2 text-sm text-warn-ink">
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
            {below!.rank}-е место отстаёт всего на {points(cushion)}
          </p>
        )}
      </div>
    </section>
  )
}

// --- the table -------------------------------------------------------------------

// the same columns for the header and every row, so everything lines up
const COLS = {
  team: 'grid-cols-[36px_minmax(0,1fr)_auto] md:grid-cols-[52px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(150px,.9fr)]',
  plain: 'grid-cols-[36px_minmax(0,1fr)_auto] md:grid-cols-[52px_minmax(0,1.6fr)_minmax(170px,1fr)]',
}

function Board({
  rows,
  leader,
  showTeam,
  scope,
  onOpen,
  more,
}: {
  rows: LeaderEntry[]
  leader: number
  showTeam: boolean
  scope: LeaderboardScope
  onOpen: (e: LeaderEntry) => void
  more: { open: boolean; total: number; toggle: () => void } | null
}) {
  // switching the period or the scope: the people who are on both boards slide to their new places
  const register = useFlip<number>(rows, (id) => !!rows.find((e) => e.id === id)?.is_me)
  return (
    <section className="card" aria-label="Места с четвёртого">
      <div
        className={cn(
          'hidden gap-x-3 border-b border-line/70 px-4 py-3 text-[11px] font-semibold uppercase tracking-[.08em] text-muted md:grid',
          showTeam ? COLS.team : COLS.plain,
        )}
        aria-hidden
      >
        <span className="text-center">Место</span>
        <span>Проводник</span>
        {showTeam && <span>{scope === 'company' ? 'Бригада и депо' : 'Бригада'}</span>}
        <span className="text-right">Очки</span>
      </div>
      <ol className="relative divide-y divide-line/60">
        {rows.map((e, i) => (
          <Row key={e.id} e={e} leader={leader} showTeam={showTeam} scope={scope} onOpen={onOpen} delay={i} liRef={register(e.id)} />
        ))}
      </ol>
      {more && (
        <button
          type="button"
          onClick={more.toggle}
          aria-expanded={more.open}
          className="flex min-h-[52px] w-full items-center justify-center gap-1.5 rounded-b-2xl border-t border-line/70 text-sm font-medium text-muted transition-colors hover:bg-ink/[.03] hover:text-ink"
        >
          {more.open ? 'Свернуть' : `Показать всех · ${more.total}`}
          <ChevronDown className={cn('h-4 w-4 transition-transform', more.open && 'rotate-180')} aria-hidden />
        </button>
      )}
    </section>
  )
}

function Row({
  e,
  leader,
  showTeam,
  scope,
  onOpen,
  delay = 0,
  liRef,
}: {
  e: LeaderEntry
  leader: number
  showTeam: boolean
  scope: LeaderboardScope
  onOpen: (e: LeaderEntry) => void
  /** position in the list: rows come in one after another (the first dozen or so) */
  delay?: number
  liRef?: (el: HTMLLIElement | null) => void
}) {
  const share = leader > 0 ? Math.min(1, e.value / leader) : 0
  return (
    <li
      ref={liRef}
      className={cn('row-in', e.is_me && 'sticky bottom-[calc(66px+env(safe-area-inset-bottom))] top-2 z-10 lg:bottom-4')}
      style={{ animationDelay: `${Math.min(delay, 14) * 35}ms` }}
    >
      <button
        onClick={() => onOpen(e)}
        className={cn(
          'grid min-h-[64px] w-full items-center gap-x-3 px-3 py-2.5 text-left transition-colors sm:px-4',
          showTeam ? COLS.team : COLS.plain,
          e.is_me ? 'bg-brand-soft shadow-lift ring-1 ring-inset ring-brand/30' : 'hover:bg-ink/[.03]',
        )}
      >
        <span className={cn('digits text-center text-xl font-semibold', e.is_me ? 'text-brand' : 'text-muted')} aria-label={`${e.rank ?? '—'}-е место`}>
          {e.rank ?? '—'}
        </span>
        <span className="flex min-w-0 items-center gap-3">
          <Avatar name={e.full_name} size="sm" className={cn('hidden min-[360px]:grid', e.is_me && 'ring-2 ring-brand/50')} />
          <span className="min-w-0">
            <span className={cn('block truncate', e.is_me ? 'font-semibold' : 'font-medium')}>
              {e.full_name}
              {e.is_me && <span className="font-normal text-muted">, вы</span>}
            </span>
            <span className="block truncate text-xs text-muted">
              {e.position_title}, <span className="md:hidden">ур.</span>
              <span className="hidden md:inline">уровень</span> {e.level}
              {showTeam && e.team && <span className="md:hidden"> · {shortTeam(e.team)}</span>}
            </span>
          </span>
        </span>
        {showTeam && (
          <span className="hidden min-w-0 md:block">
            <span className="block truncate text-sm">{e.team ? teamName(e.team) : '—'}</span>
            <span className="block truncate text-xs text-muted">{scope === 'company' ? e.depot : e.team ? teamRoute(e.team) : ''}</span>
          </span>
        )}
        <span className="flex items-center justify-end gap-3">
          {/* how far from the leader */}
          <span className="track hidden h-1.5 flex-1 overflow-hidden rounded-full md:block" aria-hidden>
            <span
              className={cn('bar-grow block h-full rounded-full transition-[width] duration-700', e.is_me ? 'bar-brand' : 'bg-ink/30')}
              style={{ width: `${share * 100}%`, animationDelay: `${Math.min(delay, 14) * 35 + 150}ms` }}
            />
          </span>
          <span className="digits min-w-[3ch] text-right text-xl font-semibold">{fmtNumber(e.value)}</span>
        </span>
      </button>
    </li>
  )
}

// --- controls --------------------------------------------------------------------

/** Tabs in a tray; the white pill slides to the picked one. Full width on phones. */
function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: [T, string][]
}) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null)
  const index = options.findIndex(([v]) => v === value)

  useLayoutEffect(() => {
    const measure = () => {
      const el = tabs.current[index]
      if (!el) return
      setPill((p) => (p && p.left === el.offsetLeft && p.width === el.offsetWidth ? p : { left: el.offsetLeft, width: el.offsetWidth }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    tabs.current.forEach((el) => el && ro.observe(el))
    return () => ro.disconnect()
  }, [index])

  return (
    <div className="relative flex w-full rounded-xl bg-ink/[.05] p-1 ring-1 ring-inset ring-line/70 sm:inline-flex sm:w-auto" role="tablist" aria-label={label}>
      {pill && (
        <span
          className="absolute inset-y-1 rounded-lg bg-surface shadow-card ring-1 ring-inset ring-line/60 transition-[left,width] duration-300 ease-[cubic-bezier(.3,.9,.3,1)] dark:bg-surface-2"
          style={pill}
          aria-hidden
        />
      )}
      {options.map(([v, text], i) => (
        <button
          key={v}
          ref={(el) => (tabs.current[i] = el)}
          role="tab"
          aria-selected={value === v}
          onClick={() => onChange(v)}
          className={cn(
            'relative min-h-[40px] flex-1 rounded-lg px-4 font-medium transition-colors coarse:min-h-[44px] sm:flex-none',
            value === v ? 'text-ink' : 'text-muted hover:text-ink',
          )}
        >
          {text}
        </button>
      ))}
    </div>
  )
}
