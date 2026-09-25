import { cn } from '@/lib/cn'
import { initials } from '@/lib/format'

const BOXES = {
  xs: 'h-7 w-7',
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
  lg: 'h-16 w-16',
  xl: 'h-20 w-20',
}
const INITIALS_TEXT = { xs: 'text-xs', sm: 'text-sm', md: 'text-base', lg: 'text-xl', xl: 'text-2xl' }
const EMOJI_TEXT = { xs: 'text-sm', sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl', xl: 'text-5xl' }
type Size = keyof typeof BOXES

/** Initials on a neutral plate. `onDark` puts them in a ring for the night-line panels. */
export function Avatar({ name, size = 'md', onDark = false, className }: { name: string; size?: Size; onDark?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-display font-semibold',
        onDark
          ? 'bg-gradient-to-br from-white to-[#C9D1DD] text-night ring-2 ring-brand ring-offset-[3px] ring-offset-night'
          : 'bg-gradient-to-br from-surface-2 to-line text-ink ring-1 ring-inset ring-ink/[.06]',
        BOXES[size],
        INITIALS_TEXT[size],
        className,
      )}
      aria-hidden
    >
      {initials(name) || '?'}
    </div>
  )
}

/** Emoji avatar used by scenario characters. */
export function EmojiAvatar({ emoji, size = 'md', className }: { emoji: string | null | undefined; size?: Size; className?: string }) {
  return (
    <div className={cn('grid shrink-0 place-items-center rounded-full border border-line bg-surface', BOXES[size], EMOJI_TEXT[size], className)} aria-hidden>
      <span className="leading-none">{emoji || '🎙️'}</span>
    </div>
  )
}
