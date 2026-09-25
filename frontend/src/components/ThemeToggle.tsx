import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useTheme, type ThemePref } from '@/theme/ThemeContext'

const OPTIONS: { value: ThemePref; label: string; icon: LucideIcon }[] = [
  { value: 'system', label: 'Системная', icon: Monitor },
  { value: 'light', label: 'Светлая', icon: Sun },
  { value: 'dark', label: 'Тёмная', icon: Moon },
]

/**
 * Three-way theme switch. `labels` shows the words next to the icons (profile page);
 * without it the words go to the tooltip and assistive tech (sidebars).
 * `night` is the variant for the dark admin sidebar.
 */
export function ThemeSwitch({ labels = false, night = false, className }: { labels?: boolean; night?: boolean; className?: string }) {
  const { pref, setPref } = useTheme()
  return (
    <div
      role="radiogroup"
      aria-label="Оформление"
      className={cn(
        'grid grid-cols-3 gap-0.5 rounded-xl p-1',
        night ? 'bg-white/[.06] ring-1 ring-white/10' : 'bg-ink/[.05] ring-1 ring-line/70',
        className,
      )}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const on = pref === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={labels ? undefined : label}
            title={label}
            onClick={() => setPref(value)}
            className={cn(
              'flex min-h-[40px] coarse:min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-[color,background-color,box-shadow]',
              // narrow phones: icon above the word so «Системная» fits
              labels && 'min-h-[48px] flex-col gap-0.5 py-1 min-[400px]:flex-row min-[400px]:gap-1.5',
              night
                ? on
                  ? 'bg-white/[.14] text-white shadow-[inset_0_1px_0_rgb(255_255_255/.12)]'
                  : 'text-white/60 hover:text-white'
                : on
                  ? 'bg-surface text-ink shadow-card'
                  : 'text-muted hover:text-ink',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {labels && <span className="truncate">{label}</span>}
          </button>
        )
      })}
    </div>
  )
}

const NEXT: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' }
const TITLE: Record<ThemePref, string> = { system: 'Системная', light: 'Светлая', dark: 'Тёмная' }

/** Icon button for tight headers: cycles Системная → Светлая → Тёмная. */
export function ThemeCycleButton({ className, night = false }: { className?: string; night?: boolean }) {
  const { pref, setPref } = useTheme()
  const Icon = OPTIONS.find((o) => o.value === pref)!.icon
  return (
    <button
      type="button"
      onClick={() => setPref(NEXT[pref])}
      className={cn(
        'grid h-11 w-11 place-items-center rounded-xl transition-colors',
        night ? 'text-white/75 hover:bg-white/10 hover:text-white' : 'text-muted hover:bg-ink/[.06] hover:text-ink',
        className,
      )}
      aria-label={`Оформление: ${TITLE[pref].toLowerCase()}. Переключить на «${TITLE[NEXT[pref]]}»`}
      title={`Оформление: ${TITLE[pref].toLowerCase()}`}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  )
}
