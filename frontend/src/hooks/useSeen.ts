import { useCallback, useEffect, useRef } from 'react'

/**
 * Tells which elements the person has actually seen: at least `ratio` of the element on screen
 * while the tab is in front. Ids come from `data-seen-id`; they are reported once, in batches.
 * Returns a ref callback for the elements to watch.
 */
export function useSeen(onSeen: (ids: number[]) => void, { ratio = 0.6, delay = 1000 } = {}) {
  const callback = useRef(onSeen)
  callback.current = onSeen
  const onScreen = useRef(new Set<number>())
  const queue = useRef(new Set<number>())
  const reported = useRef(new Set<number>())
  const timer = useRef<number | undefined>(undefined)
  const observer = useRef<IntersectionObserver | null>(null)

  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = undefined
    if (!queue.current.size) return
    const ids = [...queue.current]
    queue.current.clear()
    ids.forEach((id) => reported.current.add(id))
    callback.current(ids)
  }, [])

  // what is on screen counts only while the tab is in front
  const collect = useCallback(() => {
    if (document.visibilityState !== 'visible') return
    for (const id of onScreen.current) if (!reported.current.has(id)) queue.current.add(id)
    onScreen.current.clear()
    if (queue.current.size && timer.current === undefined) timer.current = window.setTimeout(flush, delay)
  }, [delay, flush])

  const getObserver = useCallback(() => {
    observer.current ??= new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = Number((e.target as HTMLElement).dataset.seenId)
          if (!id) continue
          if (e.isIntersecting && e.intersectionRatio >= ratio) {
            onScreen.current.add(id)
            observer.current?.unobserve(e.target)
          } else {
            onScreen.current.delete(id)
          }
        }
        collect()
      },
      { threshold: ratio },
    )
    return observer.current
  }, [collect, ratio])

  useEffect(() => {
    document.addEventListener('visibilitychange', collect)
    return () => {
      document.removeEventListener('visibilitychange', collect)
      observer.current?.disconnect()
      observer.current = null
      flush() // leaving the page: what was seen still counts
    }
  }, [collect, flush])

  return useCallback(
    (el: HTMLElement | null) => {
      if (el && !reported.current.has(Number(el.dataset.seenId))) getObserver().observe(el)
    },
    [getObserver],
  )
}
