import { Link } from 'react-router-dom'
import { Crown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { initials } from '@/lib/format'
import { CountUp } from '../CountUp'

/** Gold, silver, bronze: fixed metals, the same in both themes. */
export const MEDALS = [
  {
    disc: 'bg-gradient-to-br from-[#FFE9A8] to-[#E9BE45] text-[#5C4200]',
    ring: 'from-[#FFF1BF] via-[#E9BE45] to-[#B57B17]',
    tint: 'from-[#E9BE45]/30',
    edge: 'from-[#F6D36B] to-[#D9A23A]',
  },
  {
    disc: 'bg-gradient-to-br from-[#F4F6F8] to-[#C3CAD3] text-[#39424E]',
    ring: 'from-[#FFFFFF] via-[#C3CAD3] to-[#8D97A5]',
    tint: 'from-[#C3CAD3]/30',
    edge: 'from-[#EEF1F5] to-[#AEB7C3]',
  },
  {
    disc: 'bg-gradient-to-br from-[#F6D9C0] to-[#C98A55] text-[#4E2C0F]',
    ring: 'from-[#F6D9C0] via-[#C98A55] to-[#8E5528]',
    tint: 'from-[#C98A55]/30',
    edge: 'from-[#EDC39E] to-[#B7773F]',
  },
]

/** A place number on a medal disc (top 3) or a quiet plate. */
export function MedalDisc({ place, className }: { place: number; className?: string }) {
  return (
    <span
      className={cn(
        'digits grid h-6 w-6 shrink-0 place-items-center rounded-full text-sm font-bold leading-none',
        place <= 3 ? MEDALS[place - 1].disc : 'bg-ink/[.08] text-muted',
        className,
      )}
      aria-label={`${place}-е место`}
    >
      {place}
    </span>
  )
}

/** Initials inside a metal ring (the brand ring marks you). */
export function MedalAvatar({ name, place, me, size = 'md', className }: { name: string; place: number; me?: boolean; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span
      className={cn('block shrink-0 rounded-full bg-gradient-to-br p-[3px]', me ? 'from-[#FF8A5C] via-[#E21A1A] to-[#8E0F1A]' : MEDALS[place - 1].ring, className)}
      aria-hidden
    >
      <span
        className={cn(
          'grid place-items-center rounded-full bg-gradient-to-br from-surface-2 to-line font-display font-semibold text-ink ring-2 ring-surface',
          { sm: 'h-9 w-9 text-sm', md: 'h-11 w-11 text-base', lg: 'h-16 w-16 text-xl' }[size],
        )}
      >
        {initials(name) || '?'}
      </span>
    </span>
  )
}

export interface PodiumEntry {
  id: number
  full_name: string
  score: number
  is_me?: boolean
}

const PEDESTAL: Record<number, string> = { 1: 'h-[84px] sm:h-[96px]', 2: 'h-[60px] sm:h-[68px]', 3: 'h-[42px] sm:h-[48px]' }
const ORDER: Record<number, string> = { 1: 'order-2', 2: 'order-1', 3: 'order-3' }
// Kahoot-style: third rises first, the winner last; the people land after their step
const DELAY: Record<number, number> = { 3: 0, 2: 0.15, 1: 0.3 }

/**
 * Top three on steps: 2 · 1 · 3. The list is in place order for screen readers; CSS puts the
 * winner in the middle. A new occupant of a step drops in again.
 */
export function Podium({ entries, className }: { entries: PodiumEntry[]; className?: string }) {
  return (
    // the steps stand on a floor line
    <ol className={cn('grid grid-cols-3 items-end gap-2 border-b border-line sm:gap-3', className)} aria-label="Тройка лидеров">
      {[1, 2, 3].map((place) => {
        const e = entries[place - 1]
        return (
          <li key={place} className={cn('flex min-w-0 flex-col items-center text-center', ORDER[place])}>
            {e ? (
              <>
                <div key={e.id} className="podium-drop flex flex-col items-center" style={{ animationDelay: `${DELAY[place] + 0.4}s` }}>
                  {place === 1 && (
                    <Crown className="mb-1 h-6 w-6 fill-[#F2C04E] text-[#C8912A] drop-shadow-[0_2px_8px_rgb(233_190_69/.55)]" aria-hidden />
                  )}
                  <span className="relative">
                    <MedalAvatar name={e.full_name} place={place} me={e.is_me} size={place === 1 ? 'lg' : 'md'} />
                    <MedalDisc place={place} className="absolute -bottom-2 left-1/2 -translate-x-1/2 ring-2 ring-surface" />
                  </span>
                </div>
                <Link
                  to={e.is_me ? '/profile' : `/users/${e.id}`}
                  className="mt-3.5 line-clamp-2 w-full break-words text-[13px] font-medium leading-tight hover:underline sm:text-sm sm:leading-tight"
                >
                  {e.full_name}
                </Link>
                {e.is_me && <span className="text-xs font-semibold text-brand">это вы</span>}
                <CountUp value={e.score} className="digits mt-0.5 text-lg font-semibold leading-tight" />
              </>
            ) : (
              <>
                <span className="grid h-12 w-12 place-items-center rounded-full border-2 border-dashed border-line font-display text-lg text-muted" aria-hidden>
                  ?
                </span>
                <span className="mt-3.5 text-[13px] leading-tight text-muted sm:text-sm">Место свободно</span>
              </>
            )}
            <div
              className={cn('podium-rise relative mt-2 w-full overflow-hidden rounded-t-xl bg-gradient-to-b to-transparent', MEDALS[place - 1].tint, PEDESTAL[place])}
              style={{ animationDelay: `${DELAY[place]}s` }}
              aria-hidden
            >
              <span className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r', MEDALS[place - 1].edge)} />
              <span className="digits absolute inset-x-0 top-2 text-center text-[30px] font-bold leading-none text-ink/15 sm:text-[38px]">{place}</span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
