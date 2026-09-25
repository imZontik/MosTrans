import { useEffect, useRef } from 'react'

/** Calls `fn` immediately and then every `intervalMs` while `enabled`; pauses while the tab is hidden. */
export function usePolling(fn: () => void | Promise<void>, intervalMs: number, enabled = true) {
  const saved = useRef(fn)
  saved.current = fn

  useEffect(() => {
    if (!enabled) return
    let stopped = false
    let timer: number | undefined
    let first = true
    const tick = async () => {
      if (stopped) return
      // The first call always runs; later ones pause while the tab is in the background.
      if (first || document.visibilityState !== 'hidden') {
        first = false
        try {
          await saved.current()
        } catch {
          /* polling errors are non-fatal */
        }
      }
      if (!stopped) timer = window.setTimeout(tick, intervalMs)
    }
    tick()
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [intervalMs, enabled])
}
