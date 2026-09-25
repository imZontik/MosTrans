import { Link } from 'react-router-dom'
import { ChevronRight, Trophy, Users } from 'lucide-react'
import type { CurrentTournament } from '@/api/types'
import { useCountdown } from '@/hooks/useServerClock'
import { cn } from '@/lib/cn'
import { fmtDuration } from '@/lib/format'
import { plural, PEOPLE, pluralN, QUESTIONS } from '@/lib/plural'
import { buttonClass } from './Button'
import { SpeedLines } from './NightPanel'

/**
 * Weekly tournament teaser on Home.
 * `strip` (phones, tablets): a night-line strip «Турнир недели идёт, осталось 5:57:02».
 * `card` (desktop dashboard): the countdown, participants and a link into the arena.
 */
export function TournamentBanner({ data, variant = 'strip', className }: { data: CurrentTournament; variant?: 'strip' | 'card'; className?: string }) {
  const t = data.tournament
  const live = t?.status === 'live'
  const remaining = useCountdown(t ? (live ? t.ends_at : t.starts_at) : null, t?.server_now, 1000)
  if (!t || t.status === 'finished') return null
  const joined = !!data.entry
  const lead = live ? 'Турнир недели идёт, осталось' : 'Турнир недели начнётся через'

  const trophy = (
    <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15" aria-hidden>
      <Trophy className="h-5 w-5 text-[#F2C94C]" />
      {live && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-brand ring-2 ring-night" />}
    </span>
  )

  if (variant === 'strip') {
    return (
      <Link
        to="/tournament"
        className={cn(
          'night-line-flat night-panel press relative flex min-h-[60px] items-center gap-3 overflow-hidden rounded-2xl px-3.5 py-3 transition-[filter,transform] hover:brightness-110',
          className,
        )}
      >
        {trophy}
        <span className="min-w-0 flex-1 leading-tight text-white/80">{lead}</span>
        <span className="digits shrink-0 text-xl font-semibold leading-none text-white">{fmtDuration(remaining ?? 0)}</span>
        <ChevronRight className="-mr-1 h-5 w-5 shrink-0 text-white/50" aria-hidden />
      </Link>
    )
  }

  return (
      <section
        aria-labelledby="home-t-title"
        className={cn('night-line night-panel relative isolate flex flex-col overflow-hidden rounded-sheet p-6', live && 'running-stripe', className)}
      >
        <SpeedLines rows={[24, 62]} />
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgb(242_201_76/.32),transparent_65%)]"
          aria-hidden
        />
        <div className="relative flex items-center gap-3">
          {trophy}
          <p className="flex items-center gap-2 text-sm font-semibold">
            {live ? (
              <>
                <span className="h-2 w-2 rounded-full bg-brand ring-4 ring-brand/25" aria-hidden />
                Идёт сейчас
              </>
            ) : (
              'Запланирован'
            )}
          </p>
        </div>
        <h2 id="home-t-title" className="relative mt-4 text-[26px] font-bold leading-[1.05]">
          {t.title}
        </h2>
        <p className="relative mt-1 text-white/65">{pluralN(t.questions_total, QUESTIONS)}, решают точность и скорость</p>

        <div className="relative mt-auto flex flex-wrap items-end justify-between gap-x-3 gap-y-2 pt-6">
          <div>
            <p className="text-xs text-white/60">{live ? 'До конца' : 'До старта'}</p>
            <p className="digits text-[40px] font-bold leading-none" role="timer">
              {fmtDuration(remaining ?? 0)}
            </p>
          </div>
          <p className="flex items-center gap-1.5 pb-1 text-white/70">
            <Users className="h-4 w-4" aria-hidden />
            <span className="digits text-lg font-semibold text-white">{t.participants}</span>
            {plural(t.participants, PEOPLE)}
          </p>
        </div>
        <Link to="/tournament" className={buttonClass(live && !joined ? 'primary' : 'light', 'md', 'relative mt-5 w-full')}>
          {live ? (joined ? 'Вернуться к турниру' : 'Открыть турнир') : 'Посмотреть правила'}
        </Link>
      </section>
  )
}
