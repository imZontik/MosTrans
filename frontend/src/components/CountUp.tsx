import { useEffect, useRef, useState } from 'react'

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Animated number counter (jumps straight to the value when reduced motion is on). */
export function CountUp({ value, duration = 900, className }: { value: number; duration?: number; className?: string }) {
  const [shown, setShown] = useState(() => (reducedMotion() ? value : 0))
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
