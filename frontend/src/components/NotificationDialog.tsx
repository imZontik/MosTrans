import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, X } from 'lucide-react'
import type { AppNotification } from '@/api/types'
import { Button } from '@/components/Button'
import { cn } from '@/lib/cn'
import { dayLabel, PRIORITY_META, timeLabel } from '@/lib/notifications'

/**
 * One notification in full: a sheet from the bottom on phones, a card in the middle on wider screens.
 * Nothing happens behind the reader's back — a link only opens from the «Перейти» button.
 */
export function NotificationDialog({ item, onClose }: { item: AppNotification | null; onClose: () => void }) {
  const navigate = useNavigate()
  const box = useRef<HTMLDivElement>(null)
  // keep the last one on screen while the dialog slides away
  const [shown, setShown] = useState(item)
  if (item && item !== shown) setShown(item)
  const open = !!item
  const n = item ?? shown

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    box.current?.focus()
    // the page under the dialog stays put
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [open, onClose])

  const go = () => {
    if (!n?.link) return
    onClose()
    navigate(n.link)
  }

  const meta = n ? PRIORITY_META[n.priority] : null

  return (
    // closed: hidden once it has slid away, so it can't peek on overscroll
    <div
      className={cn(
        'fixed inset-0 z-[60] flex items-end justify-center transition-[visibility] duration-300 sm:items-center sm:p-6',
        open ? 'visible' : 'pointer-events-none invisible',
      )}
      aria-hidden={!open}
    >
      <div
        className={cn('absolute inset-0 bg-[#05080f]/55 backdrop-blur-[2px] transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0')}
        onClick={onClose}
      />
      {n && meta && (
        <div
          ref={box}
          role="dialog"
          aria-modal="true"
          aria-labelledby="notification-title"
          tabIndex={-1}
          className={cn(
            'pb-safe relative flex max-h-[85vh] w-full max-w-md flex-col rounded-t-[28px] border border-b-0 border-line/70 bg-surface shadow-dock outline-none dark:bg-surface-2',
            'transition-[transform,opacity] duration-300 ease-[cubic-bezier(.3,.9,.3,1)] sm:max-w-lg sm:rounded-[24px] sm:border-b sm:pb-0',
            open ? 'translate-y-0 sm:scale-100 sm:opacity-100' : 'translate-y-full sm:translate-y-3 sm:scale-[.97] sm:opacity-0',
          )}
        >
          <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-ink/15 sm:hidden" aria-hidden />
          <div className="flex items-start gap-3 px-5 pb-3 pt-3 sm:pt-5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ink/[.05] text-2xl" aria-hidden>
              {n.icon}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <span className={cn('inline-flex items-center gap-1 font-semibold', meta.text)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} aria-hidden />
                  {meta.label}
                </span>
                {n.sender && <span className="text-muted">от {n.sender}</span>}
                <span className="digits text-muted">
                  {dayLabel(n.created_at)}, {timeLabel(n.created_at)}
                </span>
              </p>
              <h2 id="notification-title" className="mt-1 text-lg font-semibold leading-snug">
                {n.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 -mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-ink/[.06] hover:text-ink"
              aria-label="Закрыть"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          {n.body && <p className="min-h-0 overflow-y-auto whitespace-pre-line px-5 pb-2 leading-relaxed text-ink/85">{n.body}</p>}

          <div className="flex flex-col-reverse gap-2 px-5 pb-5 pt-4 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose} block className="sm:w-auto">
              Закрыть
            </Button>
            {n.link && (
              <Button onClick={go} block className="sm:w-auto" icon={<ArrowRight className="h-4 w-4" aria-hidden />}>
                Перейти
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
