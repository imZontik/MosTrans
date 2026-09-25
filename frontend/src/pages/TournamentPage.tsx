import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Check, History, ListChecks, Radio, X } from 'lucide-react'
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

  const extras = (
    <>
      <Rules />
      <section className="card p-5">
        <SectionTitle icon={History} tint="bg-rarity-legendary-soft" tone="text-rarity-legendary-ink">
          Прошлые турниры
        </SectionTitle>
        {past.loading ? <Loading rows={2} /> : <PastTournaments items={(past.data ?? []).filter((x) => x.status === 'finished')} />}
      </section>
    </>
  )

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
        <TournamentArena state={state!} setState={setState} reload={current.reload} extras={extras} />
      )}

      {!t && <div className="grid gap-6 lg:grid-cols-2 lg:items-start xl:gap-7">{extras}</div>}
    </div>
  )
}

function TournamentArena({
  state,
  setState,
  reload,
  extras,
}: {
  state: CurrentTournament
  setState: (s: CurrentTournament) => void
  reload: () => Promise<void>
  /** Rules and past results: under the arena on the left, after the live board on phones. */
  extras: ReactNode
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
    <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,1fr)] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-7 lg:space-y-0">
      <div className="space-y-6 lg:col-start-1 lg:row-start-1">
        {inQuiz && (
          <Quiz
            tournamentId={t.id}
            question={state.question!}
            onProgress={(res) => setState({ ...state, entry: res.entry, question: res.question })}
            onResync={setState}
          />
        )}

        <NightPanel aria-labelledby="t-title" stripe={live} className="-mx-2 px-5 pb-6 pt-5 sm:mx-0 sm:px-7 sm:pt-6">
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
          <h2 id="t-title" className="relative mt-2 max-w-[72%] text-2xl font-bold leading-[1.05] lg:text-[34px]">
            {t.title}
          </h2>
          <p className="relative mt-1.5 text-white/70">
            {pluralN(t.questions_total, QUESTIONS)}, с {fmtDate(t.starts_at, true)} до {fmtDate(t.ends_at, true)}
          </p>
          {t.status !== 'finished' && countdown !== null && (
            <div className="relative mt-5 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
              <div>
                <p className="text-white/70">{live ? 'До конца турнира' : 'До старта'}</p>
                <p className="digits text-[48px] font-bold leading-none lg:text-[56px]" role="timer">
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
            <Button size="lg" block className="relative mt-5 sm:w-auto sm:min-w-[280px]" loading={joining} onClick={join}>
              Участвовать в турнире
            </Button>
          )}
          {error && (
            <p className="relative mt-3 rounded-lg bg-white px-3 py-2 text-[#B80F1F]" role="alert">
              {error}
            </p>
          )}
        </NightPanel>

        {state.entry && (state.entry.finished || !live) && (
          <section className="card p-5">
            <h2 className="text-lg font-semibold">Ваш результат</h2>
            <p className="digits mt-2 text-[48px] font-bold leading-none">{state.entry.score}</p>
            <p className="mt-2 text-muted">
              Верно {state.entry.correct} из {state.entry.total}
              {place ? `, ${place}-е место` : ''}
            </p>
            {live && <p className="mt-1">Итоги подведут, когда турнир закончится. Место ещё может измениться.</p>}
          </section>
        )}
      </div>

      <LiveBoard board={board} live={live} scheduled={t.status === 'scheduled'} />
      <div className="space-y-6 lg:col-start-1 lg:row-start-2">{extras}</div>
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
    <section className="card overflow-hidden rounded-sheet" aria-label="Вопрос турнира">
      <TimerLine remaining={left} total={shown.timer} />
      <div className="p-4 sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-muted">
            Вопрос {shown.index + 1} из {shown.total}
            {cat ? `, ${cat.title.toLowerCase()}` : ''}
          </p>
          {!reveal && <TimerDigits remaining={left} total={shown.timer} />}
        </div>
        <h3 key={shown.index} className="mt-3 font-sans text-base font-semibold leading-snug sm:text-lg">
          {shown.text}
        </h3>
        <div className="mt-4 grid gap-2 xl:grid-cols-2">
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
                  'press flex min-h-[52px] w-full items-center gap-3 rounded-xl border px-4 py-3 text-left leading-snug transition-[color,background-color,border-color,box-shadow,opacity,transform]',
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
                <span className="flex-1">{opt}</span>
                {isCorrect && <Check className="h-5 w-5 shrink-0 text-ok" aria-label="Верный ответ" />}
                {isWrongPick && <X className="h-5 w-5 shrink-0 text-brand" aria-label="Ваш ответ неверный" />}
              </button>
            )
          })}
        </div>
      </div>
      {reveal && (
        <div className="border-t border-line bg-ink/[.02] px-4 py-4 sm:px-6" role="status">
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
    <section className="card self-start p-5 lg:col-start-2 lg:row-span-2 lg:row-start-1" aria-labelledby="board-title">
      <SectionTitle
        id="board-title"
        icon={Radio}
        tint="bg-brand-soft"
        tone="text-brand"
        action={live && <span className="text-xs text-muted">Каждые 3 секунды</span>}
      >
        Таблица лидеров
      </SectionTitle>
      {scheduled ? (
        <p className="text-muted">Таблица появится, когда турнир начнётся.</p>
      ) : !board ? (
        <Loading rows={3} />
      ) : board.entries.length === 0 ? (
        <p className="text-muted">Пока никто не ответил. Ответьте первым, и ваше имя окажется наверху.</p>
      ) : (
        <ol className="-mx-2 divide-y divide-line/70">
          {board.entries.map((e) => (
            <li key={e.id} className={cn('flex min-h-[48px] items-center gap-3 rounded-lg pr-2', e.is_me ? 'border-l-[3px] !border-l-brand bg-brand-soft/70 pl-[9px]' : 'pl-3')}>
              <span
                className={cn(
                  'digits grid h-8 w-8 shrink-0 place-items-center rounded-lg text-lg font-semibold',
                  !!e.rank && e.rank <= 3 && ['bg-gradient-to-br from-[#FFE9A8] to-[#E9BE45] text-[#5C4200]', 'bg-gradient-to-br from-[#F4F6F8] to-[#C3CAD3] text-[#39424E]', 'bg-gradient-to-br from-[#F6D9C0] to-[#C98A55] text-[#4E2C0F]'][e.rank - 1],
                )}
              >
                {e.rank}
              </span>
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
    <section className="card p-5">
      <SectionTitle icon={ListChecks} tint="bg-cat-safety-soft" tone="text-cat-safety">
        Правила
      </SectionTitle>
      <dl className="divide-y divide-line/70">
        <Rule title="Около 15 секунд на вопрос">За верный ответ 100 очков и до 50 за скорость.</Rule>
        <Rule title="Первая десятка недели">Трофей турнира и ещё {points(100)} в рейтинг.</Rule>
        <Rule title="Победитель">Сверху {points(50)} и корона на неделю.</Rule>
      </dl>
    </section>
  )
}

function Rule({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <dt className="font-medium">{title}</dt>
      <dd className="mt-0.5 text-muted">{children}</dd>
    </div>
  )
}

function PastTournaments({ items }: { items: TournamentWithWinners[] }) {
  if (!items.length) return <p className="text-muted">Итоги прошедших турниров появятся здесь после первого турнира.</p>
  return (
    <ul className="divide-y divide-line/70">
      {items.map((t) => (
        <li key={t.id} className="py-3 first:pt-0 last:pb-0">
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
