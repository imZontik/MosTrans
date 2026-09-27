import { useId, useState, type ReactNode } from 'react'
import { ChevronDown, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconPlate } from './Card'

/**
 * A card that folds: the header (title and a one-line summary) toggles the body, which unfolds to
 * its own height (0fr → 1fr) and stays out of the tab order while folded.
 */
export function Disclosure({
  icon,
  title,
  summary,
  disabled = false,
  defaultOpen = false,
  children,
  className,
}: {
  icon: LucideIcon
  title: ReactNode
  summary?: ReactNode
  disabled?: boolean
  defaultOpen?: boolean
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  return (
    <section className={cn('card overflow-hidden', className)} aria-labelledby={`${id}-title`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={`${id}-body`}
        className="flex min-h-[72px] w-full items-center gap-3 p-5 text-left transition-colors hover:bg-ink/[.02] disabled:cursor-default sm:p-6"
      >
        <IconPlate icon={icon} tint="bg-ink/[.06]" tone="text-ink" />
        <span className="min-w-0 flex-1">
          <span id={`${id}-title`} className="block text-lg font-semibold leading-tight">
            {title}
          </span>
          {summary && <span className="block text-sm text-muted">{summary}</span>}
        </span>
        {!disabled && (
          <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-muted">
            <span className="hidden min-[400px]:inline">{open ? 'Свернуть' : 'Показать'}</span>
            <ChevronDown className={cn('h-5 w-5 transition-transform duration-300', open && 'rotate-180')} aria-hidden />
          </span>
        )}
      </button>
      <div
        id={`${id}-body`}
        className={cn(
          'grid transition-[grid-template-rows,visibility] duration-300 ease-[cubic-bezier(.3,.8,.3,1)]',
          open ? 'visible grid-rows-[1fr]' : 'invisible grid-rows-[0fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-line/70 px-5 pb-2 sm:px-6">{children}</div>
        </div>
      </div>
    </section>
  )
}
