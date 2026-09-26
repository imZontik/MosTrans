import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { routePosition, STATIONS } from '@/lib/route'

/** The hero train (TrainArt) in miniature, side view, nose to the right; wheels at the bottom edge. */
function TrainMarker({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 120 26" className={className} aria-hidden>
      <defs>
        <linearGradient id={`tm-body-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d9dee8" />
        </linearGradient>
      </defs>
      {/* bogies and wheels */}
      {[12, 26, 66, 80].map((x) => (
        <g key={x}>
          <rect x={x - 5.2} y="21.4" width="10.4" height="2" rx=".6" fill="#2a3656" />
          <circle cx={x - 2.8} cy="24.2" r="1.6" fill="#3a4868" />
          <circle cx={x + 2.8} cy="24.2" r="1.6" fill="#3a4868" />
        </g>
      ))}
      <path d="M0 22 L86 22 C101 22 113 20 119.2 16.4 C113.2 12 101 8.8 88 8.4 L8 8.4 Q0 8.4 0 14 Z" fill={`url(#tm-body-${uid})`} />
      <path d="M0 19.2 L90.4 19.2 C102.4 19.2 111.2 18 117.6 15.6 L119.2 16.4 C113 20 101 22 86 22 L0 22 Z" fill="#E21A1A" />
      <path d="M94 10 C104 10.8 112 13.2 117.2 16 L109 16 C104 14 99 12.4 93.6 12 Z" fill="#101a31" />
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} x={6 + i * 11.4} y="11" width="8.4" height="4.2" rx="1.4" fill="#101a31" />
      ))}
    </svg>
  )
}

interface StationLabel {
  i: number
  up: boolean
}

/**
 * «Маршрут» on the night line, drawn like a metro map: a thick rail, stations as dots sitting on it
 * (passed — white, ahead — rings punched into the rail), the passed part in brand red and the train
 * standing on the rail with its nose where you are. Stations are levels, spaced by real distance from Moscow.
 *
 * With `allNames`, from md up every station is named, alternating above / below the rail so close ones
 * don't collide. Otherwise (and always on phones) the current station is named above, the termini below.
 * `nextHint` goes under the next station's name, e.g. «ещё 262 очка». On first render the train rides
 * out from Moscow (skipped with reduced motion).
 */
export function RouteTrack({
  level,
  progress,
  animate = false,
  allNames = false,
  nextHint,
  className,
}: {
  level: number
  progress: number
  animate?: boolean
  allNames?: boolean
  nextHint?: string
  className?: string
}) {
  const pos = routePosition(level, progress)
  const [share, setShare] = useState(animate ? 0 : pos.share)

  useEffect(() => {
    if (!animate) {
      setShare(pos.share)
      return
    }
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setShare(pos.share))
    })
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
    }
  }, [pos.share, animate])

  // Stops the train stands over would peek out under its wheels like giant ones: measure the rail and
  // the train (its width changes with the breakpoint) and hide the dots it covers.
  const railRef = useRef<HTMLDivElement>(null)
  const trainRef = useRef<HTMLSpanElement>(null)
  const [geo, setGeo] = useState({ rail: 0, train: 0 })
  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    const measure = () => setGeo({ rail: rail.clientWidth, train: trainRef.current?.offsetWidth ?? 0 })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(rail)
    return () => ro.disconnect()
  }, [])
  const nose = Math.max(geo.train, pos.share * geo.rail)
  const underTrain = (t: number) => geo.rail > 0 && t * geo.rail > nose - geo.train - 4 && t * geo.rail < nose + 4

  const pct = `${share * 100}%`
  const last = STATIONS.length - 1
  const summary = pos.next ? `На маршруте между станциями ${pos.station.name} и ${pos.next.name}` : 'Вы прибыли в Санкт-Петербург'

  const wide: StationLabel[] = STATIONS.map((_, i) => ({ i, up: i % 2 === 1 }))
  const compact: StationLabel[] = [
    { i: 0, up: false },
    { i: last, up: false },
    ...(pos.index !== 0 && pos.index !== last ? [{ i: pos.index, up: true }] : []),
  ]

  // one row of names, above or below the rail
  const row = (labels: StationLabel[], up: boolean, visibility: string) => (
    <div className={cn('relative h-9 text-xs', visibility)}>
      {labels
        .filter((l) => l.up === up)
        .map(({ i }) => {
          const current = i === pos.index
          const next = !!pos.next && i === pos.index + 1
          return (
            <span
              key={STATIONS[i].name}
              className={cn(
                'absolute flex whitespace-nowrap leading-tight',
                up ? 'bottom-0.5 flex-col-reverse' : 'top-0.5 flex-col',
                i === 0 ? 'items-start' : i === last ? 'items-end' : 'items-center',
                i === 0 ? '-translate-x-[7px]' : i === last ? '-translate-x-[calc(100%-7px)]' : '-translate-x-1/2',
              )}
              style={{ left: `${pos.ticks[i] * 100}%` }}
            >
              <span className={current ? 'font-semibold text-white' : next ? 'font-medium text-white/90' : i < pos.index ? 'text-white/60' : 'text-white/45'}>
                {STATIONS[i].name}
              </span>
              {current && <span className="text-[11px] text-white/55">вы здесь</span>}
              {next && nextHint && <span className="text-[11px] font-medium text-[#FF8F6B]">{nextHint}</span>}
            </span>
          )
        })}
    </div>
  )

  const wideOnly = allNames ? 'hidden md:block' : 'hidden'
  const compactOnly = allNames ? 'md:hidden' : ''

  return (
    <div className={className}>
      <p className="sr-only">{summary}</p>
      <div className="mx-[7px]" aria-hidden>
        {row(wide, true, wideOnly)}
        {row(compact, true, compactOnly)}

        {/* the rail: its centre line sits 26px down, leaving headroom for the train standing on it */}
        <div ref={railRef} className="relative h-9">
          <div className="absolute inset-x-0 top-[26px] h-1.5 -translate-y-1/2 rounded-full bg-white/[.14] shadow-[inset_0_1px_1px_rgb(0_0_0/.35)]" />
          <div
            className={cn('bar-brand absolute left-0 top-[26px] h-1.5 -translate-y-1/2 rounded-full shadow-[0_0_14px_rgb(255_90_61/.55)]', animate && 'route-passed')}
            style={{ width: pct }}
          />
          {pos.ticks.map((t, i) => {
            const reached = i <= pos.index
            return (
              <span
                key={STATIONS[i].name}
                title={`${STATIONS[i].name} — уровень ${i + 1}`}
                className={cn(
                  'absolute top-[26px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity',
                  underTrain(t) && 'opacity-0',
                  reached
                    ? // white stops on the red rail, outlined in the night colour so they sit in the line
                      cn('bg-white shadow-[0_0_0_3px_rgb(12_20_38/.9)]', i === pos.index ? 'h-4 w-4' : 'h-2.5 w-2.5 sm:h-3 sm:w-3')
                    : // stops ahead: rings punched into the rail
                      cn('h-3.5 w-3.5 border-[2.5px] bg-[#111b31]', i === pos.index + 1 ? 'border-white/90' : 'border-white/45'),
                )}
                style={{ left: `${t * 100}%` }}
              />
            )
          })}

          {/* the train, wheels on the rail, nose at where you are; never further left than its own length */}
          <span
            ref={trainRef}
            className={cn(
              'absolute top-[24px] z-10 -translate-x-full -translate-y-full [--train-w:60px] sm:[--train-w:84px]',
              animate && 'route-train',
            )}
            style={{ left: `max(var(--train-w), ${pct})` }}
          >
            <TrainMarker className="block h-[13px] w-[60px] drop-shadow-[0_3px_8px_rgb(226_26_26/.45)] sm:h-[18px] sm:w-[84px]" />
            <span className="headlight absolute -right-2.5 top-[40%] h-3 w-4 rounded-full blur-[3px]" aria-hidden />
          </span>
        </div>

        {row(wide, false, wideOnly)}
        {row(compact, false, compactOnly)}
      </div>
    </div>
  )
}
