import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import type {
  CurrentTournament,
  TournamentAnswerResponse,
  TournamentLeaderboard,
  TournamentQuestion,
  TournamentWithWinners,
} from '@/api/types'
import { useAsync } from '@/hooks/useAsync'
import { usePolling } from '@/hooks/usePolling'
import { useCountdown } from '@/hooks/useServerClock'
import { Button } from '@/components/Button'
import { PageHeader, SectionTitle } from '@/components/Card'
import { TimerDigits, TimerLine } from '@/components/Timer'
import { EmptyState, ErrorState, Loading } from '@/components/States'
import { cn } from '@/lib/cn'
import { CATEGORY_TITLES, fmtDate, fmtDuration } from '@/lib/format'
import { plural, pluralN, PEOPLE, points, QUESTIONS } from '@/lib/plural'
import { NightPanel, SpeedLines } from '@/components/NightPanel'

export default function TournamentPage() {
  const current = useAsync(() => api.currentTournament(), [])
  const past = useAsync(() => api.tournaments(), [])
  const [state, setState] = useState<CurrentTournament | null>(null)

  useEffect(() => {
    if (current.data) setState(current.data)
  }, [current.data])

  const t = state?.tournament ?? null

  return (
    <div className="space-y-8">
      <PageHeader title="Турнир недели" subtitle="Все проводники отвечают на одни и те же вопросы. Решают точность и скорость." />

      {current.loading && !state ? (
        <Loading rows={2} />
      ) : current.error ? (
        <ErrorState message={current.error} onRetry={current.reload} />
      ) : !t ? (
        <EmptyState
          title="Турнир ещё не запланирован"
          text="Пока его нет, потренируйтесь на сценариях из расписания: турнирные вопросы по тем же темам."
        />
      ) : (
        <TournamentArena state={state!} setState={setState} reload={current.reload} />
      )}

      <Rules />

      <section>
        <SectionTitle>Прошлые турниры</SectionTitle>
        {past.loading ? (
          <Loading rows={2} />
        ) : (
          <PastTournaments items={(past.data ?? []).filter((x) => x.status === 'finished')} />
        )}
      </section>
    </div>
  )
}

function TournamentArena({
  state,
  setState,
  reload,
}: {
  state: CurrentTournament
  setState: (s: CurrentTournament) => void
  reload: () => Promise<void>
}) {
  const t = state.tournament!
  const [board, setBoard] = useState<TournamentLeaderboard | null>(null)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const live = t.status === 'live'
  const countdown = useCountdown(live ? t.ends_at : t.status === 'scheduled' ? t.starts_at : null, t.server_now, 1000)

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

  usePolling(
    async () => setBoard(await api.tournamentLeaderboard(t.id)),
    3000,
    t.status !== 'scheduled',
  )

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

  const inQuiz = live && state.entry && !state.entry.finished && state.question
  const place = state.entry?.place ?? board?.my_rank

  return (
    <div className="space-y-8 lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-8 lg:space-y-0">
      <div className="space-y-6">
        {inQuiz && (
          <Quiz
            tournamentId={t.id}
            question={state.question!}
            onProgress={(res) => setState({ ...state, entry: res.entry, question: res.question })}
            onResync={setState}
          />
        )}

        <NightPanel aria-labelledby="t-title" stripe={live} className="-mx-2 px-5 pb-6 pt-5 sm:mx-0">
          <SpeedLines rows={[20, 70]} />
          {/* trophy in a soft glow */}
          <div
            className="pointer-events-none absolute -right-6 -top-6 grid h-40 w-40 place-items-center rounded-full bg-[radial-gradient(circle,rgb(242_201_76/.35),transparent_65%)]"
            aria-hidden
          >
            <span className="text-[64px] leading-none drop-shadow-[0_6px_16px_rgba(0,0,0,.45)]">🏆</span>
          </div>
          <p className="relative flex items-center gap-2 text-sm">
            {live ? (
              <>
                <span className="h-2.5 w-2.5 rounded-full bg-brand ring-4 ring-brand/25" aria-hidden />
                <span className="font-semibold">Идёт сейчас</span>
              </>
            ) : t.status === 'scheduled' ? (
              <>
                <span className="h-2.5 w-2.5 rounded-full border-2 border-white/70" aria-hidden />
                <span className="font-semibold">Запланирован</span>
              </>
            ) : (
              <span className="font-semibold">Завершён</span>
            )}
          </p>
          <h2 id="t-title" className="relative mt-2 max-w-[72%] text-2xl font-bold leading-[1.05]">
            {t.title}
          </h2>
          <p className="relative mt-1.5 text-white/70">
            {pluralN(t.questions_total, QUESTIONS)}, с {fmtDate(t.starts_at, true)} до {fmtDate(t.ends_at, true)}
          </p>
          {t.status !== 'finished' && countdown !== null && (
            <div className="relative mt-5 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
              <div>
                <p className="text-white/70">{live ? 'До конца турнира' : 'До старта'}</p>
                <p className="digits text-[48px] font-bold leading-none" role="timer">
                  {fmtDuration(countdown)}
                </p>
              </div>
              <p className="pb-1 text-right text-white/70">
                <span className="digits block text-2xl font-semibold leading-none text-white">{t.participants}</span>
                {plural(t.participants, PEOPLE)}
              </p>
            </div>
          )}
          {t.status === 'finished' && <p className="relative mt-3 text-white/70">{pluralN(t.participants, PEOPLE)}</p>}
          {live && !state.entry && (
            <Button size="lg" block className="relative mt-5" loading={joining} onClick={join}>
              Участвовать в турнире
            </Button>
          )}
          {error && (
            <p className="relative mt-3 rounded-lg bg-white px-3 py-2 text-brand" role="alert">
              {error}
            </p>
          )}
        </NightPanel>

        {state.entry && (state.entry.finished || !live) && (
          <section className="border-t border-line pt-5">
            <h2 className="text-lg font-semibold">Ваш результат</h2>
            <p className="digits mt-1 text-3xl font-semibold leading-none">{state.entry.score}</p>
            <p className="mt-2 text-muted">
              Верно {state.entry.correct} из {state.entry.total}
              {place ? `, ${place}-е место` : ''}
            </p>
            {live && <p className="mt-1">Итоги подведут, когда турнир закончится. Место ещё может измениться.</p>}
          </section>
        )}
      </div>

      <LiveBoard board={board} live={live} scheduled={t.status === 'scheduled'} />
    </div>
  )
}

function Quiz({
  tournamentId,
  question,
  onProgress,
  onResync,
}: {
  tournamentId: number
  question: TournamentQuestion
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
        window.setTimeout(advance, 1800)
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

  const speedBonus = reveal?.correct ? reveal.points - 100 : 0
  const cat = shown.category ? CATEGORY_TITLES[shown.category] : null
  const left = reveal ? 0 : remaining ?? shown.timer

  return (
    <section className="overflow-hidden rounded-sheet border border-line bg-surface" aria-label="Вопрос турнира">
      <TimerLine remaining={left} total={shown.timer} />
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-muted">
            Вопрос {shown.index + 1} из {shown.total}
            {cat ? `, ${cat.title.toLowerCase()}` : ''}
          </p>
          {!reveal && <TimerDigits remaining={left} total={shown.timer} />}
        </div>
        <h3 key={shown.index} className="mt-3 font-sans text-base font-semibold leading-snug">
          {shown.text}
        </h3>
        <div className="mt-4 space-y-2">
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
                  'flex min-h-[52px] w-full items-center gap-3 rounded-xl border px-4 py-3 text-left leading-snug transition-colors',
                  isCorrect
                    ? 'border-ok bg-ok-soft text-ink'
                    : isWrongPick
                      ? 'border-brand bg-brand-soft text-ink'
                      : picked === i
                        ? 'border-ink bg-ink text-white'
                        : 'border-line hover:border-ink',
                  reveal && !isCorrect && !isWrongPick && 'opacity-40',
                )}
              >
                <span className="flex-1">{opt}</span>
                {isCorrect && <Check className="h-5 w-5 shrink-0 text-ok" aria-label="Верный ответ" />}
                {isWrongPick && <X className="h-5 w-5 shrink-0 text-brand" aria-label="Ваш ответ неверный" />}
              </button>
            )
          })}
        </div>
      </div>
      {reveal && (
        <div className="border-t border-line px-4 py-4" role="status">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className={cn('text-base font-semibold', reveal.correct ? 'text-ok' : 'text-brand')}>
              {reveal.correct ? 'Верно' : reveal.timed_out ? 'Время вышло' : 'Неверно'}
            </p>
            <p className="digits text-xl font-semibold">
              +{reveal.points}
              {speedBonus > 0 && <span className="ml-2 font-sans text-sm font-normal text-muted">из них {speedBonus} за скорость</span>}
            </p>
          </div>
          {reveal.explanation && <p className="mt-1 text-muted">{reveal.explanation}</p>}
          {reveal.rank && <p className="mt-2">Вы на {reveal.rank}-м месте</p>}
          <Button variant="secondary" block className="mt-3" onClick={advance}>
            {reveal.question ? 'Следующий вопрос' : 'Показать результат'}
          </Button>
        </div>
      )}
    </section>
  )
}

function LiveBoard({ board, live, scheduled }: { board: TournamentLeaderboard | null; live: boolean; scheduled: boolean }) {
  return (
    <section className="self-start" aria-labelledby="board-title">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 id="board-title" className="text-lg font-semibold">
          Таблица лидеров
        </h2>
        {live && <span className="text-xs text-muted">Обновляется каждые 3 секунды</span>}
      </div>
      {scheduled ? (
        <p className="text-muted">Таблица появится, когда турнир начнётся.</p>
      ) : !board ? (
        <Loading rows={3} />
      ) : board.entries.length === 0 ? (
        <p className="text-muted">Пока никто не ответил. Ответьте первым, и ваше имя окажется наверху.</p>
      ) : (
        <ol className="divide-y divide-line border-y border-line">
          {board.entries.map((e) => (
            <li key={e.id} className={cn('flex min-h-[48px] items-center gap-3 pr-1', e.is_me ? 'border-l-2 !border-l-brand bg-surface pl-2' : 'pl-[10px]')}>
              <span className="digits w-7 shrink-0 text-lg font-semibold">{e.rank}</span>
              <Link
                to={e.is_me ? '/profile' : `/users/${e.id}`}
                className={cn('min-w-0 flex-1 truncate py-3 hover:underline', e.is_me && 'font-semibold')}
              >
                {e.full_name}
                {e.is_me && <span className="font-normal text-muted">, вы</span>}
              </Link>
              <span className="digits text-lg font-semibold">{e.score}</span>
            </li>
          ))}
        </ol>
      )}
      {board && board.my_rank && board.my_rank > board.entries.length && (
        <p className="mt-3 border-l-2 border-brand pl-3 font-medium">Ваше место: {board.my_rank}</p>
      )}
      {board && <p className="mt-2 text-xs text-muted">Всего {pluralN(board.participants, PEOPLE)}</p>}
    </section>
  )
}

function Rules() {
  return (
    <section>
      <SectionTitle>Правила</SectionTitle>
      <dl className="divide-y divide-line border-y border-line">
        <Rule title="Около 15 секунд на вопрос">За верный ответ 100 очков и до 50 за скорость.</Rule>
        <Rule title="Первая десятка недели">Трофей турнира и ещё {points(100)} в рейтинг.</Rule>
        <Rule title="Победитель">Сверху {points(50)} и корона на неделю.</Rule>
      </dl>
    </section>
  )
}

function Rule({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="py-3">
      <dt className="font-medium">{title}</dt>
      <dd className="mt-0.5 text-muted">{children}</dd>
    </div>
  )
}

function PastTournaments({ items }: { items: TournamentWithWinners[] }) {
  if (!items.length) return <p className="text-muted">Итоги прошедших турниров появятся здесь после первого турнира.</p>
  return (
    <ul className="divide-y divide-line border-y border-line">
      {items.map((t) => (
        <li key={t.id} className="py-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate font-medium">{t.title}</p>
            <p className="shrink-0 text-xs text-muted">{fmtDate(t.starts_at)}</p>
          </div>
          {t.winners.length ? (
            <ol className="mt-1.5 space-y-1">
              {t.winners.map((w, i) => (
                <li key={w.id} className="flex items-center gap-2">
                  <span className="w-5 text-center" aria-label={`${i + 1}-е место`}>
                    {['🥇', '🥈', '🥉'][i]}
                  </span>
                  <Link to={`/users/${w.id}`} className="min-w-0 flex-1 truncate hover:underline">
                    {w.full_name}
                  </Link>
                  <span className="digits text-base font-semibold">{w.score}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-1 text-muted">Итоги подводятся, {pluralN(t.participants, PEOPLE)}</p>
          )}
        </li>
      ))}
    </ul>
  )
}
