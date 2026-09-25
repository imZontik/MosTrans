import { useEffect, useMemo, useState } from 'react'

/** Offset (ms) to add to Date.now() to get server time. */
export function serverOffset(serverNow: string | null | undefined): number {
  if (!serverNow) return 0
  const t = new Date(serverNow).getTime()
  return Number.isFinite(t) ? t - Date.now() : 0
}

/**
 * Seconds remaining until a server-side deadline, ticking ~10 times a second.
 * `serverNow` is the server clock at the time the response was produced; the
 * client clock is corrected by the offset so timers stay server-authoritative.
 */
export function useCountdown(deadline: string | null | undefined, serverNow: string | null | undefined, tickMs = 100) {
  const offset = useMemo(() => serverOffset(serverNow), [serverNow])
  const target = deadline ? new Date(deadline).getTime() : null
  const compute = () => (target === null ? null : Math.max(0, (target - (Date.now() + offset)) / 1000))
  const [remaining, setRemaining] = useState<number | null>(compute)

  useEffect(() => {
    setRemaining(compute())
    if (target === null) return
    const id = window.setInterval(() => setRemaining(compute()), tickMs)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, offset, tickMs])

  return remaining
}
