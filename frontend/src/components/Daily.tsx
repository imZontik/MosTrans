import { Link } from 'react-router-dom'
import { ArrowRight, Check, ChevronRight, Clock3, Flame, Lock, RotateCcw, Target } from 'lucide-react'
import type { RunView } from '@/api/types'
import { useStartRun } from '@/hooks/useStartRun'
import { cn } from '@/lib/cn'
import { categoryStyle } from '@/lib/category'
import { nextToken, tokenEarned, TOKENS, untilTomorrow, type Journal, type Token } from '@/lib/daily'
import { plural } from '@/lib/plural'
import { Button } from './Button'
import { CoverTile } from './Category'
import { Loading, Sk, SkText } from './Skeleton'

export const DAYS: [string, string, string] = ['день', 'дня', 'дней']
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const weekday = (d: Date) => d.toLocaleDateString('ru-RU', { weekday: 'long' })
const month = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }).replace(/^\d+\s/, '')

/**
 * The day's task as a railway ticket: a red stub with the date and the series, then the goal, the
 * direction with a suggested run, and the button. When it's done the conductor's stamp lands on it.
 */
export function DailyTicket({ j, now, from, more = false }: { j: Journal; now: Date; from: string; more?: boolean }) {
  const { start, pending, error } = useStartRun()
  const t = j.today
  if (!t) return null
  const s = t.scenario
  const done = !!j.doneBy
  const cat = categoryStyle(t.category.code)
  const lastTry = j.tries[0]

  return (
    <section className={cn('card relative isolate overflow-hidden', done && 'stamp-thud')} aria-labelledby="daily-title">
      <div className="grid grid-cols-[minmax(0,1fr)] sm:grid-cols-[120px_minmax(0,1fr)]">
        {/* the stub: the date, the series; torn off along the dashed line */}
        <div className="relative flex items-center justify-between gap-3 bg-gradient-to-br from-[#FF5A3D] to-[#C8101E] px-5 py-3 text-white sm:flex-col sm:justify-center sm:gap-4 sm:px-3 sm:py-6 sm:text-center">
          <p className="flex min-w-0 items-baseline gap-2 whitespace-nowrap sm:flex-col sm:items-center sm:gap-0">
            <span className="text-xs font-semibold uppercase tracking-[.08em] text-white/80 sm:order-first sm:text-[11px]">
              <span className="sm:hidden">{now.toLocaleDateString('ru-RU', { weekday: 'short' })}</span>
              <span className="hidden sm:inline">{weekday(now)}</span>
            </span>
            <span className="digits font-display text-[26px] font-bold leading-none sm:mt-1 sm:text-[52px]">{now.getDate()}</span>
            <span className="text-sm text-white/85 sm:mt-1">{month(now)}</span>
          </p>
          <StreakChip streak={j.streak} done={done} />
          {/* notches where the stub tears off */}
          <span className="daily-notch -bottom-[11px] -left-[11px] sm:-right-[11px] sm:-top-[11px] sm:left-auto" aria-hidden />
          <span className="daily-notch -bottom-[11px] -right-[11px] sm:-bottom-[11px]" aria-hidden />
        </div>

        <div className="border-t-2 border-dashed border-line/80 p-5 sm:border-l-2 sm:border-t-0 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[.12em] text-brand">Задание дня</p>
          <h2 id="daily-title" className={cn('mt-1 text-[26px] font-bold leading-[1.05] sm:text-[30px]', done && 'pr-24 sm:pr-28')}>
            {t.goal.title}
          </h2>
          <p className="mt-2 flex items-start gap-2 text-ink/85">
            <Target className="mt-[3px] h-4 w-4 shrink-0 text-brand" aria-hidden />
            <span>{t.goal.rule}</span>
          </p>

          {/* the direction: any of its runs counts; the suggested one reinforces most */}
          {s && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-ink/[.03] p-3 ring-1 ring-inset ring-line/60 dark:bg-white/[.025]">
              <CoverTile cover={s.cover} category={s.category} size="md" />
              <div className="min-w-0 flex-1">
                <p className={cn('flex items-center gap-1.5 text-xs font-semibold', cat.text)}>
                  <cat.icon className="h-3.5 w-3.5" aria-hidden />
                  <span className="truncate">{t.category.title}</span>
                </p>
                <p className="mt-0.5 truncate font-semibold leading-snug">{s.title}</p>
                <p className="truncate text-xs text-muted">{t.why}</p>
              </div>
            </div>
          )}

          {done ? (
            <div className="mt-4 space-y-2">
              <p className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ok text-white" aria-hidden>
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <span>
                  Засчитано: «{j.doneBy!.scenario.title}», {t.goal.measure(j.doneBy!)}
                </span>
              </p>
              <Footer now={now} more={more} done />
            </div>
          ) : (
            <>
              {lastTry && (
                <p className="mt-3 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn-ink">
                  Сегодня уже пробовали: {t.goal.measure(lastTry)}. Ещё попытка — и засчитаем.
                </p>
              )}
              {error && (
                <p className="mt-3 text-sm text-brand" role="alert">
                  {error}
                </p>
              )}
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {s && (
                  <Button size="lg" className="sm:min-w-[220px]" loading={pending === s.id} onClick={() => start(s.id, false, from)}>
                    {s.active_run_id ? 'Продолжить рейс' : 'Начать рейс'}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Button>
                )}
                <Footer now={now} more={more} />
              </div>
            </>
          )}
        </div>
      </div>

      {done && <Stamp now={now} />}
    </section>
  )
}

function Footer({ now, more, done = false }: { now: Date; more: boolean; done?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-muted sm:justify-end">
      <span className="inline-flex items-center gap-1.5">
        <Clock3 className="h-4 w-4" aria-hidden />
        {done ? 'Новое задание через' : 'Осталось'} <span className="digits">{untilTomorrow(now)}</span>
      </span>
      {more && (
        <Link
          to="/daily"
          className="-mr-2 inline-flex min-h-[44px] items-center gap-0.5 rounded-lg px-2 font-medium text-ink transition-colors hover:bg-ink/[.05]"
        >
          Серия и жетоны
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </div>
  )
}

function StreakChip({ streak, done }: { streak: number; done: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-sm font-semibold ring-1 ring-inset ring-white/25 sm:flex-col sm:gap-0 sm:rounded-2xl sm:px-3 sm:py-2"
      title="Серия: дней подряд с выполненным заданием"
    >
      <Flame className={cn('h-4 w-4 sm:h-5 sm:w-5', streak > 0 && 'flame fill-[#FFD166] text-[#FFD166]')} aria-hidden />
      <span className="digits">{streak}</span>
      <span className="text-white/80 sm:text-xs sm:font-medium">
        <span className="sr-only">{`${plural(streak, DAYS)} подряд`}</span>
        <span aria-hidden className="sm:hidden">{plural(streak, DAYS)}</span>
        <span aria-hidden className="hidden sm:inline">{done ? 'серия' : 'в серии'}</span>
      </span>
    </span>
  )
}

/** The conductor's stamp: a double ring in red ink, «ВЫПОЛНЕНО» and the date. */
export function Stamp({ now, size = 'md', className }: { now: Date; size?: 'sm' | 'md'; className?: string }) {
  return (
    <div
      className={cn(
        'stamp stamp-in pointer-events-none absolute grid place-items-center rounded-full border-[3px] border-brand text-brand opacity-90 mix-blend-multiply dark:mix-blend-screen',
        size === 'md' ? 'right-4 top-[76px] h-24 w-24 sm:right-6 sm:top-6 sm:h-28 sm:w-28' : 'right-4 top-4 h-[88px] w-[88px]',
        className,
      )}
      aria-hidden
    >
      <span className="absolute inset-1.5 rounded-full border border-dashed border-brand/70" />
      <span className="text-center font-display font-bold uppercase leading-none">
        <span className={cn('block tracking-[.08em]', size === 'md' ? 'text-[14px] sm:text-[17px]' : 'text-[12px]')}>Выполнено</span>
        <span className="digits mt-1 block text-xs font-semibold tracking-[.1em]">
          {now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
        </span>
      </span>
    </div>
  )
}

/** The series in days and this week as a pass: Monday to Sunday, the done days punched. */
export function WeekPass({ j }: { j: Journal }) {
  const done = !!j.doneBy
  const message =
    j.streak === 0
      ? done
        ? 'Серия началась. Завтра — второй день.'
        : 'Выполните задание сегодня — и серия начнётся.'
      : done
        ? `Сегодня засчитано. Завтра серия станет ${j.streak + 1}-дневной.`
        : 'Выполните задание сегодня, чтобы не прервать серию.'
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="week-pass">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="week-pass" className="text-lg font-semibold">
          Серия
        </h2>
        <p className="text-sm text-muted">
          Рекорд <span className="digits font-semibold text-ink">{j.best}</span>
        </p>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span className={cn('grid h-14 w-14 shrink-0 place-items-center rounded-2xl', j.streak ? 'bg-brand-soft' : 'bg-ink/[.05]')} aria-hidden>
          <Flame className={cn('h-8 w-8', j.streak ? 'flame fill-[#FF8A3D] text-brand' : 'text-muted')} />
        </span>
        <p className="leading-tight">
          <span className="digits font-display text-[40px] font-bold leading-none">{j.streak}</span>{' '}
          <span className="text-lg font-semibold">{plural(j.streak, DAYS)} подряд</span>
        </p>
      </div>
      <p className={cn('mt-2 text-sm', !done && j.streak > 0 ? 'font-medium text-warn-ink' : 'text-muted')}>{message}</p>

      <p className="mt-5 text-xs font-semibold uppercase tracking-[.1em] text-muted">Проездной на неделю</p>
      <ol className="mt-2.5 grid grid-cols-7 gap-1 sm:gap-2" aria-label="Эта неделя">
        {j.week.map((d, i) => (
          <li key={d.day} className="flex flex-col items-center gap-1.5">
            <span className={cn('text-xs', d.today ? 'font-bold text-ink' : 'text-muted')}>{WEEKDAYS[i]}</span>
            <span
              className={cn(
                'grid aspect-square w-full max-w-[44px] place-items-center rounded-full',
                d.done
                  ? 'punch bg-gradient-to-b from-[#FF5A3D] to-[#C8101E] text-white shadow-[0_6px_14px_-6px_rgb(226_26_26/.8)]'
                  : d.today
                    ? 'today-pulse border-2 border-dashed border-brand/70'
                    : d.future
                      ? 'border border-line/80'
                      : 'bg-ink/[.05]',
              )}
              style={d.done ? { animationDelay: `${i * 60}ms` } : undefined}
              aria-label={`${d.date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}: ${
                d.done ? 'выполнено' : d.today ? 'сегодня, ещё не выполнено' : d.future ? 'впереди' : 'пропущено'
              }`}
            >
              {d.done ? (
                <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
              ) : (
                <span className={cn('digits text-xs', d.today ? 'font-bold text-brand' : 'text-muted')} aria-hidden>
                  {d.date.getDate()}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** A metal token: a coin in its metal with the emoji; greyed with a lock until it's earned. */
export function TokenDisc({ token, earned, size = 'md' }: { token: Token; earned: boolean; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center rounded-full',
        size === 'md' ? 'h-16 w-16 text-[28px]' : 'h-10 w-10 text-lg',
        earned
          ? `token-${token.metal} token-shine shadow-[inset_0_0_0_3px_rgb(255_255_255/.35),0_8px_18px_-8px_rgb(16_24_40/.55)]`
          : 'border-2 border-dashed border-line bg-ink/[.03]',
      )}
      aria-hidden
    >
      <span className={cn('relative leading-none', !earned && 'opacity-35 grayscale')}>{token.emoji}</span>
      {!earned && size === 'md' && (
        <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full bg-surface text-muted ring-1 ring-line">
          <Lock className="h-3 w-3" />
        </span>
      )}
    </span>
  )
}

/** Every token, earned first shining, the rest with how far to go. */
export function Tokens({ j }: { j: Journal }) {
  const earned = TOKENS.filter((t) => tokenEarned(t, j)).length
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="tokens">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="tokens" className="text-lg font-semibold">
          Жетоны
        </h2>
        <p className="text-sm text-muted">
          <span className="digits font-semibold text-ink">{earned}</span> из {TOKENS.length}
        </p>
      </div>
      <p className="mt-1 text-sm text-muted">Даются за серию и за выполненные задания. Однажды полученный остаётся навсегда.</p>
      <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {TOKENS.map((t) => {
          const got = tokenEarned(t, j)
          const have = Math.min(t.have(j), t.need)
          return (
            <li
              key={t.code}
              className={cn(
                'flex flex-col items-center rounded-2xl p-3.5 text-center ring-1 ring-inset',
                got ? 'bg-surface ring-line/80 dark:bg-surface-2' : 'bg-ink/[.02] ring-line/60',
              )}
            >
              <TokenDisc token={t} earned={got} />
              <p className={cn('mt-2.5 text-sm font-semibold leading-tight', !got && 'text-ink/80')}>{t.title}</p>
              <p className="mt-0.5 text-xs text-muted">{t.text}</p>
              {!got && (
                <div className="mt-2.5 w-full">
                  <div className="track h-1.5">
                    <div className="bar-brand h-full rounded-full" style={{ width: `${(have / t.need) * 100}%` }} />
                  </div>
                  <p className="digits mt-1 text-xs text-muted">
                    {have}/{t.need}
                  </p>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const TASKS: [string, string, string] = ['задание', 'задания', 'заданий']
const tokenLeft = (t: Token, j: Journal) => {
  const n = t.need - Math.min(t.have(j), t.need)
  return `${n} ${plural(n, t.unit === 'days' ? DAYS : TASKS)}`
}

/** Under a finished run: the task counted (with the stamp), or how close it came. */
export function DailyResult({ j, run, onRestart, restarting }: { j: Journal; run: RunView; onRestart: () => void; restarting: boolean }) {
  const t = j.today
  if (!t) return null
  const now = new Date()

  if (j.doneBy?.id === run.id) {
    const next = nextToken(j)
    return (
      <section className="card stamp-thud relative isolate overflow-hidden" aria-labelledby="daily-done">
        <div className="flex">
          <div className="w-2 shrink-0 bg-gradient-to-b from-[#FF5A3D] to-[#C8101E]" aria-hidden />
          <div className="min-w-0 flex-1 p-5 pr-[116px]">
            <p className="text-xs font-bold uppercase tracking-[.12em] text-brand">Задание дня</p>
            <h2 id="daily-done" className="mt-1 text-xl font-semibold leading-tight">
              {t.goal.title} — выполнено
            </h2>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm">
              <Flame className="flame h-4 w-4 fill-[#FF8A3D] text-brand" aria-hidden />
              Серия: <span className="digits font-semibold">{j.streak}</span> {plural(j.streak, DAYS)} подряд
            </p>
            {next && (
              <p className="mt-1 text-sm text-muted">
                До жетона «{next.title}» — ещё {tokenLeft(next, j)}
              </p>
            )}
            <Link
              to="/daily"
              className="-ml-2 mt-2 inline-flex min-h-[44px] items-center gap-0.5 rounded-lg px-2 text-sm font-semibold text-ink transition-colors hover:bg-ink/[.05]"
            >
              Серия и жетоны
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
        <Stamp now={now} size="sm" className="top-1/2 -translate-y-1/2" />
      </section>
    )
  }

  const today = run.finished_at && new Date(run.finished_at).toDateString() === now.toDateString()
  if (j.doneBy || !today || run.scenario.category !== t.category.code) return null
  return (
    <section className="card border-l-4 border-l-warn p-5" aria-labelledby="daily-miss">
      <p className="text-xs font-bold uppercase tracking-[.12em] text-warn-ink">Задание дня</p>
      <h2 id="daily-miss" className="mt-1 text-xl font-semibold leading-tight">
        Почти: не хватило совсем немного
      </h2>
      <p className="mt-1.5 text-sm">
        Нужно: {t.goal.rule.toLowerCase()}. У вас — {t.goal.measure(run)}.
      </p>
      <Button variant="secondary" className="mt-3" onClick={onRestart} loading={restarting} icon={<RotateCcw className="h-4 w-4" aria-hidden />}>
        Ещё попытка
      </Button>
    </section>
  )
}

/** The ticket while the task loads. */
export function DailyTicketSkeleton() {
  return (
    <Loading label="Загружаем задание дня">
      <div className="card grid grid-cols-[minmax(0,1fr)] overflow-hidden sm:grid-cols-[120px_minmax(0,1fr)]">
        <Sk className="h-14 rounded-none sm:h-auto" />
        <div className="p-5 sm:p-6">
          <Sk className="h-3.5 w-28 rounded-md" />
          <Sk className="mt-2.5 h-8 w-2/3 rounded-lg" />
          <SkText lines={1} className="mt-3 max-w-sm" />
          <Sk className="mt-4 h-[72px] w-full rounded-2xl" />
          <Sk className="mt-4 h-[52px] w-full rounded-xl sm:w-56" />
        </div>
      </div>
    </Loading>
  )
}
