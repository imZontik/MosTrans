import { useCallback, useLayoutEffect, useRef } from 'react'

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * FLIP for lists: when `trigger` changes, every registered element that moved slides from where it
 * was to where it is now. Positions are `offsetTop` within the list (make the list `relative`), so
 * page scrolling between updates doesn't count as movement. `skip` leaves out elements that must
 * not slide, e.g. a sticky row whose offset follows the scroll.
 */
export function useFlip<K>(trigger: unknown, skip?: (key: K) => boolean) {
  const nodes = useRef(new Map<K, HTMLElement>())
  const tops = useRef(new Map<K, number>())

  useLayoutEffect(() => {
    const smooth = !reducedMotion()
    const seen = new Set<K>()
    nodes.current.forEach((el, key) => {
      seen.add(key)
      if (skip?.(key)) {
        tops.current.delete(key)
        return
      }
      const top = el.offsetTop
      const before = tops.current.get(key)
      if (smooth && before !== undefined && before !== top) {
        el.animate([{ transform: `translateY(${before - top}px)` }, { transform: 'none' }], {
          duration: 650,
          easing: 'cubic-bezier(.2,.8,.2,1)',
        })
      }
      tops.current.set(key, top)
    })
    // rows that left: forget them, so coming back they enter fresh instead of sliding from afar
    for (const key of [...tops.current.keys()]) if (!seen.has(key)) tops.current.delete(key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])

  return useCallback(
    (key: K) => (el: HTMLElement | null) => {
      if (el) nodes.current.set(key, el)
      else nodes.current.delete(key)
    },
    [],
  )
}
