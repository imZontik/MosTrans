import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

/** «‹ Профиль» above a page that opened from another one. */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="-ml-2 mb-2 inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted transition-colors hover:bg-ink/[.05] hover:text-ink coarse:min-h-[44px]"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden />
      {children}
    </Link>
  )
}
