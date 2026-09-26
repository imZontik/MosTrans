import { useMemo, useState, type ReactNode } from 'react'
import { BadgeCheck, Crown, Loader2, Lock, RotateCcw, TrainFront, UserRound, type LucideIcon } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { api } from '@/api/client'
import type { CatalogItem } from '@/api/types'
import { useAsync } from '@/hooks/useAsync'
import { useStartRun } from '@/hooks/useStartRun'
import { PageHeader } from '@/components/Card'
import { CoverTile } from '@/components/Category'
import { DifficultyDots } from '@/components/Progress'
import { ErrorState, Loading } from '@/components/States'
import { cn } from '@/lib/cn'
import { categoryStyle } from '@/lib/category'
import { pluralN, SCENARIOS } from '@/lib/plural'

const POSITION_ICON: Record<string, LucideIcon> = {
  conductor: UserRound,
  senior_conductor: BadgeCheck,
  train_chief: Crown,
}

export default function ScenariosPage() {
  const catalog = useAsync(() => api.scenarios(), [])
  // «Подтянуть» in the profile links here with ?category=…
  const [params] = useSearchParams()
  const [category, setCategory] = useState<string | null>(() => params.get('category'))
  const { start, pending, error } = useStartRun()

  const groups = useMemo(() => {
    if (!catalog.data) return []
    const items = catalog.data.items.filter((s) => !category || s.category === category)
    return [...catalog.data.positions]
      .sort((a, b) => a.rank - b.rank)
      .map((p) => ({ ...p, items: items.filter((s) => s.position === p.code) }))
      .filter((g) => g.items.length > 0)
  }, [catalog.data, category])

  return (
    <div>
      <PageHeader title="Расписание" subtitle="Сценарии рейсов. Каждое решение влияет на пассажира и на безопасность." />

      {catalog.data && (
        <div className="scrollbar-none -mx-4 mb-7 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Направления">
          <Chip active={!category} onClick={() => setCategory(null)}>
            <TrainFront className="h-4 w-4" aria-hidden />
            Все
          </Chip>
          {catalog.data.categories.map((c) => (
            <Chip key={c.code} code={c.code} active={category === c.code} onClick={() => setCategory(c.code)}>
              {c.title}
            </Chip>
          ))}
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
        <div className="space-y-9">
          {groups.map((g) => {
            const PosIcon = POSITION_ICON[g.code] ?? UserRound
            return (
            <section key={g.code} aria-labelledby={`pos-${g.code}`}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id={`pos-${g.code}`} className="flex items-center gap-2.5 text-xl font-semibold">
                  <span className="btn-ink grid h-9 w-9 place-items-center rounded-[10px]" aria-hidden>
                    <PosIcon className="h-[18px] w-[18px]" />
                  </span>
                  {g.title}
                </h2>
                <span className="rounded-full bg-ink/[.05] px-2.5 py-1 text-xs text-muted ring-1 ring-inset ring-line/70">{pluralN(g.items.length, SCENARIOS)}</span>
              </div>
              <ul className="grid gap-2.5 md:grid-cols-2 md:gap-3">
                {g.items.map((s) => (
                  <ScenarioRow key={s.id} s={s} loading={pending === s.id} onStart={(restart) => start(s.id, restart)} />
                ))}
              </ul>
            </section>
            )
          })}
          {groups.length === 0 && (
            <div className="py-6">
              <p className="font-medium">В этом направлении сценариев пока нет.</p>
              <button onClick={() => setCategory(null)} className="mt-2 min-h-[44px] font-medium underline decoration-line underline-offset-4">
                Показать все сценарии
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Chip({ active, onClick, code, children }: { active: boolean; onClick: () => void; code?: string; children: ReactNode }) {
  const c = code ? categoryStyle(code) : null
  const Icon = c?.icon
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'chip',
        active
          ? c
            ? cn(c.soft, c.border, 'tile-sheen text-ink shadow-card')
            : 'btn-ink border-transparent'
          : 'border-line bg-surface text-ink shadow-card hover:border-ink/40 hover:bg-surface-2',
      )}
    >
      {Icon && <Icon className={cn('h-4 w-4', c!.text)} aria-hidden />}
      {children}
    </button>
  )
}

type Pill = 'ok' | 'warn' | 'neutral' | 'qual' | 'locked' | 'resume'
const PILL: Record<Pill, string> = {
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn-ink',
  neutral: 'bg-ink/[.06] text-muted',
  qual: 'bg-brand-soft/60 text-brand ring-1 ring-inset ring-brand/40',
  locked: 'bg-ink/[.06] text-muted',
  resume: 'btn-ink',
}

function status(s: CatalogItem): { text: string; pill: Pill } {
  if (s.locked) return { text: 'Закрыт', pill: 'locked' }
  if (s.active_run_id) return { text: 'Продолжить', pill: 'resume' }
  if (s.finishes === 0) {
    return s.mode === 'qualification' ? { text: 'Повышение', pill: 'qual' } : { text: 'Не пройден', pill: 'neutral' }
  }
  if (s.best_outcome === 'success') return { text: 'Пройден', pill: 'ok' }
  return { text: 'Есть ошибки', pill: 'warn' }
}

function ScenarioRow({ s, loading, onStart }: { s: CatalogItem; loading: boolean; onStart: (restart?: boolean) => void }) {
  const st = status(s)
  const locked = s.locked
  return (
    <li data-testid="scenario-row" data-slug={s.slug} className={cn('card relative overflow-hidden', !locked && 'lift hover:border-ink/25', locked && 'bg-none opacity-90 shadow-none')}>
      <button
        type="button"
        disabled={locked || loading}
        onClick={() => onStart(false)}
        aria-describedby={locked ? `lock-${s.id}` : undefined}
        className={cn(
          'flex min-h-[76px] w-full items-center gap-3 px-3.5 py-3 text-left transition-colors',
          locked ? 'cursor-not-allowed' : 'press',
        )}
      >
        <CoverTile cover={s.cover} category={s.category} muted={locked} />
        <span className="min-w-0 flex-1">
          <span className={cn('block font-medium leading-snug', locked && 'text-muted')}>{s.title}</span>
          <span className="sr-only">{s.category_title}</span>
          <span className="mt-1 flex items-center gap-2 text-xs text-muted">
            <span className="digits text-sm font-semibold text-ink/80">{s.estimated_minutes} мин</span>
            <DifficultyDots value={s.difficulty} />
            {s.mode === 'qualification' && s.finishes > 0 && <span>повышение</span>}
          </span>
        </span>
        <span className="flex shrink-0 items-center">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-ink" aria-label="Открываем рейс" />
          ) : (
            <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold leading-none', PILL[st.pill])}>
              {locked && <Lock className="h-3 w-3" aria-hidden />}
              {st.text}
            </span>
          )}
        </span>
      </button>
      {locked && (
        <p id={`lock-${s.id}`} className="-mt-2 px-4 pb-3 pl-[74px] text-xs text-muted">
          Откроется с должностью «{s.position === 'train_chief' ? 'Старший проводник' : 'Проводник'}»
        </p>
      )}
      {s.active_run_id && !locked && (
        <button
          type="button"
          disabled={loading}
          onClick={() => onStart(true)}
          className="-mt-3 ml-[74px] flex min-h-[44px] items-center gap-1 text-xs text-muted underline decoration-line underline-offset-4 hover:text-ink"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Начать заново
        </button>
      )}
    </li>
  )
}
