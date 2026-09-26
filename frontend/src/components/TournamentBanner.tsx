import { Link } from 'react-router-dom'
import { ChevronRight, Trophy } from 'lucide-react'
import type { CurrentTournament } from '@/api/types'
import { useCountdown } from '@/hooks/useServerClock'
import { cn } from '@/lib/cn'
import { fmtDuration } from '@/lib/format'

/** Weekly tournament teaser on Home: a night-line strip «Турнир недели идёт, осталось 5:57:02» into the arena. */
export function TournamentBanner({ data, className }: { data: CurrentTournament; className?: string }) {
  const t = data.tournament
  const live = t?.status === 'live'
  const remaining = useCountdown(t ? (live ? t.ends_at : t.starts_at) : null, t?.server_now, 1000)
  if (!t || t.status === 'finished') return null
  const lead = live ? 'Турнир недели идёт, осталось' : 'Турнир недели начнётся через'

  return (
    <Link
      to="/tournament"
      className={cn(
        'night-line-flat night-panel press relative flex min-h-[60px] items-center gap-3 overflow-hidden rounded-2xl px-3.5 py-3 transition-[filter,transform] hover:brightness-110',
        className,
      )}
    >
      <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15" aria-hidden>
        <Trophy className="h-5 w-5 text-[#F2C94C]" />
        {live && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-brand ring-2 ring-night" />}
      </span>
      <span className="min-w-0 flex-1 leading-tight text-white/80">{lead}</span>
      <span className="digits shrink-0 text-xl font-semibold leading-none text-white">{fmtDuration(remaining ?? 0)}</span>
      <ChevronRight className="-mr-1 h-5 w-5 shrink-0 text-white/50" aria-hidden />
    </Link>
  )
}
