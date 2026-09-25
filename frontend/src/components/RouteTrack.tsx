import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { routePosition, STATIONS } from '@/lib/route'

/** The high-speed train, nose to the right (towards St Petersburg). */
function TrainMarker({ dark }: { dark?: boolean }) {
  return (
    <svg
      viewBox="0 0 34 12"
      className={cn(dark ? 'h-[15px] w-[42px] drop-shadow-[0_0_8px_rgba(226,26,26,.65)]' : 'h-3 w-[34px]')}
      aria-hidden
    >
      <path d="M2 1 H22 C27 1 31 3.5 33.5 7.5 C34 8.6 33.4 11 32 11 H2 C1 11 0.5 10.4 0.5 9.5 V2.5 C0.5 1.6 1 1 2 1 Z" fill="#E21A1A" />
      <path d="M24 3 C27 3.4 29.6 5 31 7 H24 Z" fill={dark ? '#0A101E' : 'rgb(var(--ink))'} />
      <path d="M3 5 H21" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="3 1.6" />
    </svg>
  )
}

/**
 * «Маршрут»: 8 stations spaced by real distance. Passed stations are filled,
 * the train sits between the current and the next station by level progress.
 * On first render the train slides from Moscow to its place (skipped with reduced motion).
 * `allNames` labels every station from md up (two staggered rows, so close stations don't collide);
 * phones always get just the two termini.
 */
export function RouteTrack({
  level,
  progress,
  animate = false,
  dark = false,
  allNames = false,
  className,
}: {
  level: number
  progress: number
  animate?: boolean
  /** White track for the night-line panels. */
  dark?: boolean
  allNames?: boolean
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

  const pct = `${share * 100}%`
  const label = pos.next
    ? `На маршруте между станциями ${pos.station.name} и ${pos.next.name}`
    : 'Вы прибыли в Санкт-Петербург'

  return (
    <div className={className}>
      <p className="sr-only">{label}</p>
      <div className={cn('relative mx-[6px]', dark ? 'h-9' : 'h-7')} aria-hidden>
        {/* the line ahead */}
        <div className={cn('absolute inset-x-0 top-1/2 h-px -translate-y-1/2', dark ? 'bg-white/30' : 'bg-ink/30')} />
        {/* the line behind: white fading in from the red of the dawn */}
        <div
          className={cn(
            'absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full',
            dark ? 'bg-gradient-to-r from-white/50 via-white to-white shadow-[0_0_10px_rgb(255_255_255/.35)]' : 'bar-ink',
            animate && 'route-passed',
          )}
          style={{ width: pct }}
        />
        {pos.ticks.map((t, i) => (
          <span
            key={STATIONS[i].name}
            className={cn(
              'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full',
              i === pos.index ? 'h-[13px] w-[13px]' : 'h-[11px] w-[11px]',
              dark
                ? i < pos.index
                  ? 'bg-white'
                  : i === pos.index
                    ? 'bg-white ring-4 ring-brand/50'
                    : 'border-[1.5px] border-white/55 bg-night'
                : i < pos.index
                  ? 'bg-ink'
                  : i === pos.index
                    ? 'bg-ink ring-4 ring-brand/30'
                    : 'border-[1.5px] border-ink/60 bg-surface',
            )}
            style={{ left: `${t * 100}%` }}
          />
        ))}
        <span
          className={cn(
            'absolute top-1/2 -translate-x-full',
            dark ? '-translate-y-[calc(50%+11px)]' : '-translate-y-[calc(50%+9px)]',
            animate && 'route-train',
          )}
          style={{ left: `max(${dark ? 42 : 34}px, ${pct})` }}
        >
          <TrainMarker dark={dark} />
        </span>
      </div>

      <div className={cn('mt-1 flex justify-between text-xs', dark ? 'text-white/60' : 'text-muted', allNames && 'md:hidden')} aria-hidden>
        <span>{STATIONS[0].name}</span>
        <span>{STATIONS[STATIONS.length - 1].name}</span>
      </div>

      {allNames && (
        <div className="relative mx-[6px] mt-1.5 hidden h-10 text-xs md:block" aria-hidden>
          {pos.ticks.map((t, i) => {
            const first = i === 0
            const last = i === STATIONS.length - 1
            const current = i === pos.index
            return (
              <span
                key={STATIONS[i].name}
                className={cn(
                  'absolute whitespace-nowrap leading-none',
                  i % 2 ? 'top-[22px]' : 'top-0',
                  first ? '-translate-x-[6px]' : last ? '-translate-x-[calc(100%-6px)]' : '-translate-x-1/2',
                  current
                    ? cn('font-semibold', dark ? 'text-white' : 'text-ink')
                    : i < pos.index
                      ? dark
                        ? 'text-white/75'
                        : 'text-ink/75'
                      : dark
                        ? 'text-white/50'
                        : 'text-muted',
                )}
                style={{ left: `${t * 100}%` }}
              >
                {current && <span className="mr-1 inline-block h-1.5 w-1.5 -translate-y-px rounded-full bg-brand align-middle" />}
                {STATIONS[i].name}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
