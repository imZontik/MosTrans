import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Bell, LayoutDashboard, LogOut, PanelLeftClose, PanelLeftOpen, type LucideIcon } from 'lucide-react'
import { api } from '@/api/client'
import type { Me } from '@/api/types'
import { useAuth } from '@/auth/AuthContext'
import { useAsync } from '@/hooks/useAsync'
import { cn } from '@/lib/cn'
import { routePosition } from '@/lib/route'
import { useNotifications } from '@/notifications/NotificationsContext'
import { Logo, LogoMark } from './Logo'
import { Avatar } from './Avatar'
import { Progress } from './Progress'
import { ThemeCycleButton, ThemeSwitch } from './ThemeToggle'
import { NAV, TabBar } from './TabBar'


// Desktop sidebar: full (icons + words) or a 76px rail of icons; the choice is remembered per browser.
const COLLAPSED_KEY = 'm400-sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function writeCollapsed(v: boolean) {
  try {
    if (v) localStorage.setItem(COLLAPSED_KEY, '1')
    else localStorage.removeItem(COLLAPSED_KEY)
  } catch {
    /* storage blocked: the choice lives for this tab only */
  }
}

export function Layout() {
  const { user, isStaff, logout } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const tournament = useAsync(() => api.currentTournament(), [])
  const tournamentLive = tournament.data?.tournament?.status === 'live'
  const { unread } = useNotifications()

  const toggle = () =>
    setCollapsed((c) => {
      writeCollapsed(!c)
      return !c
    })

  return (
    <div className="min-h-screen lg:flex">
      {/* desktop sidebar */}
      <aside
        className={cn(
          'glass sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-line/70 px-3 py-5 transition-[width] duration-200 ease-out lg:flex',
          collapsed ? 'w-[76px]' : 'w-64',
        )}
      >
        <div className={cn('flex items-center', collapsed ? 'flex-col gap-2' : 'justify-between gap-2 pl-2')}>
          <Link to="/" aria-label="Магистраль 400, на главную" className="rounded-lg">
            {collapsed ? <LogoMark className="rounded-[9px] shadow-[0_4px_12px_-4px_rgb(10_16_30/.5)] dark:ring-1 dark:ring-white/15" /> : <Logo />}
          </Link>
          <button
            type="button"
            onClick={toggle}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-ink/[.06] hover:text-ink"
            aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" aria-hidden /> : <PanelLeftClose className="h-5 w-5" aria-hidden />}
          </button>
        </div>

        <nav className="mt-6 flex flex-col gap-1" aria-label="Разделы">
          {NAV.map((item) => (
            <SideLink key={item.to} {...item} collapsed={collapsed} live={item.to === '/tournament' && tournamentLive} />
          ))}
          <SideLink to="/notifications" label="Уведомления" icon={Bell} collapsed={collapsed} count={unread.total} urgent={unread.high > 0} />
          {isStaff && (
            <>
              <span className="mx-3 my-2 h-px bg-line/70" aria-hidden />
              <SideLink to="/admin" label="Панель руководителя" icon={LayoutDashboard} collapsed={collapsed} />
            </>
          )}
        </nav>

        {/* settings row: theme and sign-out */}
        <div className={cn('mt-auto flex items-center gap-1', collapsed ? 'flex-col' : 'px-1')}>
          {collapsed ? <ThemeCycleButton /> : <ThemeSwitch className="flex-1" />}
          <button
            type="button"
            onClick={logout}
            className="group relative grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-ink/[.06] hover:text-ink"
            aria-label="Выйти из аккаунта"
            title={collapsed ? undefined : 'Выйти'}
          >
            <LogOut className="h-[18px] w-[18px]" aria-hidden />
            {collapsed && <RailTip>Выйти</RailTip>}
          </button>
        </div>

        {user && <SideUser user={user} collapsed={collapsed} />}
      </aside>

      <div className="min-w-0 flex-1">
        {/* mobile header, scrolls away */}
        <header className="flex h-14 items-center justify-between gap-2 pl-4 pr-2 pt-[env(safe-area-inset-top)] box-content sm:pl-6 sm:pr-4 lg:hidden">
          <Logo />
          <div className="flex items-center gap-1">
            <BellLink count={unread.total} urgent={unread.high > 0} />
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

      {/* phones and tablets: the bottom bar */}
      <TabBar />
    </div>
  )
}

/** Hover / focus label for the collapsed rail. */
function RailTip({ children }: { children: string }) {
  return (
    <span
      className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-inverse opacity-0 shadow-lift transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      aria-hidden
    >
      {children}
    </span>
  )
}

function SideLink({
  to,
  label,
  icon: Icon,
  end,
  collapsed,
  live = false,
  count = 0,
  urgent = false,
}: {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  collapsed: boolean
  /** A red dot: something is happening there right now (the weekly tournament is live). */
  live?: boolean
  /** Unread notifications; red when some are important. */
  count?: number
  urgent?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'group relative flex min-h-[44px] items-center gap-3 rounded-xl transition-[color,background-color,box-shadow]',
          collapsed ? 'justify-center' : 'px-3',
          isActive ? 'bg-surface font-semibold text-ink shadow-card ring-1 ring-line/70' : 'text-muted hover:bg-ink/[.05] hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute -left-3 bottom-2.5 top-2.5 w-[3px] rounded-r-full bg-gradient-to-b from-[#FF5A3D] to-brand" aria-hidden />}
          <span className="relative shrink-0">
            <Icon className={cn('h-5 w-5', isActive && 'text-brand')} aria-hidden />
            {live && collapsed && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-bg" aria-hidden />}
          </span>
          <span className={collapsed ? 'sr-only' : 'min-w-0 flex-1'}>{label}</span>
          {live && !collapsed && <span className="h-2 w-2 shrink-0 rounded-full bg-brand ring-4 ring-brand/15" aria-hidden />}
          {live && <span className="sr-only">, идёт сейчас</span>}
          {count > 0 && <CountBadge count={count} urgent={urgent} floating={collapsed} />}
          {count > 0 && <span className="sr-only">, непрочитанных: {count}</span>}
          {collapsed && <RailTip>{live ? `${label} · идёт сейчас` : count ? `${label} · ${count}` : label}</RailTip>}
        </>
      )}
    </NavLink>
  )
}

function CountBadge({ count, urgent, floating }: { count: number; urgent: boolean; floating?: boolean }) {
  return (
    <span
      className={cn(
        'digits grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full px-1.5 text-[11px] font-semibold leading-none',
        urgent ? 'bg-brand text-white' : 'bg-ink text-inverse',
        floating && 'absolute right-2 top-1 ring-2 ring-bg',
      )}
      aria-hidden
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

/** The phone header bell: the inbox is one tap away, the tab bar keeps its five sections. */
function BellLink({ count, urgent }: { count: number; urgent: boolean }) {
  return (
    <NavLink
      to="/notifications"
      className={({ isActive }) => cn('relative grid h-11 w-11 place-items-center rounded-xl hover:bg-ink/[.06]', isActive ? 'text-brand' : 'text-ink')}
      aria-label={count ? `Уведомления, непрочитанных: ${count}` : 'Уведомления'}
    >
      <Bell className="h-[22px] w-[22px]" aria-hidden />
      {count > 0 && (
        <span
          className={cn(
            'digits absolute right-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-semibold leading-none ring-2 ring-bg',
            urgent ? 'bg-brand text-white' : 'bg-ink text-inverse',
          )}
          aria-hidden
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </NavLink>
  )
}

/** Who is signed in — the whole name, the level, how far to the next station. Opens the profile. */
function SideUser({ user, collapsed }: { user: Me; collapsed: boolean }) {
  const li = user.level_info
  const pos = routePosition(li.level, li.progress)

  if (collapsed) {
    return (
      <div className="mt-2 flex justify-center border-t border-line/70 pt-3">
        <Link to="/profile" className="group relative grid h-11 w-11 place-items-center rounded-xl" aria-label={`Профиль: ${user.full_name}`}>
          <Avatar name={user.full_name} size="sm" />
          <RailTip>{user.full_name}</RailTip>
        </Link>
      </div>
    )
  }

  return (
    <div className="mt-3 border-t border-line/70 pt-3">
      <Link
        to="/profile"
        className="block rounded-xl px-2 py-2 transition-colors hover:bg-ink/[.04]"
        aria-label={`Профиль: ${user.full_name}, ${li.title}`}
      >
        <div className="flex items-center gap-3">
          <Avatar name={user.full_name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="break-words font-medium leading-tight text-ink">{user.full_name}</p>
            <p className="mt-0.5 text-xs text-muted">{li.title}</p>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="min-w-0 text-muted">{pos.next ? `${pos.station.name} → ${pos.next.name}` : pos.station.name}</span>
            <span className="digits shrink-0 font-semibold text-ink">{pos.next ? `${Math.round(li.progress * 100)}%` : 'финиш'}</span>
          </div>
          <Progress value={pos.next ? li.progress : 1} className="mt-1.5" height="h-1" barClassName="bar-brand" />
        </div>
      </Link>
    </div>
  )
}
