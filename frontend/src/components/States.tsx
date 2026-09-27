import type { ReactNode } from 'react'
import { Mascot } from './Mascot'
import { Button } from './Button'
import { SkRows } from './Skeleton'

/** Generic loading: shimmer rows in a card. Pages with a shape of their own use the skeletons in Skeleton.tsx. */
export function Loading({ rows = 3, avatar = 'round', bare = false }: { rows?: number; avatar?: 'round' | 'tile' | false; bare?: boolean }) {
  const list = <SkRows rows={rows} avatar={avatar} />
  return (
    <div role="status" aria-busy aria-label="Загрузка">
      {bare ? list : <div className="card px-4 py-1 sm:px-5">{list}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card border-l-4 border-l-brand px-4 py-4" role="alert">
      <p className="font-medium">{message}</p>
      <p className="mt-1 text-muted">Проверьте соединение и загрузите данные снова.</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          Загрузить снова
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ title, text, action }: { title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-4">
      <Mascot className="h-16 w-16 shrink-0" mood="thinking" />
      <div className="min-w-0 pt-1">
        <p className="text-base font-semibold">{title}</p>
        {text && <p className="mt-1 max-w-sm text-muted">{text}</p>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  )
}
