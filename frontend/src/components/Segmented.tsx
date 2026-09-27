import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Tabs in a tray; the white pill slides to the picked one. Full width on phones. */
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
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null)
  const index = options.findIndex(([v]) => v === value)

  useLayoutEffect(() => {
    const measure = () => {
      const el = tabs.current[index]
      if (!el) return
      setPill((p) => (p && p.left === el.offsetLeft && p.width === el.offsetWidth ? p : { left: el.offsetLeft, width: el.offsetWidth }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    tabs.current.forEach((el) => el && ro.observe(el))
    return () => ro.disconnect()
  }, [index])

  return (
    <div className="relative flex w-full rounded-xl bg-ink/[.05] p-1 ring-1 ring-inset ring-line/70 sm:inline-flex sm:w-auto" role="tablist" aria-label={label}>
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
            'relative min-h-[40px] flex-auto rounded-lg px-2 py-1 text-center text-[15px] font-medium leading-tight transition-colors [text-wrap:balance] coarse:min-h-[44px] min-[400px]:px-4 min-[400px]:text-base sm:flex-none',
            value === v ? 'text-ink' : 'text-muted hover:text-ink',
          )}
        >
          {text}
        </button>
      ))}
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
