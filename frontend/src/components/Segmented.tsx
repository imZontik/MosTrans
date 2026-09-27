import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Tabs in a tray; the white pill slides to the picked one. Full width on phones.
 * A tab never gets narrower than its label: when the labels don't fit (a 320px phone), the tray
 * scrolls sideways instead of squeezing them into each other, its edges fade where there is more,
 * and the picked tab scrolls into view.
 */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: [T, ReactNode][]
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null)
  const [edges, setEdges] = useState({ start: false, end: false })
  const index = options.findIndex(([v]) => v === value)

  const readEdges = () => {
    const el = scroller.current
    if (!el) return
    const start = el.scrollLeft > 2
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 2
    setEdges((e) => (e.start === start && e.end === end ? e : { start, end }))
  }

  useLayoutEffect(() => {
    const measure = () => {
      const el = tabs.current[index]
      if (!el) return
      setPill((p) => (p && p.left === el.offsetLeft && p.width === el.offsetWidth ? p : { left: el.offsetLeft, width: el.offsetWidth }))
      readEdges()
    }
    measure()
    // the picked tab into view, inside the tray only (the page doesn't move)
    const box = scroller.current
    const el = tabs.current[index]
    if (box && el && box.scrollWidth > box.clientWidth) {
      box.scrollTo({ left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' })
    }
    const ro = new ResizeObserver(measure)
    if (box) ro.observe(box)
    tabs.current.forEach((t) => t && ro.observe(t))
    return () => ro.disconnect()
  }, [index])

  const fade = edges.start && edges.end
    ? '[mask-image:linear-gradient(90deg,transparent,black_24px,black_calc(100%-24px),transparent)]'
    : edges.end
      ? '[mask-image:linear-gradient(90deg,black_calc(100%-24px),transparent)]'
      : edges.start
        ? '[mask-image:linear-gradient(90deg,transparent,black_24px)]'
        : ''

  return (
    <div className="w-full rounded-xl bg-ink/[.05] ring-1 ring-inset ring-line/70 sm:inline-block sm:w-auto sm:max-w-full">
      <div ref={scroller} onScroll={readEdges} className={cn('scrollbar-none overflow-x-auto rounded-xl', fade)}>
        <div className="relative flex w-max min-w-full p-1" role="tablist" aria-label={label}>
          {pill && (
            <span
              className="absolute inset-y-1 rounded-lg bg-surface shadow-card ring-1 ring-inset ring-line/60 transition-[left,width] duration-300 ease-[cubic-bezier(.3,.9,.3,1)] dark:bg-surface-2"
              style={pill}
              aria-hidden
            />
          )}
          {options.map(([v, text], i) => (
            <button
              key={v}
              ref={(el) => (tabs.current[i] = el)}
              role="tab"
              aria-selected={value === v}
              onClick={() => onChange(v)}
              className={cn(
                // flex-1 shares the spare room; min-width stays at the label, so labels never overlap
                'relative min-h-[40px] min-w-fit flex-1 whitespace-nowrap rounded-lg px-3 text-center text-[15px] font-medium leading-tight transition-colors coarse:min-h-[44px] min-[400px]:px-4 min-[400px]:text-base sm:flex-none',
                value === v ? 'text-ink' : 'text-muted hover:text-ink',
              )}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** A tab label with a count; the count shows from sm up, so several tabs fit a 320px phone. */
export function Counted({ text, n }: { text: string; n: number }) {
  return (
    <>
      {text}
      <span className="hidden sm:inline"> · {n}</span>
    </>
  )
}
