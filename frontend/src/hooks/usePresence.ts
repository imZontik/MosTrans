import { useEffect, useState } from 'react'

/**
 * Mount / unmount with room for a CSS transition on both sides.
 * - `mounted`: render the thing (stays true while it animates out);
 * - `on`: the visible state to transition to (flips a frame after mounting, so there is a «from»);
 * - `settled`: fully in and at rest, e.g. to stop clipping it once the transition is over.
 * Shown from the start, it is simply there: no entrance.
 */
export function usePresence(show: boolean, { enterMs, exitMs }: { enterMs: number; exitMs: number }) {
  const [mounted, setMounted] = useState(show)
  const [on, setOn] = useState(show)
  const [settled, setSettled] = useState(show)

  useEffect(() => {
    if (show) {
      setMounted(true)
      let second = 0
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setOn(true))
      })
      const done = window.setTimeout(() => setSettled(true), enterMs)
      return () => {
        cancelAnimationFrame(first)
        cancelAnimationFrame(second)
        window.clearTimeout(done)
      }
    }
    setOn(false)
    setSettled(false)
    const gone = window.setTimeout(() => setMounted(false), exitMs)
    return () => window.clearTimeout(gone)
  }, [show, enterMs, exitMs])

  return { mounted, on, settled }
}
