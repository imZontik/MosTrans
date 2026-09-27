import { Suspense, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Bot, ChevronRight, CircleHelp, FileText, Gauge, LayoutGrid, LogOut, Megaphone, Siren, Smartphone, Sparkles, Trophy, Users, X, type LucideIcon } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { cn } from '@/lib/cn'
import { Logo } from './Logo'
import { Avatar } from './Avatar'
import { PageSkeleton } from './Skeleton'
import { ThemeSwitch } from './ThemeToggle'
import { openTour, TourHost } from './onboarding/Tours'

const NAV = [
  { to: '/admin', label: 'Дашборд', icon: Gauge, end: true },
  { to: '/admin/employees', label: 'Сотрудники', icon: Users },
  { to: '/admin/scenarios', label: 'Сценарии', icon: FileText, end: true },
  { to: '/admin/scenarios/generate', label: 'Генератор ИИ', icon: Sparkles },
  { to: '/admin/tournaments', label: 'Турниры', icon: Trophy },
  { to: '/admin/emergencies', label: 'Специвенты', icon: Siren },
  { to: '/admin/broadcasts', label: 'Рассылки', icon: Megaphone },
  { to: '/admin/assistant', label: 'ИИ-ассистент', icon: Bot },
]

const ROLE_TITLE: Record<string, string> = { lead: 'Руководитель', admin: 'Администратор', employee: 'Сотрудник' }

export function AdminLayout() {
  const { user, logout } = useAuth()
  return (
    <div className="min-h-screen lg:flex">
      <aside className="night-line-flat sticky top-0 hidden h-screen w-64 shrink-0 flex-col px-3 py-6 shadow-[1px_0_0_rgb(255_255_255/.06)] lg:flex">
        <Logo light subtitle="Панель руководителя" className="px-3" />
        <nav className="mt-8 flex flex-col" aria-label="Разделы панели">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'relative flex min-h-[44px] items-center gap-3 rounded-xl px-3 transition-colors',
                  isActive ? 'bg-white/[.1] font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/.08)]' : 'text-white/65 hover:bg-white/5 hover:text-white',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute -left-3 bottom-2.5 top-2.5 w-[3px] rounded-r-full bg-gradient-to-b from-[#FF5A3D] to-brand" aria-hidden />}
                  <Icon className="h-5 w-5" aria-hidden />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => openTour('lead')}
          className="mt-auto flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm text-white/65 transition-colors hover:bg-white/5 hover:text-white"
        >
          <CircleHelp className="h-5 w-5" aria-hidden />
          Как устроена панель
        </button>
        <div className="mt-2 px-1">
          <ThemeSwitch night />
        </div>
        <div className="mt-4 space-y-3 border-t border-white/15 px-3 pt-4">
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
        {/* phones and tablets: a slim header; the sections live in the bottom bar */}
        <header className="night-line-flat sticky top-0 z-30 pt-[env(safe-area-inset-top)] lg:hidden">
          <div className="flex h-14 items-center justify-between gap-2 pl-4 pr-2 sm:pr-3">
            <Logo light subtitle="Панель руководителя" className="min-w-0" />
            {/* the way back to the conductor's app: a white pill, the twin of «Панель» over there */}
            <NavLink to="/" className="group flex h-11 shrink-0 items-center px-0.5" aria-label="Открыть приложение проводника">
              <span className="flex h-9 items-center gap-1.5 rounded-full bg-white px-2.5 text-sm font-semibold text-[#1C2430] shadow-[0_6px_16px_-8px_rgb(0_0_0/.6)] transition-transform group-active:scale-95 min-[360px]:pr-3.5">
                <Smartphone className="h-4 w-4 text-[#E21A1A]" aria-hidden />
                <span className="max-[359px]:sr-only" aria-hidden>
                  Проводник
                </span>
              </span>
            </NavLink>
          </div>
        </header>
        <main className="pb-tabbar mx-auto w-full max-w-[1400px] px-4 pt-5 sm:px-6 lg:px-10 lg:pb-16 lg:pt-9 2xl:px-14">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <AdminTabBar />
      <TourHost kind="lead" />
    </div>
  )
}

// --- phones and tablets: the bottom bar and the «Ещё» sheet ------------------------------

// the four sections a lead opens most; the rest go under «Ещё»
const MAIN = ['/admin', '/admin/employees', '/admin/scenarios', '/admin/broadcasts']
const MORE = NAV.filter((n) => !MAIN.includes(n.to))

function AdminTabBar() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const inMore = MORE.some((n) => pathname.startsWith(n.to))

  // a new page closes the sheet
  useEffect(() => setOpen(false), [pathname])

  return (
    <>
      <nav className="glass pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line/60 shadow-dock lg:hidden" aria-label="Разделы панели">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {NAV.filter((n) => MAIN.includes(n.to)).map(({ to, label, icon, end }) => {
            // the editor lives under /admin/scenarios/… too; the generator belongs to «Ещё»
            const match = to === '/admin/scenarios' ? pathname.startsWith(to) && !inMore : end ? pathname === to : pathname.startsWith(to)
            return (
              <NavLink key={to} to={to} end={end} className={tabClass(match)} aria-current={match ? 'page' : undefined}>
                <TabInner icon={icon} label={label} active={match} />
              </NavLink>
            )
          })}
          <button type="button" onClick={() => setOpen(true)} className={tabClass(inMore || open)} aria-haspopup="dialog" aria-expanded={open}>
            <TabInner icon={LayoutGrid} label="Ещё" active={inMore || open} />
          </button>
        </div>
      </nav>
      <MoreSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}

const tabClass = (active: boolean) =>
  cn(
    'relative flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-0.5 pt-1 text-[10px] leading-tight transition-colors min-[300px]:text-[11px] min-[360px]:text-xs',
    active ? 'font-semibold text-ink' : 'text-muted hover:text-ink',
  )

function TabInner({ icon: Icon, label, active }: { icon: LucideIcon; label: string; active: boolean }) {
  return (
    <>
      <span
        className={cn(
          'mb-0.5 h-1 w-6 rounded-full transition-colors',
          active ? 'bg-gradient-to-r from-[#FF5A3D] to-brand shadow-[0_2px_8px_rgb(226_26_26/.5)]' : 'bg-transparent',
        )}
        aria-hidden
      />
      <Icon className={cn('h-5 w-5 min-[360px]:h-[22px] min-[360px]:w-[22px]', active && 'text-brand')} strokeWidth={active ? 2.3 : 1.8} aria-hidden />
      <span className="max-w-full truncate">{label}</span>
    </>
  )
}

/** The rest of the panel in a sheet from the bottom: sections as tiles, the theme, the conductor app, the account. */
function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const sheet = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    sheet.current?.focus()
    // the page under the sheet stays put
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [open, onClose])

  return (
    // closed: hidden once it has slid away (visibility waits for the slide), so it can't peek on overscroll
    <div
      className={cn('fixed inset-0 z-50 transition-[visibility] duration-300 lg:hidden', open ? 'visible' : 'pointer-events-none invisible')}
      aria-hidden={!open}
    >
      <div
        className={cn('absolute inset-0 bg-[#05080f]/55 backdrop-blur-[2px] transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0')}
        onClick={onClose}
      />
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-label="Все разделы"
        tabIndex={-1}
        className={cn(
          'pb-safe absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-[28px] border border-b-0 border-line/70 bg-surface shadow-dock outline-none transition-transform duration-300 ease-[cubic-bezier(.3,.9,.3,1)] dark:bg-surface-2',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-ink/15" aria-hidden />
        <div className="flex items-center justify-between px-5 pb-2 pt-2">
          <p className="text-lg font-semibold">Все разделы</p>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 grid h-11 w-11 place-items-center rounded-xl text-muted transition-colors hover:bg-ink/[.06] hover:text-ink"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <nav className="grid grid-cols-2 gap-2 px-4" aria-label="Другие разделы">
          {MORE.map(({ to, label, icon: Icon }) => {
            const active = pathname.startsWith(to)
            return (
              <NavLink
                key={to}
                to={to}
                className={cn(
                  'flex min-h-[64px] items-center gap-3 rounded-2xl px-3.5 ring-1 ring-inset transition-colors',
                  active ? 'bg-brand-soft font-semibold ring-brand/30' : 'bg-ink/[.035] ring-line/70 hover:bg-ink/[.06]',
                )}
              >
                <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', active ? 'bg-brand text-white' : 'bg-ink/[.06] text-ink')} aria-hidden>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 text-sm leading-tight">{label}</span>
              </NavLink>
            )
          })}
        </nav>
        <div className="mx-4 mt-4 space-y-3 border-t border-line/70 pb-4 pt-4">
          <button
            type="button"
            onClick={() => {
              onClose()
              openTour('lead')
            }}
            className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl bg-brand-soft px-3.5 text-left ring-1 ring-inset ring-brand/20 transition-colors hover:bg-brand-soft/70"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand text-white" aria-hidden>
              <CircleHelp className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold leading-tight">Как устроена панель</span>
              <span className="block text-xs text-muted">Короткий тур, 6 шагов</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
          </button>
          <ThemeSwitch labels />
          <NavLink to="/" className="flex min-h-[48px] items-center gap-3 rounded-xl px-1 font-medium text-ink transition-colors hover:bg-ink/[.04]">
            <Smartphone className="h-5 w-5 text-muted" aria-hidden />
            Открыть приложение проводника
          </NavLink>
          {user && (
            <div className="flex items-center gap-3 rounded-2xl bg-ink/[.035] p-3 ring-1 ring-inset ring-line/60">
              <Avatar name={user.full_name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{user.full_name}</p>
                <p className="truncate text-xs text-muted">{ROLE_TITLE[user.role] ?? user.role}</p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-muted transition-colors hover:bg-ink/[.06] hover:text-ink"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Выйти
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
