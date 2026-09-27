import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { ArrowRight, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * The way into the lead's panel for staff, in the conductor's app. Phones: a card of its own at the top
 * of the home screen (and in the profile), one big tap, instead of a pill squeezed into the header.
 */
export function PanelCard({ className }: { className?: string }) {
  return (
    <Link
      to="/admin"
      className={cn('card group flex items-center gap-3 p-3 transition-shadow hover:shadow-lift min-[360px]:gap-3.5 min-[360px]:p-3.5 min-[360px]:pr-4', className)}
    >
      <span
        className="night-line-flat grid h-11 w-11 shrink-0 place-items-center rounded-[14px] min-[360px]:h-12 min-[360px]:w-12 text-white shadow-[0_8px_18px_-8px_rgb(10_16_30/.7)] ring-1 ring-inset ring-white/10"
        aria-hidden
      >
        <LayoutDashboard className="h-[22px] w-[22px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-tight min-[360px]:text-base">Панель руководителя</span>
        <span className="mt-0.5 block truncate text-sm text-muted max-[359px]:hidden">Команда и аналитика</span>
      </span>
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-b min-[360px]:h-10 min-[360px]:w-10 from-[#FF5A3D] to-[#C8101E] text-white shadow-brand-glow transition-transform group-hover:translate-x-0.5 group-active:scale-95"
        aria-hidden
      >
        <ArrowRight className="h-[18px] w-[18px]" />
      </span>
    </Link>
  )
}

/** Desktop sidebar: a night-line card over the settings; the collapsed rail gets its icon with a tip. */
export function PanelSideCard({ collapsed, tip }: { collapsed: boolean; tip: ReactNode }) {
  if (collapsed) {
    return (
      <NavLink
        to="/admin"
        aria-label="Панель руководителя"
        className="night-line-flat group relative mx-auto grid h-11 w-11 place-items-center rounded-xl text-white shadow-[0_6px_14px_-8px_rgb(10_16_30/.8)] ring-1 ring-inset ring-white/10"
      >
        <LayoutDashboard className="h-5 w-5" aria-hidden />
        {tip}
      </NavLink>
    )
  }
  return (
    <NavLink
      to="/admin"
      className="night-line-flat group flex items-center gap-2.5 rounded-2xl p-2.5 text-white shadow-[0_10px_24px_-14px_rgb(10_16_30/.9)] ring-1 ring-inset ring-white/10 transition-shadow hover:shadow-[0_14px_28px_-12px_rgb(10_16_30/.9)]"
    >
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-[#FF5A3D] to-[#C8101E] shadow-[0_6px_14px_-6px_rgb(226_26_26/.8)] transition-transform group-hover:scale-105"
        aria-hidden
      >
        <LayoutDashboard className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate text-sm font-semibold">Панель руководителя</span>
        <span className="block truncate text-xs text-white/60">Команда и аналитика</span>
      </span>
    </NavLink>
  )
}
