import type { ReactNode } from 'react'
import { Mascot } from './Mascot'
import { Button } from './Button'

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy aria-label="Загрузка">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-16" />
      ))}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="border-l-2 border-brand bg-surface px-4 py-4" role="alert">
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
