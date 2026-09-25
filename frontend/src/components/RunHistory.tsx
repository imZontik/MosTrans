import type { RunHistoryItem } from '@/api/types'
import { cn } from '@/lib/cn'
import { CoverTile } from './Category'
import { fmtDate, MODE_LABEL, OUTCOME_META, TONE_TEXT } from '@/lib/format'

export function RunHistory({ items, limit }: { items: RunHistoryItem[]; limit?: number }) {
  const list = limit ? items.slice(0, limit) : items
  if (!list.length) return <p className="py-4 text-muted">Завершённых рейсов пока нет. Пройдите любой сценарий из расписания.</p>
  return (
    <ul className="divide-y divide-line">
      {list.map((r) => {
        const o = r.outcome ? OUTCOME_META[r.outcome] : null
        return (
          <li key={r.id} className="flex items-center gap-3 py-3">
            <CoverTile cover={r.scenario.cover} category={r.scenario.category} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.scenario.title}</p>
              <p className="truncate text-xs text-muted">
                {fmtDate(r.finished_at, true)}, {(MODE_LABEL[r.mode] ?? r.mode).toLowerCase()}. Пассажир {r.loyalty}, безопасность {r.safety}
              </p>
            </div>
            <div className="shrink-0 text-right">
              {o && <p className={cn('text-xs font-medium', TONE_TEXT[o.tone])}>{o.label}</p>}
              <p className="digits text-base font-semibold">+{r.points_awarded ?? 0}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
