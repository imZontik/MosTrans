import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'dark' | 'secondary' | 'ghost' | 'danger' | 'light'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark',
  dark: 'bg-ink text-white hover:bg-ink/90',
  secondary: 'bg-surface text-ink border border-line hover:border-ink',
  ghost: 'text-ink hover:bg-ink/5',
  danger: 'bg-surface text-brand border border-brand/40 hover:border-brand',
  light: 'bg-white text-ink hover:bg-white/90',
}
const SIZES: Record<Size, string> = {
  sm: 'min-h-[40px] px-3.5 text-sm gap-1.5',
  md: 'min-h-[44px] px-5 text-sm gap-2',
  lg: 'min-h-[52px] px-6 text-base gap-2',
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra?: string) {
  return cn(
    'inline-flex select-none items-center justify-center rounded-xl font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    extra,
  )
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  block?: boolean
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', loading, icon, block, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, size, cn(block && 'w-full', className))}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  )
})

export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  icon,
  className,
  children,
}: {
  to: string
  variant?: Variant
  size?: Size
  icon?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Link to={to} className={buttonClass(variant, size, className)}>
      {icon}
      {children}
    </Link>
  )
}
