import { useEffect, useRef, useState } from 'react'

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Animated number counter (jumps straight to the value when reduced motion is on). It starts from
 * `initial` (0 by default) and later runs from the previous value to the new one.
 */
export function CountUp({ value, initial: startAt = 0, duration = 900, className }: { value: number; initial?: number; duration?: number; className?: string }) {
  const [shown, setShown] = useState(() => (reducedMotion() ? value : startAt))
  const from = useRef(shown)

  useEffect(() => {
    if (reducedMotion()) {
      setShown(value)
      from.current = value
      return
    }
    const start = performance.now()
    const initial = from.current
    let frame = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setShown(Math.round(initial + (value - initial) * eased))
      if (t < 1) frame = requestAnimationFrame(step)
      else from.current = value
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value, duration])

  return <span className={className}>{new Intl.NumberFormat('ru-RU').format(shown)}</span>
}
