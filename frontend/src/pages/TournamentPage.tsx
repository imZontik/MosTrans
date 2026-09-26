import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, CalendarClock, Check, Clock, Crown, Flag, History, ListChecks, Timer, Trophy, X, type LucideIcon } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import type {
  CurrentTournament,
  Tournament,
  TournamentAnswerResponse,
  TournamentEntry,
  TournamentLeaderboard,
  TournamentLeaderEntry,
  TournamentQuestion,
  TournamentWithWinners,
} from '@/api/types'
import { useAuth } from '@/auth/AuthContext'
import { useAsync } from '@/hooks/useAsync'
import { usePolling } from '@/hooks/usePolling'
import { useFlip } from '@/hooks/useFlip'
import { useCountdown } from '@/hooks/useServerClock'
import { Avatar } from '@/components/Avatar'
import { Button, ButtonLink } from '@/components/Button'
import { IconPlate, PageHeader, SectionTitle } from '@/components/Card'
import { CategoryTag } from '@/components/Category'
import { Confetti } from '@/components/Confetti'
import { CountUp } from '@/components/CountUp'
import { NightPanel, SpeedLines } from '@/components/NightPanel'
import { ScoreRing } from '@/components/ScoreRing'
import { EmptyState, ErrorState, Loading } from '@/components/States'
import { TimerLine, timerTone } from '@/components/Timer'
import { FlapClock } from '@/components/tournament/FlapClock'
import { MEDALS, MedalAvatar, MedalDisc, Podium } from '@/components/Podium'
import { TrophyArt } from '@/components/tournament/TrophyArt'
import { cn } from '@/lib/cn'
import { CATEGORY_TITLES, fmtDate, fmtDuration, fmtNumber, initials } from '@/lib/format'
import { plural, pluralN, PEOPLE, POINTS, points, QUESTIONS } from '@/lib/plural'

const DEFAULT_REWARDS: Tournament['rewards'] = { top_n: 10, top_bonus: 100, winner_extra: 50 }

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
const dayMonth = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })

/** «26 сент., 14:38–17:12», or both dates when it runs past midnight. */
function fmtWindow(start: string, end: string) {
  return new Date(start).toDateString() === new Date(end).toDateString()
    ? `${dayMonth(start)}, ${hhmm(start)}–${hhmm(end)}`
    : `${dayMonth(start)}, ${hhmm(start)} – ${dayMonth(end)}, ${hhmm(end)}`
}

/** ~15 s a question plus the reveal. */
const playMinutes = (questions: number) => Math.max(1, Math.round((questions * 18) / 60))

export default function TournamentPage() {
  const current = useAsync(() => api.currentTournament(), [])
  const past = useAsync(() => api.tournaments(), [])
  const [state, setState] = useState<CurrentTournament | null>(null)

  useEffect(() => {
    if (current.data) setState(current.data)
  }, [current.data])

  const t = state?.tournament ?? null
  // finished ones, without the tournament that is on the arena right now
  const history = (past.data ?? []).filter((x) => x.status === 'finished' && x.id !== t?.id)

  return (
    <div className="space-y-8">
      <PageHeader title="Турнир недели" subtitle="Все проводники отвечают на одни и те же вопросы. Решают точность и скорость." />

      {current.loading && !state ? (
        <Loading rows={2} />
      ) : current.error ? (
        <ErrorState message={current.error} onRetry={current.reload} />
      ) : !t ? (
        <div className="grid gap-6 xl:grid-cols-2 xl:items-start xl:gap-7">
          <div className="space-y-6">
            <EmptyState
              title="Турнир ещё не запланирован"
              text="Пока его нет, потренируйтесь на сценариях из расписания: турнирные вопросы по тем же темам."
            />
            <HowItWorks rewards={DEFAULT_REWARDS} />
          </div>
          <HallOfFame items={history} loading={past.loading} />
        </div>
      ) : (
        <TournamentArena state={state!} setState={setState} reload={current.reload} history={history} historyLoading={past.loading} />
      )}
    </div>
  )
}

function TournamentArena({
  state,
  setState,
  reload,
  history,
  historyLoading,
}: {
  state: CurrentTournament
  setState: (s: CurrentTournament) => void
  reload: () => Promise<void>
  history: TournamentWithWinners[]
  historyLoading: boolean
}) {
  const t = state.tournament!
  const { user } = useAuth()
  const [board, setBoard] = useState<TournamentLeaderboard | null>(null)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const live = t.status === 'live'
  const scheduled = t.status === 'scheduled'
  const countdown = useCountdown(live ? t.ends_at : scheduled ? t.starts_at : null, t.server_now, 1000)

  // Status flips (scheduled → live → finished) are server-side; refresh when the countdown ends.
  const flipped = useRef(false)
  useEffect(() => {
    flipped.current = false
  }, [t.status])
  useEffect(() => {
    if (countdown === 0 && !flipped.current) {
      flipped.current = true
      window.setTimeout(reload, 1200)
    }
  }, [countdown, reload])

  // live: every 3 s; after the finish the standings only change once, when the results are in
  usePolling(async () => setBoard(await api.tournamentLeaderboard(t.id)), live ? 3000 : 30_000, !scheduled)

  const join = async () => {
    setJoining(true)
    setError(null)
    try {
      const res = await api.joinTournament(t.id)
      setState({ ...state, entry: res.entry, question: res.question })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось присоединиться')
    } finally {
      setJoining(false)
    }
  }

  const entry = state.entry
  const playing = !!(live && entry && !entry.finished && state.question)
  const place = entry?.place ?? board?.my_rank ?? null

  return (
    // two columns only where the hero's board and the podium both have room (xl, or wider with the rail)
    <div className="space-y-6 xl:grid xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,1fr)] xl:grid-rows-[auto_1fr] xl:items-start xl:gap-7 xl:space-y-0">
      <div className="space-y-6 xl:col-start-1 xl:row-start-1">
        {playing ? (
          <>
            <LiveStrip t={t} remaining={countdown ?? 0} />
            <Quiz
              tournamentId={t.id}
              question={state.question!}
              score={entry!.score}
              rank={board?.my_rank ?? null}
              onProgress={(res) => setState({ ...state, entry: res.entry, question: res.question })}
              onResync={setState}
            />
          </>
        ) : (
          <Hero t={t} countdown={countdown} board={board} entry={entry} joining={joining} error={error} onJoin={join} />
        )}

        {entry && !playing && (entry.finished || !live) && (
          <MyResult t={t} entry={entry} place={place} participants={board?.participants ?? t.participants} board={board} />
        )}
      </div>

      <div className="xl:col-start-2 xl:row-span-2 xl:row-start-1">
        {scheduled ? (
          <LastChampions item={history[0]} startsAt={t.starts_at} meId={user?.id} />
        ) : (
          <LiveBoard t={t} board={board} playing={playing} meName={user?.full_name ?? ''} myScore={entry?.score ?? null} />
        )}
      </div>

      <div className="space-y-6 xl:col-start-1 xl:row-start-2">
        <HowItWorks rewards={t.rewards} />
        {/* before the start the last champions stand on the right already */}
        <HallOfFame items={scheduled ? history.slice(1) : history} loading={historyLoading} meId={user?.id} hideEmpty={scheduled} />
      </div>
    </div>
  )
}

// --- hero --------------------------------------------------------------------

function Hero({
  t,
  countdown,
  board,
  entry,
  joining,
  error,
  onJoin,
}: {
  t: Tournament
  countdown: number | null
  board: TournamentLeaderboard | null
  entry: TournamentEntry | null
  joining: boolean
  error: string | null
  onJoin: () => void
}) {
  const live = t.status === 'live'
  const finished = t.status === 'finished'
  const participants = board?.participants ?? t.participants
  const minutes = playMinutes(t.questions_total)

  return (
    <NightPanel aria-labelledby="t-title" stripe={live} className="-mx-2 px-5 pb-6 pt-5 sm:mx-0 sm:px-7 sm:pb-7 sm:pt-6">
      <SpeedLines rows={[18, 64]} />
      {/* the cup in a warm pool of light */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgb(242_201_76/.3),transparent_66%)] sm:-right-4 sm:-top-6 sm:h-60 sm:w-60"
        aria-hidden
      />
      <TrophyArt className="absolute right-3 top-4 h-[84px] w-[84px] drop-shadow-[0_12px_18px_rgba(0,0,0,.5)] sm:right-7 sm:top-6 sm:h-[128px] sm:w-[128px]" />

      <StatusChip status={t.status} />
      <h2 id="t-title" className="relative mt-3 max-w-[calc(100%-92px)] text-2xl font-bold leading-[1.05] sm:max-w-[calc(100%-150px)] lg:text-[40px]">
        {t.title}
      </h2>
      <p className="relative mt-2 text-white/70 sm:max-w-[calc(100%-150px)]">
        {fmtWindow(t.starts_at, t.ends_at)} · {pluralN(t.questions_total, QUESTIONS)}
      </p>

      {!finished && countdown !== null && (
        <div className="relative mt-6">
          <p className="mb-2 text-sm text-white/65">{live ? 'До финиша' : 'До старта'}</p>
          <FlapClock seconds={countdown} />
        </div>
      )}
      {live && countdown !== null && <WindowTrack t={t} remaining={countdown} />}
      {finished && <Champion leader={board?.entries[0]} finalized={t.finalized} />}

      <div className="relative mt-6 flex flex-wrap items-center gap-x-6 gap-y-4">
        {live && !entry && (
          <Button size="lg" className="w-full sm:w-auto sm:min-w-[260px]" loading={joining} onClick={onJoin}>
            Участвовать в турнире
          </Button>
        )}
        {t.status === 'scheduled' && (
          <ButtonLink to="/scenarios" variant="light" size="lg" className="w-full sm:w-auto">
            Размяться на сценариях
          </ButtonLink>
        )}
        {participants > 0 && <Crowd names={(board?.entries ?? []).map((e) => e.full_name)} count={participants} />}
      </div>
      {live && !entry && (
        <p className="relative mt-3 text-sm text-white/60">
          Займёт около {minutes} мин. Вопросы идут подряд, таймер вопроса не останавливается.
        </p>
      )}
      {t.status === 'scheduled' && <p className="relative mt-3 text-sm text-white/60">Турнирные вопросы по тем же темам, что и сценарии.</p>}
      {error && (
        <p className="relative mt-3 rounded-lg bg-white px-3 py-2 text-[#B80F1F]" role="alert">
          {error}
        </p>
      )}
    </NightPanel>
  )
}

function StatusChip({ status }: { status: Tournament['status'] }) {
  return (
    <p className="relative inline-flex items-center gap-2 rounded-full bg-white/10 py-1 pl-2.5 pr-3 text-sm font-semibold ring-1 ring-inset ring-white/15">
      {status === 'live' ? (
        <>
          <LiveDot />
          Идёт сейчас
        </>
      ) : status === 'scheduled' ? (
        <>
          <CalendarClock className="h-4 w-4 text-white/70" aria-hidden />
          Скоро старт
        </>
      ) : (
        <>
          <Flag className="h-4 w-4 text-white/70" aria-hidden />
          Завершён
        </>
      )}
    </p>
  )
}

function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn('relative flex h-2.5 w-2.5 shrink-0', className)} aria-hidden>
      <span className="absolute inset-0 animate-ping rounded-full bg-[#FF4D4D]" />
      <span className="relative h-2.5 w-2.5 rounded-full bg-[#FF4D4D]" />
    </span>
  )
}

/** How much of the tournament window has passed: start and finish times at the ends. */
function WindowTrack({ t, remaining }: { t: Tournament; remaining: number }) {
  const total = (new Date(t.ends_at).getTime() - new Date(t.starts_at).getTime()) / 1000
  const done = total > 0 ? Math.min(1, Math.max(0, 1 - remaining / total)) : 0
  return (
    <div className="relative mt-5 max-w-[360px]" aria-hidden>
      <div className="relative h-1.5 rounded-full bg-white/10">
        <div className="bar-brand absolute inset-y-0 left-0 rounded-full" style={{ width: `${done * 100}%` }} />
        <span
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_4px_rgb(226_26_26/.35),0_0_14px_2px_rgb(255_106_61/.7)]"
          style={{ left: `${done * 100}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-white/55">
        <span>Старт {hhmm(t.starts_at)}</span>
        <span>Финиш {hhmm(t.ends_at)}</span>
      </div>
    </div>
  )
}

/** After the finish the hero names the winner. */
function Champion({ leader, finalized }: { leader: TournamentLeaderEntry | undefined; finalized: boolean }) {
  if (!leader) return null
  return (
    <div className="relative mt-6 flex max-w-md items-center gap-3.5 rounded-2xl bg-white/[.06] py-3 pl-3.5 pr-4 ring-1 ring-inset ring-white/10">
      <span className="relative mt-2 shrink-0">
        <Crown className="absolute -top-4 left-1/2 h-5 w-5 -translate-x-1/2 fill-[#F2C04E] text-[#C8912A]" aria-hidden />
        <span className={cn('grid h-12 w-12 place-items-center rounded-full font-display text-lg font-semibold', MEDALS[0].disc)} aria-hidden>
          {initials(leader.full_name)}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-[.08em] text-white/55">{finalized ? 'Победитель' : 'Лидер'}</p>
        <p className="line-clamp-2 font-semibold leading-tight">
          {leader.full_name}
          {leader.is_me && <span className="font-normal text-white/60">, вы</span>}
        </p>
      </div>
      <p className="digits shrink-0 text-2xl font-bold leading-none">{fmtNumber(leader.score)}</p>
    </div>
  )
}

/** Who is already in: a few faces and the count. */
function Crowd({ names, count }: { names: string[]; count: number }) {
  return (
    <div className="flex items-center gap-3">
      {names.length > 0 && (
        <div className="flex -space-x-1.5" aria-hidden>
          {names.slice(0, 4).map((name, i) => (
            <span
              key={i}
              className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-white to-[#C9D1DD] font-display text-[13px] font-semibold text-night ring-2 ring-[#15203a]"
            >
              {initials(name)}
            </span>
          ))}
        </div>
      )}
      <p className="text-sm leading-tight text-white/65">
        <span className="digits block text-lg font-semibold leading-tight text-white">{count}</span>
        {plural(count, PEOPLE)}
      </p>
    </div>
  )
}

/** While answering, the big panel steps back to a strip with the clock. */
function LiveStrip({ t, remaining }: { t: Tournament; remaining: number }) {
  return (
    <NightPanel flat className="flex items-center gap-3 px-4 py-3 sm:px-5" aria-label={t.title}>
      <LiveDot />
      <p className="min-w-0 flex-1 truncate font-semibold">{t.title}</p>
      <p className="shrink-0 text-sm text-white/60">до финиша</p>
      <p className="digits shrink-0 text-lg font-semibold leading-none">{fmtDuration(remaining)}</p>
    </NightPanel>
  )
}

// --- quiz --------------------------------------------------------------------

const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е']
const ADVANCE_MS = 1800
const TIMER_TEXT = { ok: 'text-ink', warn: 'text-warn-ink', bad: 'text-bad' } as const
const TIMER_STROKE = { ok: 'stroke-ok', warn: 'stroke-warn', bad: 'stroke-brand' } as const

function Quiz({
  tournamentId,
  question,
  score,
  rank,
  onProgress,
  onResync,
}: {
  tournamentId: number
  question: TournamentQuestion
  score: number
  rank: number | null
  onProgress: (res: TournamentAnswerResponse) => void
  onResync: (cur: CurrentTournament) => void
}) {
  const [shown, setShown] = useState(question)
  const [picked, setPicked] = useState<number | null>(null)
  const [reveal, setReveal] = useState<TournamentAnswerResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const remaining = useCountdown(reveal ? null : shown.deadline, shown.server_now)
  const sent = useRef<number | null>(null)
  const pendingNext = useRef<TournamentAnswerResponse | null>(null)

  const advance = useCallback(() => {
    const res = pendingNext.current
    if (!res) return
    pendingNext.current = null
    setReveal(null)
    setPicked(null)
    if (res.question) setShown(res.question)
    onProgress(res)
  }, [onProgress])

  const submit = useCallback(
    async (option: number | null) => {
      if (busy || sent.current === shown.index) return
      sent.current = shown.index
      setBusy(true)
      setPicked(option)
      try {
        const res = await api.tournamentAnswer(tournamentId, shown.index, option)
        pendingNext.current = res
        setReveal(res)
        window.setTimeout(advance, ADVANCE_MS)
      } catch (e) {
        // Out of sync — re-fetch the authoritative state.
        const cur = await api.currentTournament().catch(() => null)
        if (cur) onResync(cur)
        if (cur?.question) setShown(cur.question)
        if (e instanceof ApiError && e.status === 0) sent.current = null
        setPicked(null)
      } finally {
        setBusy(false)
      }
    },
    [busy, shown.index, tournamentId, advance, onResync],
  )

  useEffect(() => {
    if (remaining === 0 && !reveal) submit(null)
  }, [remaining, reveal, submit])

  // keys 1–4 answer, Enter moves on
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) return
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (reveal) {
        if (e.key === 'Enter') {
          e.preventDefault()
          advance()
        }
        return
      }
      const n = Number(e.key)
      if (Number.isInteger(n) && n >= 1 && n <= shown.options.length) {
        e.preventDefault()
        submit(n - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reveal, shown.options.length, submit, advance])

  const speedBonus = reveal?.correct ? reveal.points - 100 : 0
  const cat = shown.category ? CATEGORY_TITLES[shown.category] : null
  const left = reveal ? 0 : remaining ?? shown.timer
  const liveScore = reveal?.entry.score ?? score
  const liveRank = reveal?.rank ?? rank

  return (
    <section className="card overflow-hidden rounded-sheet" aria-label="Вопрос турнира">
      <TimerLine remaining={left} total={shown.timer} />
      <div className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="text-muted">
                Вопрос <span className="digits text-lg font-semibold text-ink">{shown.index + 1}</span> из {shown.total}
              </p>
              {cat && <CategoryTag category={shown.category!} title={cat.title} />}
            </div>
            <Steps index={shown.index} total={shown.total} className="mt-2.5 max-w-[260px]" />
            <p className="mt-2 text-sm text-muted">
              Счёт <span className="digits font-semibold text-ink">{fmtNumber(liveScore)}</span>
              {liveRank ? `, ${liveRank}-е место` : ''}
            </p>
          </div>
          {!reveal && <RingTimer remaining={left} total={shown.timer} />}
        </div>

        <h3 key={shown.index} className="tip-in mt-4 font-sans text-base font-semibold leading-snug sm:text-lg">
          {shown.text}
        </h3>
        <div className="mt-4 grid gap-2.5 xl:grid-cols-2">
          {shown.options.map((opt, i) => {
            const isCorrect = reveal && i === reveal.correct_option
            const isWrongPick = reveal && picked === i && !reveal.correct
            return (
              <button
                key={i}
                data-testid="t-option"
                disabled={busy || !!reveal}
                onClick={() => submit(i)}
                className={cn(
                  'press group flex min-h-[56px] w-full items-center gap-3 rounded-xl border py-2.5 pl-2.5 pr-4 text-left leading-snug transition-[color,background-color,border-color,box-shadow,opacity,transform]',
                  isCorrect
                    ? 'border-ok bg-ok-soft text-ink shadow-[0_0_0_3px_rgb(var(--ok)/.15)]'
                    : isWrongPick
                      ? 'border-brand bg-brand-soft text-ink shadow-[0_0_0_3px_rgb(var(--brand)/.15)]'
                      : picked === i
                        ? 'btn-ink border-transparent'
                        : 'border-line bg-surface shadow-card hover:border-ink/40 hover:bg-surface-2',
                  reveal && !isCorrect && !isWrongPick && 'opacity-40',
                )}
              >
                <span
                  className={cn(
                    'grid h-8 w-8 shrink-0 place-items-center rounded-lg font-display text-base font-semibold transition-colors',
                    isCorrect
                      ? 'bg-ok text-white'
                      : isWrongPick
                        ? 'bg-brand text-white'
                        : picked === i
                          ? 'bg-inverse/15 text-inverse'
                          : 'bg-ink/[.06] text-muted group-hover:bg-ink/10 group-hover:text-ink',
                  )}
                  aria-hidden
                >
                  {LETTERS[i]}
                </span>
                <span className="flex-1">{opt}</span>
                {isCorrect && <Check className="h-5 w-5 shrink-0 text-ok" aria-label="Верный ответ" />}
                {isWrongPick && <X className="h-5 w-5 shrink-0 text-brand" aria-label="Ваш ответ неверный" />}
              </button>
            )
          })}
        </div>
        {!reveal && (
          <p className="mt-3 hidden text-xs text-muted [@media(hover:hover)_and_(pointer:fine)]:block">
            Можно отвечать клавишами 1–{shown.options.length}
          </p>
        )}
      </div>
      {reveal && (
        <div className="border-t border-line bg-ink/[.02] px-4 py-4 sm:px-6" role="status">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={cn('flex items-center gap-2 text-base font-semibold', reveal.correct ? 'text-ok' : 'text-brand')}>
              {reveal.correct ? <Check className="h-5 w-5" aria-hidden /> : <X className="h-5 w-5" aria-hidden />}
              {reveal.correct ? 'Верно' : reveal.timed_out ? 'Время вышло' : 'Неверно'}
            </p>
            <p className="flex items-baseline">
              <span className="points-pop digits text-2xl font-bold leading-none">+{reveal.points}</span>
              {speedBonus > 0 && <span className="ml-2 text-sm text-muted">из них {speedBonus} за скорость</span>}
            </p>
          </div>
          {reveal.explanation && <p className="mt-1.5 text-muted">{reveal.explanation}</p>}
          {/* it moves on by itself: the button fills up like «next episode» */}
          <Button variant="secondary" block className="relative mt-3 overflow-hidden" onClick={advance}>
            <span className="advance-fill absolute inset-0 origin-left bg-ink/[.07]" style={{ animationDuration: `${ADVANCE_MS}ms` }} aria-hidden />
            <span className="relative">{reveal.question ? 'Следующий вопрос' : 'Показать результат'}</span>
          </Button>
        </div>
      )}
    </section>
  )
}

/** One segment per question: done, current, ahead. */
function Steps({ index, total, className }: { index: number; total: number; className?: string }) {
  return (
    <div className={cn('flex gap-1', className)} aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < index ? 'bg-ink/35' : i === index ? 'bar-brand' : 'bg-ink/10')} />
      ))}
    </div>
  )
}

/** Seconds left inside a ring that runs down with them, green → yellow → red. */
function RingTimer({ remaining, total }: { remaining: number; total: number }) {
  const r = 22
  const c = 2 * Math.PI * r
  const share = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0
  const tone = timerTone(remaining, total)
  return (
    <div className="relative grid h-14 w-14 shrink-0 place-items-center" role="timer" aria-label={`Осталось ${Math.ceil(remaining)} секунд`}>
      <svg viewBox="0 0 52 52" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="26" cy="26" r={r} fill="none" strokeWidth="4" className="stroke-ink/10" />
        <circle
          cx="26"
          cy="26"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - share)}
          className={cn(TIMER_STROKE[tone], 'transition-[stroke-dashoffset,stroke] duration-100 ease-linear')}
        />
      </svg>
      <span className={cn('digits text-xl font-semibold leading-none', TIMER_TEXT[tone])} aria-hidden>
        {Math.ceil(remaining)}
      </span>
    </div>
  )
}

// --- your result --------------------------------------------------------------

function MyResult({
  t,
  entry,
  place,
  participants,
  board,
}: {
  t: Tournament
  entry: TournamentEntry
  place: number | null
  participants: number
  board: TournamentLeaderboard | null
}) {
  const live = t.status === 'live'
  const { top_n: top, top_bonus: bonus, winner_extra: extra } = t.rewards
  const medal = place && place <= 3 ? MEDALS[place - 1] : null
  const cutoff = board?.entries.find((e) => e.rank === top)?.score

  // a little celebration the first time you see yourself on the podium
  const [cheer, setCheer] = useState(false)
  useEffect(() => {
    if (!t.finalized || !place || place > 3) return
    const key = `m400-tournament-cheer-${t.id}`
    try {
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
    } catch {
      /* no storage: cheer anyway */
    }
    setCheer(true)
  }, [t.id, t.finalized, place])

  let outcome: { icon: LucideIcon; text: ReactNode; tone: 'gold' | 'ok' | 'muted' }
  if (live) outcome = { icon: Clock, text: `Место может измениться до финиша в ${hhmm(t.ends_at)}. Награды начислят после.`, tone: 'muted' }
  else if (!t.finalized || !place) outcome = { icon: Clock, text: 'Итоги подводятся, награды начислят автоматически.', tone: 'muted' }
  else if (place === 1) outcome = { icon: Crown, text: `Победа! +${points(bonus + extra)} в рейтинг, трофей недели и корона.`, tone: 'gold' }
  else if (place <= top) outcome = { icon: Trophy, text: `Топ-${top}: +${points(bonus)} в рейтинг и трофей недели.`, tone: 'ok' }
  else
    outcome = {
      icon: Flag,
      text: cutoff !== undefined && cutoff >= entry.score ? `До топ-${top} не хватило ${points(cutoff - entry.score + 1)}.` : `Награды получает топ-${top}.`,
      tone: 'muted',
    }
  const Icon = outcome.icon

  return (
    <section className="card relative isolate overflow-hidden p-5 sm:p-6" aria-labelledby="my-result">
      {cheer && <Confetti />}
      {medal && (
        <div className={cn('pointer-events-none absolute -left-16 -top-20 -z-10 h-56 w-56 rounded-full bg-gradient-to-br to-transparent opacity-60 blur-2xl', medal.tint)} aria-hidden />
      )}
      <h2 id="my-result" className="text-lg font-semibold">
        {live ? 'Вы сыграли' : 'Ваш результат'}
      </h2>
      <div className="mt-4 flex items-center gap-4 sm:gap-5">
        <div
          className={cn(
            'grid h-[68px] w-[68px] shrink-0 place-items-center rounded-2xl text-center shadow-card',
            medal ? medal.disc : 'bg-ink/[.06] text-ink ring-1 ring-inset ring-line',
          )}
        >
          <span className="leading-none">
            <span className="digits block text-[30px] font-bold leading-none">{place ?? '—'}</span>
            <span className="text-[11px] font-medium uppercase tracking-[.06em] opacity-70">место</span>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="leading-none">
            <CountUp value={entry.score} className="digits text-[40px] font-bold leading-none sm:text-3xl" />{' '}
            <span className="text-muted">{plural(entry.score, POINTS)}</span>
          </p>
          <p className="mt-2 text-muted">{place ? `из ${pluralN(participants, PEOPLE)}` : 'Место уточняется'}</p>
        </div>
        <div className="hidden flex-col items-center min-[360px]:flex">
          <ScoreRing
            value={entry.total ? entry.correct / entry.total : 0}
            tone="ok"
            size={64}
            stroke={6}
            label={`Верно ${entry.correct} из ${entry.total}`}
          >
            <span className="digits text-lg font-semibold leading-none">
              {entry.correct}
              <span className="text-sm text-muted">/{entry.total}</span>
            </span>
          </ScoreRing>
          <span className="mt-1 text-xs text-muted">верно</span>
        </div>
      </div>
      <p
        className={cn(
          'mt-4 flex items-start gap-2.5 rounded-xl px-3.5 py-3',
          outcome.tone === 'gold'
            ? 'bg-rarity-legendary-soft font-medium text-rarity-legendary-ink'
            : outcome.tone === 'ok'
              ? 'bg-ok-soft font-medium text-ink'
              : 'bg-ink/[.04] text-muted',
        )}
      >
        <Icon className={cn('mt-0.5 h-[18px] w-[18px] shrink-0', outcome.tone === 'ok' && 'text-ok')} aria-hidden />
        {outcome.text}
      </p>
    </section>
  )
}

// --- leaderboard ---------------------------------------------------------------

/**
 * Rows slide to their new place when the standings change (FLIP), and the ones that moved
 * show ▲/▼ for a few seconds. Your own row is left out of the slide: it is sticky.
 */
function useRankMotion(entries: TournamentLeaderEntry[]) {
  const register = useFlip<number>(entries, (id) => !!entries.find((e) => e.id === id)?.is_me)
  const ranks = useRef(new Map<number, number>())
  const [moves, setMoves] = useState<Record<number, number>>({})

  useEffect(() => {
    const moved: Record<number, number> = {}
    for (const e of entries) {
      const was = ranks.current.get(e.id)
      if (was !== undefined && was !== e.rank) moved[e.id] = was - e.rank
      ranks.current.set(e.id, e.rank)
    }
    if (Object.keys(moved).length) setMoves(moved)
  }, [entries])

  useEffect(() => {
    if (!Object.keys(moves).length) return
    const id = window.setTimeout(() => setMoves({}), 4000)
    return () => window.clearTimeout(id)
  }, [moves])

  return { register, moves }
}

function LiveBoard({
  t,
  board,
  playing,
  meName,
  myScore,
}: {
  t: Tournament
  board: TournamentLeaderboard | null
  /** answering right now: your row tells how far the next place is */
  playing: boolean
  meName: string
  myScore: number | null
}) {
  const live = t.status === 'live'
  const top = t.rewards.top_n
  const entries = board?.entries ?? []
  const rest = entries.slice(3)
  const { register, moves } = useRankMotion(entries)
  const myRank = board?.my_rank ?? null
  const outside = myRank !== null && myRank > entries.length && myScore !== null

  const gapUp = (e: TournamentLeaderEntry) => {
    const above = entries.find((x) => x.rank === e.rank - 1)
    return above ? `до ${above.rank}-го места ${points(above.score - e.score + 1)}` : null
  }

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="board-title">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id="board-title" className="flex min-w-0 items-center gap-2.5 text-lg font-semibold">
          <IconPlate icon={Trophy} tint="bg-rarity-legendary-soft" tone="text-rarity-legendary-ink" />
          Таблица лидеров
        </h2>
        {live ? (
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
            <LiveDot className="h-2 w-2 [&>span]:h-2 [&>span]:w-2" />в эфире
          </span>
        ) : (
          <span className="shrink-0 text-xs text-muted">{t.finalized ? 'Итоги' : 'Подводим итоги'}</span>
        )}
      </div>

      {!board ? (
        <Loading rows={3} />
      ) : entries.length === 0 ? (
        <>
          <Podium entries={[]} />
          <p className="mt-4 text-center text-muted">Пока никто не ответил. Ответьте первым, и ваше имя окажется наверху.</p>
        </>
      ) : (
        <>
          <Podium entries={entries.slice(0, 3)} />
          {(rest.length > 0 || outside) && (
            <ol className="relative mt-4 space-y-1" aria-label="Остальные места" start={4}>
              {rest.map((e) => {
                const move = moves[e.id]
                const gap = e.is_me && playing ? gapUp(e) : null
                return (
                  <Fragment key={e.id}>
                    <li
                      ref={register(e.id)}
                      className={cn(
                        'flex min-h-[52px] items-center gap-3 rounded-xl px-2.5 py-1.5',
                        e.is_me
                          ? 'sticky bottom-[calc(66px+env(safe-area-inset-bottom))] top-2 z-10 bg-brand-soft shadow-lift ring-1 ring-inset ring-brand/30 lg:bottom-4'
                          : 'transition-colors hover:bg-ink/[.03]',
                      )}
                    >
                      <span className={cn('digits w-7 shrink-0 text-center text-lg font-semibold', e.is_me ? 'text-brand' : 'text-muted')}>{e.rank}</span>
                      <Avatar name={e.full_name} size="xs" className="hidden min-[360px]:grid" />
                      <div className="min-w-0 flex-1">
                        <Link to={e.is_me ? '/profile' : `/users/${e.id}`} className={cn('block truncate hover:underline', e.is_me ? 'font-semibold' : 'font-medium')}>
                          {e.full_name}
                          {e.is_me && <span className="font-normal text-muted">, вы</span>}
                        </Link>
                        {gap && <p className="text-xs text-muted">{gap}</p>}
                      </div>
                      {move ? <MoveBadge delta={move} /> : null}
                      <span className="digits text-lg font-semibold">{fmtNumber(e.score)}</span>
                    </li>
                    {e.rank === top && entries.length > top && <PrizeLine top={top} bonus={t.rewards.top_bonus} />}
                  </Fragment>
                )
              })}
              {outside && (
                <li className="sticky bottom-[calc(66px+env(safe-area-inset-bottom))] z-10 flex min-h-[52px] items-center gap-3 rounded-xl bg-brand-soft px-2.5 py-1.5 shadow-lift ring-1 ring-inset ring-brand/30 lg:bottom-4">
                  <span className="digits w-7 shrink-0 text-center text-lg font-semibold text-brand">{myRank}</span>
                  <Avatar name={meName} size="xs" className="hidden min-[360px]:grid" />
                  <Link to="/profile" className="min-w-0 flex-1 truncate font-semibold hover:underline">
                    {meName}
                    <span className="font-normal text-muted">, вы</span>
                  </Link>
                  <span className="digits text-lg font-semibold">{fmtNumber(myScore)}</span>
                </li>
              )}
            </ol>
          )}
        </>
      )}
      {board && <p className="mt-4 text-xs text-muted">Всего {pluralN(board.participants, PEOPLE)}</p>}
    </section>
  )
}

/** Duolingo-style line under the prize places. */
function PrizeLine({ top, bonus }: { top: number; bonus: number }) {
  return (
    <li className="flex items-center gap-2 py-1.5 text-xs font-semibold text-ok" aria-hidden>
      <span className="h-px flex-1 bg-ok/40" />
      <ArrowUp className="h-3.5 w-3.5" />
      Топ-{top}: трофей и +{bonus}
      <span className="h-px flex-1 bg-ok/40" />
    </li>
  )
}

function MoveBadge({ delta }: { delta: number }) {
  const up = delta > 0
  return (
    <span className={cn('tip-in inline-flex shrink-0 items-center text-xs font-semibold', up ? 'text-ok' : 'text-brand')} aria-label={up ? `Поднялся на ${delta}` : `Опустился на ${-delta}`}>
      {up ? <ArrowUp className="h-3.5 w-3.5" aria-hidden /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden />}
      {Math.abs(delta)}
    </span>
  )
}

/** Before the start: last week's podium stands where the live board will be. */
function LastChampions({ item, startsAt, meId }: { item: TournamentWithWinners | undefined; startsAt: string; meId: number | undefined }) {
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="champions-title">
      <div className="mb-5 flex items-center gap-2.5">
        <IconPlate icon={Crown} tint="bg-rarity-legendary-soft" tone="text-rarity-legendary-ink" />
        <div className="min-w-0">
          <h2 id="champions-title" className="text-lg font-semibold leading-tight">
            {item ? 'Чемпионы прошлого турнира' : 'Подиум ждёт'}
          </h2>
          {item && (
            <p className="truncate text-xs text-muted">
              {item.title}, {fmtDate(item.starts_at)}
            </p>
          )}
        </div>
      </div>
      <Podium entries={(item?.winners ?? []).map((w) => ({ ...w, is_me: w.id === meId }))} />
      <p className="mt-5 flex items-start gap-2.5 rounded-xl bg-ink/[.04] px-3.5 py-3 text-muted">
        <CalendarClock className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden />
        Живая таблица лидеров появится со стартом, {dayMonth(startsAt)} в {hhmm(startsAt)}.
      </p>
    </section>
  )
}

// --- rules and history -----------------------------------------------------------

function HowItWorks({ rewards }: { rewards: Tournament['rewards'] }) {
  return (
    <section className="rules card p-5 sm:p-6" aria-labelledby="rules-title">
      <SectionTitle id="rules-title" icon={ListChecks} tint="bg-cat-safety-soft" tone="text-cat-safety">
        Как устроен турнир
      </SectionTitle>
      <ul className="rules-grid grid gap-3">
        <RuleTile icon={Timer} tint="bg-cat-safety-soft" tone="text-cat-safety" title="≈15 секунд на вопрос">
          100 очков за верный ответ и до 50 сверху за скорость.
          <span className="mt-3 block" aria-hidden>
            <span className="block h-1.5 rounded-full bg-gradient-to-r from-ok to-ok/20" />
            <span className="mt-1 flex justify-between text-xs">
              <span>сразу 150</span>
              <span>в конце 100</span>
            </span>
          </span>
        </RuleTile>
        <RuleTile icon={Trophy} tint="bg-rarity-legendary-soft" tone="text-rarity-legendary-ink" title={`Топ-${rewards.top_n} недели`}>
          Трофей турнира и ещё {points(rewards.top_bonus)} в рейтинг.
        </RuleTile>
        <RuleTile icon={Crown} tint="bg-rarity-legendary-soft" tone="text-rarity-legendary-ink" title="Победитель">
          Сверху {points(rewards.winner_extra)} и корона на неделю.
        </RuleTile>
      </ul>
    </section>
  )
}

function RuleTile({ icon, tint, tone, title, children }: { icon: LucideIcon; tint: string; tone: string; title: string; children: ReactNode }) {
  return (
    <li className="rules-tile tile-sheen flex gap-3 rounded-xl bg-ink/[.025] p-4 ring-1 ring-inset ring-line/70">
      <IconPlate icon={icon} tint={tint} tone={tone} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug">{title}</p>
        <p className="mt-1 text-sm text-muted">{children}</p>
      </div>
    </li>
  )
}

const HISTORY_FOLDED = 3

function HallOfFame({ items, loading, meId, hideEmpty = false }: { items: TournamentWithWinners[]; loading: boolean; meId?: number; hideEmpty?: boolean }) {
  const [all, setAll] = useState(false)
  if (!loading && !items.length && hideEmpty) return null
  const shown = all ? items : items.slice(0, HISTORY_FOLDED)

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="past-title">
      <SectionTitle id="past-title" icon={History} tint="bg-rarity-legendary-soft" tone="text-rarity-legendary-ink">
        Прошлые турниры
      </SectionTitle>
      {loading ? (
        <Loading rows={2} />
      ) : !items.length ? (
        <p className="text-muted">Итоги прошедших турниров появятся здесь после первого турнира.</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((t) => (
            <PastTournament key={t.id} t={t} meId={meId} />
          ))}
        </ul>
      )}
      {items.length > HISTORY_FOLDED && (
        <Button variant="ghost" size="sm" block className="mt-3 text-muted" onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? 'Свернуть' : `Показать все (${items.length})`}
        </Button>
      )}
    </section>
  )
}

function PastTournament({ t, meId }: { t: TournamentWithWinners; meId?: number }) {
  const [champ, ...others] = t.winners
  return (
    <li className="rounded-xl bg-ink/[.025] p-3.5 ring-1 ring-inset ring-line/70 sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="min-w-0 truncate font-medium">{t.title}</p>
        <p className="shrink-0 text-xs text-muted">
          {fmtDate(t.starts_at)}, {pluralN(t.participants, PEOPLE)}
        </p>
      </div>
      {champ ? (
        <>
          <Link to={champ.id === meId ? '/profile' : `/users/${champ.id}`} className="group mt-3 flex items-center gap-3">
            <span className="relative mt-1.5 shrink-0">
              <Crown className="absolute -top-3.5 left-1/2 h-4 w-4 -translate-x-1/2 fill-[#F2C04E] text-[#C8912A]" aria-hidden />
              <MedalAvatar name={champ.full_name} place={1} me={champ.id === meId} size="sm" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold group-hover:underline">
                {champ.full_name}
                {champ.id === meId && <span className="font-normal text-muted">, вы</span>}
              </span>
              <span className="text-xs text-muted">победитель</span>
            </span>
            <span className="digits text-lg font-semibold">{fmtNumber(champ.score)}</span>
          </Link>
          {others.length > 0 && (
            <ol className="mt-2.5 grid gap-x-5 gap-y-1 border-t border-line/70 pt-2.5 sm:grid-cols-2">
              {others.map((w, i) => (
                <li key={w.id} className="flex min-w-0 items-center gap-2 text-sm">
                  <MedalDisc place={i + 2} className="h-5 w-5 text-xs" />
                  <Link to={w.id === meId ? '/profile' : `/users/${w.id}`} className="min-w-0 flex-1 truncate hover:underline coarse:leading-[44px]">
                    {w.full_name}
                    {w.id === meId && <span className="text-muted">, вы</span>}
                  </Link>
                  <span className="digits font-semibold">{fmtNumber(w.score)}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      ) : (
        <p className="mt-1 text-muted">Итоги подводятся</p>
      )}
    </li>
  )
}
