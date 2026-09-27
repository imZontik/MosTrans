import { NavLink } from 'react-router-dom'
import { BarChart3, CalendarClock, Home, Trophy, User } from 'lucide-react'
import { cn } from '@/lib/cn'

export const NAV = [
  { to: '/', label: 'Главная', icon: Home, end: true },
  { to: '/scenarios', label: 'Сценарии', icon: CalendarClock },
  { to: '/tournament', label: 'Турнир', icon: Trophy },
  { to: '/leaderboard', label: 'Рейтинг', icon: BarChart3 },
  { to: '/profile', label: 'Профиль', icon: User },
]

/**
 * The phone's bottom bar: on every employee screen below lg, the run included. Five equal cells;
 * on the narrowest phones (<360px) the labels get smaller and the icons a touch tighter, so every
 * word fits instead of running off the edges.
 */
export function TabBar() {
  return (
    <nav className="glass pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line/60 shadow-dock lg:hidden" aria-label="Разделы">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'relative flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-0.5 pt-1 text-[10px] leading-tight transition-colors min-[300px]:text-[11px] min-[360px]:text-xs',
                isActive ? 'font-semibold text-ink' : 'text-muted hover:text-ink',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'mb-0.5 h-1 w-6 rounded-full transition-colors',
                    isActive ? 'bg-gradient-to-r from-[#FF5A3D] to-brand shadow-[0_2px_8px_rgb(226_26_26/.5)]' : 'bg-transparent',
                  )}
                  aria-hidden
                />
                <Icon className={cn('h-5 w-5 min-[360px]:h-[22px] min-[360px]:w-[22px]', isActive && 'text-brand')} strokeWidth={isActive ? 2.3 : 1.8} aria-hidden />
                <span className="max-w-full truncate">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
