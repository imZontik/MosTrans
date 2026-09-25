import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BarChart3, CalendarClock, Home, LogOut, Trophy, User } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { cn } from '@/lib/cn'
import { Logo } from './Logo'
import { Avatar } from './Avatar'

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
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-6 lg:flex">
        <Logo className="px-3" />
        <nav className="mt-8 flex flex-col" aria-label="Разделы">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'relative flex min-h-[44px] items-center gap-3 rounded-lg px-3 transition-colors',
                  isActive ? 'font-semibold text-ink' : 'text-muted hover:bg-bg hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full bg-brand" aria-hidden />}
                  <Icon className="h-5 w-5" aria-hidden />
                  {label}
                </>
              )}
            </NavLink>
          ))}
          {isStaff && (
            <NavLink to="/admin" className="mt-4 flex min-h-[44px] items-center rounded-lg px-3 text-muted hover:bg-bg hover:text-ink">
              Панель руководителя
            </NavLink>
          )}
        </nav>
        {user && (
          <div className="mt-auto flex items-center gap-3 border-t border-line px-3 pt-4">
            <Avatar name={user.full_name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{user.full_name}</p>
              <p className="truncate text-xs text-muted">{user.level_title}</p>
            </div>
            <button
              onClick={logout}
              className="grid h-11 w-11 place-items-center rounded-lg text-muted hover:bg-bg hover:text-ink"
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
        <header className="flex h-14 items-center justify-between px-4 lg:hidden">
          <Logo />
          {isStaff && (
            <NavLink to="/admin" className="flex min-h-[44px] items-center text-sm font-medium text-ink underline decoration-line underline-offset-4">
              Панель руководителя
            </NavLink>
          )}
        </header>

        <main key={location.pathname} className="pb-tabbar mx-auto w-full max-w-3xl px-4 pt-2 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
          <Outlet />
        </main>
      </div>

      {/* mobile tab bar: frosted glass */}
      <nav
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-white/60 bg-white/80 shadow-[0_-6px_24px_-14px_rgb(28_36_48/.35)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
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
                  <span className={cn('mb-0.5 h-1 w-5 rounded-full transition-colors', isActive ? 'bg-brand' : 'bg-transparent')} aria-hidden />
                  <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.3 : 1.8} aria-hidden />
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
