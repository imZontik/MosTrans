import { Link, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { RunHistoryItem } from '@/api/types'
import { cn } from '@/lib/cn'
import { CoverTile } from './Category'
import { fmtDate, MODE_LABEL, OUTCOME_META, scaleTone, TONE_TEXT } from '@/lib/format'

const OUTCOME_PILL = { ok: 'bg-ok-soft text-ok', warn: 'bg-warn-soft text-warn-ink', bad: 'bg-brand-soft text-brand' } as const

/**
 * Finished runs: cover, title, when and how, the two scales, the outcome and the points.
 * With `linked` (your own runs) a row opens the run's debrief.
 */
export function RunHistory({ items, limit, linked = false }: { items: RunHistoryItem[]; limit?: number; linked?: boolean }) {
  const location = useLocation()
  const list = limit ? items.slice(0, limit) : items
  if (!list.length) return <p className="py-4 text-muted">Завершённых рейсов пока нет. Пройдите любой сценарий из расписания.</p>
  return (
    <ul className="divide-y divide-line/70">
      {list.map((r) => {
        const o = r.outcome ? OUTCOME_META[r.outcome] : null
        const body = (
          <>
            <CoverTile cover={r.scenario.cover} category={r.scenario.category} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.scenario.title}</p>
              <p className="truncate text-xs text-muted">
                {fmtDate(r.finished_at, true)} · {(MODE_LABEL[r.mode] ?? r.mode).toLowerCase()}
              </p>
              {/* the outcome sits with the scales, so the title keeps the row's width */}
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                {o && <span className={cn('rounded-full px-2 py-0.5 font-semibold leading-none', OUTCOME_PILL[o.tone])}>{o.label}</span>}
                <Scale label="Пассажир" value={r.loyalty} />
                <Scale label="Безопасность" value={r.safety} />
              </p>
            </div>
            <span className="digits shrink-0 self-center text-xl font-semibold leading-none">+{r.points_awarded ?? 0}</span>
            {linked && <ChevronRight className="-mr-1 hidden h-4 w-4 shrink-0 text-muted/70 min-[400px]:block" aria-hidden />}
          </>
        )
        return (
          <li key={r.id}>
            {linked ? (
              <Link
                to={`/play/${r.id}`}
                state={{ from: location.pathname }}
                className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-ink/[.03]"
                aria-label={`${r.scenario.title}: разбор рейса`}
              >
                {body}
              </Link>
            ) : (
              <div className="flex items-center gap-3 py-3">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** «Пассажир 72» with a dot in the scale's signal colour. */
function Scale({ label, value }: { label: string; value: number }) {
  const tone = scaleTone(value)
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className={cn('h-1.5 w-1.5 rounded-full', { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-brand' }[tone])} aria-hidden />
      {label} <span className={cn('digits text-sm font-semibold', TONE_TEXT[tone])}>{value}</span>
    </span>
  )
}
