import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BarChart3, CalendarClock, Home, LogOut, Trophy, User } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { cn } from '@/lib/cn'
import { Logo } from './Logo'
import { Avatar } from './Avatar'
import { ThemeCycleButton, ThemeSwitch } from './ThemeToggle'

const NAV = [
  { to: '/', label: 'Главная', icon: Home, end: true },
  { to: '/scenarios', label: 'Сценарии', icon: CalendarClock },
  { to: '/tournament', label: 'Турнир', icon: Trophy },
  { to: '/leaderboard', label: 'Рейтинг', icon: BarChart3 },
  { to: '/profile', label: 'Профиль', icon: User },
]

export function Layout() {
  const { user, isStaff, logout } = useAuth()
  const location = useLocation()

  return (
    <div className="min-h-screen lg:flex">
      {/* desktop sidebar */}
      <aside className="glass sticky top-0 z-30 hidden h-screen w-64 shrink-0 flex-col border-r border-line/70 px-3 py-6 lg:flex">
        <Logo className="px-3" />
        <nav className="mt-8 flex flex-col" aria-label="Разделы">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'relative flex min-h-[44px] items-center gap-3 rounded-xl px-3 transition-[color,background-color,box-shadow]',
                  isActive ? 'bg-surface font-semibold text-ink shadow-card ring-1 ring-line/70' : 'text-muted hover:bg-ink/[.05] hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute -left-3 bottom-2.5 top-2.5 w-[3px] rounded-r-full bg-gradient-to-b from-[#FF5A3D] to-brand" aria-hidden />}
                  <Icon className={cn('h-5 w-5', isActive && 'text-brand')} aria-hidden />
                  {label}
                </>
              )}
            </NavLink>
          ))}
          {isStaff && (
            <NavLink to="/admin" className="mt-4 flex min-h-[44px] items-center rounded-xl px-3 text-muted hover:bg-ink/[.05] hover:text-ink">
              Панель руководителя
            </NavLink>
          )}
        </nav>
        <div className="mt-auto px-1">
          <ThemeSwitch />
        </div>
        {user && (
          <div className="mt-4 flex items-center gap-3 border-t border-line/70 px-2 pt-4">
            <Avatar name={user.full_name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{user.full_name}</p>
              <p className="truncate text-xs text-muted">{user.level_title}</p>
            </div>
            <button
              onClick={logout}
              className="grid h-11 w-11 place-items-center rounded-xl text-muted hover:bg-ink/[.06] hover:text-ink"
              aria-label="Выйти из аккаунта"
              title="Выйти"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </aside>

      <div className="min-w-0 flex-1">
        {/* mobile header, scrolls away */}
        <header className="flex h-14 items-center justify-between gap-2 pl-4 pr-2 pt-[env(safe-area-inset-top)] box-content sm:pl-6 sm:pr-4 lg:hidden">
          <Logo />
          <div className="flex items-center gap-1">
            {isStaff && (
              <NavLink to="/admin" className="flex min-h-[44px] items-center px-2 text-sm font-medium text-ink underline decoration-line underline-offset-4">
                Панель руководителя
              </NavLink>
            )}
            <ThemeCycleButton />
          </div>
        </header>

        <main key={location.pathname} className="pb-tabbar mx-auto w-full max-w-[1360px] px-4 pt-2 sm:px-6 lg:px-10 lg:pb-14 lg:pt-9 2xl:px-14">
          <Outlet />
        </main>
      </div>

      {/* mobile tab bar: frosted glass */}
      <nav
        className="glass pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line/60 shadow-dock lg:hidden"
        aria-label="Разделы"
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'relative flex min-h-[58px] flex-col items-center justify-center gap-0.5 pt-1 text-xs transition-colors',
                  isActive ? 'font-semibold text-ink' : 'text-muted hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn('mb-0.5 h-1 w-6 rounded-full transition-colors', isActive ? 'bg-gradient-to-r from-[#FF5A3D] to-brand shadow-[0_2px_8px_rgb(226_26_26/.5)]' : 'bg-transparent')}
                    aria-hidden
                  />
                  <Icon className={cn('h-[22px] w-[22px]', isActive && 'text-brand')} strokeWidth={isActive ? 2.3 : 1.8} aria-hidden />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
