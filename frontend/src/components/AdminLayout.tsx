import { Suspense } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Bot, FileText, Gauge, LogOut, Siren, Sparkles, Trophy, Users } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { cn } from '@/lib/cn'
import { Logo } from './Logo'
import { Avatar } from './Avatar'
import { Loading } from './States'

const NAV = [
  { to: '/admin', label: 'Дашборд', icon: Gauge, end: true },
  { to: '/admin/employees', label: 'Сотрудники', icon: Users },
  { to: '/admin/scenarios', label: 'Сценарии', icon: FileText, end: true },
  { to: '/admin/scenarios/generate', label: 'Генератор ИИ', icon: Sparkles },
  { to: '/admin/tournaments', label: 'Турниры', icon: Trophy },
  { to: '/admin/emergencies', label: 'Специвенты', icon: Siren },
  { to: '/admin/assistant', label: 'ИИ-ассистент', icon: Bot },
]

const ROLE_TITLE: Record<string, string> = { lead: 'Руководитель', admin: 'Администратор', employee: 'Сотрудник' }

export function AdminLayout() {
  const { user, logout } = useAuth()
  return (
    <div className="min-h-screen lg:flex">
      <aside className="night-line-flat sticky top-0 hidden h-screen w-60 shrink-0 flex-col px-3 py-6 lg:flex">
        <Logo light subtitle="Панель руководителя" className="px-3" />
        <nav className="mt-8 flex flex-col" aria-label="Разделы панели">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'relative flex min-h-[44px] items-center gap-3 rounded-lg px-3 transition-colors',
                  isActive ? 'bg-white/10 font-semibold text-white' : 'text-white/65 hover:bg-white/5 hover:text-white',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute bottom-2.5 left-0 top-2.5 w-[3px] rounded-full bg-brand" aria-hidden />}
                  <Icon className="h-5 w-5" aria-hidden />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-3 border-t border-white/15 px-3 pt-4">
          <NavLink to="/" className="flex min-h-[44px] items-center text-white/65 hover:text-white">
            Открыть приложение проводника
          </NavLink>
          {user && (
            <div className="flex items-center gap-3">
              <Avatar name={user.full_name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">{user.full_name}</p>
                <p className="truncate text-xs text-white/60">{ROLE_TITLE[user.role] ?? user.role}</p>
              </div>
              <button
                onClick={logout}
                className="grid h-11 w-11 place-items-center rounded-lg text-white/65 hover:bg-white/10 hover:text-white"
                aria-label="Выйти из аккаунта"
                title="Выйти"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="night-line-flat sticky top-0 z-30 pt-[env(safe-area-inset-top)] lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Logo light subtitle="Панель руководителя" />
            <div className="flex items-center">
              <NavLink to="/" className="flex min-h-[44px] items-center px-2 text-sm font-medium text-white underline decoration-white/40 underline-offset-4">
                Приложение
              </NavLink>
              <button onClick={logout} className="grid h-11 w-11 place-items-center rounded-lg text-white/70" aria-label="Выйти из аккаунта">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
          <nav className="scrollbar-none flex gap-1 overflow-x-auto px-2" aria-label="Разделы панели">
            {NAV.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'relative flex min-h-[44px] shrink-0 items-center whitespace-nowrap px-3 text-sm transition-colors',
                    isActive ? 'font-semibold text-white' : 'text-white/65',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {label}
                    {isActive && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-brand" aria-hidden />}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-5 sm:px-6 lg:px-10 lg:pt-10">
          <Suspense fallback={<Loading rows={4} />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
