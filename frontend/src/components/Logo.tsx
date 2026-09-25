import { cn } from '@/lib/cn'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('h-8 w-8 shrink-0', className)} aria-hidden>
      <rect width="40" height="40" rx="9" fill="#1C2430" />
      <path d="M8 25 L21 10 H33 L20 25 Z" fill="#E21A1A" />
      <path d="M8 30.5 H32" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

export function Logo({ light = false, className, subtitle }: { light?: boolean; className?: string; subtitle?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark className={light ? 'rounded-[9px] ring-1 ring-white/25' : 'rounded-[9px] shadow-[0_4px_12px_-4px_rgb(10_16_30/.5)] dark:ring-1 dark:ring-white/15'} />
      {/* min-w-0 + truncate: in a tight header the subtitle gets an ellipsis instead of pushing the buttons off-screen */}
      <div className="min-w-0 leading-none">
        <div className={cn('truncate font-display text-lg font-semibold leading-none', light ? 'text-white' : 'text-ink')}>
          Магистраль 400
        </div>
        {subtitle && <div className={cn('mt-0.5 truncate text-xs', light ? 'text-white/70' : 'text-muted')}>{subtitle}</div>}
      </div>
    </div>
  )
}
