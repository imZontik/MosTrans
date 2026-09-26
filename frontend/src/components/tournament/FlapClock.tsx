import { cn } from '@/lib/cn'

const pad = (n: number) => String(n).padStart(2, '0')

/** Split into board groups: days only when there are any, hours only when there are any. */
function groups(total: number): [string, string][] {
  const s = Math.max(0, Math.floor(total))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d > 0) return [[String(d), 'дн'], [pad(h), 'ч'], [pad(m), 'мин'], [pad(sec), 'с']]
  if (h > 0) return [[pad(h), 'ч'], [pad(m), 'мин'], [pad(sec), 'с']]
  return [[pad(m), 'мин'], [pad(sec), 'с']]
}

/** Human reading for assistive tech: «2 ч 23 мин». */
function spoken(total: number): string {
  return groups(total)
    .filter(([, unit]) => unit !== 'с' || total < 60)
    .map(([v, unit]) => `${Number(v)} ${unit}`)
    .join(' ')
}

/**
 * Countdown as a station departure board: each digit on its own split-flap tile, and a digit that
 * changes flips down into place. Units sit under the groups, so there are no colons to read.
 */
export function FlapClock({ seconds, className }: { seconds: number; className?: string }) {
  return (
    <div className={cn('flex items-start gap-2.5 sm:gap-3.5', className)} role="timer" aria-label={spoken(seconds)}>
      {groups(seconds).map(([value, unit]) => (
        <div key={unit} className="flex flex-col items-center" aria-hidden>
          <div className="flex gap-1">
            {value.split('').map((ch, i) => (
              <span
                key={i}
                className="relative grid h-12 w-8 place-items-center overflow-hidden rounded-lg bg-gradient-to-b from-white/[.16] to-white/[.05] shadow-[0_8px_16px_-8px_rgb(0_0_0/.7)] ring-1 ring-inset ring-white/10 min-[360px]:h-[54px] min-[360px]:w-9 sm:h-16 sm:w-[46px]"
              >
                <span key={ch} className="flap digits text-[32px] font-bold leading-none text-white min-[360px]:text-[36px] sm:text-[46px]">
                  {ch}
                </span>
                {/* the hinge between the two flaps */}
                <span className="absolute inset-x-0 top-1/2 h-px bg-black/45 shadow-[0_1px_0_rgb(255_255_255/.06)]" />
              </span>
            ))}
          </div>
          <span className="mt-1.5 text-[11px] font-medium uppercase tracking-[.08em] text-white/50">{unit}</span>
        </div>
      ))}
    </div>
  )
}
