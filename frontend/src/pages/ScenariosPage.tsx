import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Clock, Crown, GitBranch, Loader2, Lock, Play, RotateCcw, TrainFront, UserRound, type LucideIcon } from 'lucide-react'
import { api } from '@/api/client'
import type { CatalogItem } from '@/api/types'
import { useAsync } from '@/hooks/useAsync'
import { useStartRun } from '@/hooks/useStartRun'
import { PageHeader } from '@/components/Card'
import { CoverTile } from '@/components/Category'
import { DifficultyDots } from '@/components/Progress'
import { Segmented } from '@/components/Segmented'
import { ErrorState, Loading } from '@/components/States'
import { cn } from '@/lib/cn'
import { categoryStyle } from '@/lib/category'
import { fmtNumber } from '@/lib/format'
import { ENDINGS, plural } from '@/lib/plural'

const POSITION_ICON: Record<string, LucideIcon> = {
  conductor: UserRound,
  senior_conductor: BadgeCheck,
  train_chief: Crown,
}
const DIFFICULTY = ['', 'Лёгкий', 'Средний', 'Сложный']

type Filter = 'all' | 'new' | 'improve' | 'done'
const FILTERS: Record<Filter, (s: CatalogItem) => boolean> = {
  all: () => true,
  new: (s) => !s.locked && s.finishes === 0,
  improve: (s) => !s.locked && s.finishes > 0 && s.best_outcome !== 'success',
  done: (s) => s.best_outcome === 'success',
}
const EMPTY: Record<Filter, string> = {
  all: 'В этом направлении сценариев пока нет.',
  new: 'Новых сценариев здесь не осталось, все уже пройдены хотя бы раз.',
  improve: 'Исправлять нечего: пройденные сценарии пройдены без ошибок.',
  done: 'Пока ни один сценарий здесь не пройден без ошибок.',
}

/**
 * «Расписание»: the run you left off first (Coursera's «continue where you left off»), then the
 * scenarios by post with how far along each post is. Cards say what the scenario is about, how long
 * and how hard, your best result, and the one next action.
 */
export default function ScenariosPage() {
  const catalog = useAsync(() => api.scenarios(), [])
  // «Подтянуть» in the profile links here with ?category=…
  const [params] = useSearchParams()
  const [category, setCategory] = useState<string | null>(() => params.get('category'))
  const [filter, setFilter] = useState<Filter>('all')
  const { start, pending, error } = useStartRun()

  const items = catalog.data?.items ?? []
  const open = items.filter((s) => !s.locked)
  const done = items.filter(FILTERS.done).length
  // the most recently started unfinished run
  const resume = [...items].filter((s) => s.active_run_id && !s.locked).sort((a, b) => b.active_run_id! - a.active_run_id!)[0]

  const inCategory = items.filter((s) => !category || s.category === category)
  const groups = useMemo(() => {
    if (!catalog.data) return []
    return [...catalog.data.positions]
      .sort((a, b) => a.rank - b.rank)
      .map((p) => {
        const all = inCategory.filter((s) => s.position === p.code)
        return { ...p, all, items: all.filter(FILTERS[filter]) }
      })
      .filter((g) => g.items.length > 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog.data, category, filter])

  return (
    <div>
      <PageHeader
        title="Расписание"
        subtitle={
          catalog.data
            ? `Пройдено без ошибок ${done} из ${open.length} доступных. Каждое решение влияет на пассажира и безопасность.`
            : 'Сценарии рейсов. Каждое решение влияет на пассажира и безопасность.'
        }
      />

      {resume && <Resume s={resume} loading={pending === resume.id} onStart={(restart) => start(resume.id, restart)} />}

      {catalog.data && (
        <div className="mb-7 space-y-3">
          <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Направления">
            <Chip active={!category} onClick={() => setCategory(null)}>
              <TrainFront className="h-4 w-4 text-muted" aria-hidden />
              Все
            </Chip>
            {catalog.data.categories.map((c) => (
              <Chip
                key={c.code}
                code={c.code}
                active={category === c.code}
                onClick={() => setCategory(category === c.code ? null : c.code)}
              >
                {c.title}
              </Chip>
            ))}
          </div>
          <Segmented
            label="Показать"
            value={filter}
            onChange={setFilter}
            options={[
              ['all', 'Все'],
              ['new', 'Новые'],
              ['improve', 'Улучшить'],
              ['done', 'Пройдены'],
            ]}
          />
        </div>
      )}

      {error && (
        <p className="card mb-4 border-l-4 border-l-brand px-4 py-3" role="alert">
          {error}
        </p>
      )}

      {catalog.loading && !catalog.data ? (
        <Loading rows={5} />
      ) : catalog.error ? (
        <ErrorState message={catalog.error} onRetry={catalog.reload} />
      ) : (
        <div className="space-y-10">
          {groups.map((g) => (
            <Group key={g.code} code={g.code} title={g.title} all={g.all}>
              {g.items.map((s, i) => (
                <ScenarioCard key={s.id} s={s} index={i} loading={pending === s.id} onStart={(restart) => start(s.id, restart)} />
              ))}
            </Group>
          ))}
          {groups.length === 0 && (
            <div className="card px-5 py-8 text-center">
              <p className="font-medium">{EMPTY[filter]}</p>
              <button
                onClick={() => {
                  setCategory(null)
                  setFilter('all')
                }}
                className="mt-2 min-h-[44px] font-medium text-muted underline decoration-line underline-offset-4 hover:text-ink"
              >
                Показать все сценарии
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --- resume ----------------------------------------------------------------------

/** The run you left off, on the night line: one tap back into it. */
function Resume({ s, loading, onStart }: { s: CatalogItem; loading: boolean; onStart: (restart: boolean) => void }) {
  return (
    <section className="night-line-flat night-panel relative mb-7 flex flex-wrap items-center gap-x-4 gap-y-3 overflow-hidden rounded-2xl px-4 py-4 sm:px-5" aria-label="Незавершённый рейс">
      <CoverTile cover={s.cover} category={s.category} size="md" className="ring-white/10" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-[.08em] text-white/50">Вы остановились здесь</p>
        <p className="truncate text-lg font-semibold leading-tight">{s.title}</p>
        <p className="truncate text-sm text-white/60">{s.category_title} · прогресс сохранён</p>
      </div>
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <button
          type="button"
          onClick={() => onStart(false)}
          disabled={loading}
          className="btn-brand press inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl px-5 font-semibold sm:flex-none"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Play className="h-4 w-4 fill-current" aria-hidden />}
          Продолжить
        </button>
        <button
          type="button"
          onClick={() => onStart(true)}
          disabled={loading}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Заново
        </button>
      </div>
    </section>
  )
}

// --- filters ---------------------------------------------------------------------

function Chip({ active, onClick, code, children }: { active: boolean; onClick: () => void; code?: string; children: ReactNode }) {
  const c = code ? categoryStyle(code) : null
  const Icon = c?.icon
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'chip gap-2',
        active
          ? cn(c ? cn(c.soft, c.ring) : 'bg-ink/[.07] ring-ink/15', 'border-transparent text-ink shadow-card ring-1 ring-inset')
          : 'border-line/80 bg-transparent text-muted hover:border-line hover:bg-ink/[.03] hover:text-ink',
      )}
    >
      {Icon && <Icon className={cn('h-4 w-4', active ? c!.text : 'text-muted')} aria-hidden />}
      {children}
    </button>
  )
}

// --- groups ----------------------------------------------------------------------

/** One post: its scenarios and how far along you are there. A locked post says so once, at the top. */
function Group({ code, title, all, children }: { code: string; title: string; all: CatalogItem[]; children: ReactNode }) {
  const PosIcon = POSITION_ICON[code] ?? UserRound
  const locked = all.every((s) => s.locked)
  const done = all.filter(FILTERS.done).length
  return (
    <section aria-labelledby={`pos-${code}`}>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 id={`pos-${code}`} className="flex items-center gap-2.5 text-xl font-semibold">
          <span className={cn('grid h-9 w-9 place-items-center rounded-xl ring-1 ring-inset', locked ? 'bg-ink/[.04] text-muted ring-line' : 'bg-ink/[.06] text-ink ring-ink/10')} aria-hidden>
            {locked ? <Lock className="h-4 w-4" /> : <PosIcon className="h-[18px] w-[18px]" />}
          </span>
          {title}
        </h2>
        {locked ? (
          <p className="text-sm text-muted">Откроется со следующей должностью</p>
        ) : (
          <div className="ml-auto flex items-center gap-3 text-sm text-muted">
            <span className="track hidden h-1.5 w-28 overflow-hidden rounded-full sm:block" aria-hidden>
              <span className="bar-ok bar-grow block h-full rounded-full" style={{ width: `${(done / all.length) * 100}%` }} />
            </span>
            <span>
              <span className="digits font-semibold text-ink">{done}</span> из {all.length} пройдено
            </span>
          </div>
        )}
      </div>
      <ul className="grid gap-3 md:grid-cols-2 md:gap-4">{children}</ul>
    </section>
  )
}

// --- a scenario --------------------------------------------------------------------

type Tone = 'ok' | 'warn' | 'new' | 'qual' | 'locked' | 'active'
const TONE: Record<Tone, string> = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn-ink',
  new: 'bg-ink/[.06] text-muted',
  qual: 'bg-cat-service-soft text-cat-service',
  locked: 'bg-ink/[.05] text-muted',
  active: 'bg-brand-soft text-brand',
}

function status(s: CatalogItem): { text: string; tone: Tone; action: string } {
  if (s.locked) return { text: 'Закрыт', tone: 'locked', action: '' }
  if (s.active_run_id) return { text: 'В процессе', tone: 'active', action: 'Продолжить' }
  if (s.finishes === 0) return s.mode === 'qualification' ? { text: 'Повышение', tone: 'qual', action: 'Начать' } : { text: 'Новый', tone: 'new', action: 'Начать' }
  if (s.best_outcome === 'success') return { text: 'Пройден', tone: 'ok', action: 'Пройти снова' }
  return { text: 'Есть ошибки', tone: 'warn', action: 'Исправить' }
}

/**
 * The whole card starts (or resumes) the scenario: the title's button stretches over it, and only
 * «Заново» sits above it. A light in the category's colour glows in the corner; the footer carries
 * time, difficulty, your best result and the action.
 */
function ScenarioCard({ s, index, loading, onStart }: { s: CatalogItem; index: number; loading: boolean; onStart: (restart?: boolean) => void }) {
  const st = status(s)
  const c = categoryStyle(s.category)
  const locked = s.locked
  return (
    <li
      data-testid="scenario-row"
      data-slug={s.slug}
      className={cn(
        'scenario-card row-in group relative isolate flex flex-col overflow-hidden rounded-2xl',
        locked ? 'border border-dashed border-line' : 'card lift hover:border-ink/20',
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      {!locked && (
        <span
          className="pointer-events-none absolute -right-16 -top-16 -z-10 h-44 w-44 rounded-full opacity-[.16] blur-2xl transition-opacity group-hover:opacity-25 dark:opacity-[.2]"
          style={{ background: `rgb(var(--cat-${s.category}))` }}
          aria-hidden
        />
      )}
      <div className="flex items-start gap-3.5 px-4 pt-4 sm:px-5 sm:pt-5">
        <CoverTile cover={s.cover} category={s.category} size="md" muted={locked} />
        <div className="min-w-0 flex-1">
          <h3 className={cn('text-lg font-semibold leading-tight', locked && 'text-muted')}>
              <button
                type="button"
                disabled={locked || loading}
                onClick={() => onStart(false)}
                className={cn('text-left after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ink/40', locked ? 'cursor-not-allowed' : 'press')}
              >
                {s.title}
                <span className="sr-only">{locked ? ', закрыт' : `: ${st.action.toLowerCase()}`}</span>
              </button>
          </h3>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-medium">
            <span className={cn('inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-[3px] font-semibold leading-none', TONE[st.tone])}>
              {locked && <Lock className="h-3 w-3" aria-hidden />}
              {st.tone === 'active' && <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />}
              {st.text}
            </span>
            <span className={cn('inline-flex min-w-0 items-center gap-1.5', locked ? 'text-muted' : c.text)}>
              <c.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {s.category_title}
            </span>
          </p>
        </div>
      </div>
      <p className={cn('line-clamp-2 px-4 pt-3 text-sm leading-relaxed sm:px-5', locked ? 'text-muted/80' : 'text-muted')}>{s.description}</p>

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-4 pt-4 text-sm text-muted min-[400px]:gap-x-4 sm:px-5">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <Clock className="h-4 w-4" aria-hidden />
          <span className="digits font-semibold text-ink/80">{s.estimated_minutes}</span> мин
        </span>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={`Сложность: ${DIFFICULTY[s.difficulty]}`}>
          <DifficultyDots value={s.difficulty} />
          <span className="sc-difficulty">{DIFFICULTY[s.difficulty]}</span>
        </span>
        {(s.endings ?? 0) > 1 && (
          <span className="sc-endings inline-flex items-center gap-1.5 whitespace-nowrap" title="Чем закончится рейс, зависит от ваших решений">
            <GitBranch className="h-4 w-4" aria-hidden />
            <span className="digits font-semibold text-ink/80">{s.endings}</span> {plural(s.endings ?? 0, ENDINGS)}
          </span>
        )}
        {s.best_points > 0 && (
          <span className="sc-best whitespace-nowrap">
            лучший <span className="digits font-semibold text-ink/80">+{fmtNumber(s.best_points)}</span>
          </span>
        )}
        {!locked && (
          <span className="ml-auto flex shrink-0 items-center gap-1">
            {s.active_run_id && (
              <button
                type="button"
                disabled={loading}
                onClick={() => onStart(true)}
                className="relative z-10 grid h-9 w-9 place-items-center rounded-xl text-muted transition-colors hover:bg-ink/[.06] hover:text-ink coarse:h-11 coarse:w-11"
                title="Начать заново"
                aria-label={`${s.title}: начать заново`}
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
              </button>
            )}
            <span
              className={cn(
                'inline-flex min-h-[36px] items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition-colors',
                st.tone === 'active' ? 'bg-brand-soft text-brand ring-1 ring-inset ring-brand/25' : 'bg-ink/[.05] text-ink group-hover:bg-ink/[.09]',
              )}
              aria-hidden
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : st.action}
              {!loading && <ArrowRight className="sc-arrow h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
            </span>
          </span>
        )}
      </div>
      {locked && <p className="-mt-2 px-4 pb-4 text-xs text-muted sm:px-5">Откроется с должностью «{s.position === 'train_chief' ? 'Старший проводник' : 'Проводник'}»</p>}
    </li>
  )
}
