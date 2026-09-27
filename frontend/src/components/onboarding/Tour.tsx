import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '../Button'

export interface Slide {
  key: string
  eyebrow: string
  title: string
  text: string
  points?: string[]
  /** the picture on the night panel */
  art: ReactNode
}

/**
 * A short welcome tour, story-style: a picture on the night line, a title, two or three lines, and one
 * big button at the thumb. Phones get the whole screen and a swipe; wider screens a dialog. Arrows and
 * Esc on a keyboard. `onClose` fires on «Пропустить», Esc and the backdrop; `finish` on the last button.
 */
export function Tour({
  slides,
  label,
  onClose,
  finish,
}: {
  slides: Slide[]
  label: string
  onClose: () => void
  finish: { label: string; onClick: () => void }
}) {
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState<1 | -1>(1)
  const panel = useRef<HTMLDivElement>(null)
  const nextBtn = useRef<HTMLButtonElement>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const slide = slides[index]
  const last = index === slides.length - 1

  const go = (to: number) => {
    if (to < 0 || to >= slides.length || to === index) return
    setDir(to > index ? 1 : -1)
    setIndex(to)
  }
  const next = () => (last ? finish.onClick() : go(index + 1))

  // the page under the tour stays put; focus starts on the button
  useEffect(() => {
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus({ preventScroll: true })
    return () => {
      document.body.style.overflow = overflow
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(index + 1)
      else if (e.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-6">
      <div className="tour-fade absolute inset-0 bg-[#05080f]/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="tour-rise relative flex h-[100dvh] w-full flex-col overflow-hidden bg-surface outline-none sm:h-[min(760px,94dvh)] sm:max-w-[540px] sm:rounded-[28px] sm:shadow-lift sm:ring-1 sm:ring-white/10"
        onPointerDown={(e) => (touch.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          const t = touch.current
          touch.current = null
          if (!t) return
          const dx = e.clientX - t.x
          if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(e.clientY - t.y) * 1.5) go(index + (dx < 0 ? 1 : -1))
        }}
      >
        {/* the picture; progress and «Пропустить» over its top */}
        <div className="night-line relative isolate h-[min(46dvh,380px)] min-h-[250px] shrink-0 overflow-hidden sm:h-[330px] [@media(max-height:640px)]:h-[40dvh] [@media(max-height:640px)]:min-h-[220px]">
          <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 pl-5 pr-2 pt-[calc(8px+env(safe-area-inset-top))] sm:pl-6 sm:pr-3 sm:pt-3">
            <div className="flex flex-1 gap-1.5" aria-hidden>
              {slides.map((s, i) => (
                <span key={s.key} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                  <span
                    className="block h-full rounded-full bg-white transition-[width] duration-500 ease-out"
                    style={{ width: i <= index ? '100%' : '0%' }}
                  />
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-xl px-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              {last ? 'Закрыть' : 'Пропустить'}
            </button>
          </div>
          <div
            key={slide.key}
            className={cn('absolute inset-0 pb-8 pt-[calc(52px+env(safe-area-inset-top))] sm:pt-14', dir > 0 ? 'tour-next' : 'tour-prev')}
          >
            <div className="h-full [@media(max-height:640px)]:scale-[.84]">{slide.art}</div>
          </div>
        </div>

        {/* the words, on a sheet that rides up over the picture */}
        <div className="relative -mt-6 flex min-h-0 flex-1 flex-col rounded-t-[24px] bg-surface">
          <div
            key={slide.key}
            className={cn(
              'min-h-0 flex-1 overflow-y-auto px-6 pb-3 pt-6 [mask-image:linear-gradient(black_calc(100%-20px),transparent)] sm:px-8 sm:pt-7',
              dir > 0 ? 'tour-next' : 'tour-prev',
            )}
            aria-live="polite"
          >
            <p className="text-xs font-bold uppercase tracking-[.12em] text-brand">
              <span className="digits">
                {index + 1} из {slides.length}
              </span>{' '}
              · {slide.eyebrow}
            </p>
            <h2 className="mt-2 text-[26px] font-bold leading-[1.1] sm:text-[30px]">{slide.title}</h2>
            <p className="mt-2.5 text-base leading-relaxed text-muted">{slide.text}</p>
            {slide.points && (
              <ul className="mt-4 space-y-2.5 pb-2">
                {slide.points.map((p) => (
                  <li key={p} className="flex gap-3 text-[15px] leading-snug">
                    <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-soft text-brand" aria-hidden>
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center gap-3 border-t border-line/60 px-5 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3.5 sm:px-8 sm:pb-6">
            <button
              type="button"
              onClick={() => go(index - 1)}
              className={cn(
                'grid h-[52px] w-[52px] shrink-0 place-items-center rounded-xl border border-line bg-surface text-ink shadow-card transition-colors hover:bg-surface-2',
                index === 0 && 'invisible',
              )}
              aria-label="Назад"
              tabIndex={index === 0 ? -1 : 0}
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </button>
            <Button ref={nextBtn} size="lg" className="flex-1" onClick={next}>
              {last ? finish.label : 'Далее'}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
