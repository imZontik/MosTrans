import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Check, Clock, Lightbulb, Minus, SendHorizontal, X } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import type { AnswerAction, HistoryItem, PublicNode, Quality, RunView } from '@/api/types'
import { useAuth } from '@/auth/AuthContext'
import { useCountdown } from '@/hooks/useServerClock'
import { useSpeech } from '@/hooks/useSpeech'
import { Button } from '@/components/Button'
import { RingTimer, TimerLine } from '@/components/Timer'
import { SignalBar } from '@/components/SignalBar'
import { CountUp } from '@/components/CountUp'
import { Mascot } from '@/components/Mascot'
import { CoverTile } from '@/components/Category'
import { DifficultyDots } from '@/components/Progress'
import { EndScreen } from '@/components/play/EndScreen'
import { TabBar } from '@/components/TabBar'
import { AnswerBubble, GradingIndicator, HistoryEntry, PromptBubble } from '@/components/play/Feed'
import { PlaySkeleton } from '@/components/Skeleton'
import { cn } from '@/lib/cn'
import { categoryStyle } from '@/lib/category'
import { MODE_LABEL } from '@/lib/format'
import { plural, POINTS } from '@/lib/plural'

export default function PlayPage() {
  const { runId } = useParams()
  const id = Number(runId)
  const navigate = useNavigate()
  const location = useLocation()
  const { isStaff, refresh } = useAuth()
  const [run, setRun] = useState<RunView | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState<AnswerAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [freshIndex, setFreshIndex] = useState<number | null>(null)
  const [restarting, setRestarting] = useState(false)
  const [needsGesture, setNeedsGesture] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const timeoutSent = useRef<string | null>(null)
  const { play, stop, speaking } = useSpeech()

  const load = useCallback(async () => {
    try {
      setRun(await api.run(id))
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить сценарий')
    }
  }, [id])

  useEffect(() => {
    setRun(null)
    setLoadError(null)
    load()
  }, [load])

  const node = run?.node
  const active = run?.status === 'active' && node && node.type !== 'end'
  const remaining = useCountdown(active && node?.timer ? node.deadline : null, run?.server_now)

  // Auto-play voice messages for the current node.
  useEffect(() => {
    if (!active || !node?.audio) return
    let cancelled = false
    play(node.audio).then((ok) => !cancelled && setNeedsGesture(!ok))
    return () => {
      cancelled = true
    }
  }, [active, node?.id, node?.audio, play])

  const isFinished = run ? run.status !== 'active' : false
  useEffect(() => {
    if (isFinished) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [isFinished])

  // Keep the newest message in view.
  // Scroll to the page end (not just the marker), so the sticky decision dock never covers the newest line.
  // The dock settles a moment later (its timer appears, fonts load): stay pinned to the end while it does.
  useEffect(() => {
    if (!bottomRef.current) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const toEnd = (smooth: boolean) =>
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: smooth && !reduce ? 'smooth' : 'auto' })
    toEnd(true)
    const ro = new ResizeObserver(() => toEnd(false))
    ro.observe(document.body)
    const done = window.setTimeout(() => ro.disconnect(), 1200)
    return () => {
      ro.disconnect()
      window.clearTimeout(done)
    }
  }, [run?.history.length, node?.id, busy])

  const send = useCallback(
    async (action: AnswerAction, extra: { choice_id?: string; text?: string } = {}) => {
      if (!run || !node || busy) return
      setBusy(action)
      setError(null)
      stop()
      try {
        const res = await api.answer(run.id, { node_id: node.id, action, ...extra })
        setFreshIndex(res.run.history.length - 1)
        setRun(res.run)
        setText('')
        if (res.run.status === 'finished') refresh()
      } catch (e) {
        if (e instanceof ApiError && (e.status === 409 || action === 'timeout')) {
          // Out of sync with the server clock/state — reload the authoritative run.
          window.setTimeout(() => {
            if (action === 'timeout') timeoutSent.current = null
            load()
          }, action === 'timeout' ? 1200 : 0)
        } else {
          setError(e instanceof Error ? e.message : 'Ошибка отправки ответа')
        }
      } finally {
        setBusy(null)
      }
    },
    [run, node, busy, stop, load, refresh],
  )

  // Server-authoritative timer expired.
  useEffect(() => {
    if (!active || !node?.timer || remaining === null || remaining > 0 || busy) return
    if (timeoutSent.current === node.id) return
    timeoutSent.current = node.id
    send('timeout')
  }, [remaining, active, node, busy, send])

  const restart = async () => {
    if (!run) return
    setRestarting(true)
    try {
      const next = await api.startRun(run.scenario.id, true)
      navigate(`/play/${next.id}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось перезапустить')
    } finally {
      setRestarting(false)
    }
  }

  // a debrief opened from the profile or the run history goes back there
  const from = (location.state as { from?: string } | null)?.from
  const backTo = from ?? (isStaff && run && !run.scenario.is_published ? `/admin/scenarios/${run.scenario.id}` : '/scenarios')

  if (loadError) {
    return (
      <Shell>
        <div className="mx-auto max-w-md px-4 py-16">
          <Mascot className="h-24 w-24" mood="thinking" />
          <h1 className="mt-4 text-xl font-semibold">Рейс не открылся</h1>
          <p className="mt-2 text-muted">{loadError.replace(/\.$/, '')}. Вернитесь в расписание и начните сценарий снова.</p>
          <Button className="mt-6" variant="secondary" onClick={() => navigate('/scenarios')}>
            К расписанию
          </Button>
        </div>
      </Shell>
    )
  }

  if (!run || !node) {
    return (
      <Shell>
        <PlaySkeleton />
      </Shell>
    )
  }

  const finished = run.status !== 'active'
  const emergency = run.mode === 'emergency'
  const modeNote = emergency ? 'Экстренная ситуация' : run.mode === 'qualification' ? 'Повышение квалификации' : run.scenario.category_title

  return (
    <Shell>
      {/* compact top bar on the night line */}
      <header className="night-line-flat sticky top-0 z-20 pt-[env(safe-area-inset-top)] shadow-[0_10px_30px_-18px_rgb(10_16_30/.8)] dark:shadow-[0_1px_0_rgb(255_255_255/.06),0_10px_30px_-18px_rgb(0_0_0/.9)]">
        {/* the results page has no side rail: the header centres over it */}
        <Columns rail={!finished}>
          <div className="flex items-center gap-2 pt-1.5">
            <button
              onClick={() => navigate(backTo)}
              className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Закрыть рейс. Прогресс сохранится"
              title="Закрыть (прогресс сохранится)"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold leading-tight text-white">{run.scenario.title}</p>
              <p className={cn('truncate text-xs', emergency ? 'font-medium text-[#FF8A8A]' : 'text-white/60')}>{modeNote}</p>
            </div>
            <div className="shrink-0 rounded-xl bg-white/[.07] px-3 py-1.5 text-right ring-1 ring-inset ring-white/10">
              <p className="digits text-xl font-semibold leading-none text-white">
                <CountUp value={run.score} duration={600} />
              </p>
              <p className="text-[11px] leading-tight text-white/55">{plural(run.score, POINTS)}</p>
            </div>
          </div>
          <div className="flex gap-5 pb-3 pt-2.5">
            <SignalBar label="Пассажир" value={run.loyalty} showDelta dark />
            <SignalBar label="Безопасность" value={run.safety} showDelta dark />
          </div>
        </Columns>
      </header>

      {finished ? (
        <EndScreen run={run} onRestart={restart} restarting={restarting} backTo={backTo} />
      ) : (
        <Columns
          className="flex-1"
          side={<RunSide run={run} />}
          body="flex flex-col"
        >
          {/* the conversation sits on the answer dock, like a messenger: the newest line right above the choices */}
          <main className="flex flex-1 flex-col justify-end gap-5 pb-3 pt-5 sm:pt-7" aria-live="polite">
            <RunIntro run={run} />
            {run.history.map((h, i) => (
              <HistoryEntry key={`${h.node_id}-${i}`} item={h} fresh={i === freshIndex} category={run.scenario.category} />
            ))}
            <CurrentPrompt
              node={node}
              category={run.scenario.category}
              speaking={speaking}
              onReplay={node.audio ? () => play(node.audio).then((ok) => setNeedsGesture(!ok)) : undefined}
            />
            {needsGesture && node.audio && !speaking && (
              <p className="text-xs text-muted">Браузер не включил звук сам. Нажмите «Прослушать голосовое».</p>
            )}
            {busy === 'answer' && (
              <>
                <AnswerBubble text={text} fresh />
                <GradingIndicator />
              </>
            )}
            <div ref={bottomRef} className="h-1" />
          </main>

          <AnswerPanel
            node={node}
            remaining={remaining}
            busy={busy}
            error={error}
            text={text}
            setText={setText}
            onContinue={() => send('continue')}
            onChoose={(choice_id) => send('choose', { choice_id })}
            onAnswer={() => send('answer', { text })}
          />
        </Columns>
      )}
    </Shell>
  )
}

/**
 * The page's columns: on xl a side rail with the run on the left and the conversation in the
 * middle; below xl just the conversation. The header uses the same columns, so its title and
 * scales line up with the conversation under them.
 */
function Columns({
  side,
  rail = true,
  body,
  className,
  children,
}: {
  side?: ReactNode
  rail?: boolean
  body?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('mx-auto flex w-full max-w-[1180px] gap-10 px-4 xl:px-8 2xl:max-w-[1480px]', className)}>
      {rail && <div className="hidden w-[280px] shrink-0 xl:block">{side}</div>}
      <div className={cn('mx-auto w-full min-w-0 max-w-3xl flex-1', body)}>{children}</div>
      {/* keeps the conversation centred on the page on 2xl */}
      {rail && <div className="hidden w-[280px] shrink-0 2xl:block" aria-hidden />}
    </div>
  )
}

/** The run's page: the bottom bar stays (below lg), and the page leaves room for it. */
function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col max-lg:pb-[calc(58px+env(safe-area-inset-bottom))]">
      {children}
      <TabBar />
    </div>
  )
}

function CurrentPrompt({
  node,
  category,
  speaking,
  onReplay,
}: {
  node: PublicNode
  category: string
  speaking: boolean
  onReplay?: () => void
}) {
  return (
    <div key={node.id} className="space-y-2.5">
      <PromptBubble
        speaker={node.speaker}
        name={node.speaker_name}
        role={node.speaker_role}
        avatar={node.avatar}
        text={node.text}
        onReplay={onReplay}
        speaking={speaking}
        category={category}
        current
      />
      {node.hint && (
        <p
          className="feed-in flex gap-2.5 rounded-2xl bg-warn-soft/70 px-4 py-3 text-sm leading-relaxed ring-1 ring-inset ring-warn/25"
          style={{ animationDelay: '120ms' }}
        >
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warn-ink" aria-hidden />
          <span>
            <span className="font-semibold">Подсказка. </span>
            <span className="text-muted">{node.hint}</span>
          </span>
        </p>
      )}
    </div>
  )
}

/** Below xl, where there's no side rail: the scenario opens the conversation, like a chat's first card. */
function RunIntro({ run }: { run: RunView }) {
  const s = run.scenario
  const c = categoryStyle(s.category)
  return (
    <section className="mb-2 flex items-start gap-3.5 border-b border-line/70 pb-5 xl:hidden" aria-label="О рейсе">
      <CoverTile cover={s.cover} category={s.category} size="md" />
      <div className="min-w-0 flex-1">
        <p className={cn('flex items-center gap-1.5 text-xs font-medium', c.text)}>
          <c.icon className="h-3.5 w-3.5" aria-hidden />
          {s.category_title}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {s.estimated_minutes} мин
          </span>
          <span className="inline-flex items-center gap-1.5">
            <DifficultyDots value={s.difficulty} />
            {DIFFICULTY[s.difficulty]}
          </span>
          <span>прогресс сохраняется</span>
        </p>
      </div>
    </section>
  )
}

// --- side rail (xl) ------------------------------------------------------------------

const DIFFICULTY = ['', 'Лёгкий', 'Средний', 'Сложный']
const TRAIL: Record<Quality, { icon: typeof Check; className: string; label: string }> = {
  best: { icon: Check, className: 'bg-ok text-white', label: 'верно' },
  ok: { icon: Minus, className: 'bg-warn text-[#1C2430]', label: 'допустимо' },
  bad: { icon: X, className: 'bg-bad text-white', label: 'ошибка' },
}

/** What this run is, and the trail of your decisions so far: one mark per answer. */
function RunSide({ run }: { run: RunView }) {
  const s = run.scenario
  const c = categoryStyle(s.category)
  const decisions = run.history.filter((h): h is HistoryItem & { quality: Quality } => h.type !== 'scene' && !!h.quality)
  return (
    <aside className="sticky top-[132px] space-y-4 pt-7" aria-label="О рейсе">
      <section className="card relative isolate overflow-hidden p-5">
        <span
          className="pointer-events-none absolute -right-14 -top-14 -z-10 h-40 w-40 rounded-full opacity-20 blur-2xl"
          style={{ background: `rgb(var(--cat-${s.category}))` }}
          aria-hidden
        />
        <CoverTile cover={s.cover} category={s.category} size="lg" />
        <h2 className="mt-4 text-lg font-semibold leading-tight">{s.title}</h2>
        <p className={cn('mt-1 flex items-center gap-1.5 text-xs font-medium', c.text)}>
          <c.icon className="h-3.5 w-3.5" aria-hidden />
          {s.category_title}
        </p>
        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line/70 pt-3 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4" aria-hidden />
            <span className="digits font-semibold text-ink/80">{s.estimated_minutes}</span> мин
          </span>
          <span className="inline-flex items-center gap-1.5">
            <DifficultyDots value={s.difficulty} />
            {DIFFICULTY[s.difficulty]}
          </span>
          <span>{MODE_LABEL[run.mode] ?? run.mode}</span>
        </p>
      </section>

      <section className="card p-5" aria-labelledby="trail">
        <h2 id="trail" className="text-sm font-semibold">
          Ваши решения
        </h2>
        {decisions.length ? (
          <ol className="mt-3 flex flex-wrap gap-1.5">
            {decisions.map((d, i) => {
              const t = TRAIL[d.quality]
              return (
                <li key={i} className={cn('grid h-7 w-7 place-items-center rounded-full', t.className)} title={`Решение ${i + 1}: ${t.label}`}>
                  <t.icon className="h-3.5 w-3.5" strokeWidth={3} aria-label={t.label} />
                </li>
              )
            })}
            <li className="grid h-7 w-7 place-items-center rounded-full border-2 border-dashed border-line" title="Текущий шаг" aria-label="текущий шаг" />
          </ol>
        ) : (
          <p className="mt-1.5 text-sm text-muted">Здесь появится след ваших решений.</p>
        )}
        <p className="mt-4 text-xs text-muted">Можно закрыть рейс в любой момент: прогресс сохранится.</p>
      </section>
    </aside>
  )
}

// --- the answer dock -----------------------------------------------------------------

const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е']
const FINE_POINTER = '[@media(hover:hover)_and_(pointer:fine)]:block'

function AnswerPanel({
  node,
  remaining,
  busy,
  error,
  text,
  setText,
  onContinue,
  onChoose,
  onAnswer,
}: {
  node: PublicNode
  remaining: number | null
  busy: AnswerAction | null
  error: string | null
  text: string
  setText: (v: string) => void
  onContinue: () => void
  onChoose: (id: string) => void
  onAnswer: () => void
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const shownAt = useRef(Date.now())
  useEffect(() => {
    setPicked(null)
    shownAt.current = Date.now()
  }, [node.id])
  const timer = node.timer && remaining !== null ? { remaining, total: node.timer } : null

  const choose = useCallback(
    (id: string) => {
      if (busy || Date.now() - shownAt.current < 450) return // ignore a double-tap carried over from «Далее»
      setPicked(id)
      onChoose(id)
    },
    [busy, onChoose],
  )

  // keys: 1–N pick a choice, Enter goes on through a scene
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) return
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select, button, [contenteditable="true"]') && e.key === 'Enter') return
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (node.type === 'scene' && e.key === 'Enter' && !busy) {
        e.preventDefault()
        onContinue()
      }
      if (node.type === 'choice' && node.choices) {
        const n = Number(e.key)
        if (Number.isInteger(n) && n >= 1 && n <= node.choices.length) {
          e.preventDefault()
          choose(node.choices[n - 1].id)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [node, busy, onContinue, choose])

  const title = node.type === 'choice' ? 'Ваше решение' : node.type === 'input' ? 'Ваш ответ' : null

  return (
    <div className="sticky bottom-[calc(58px+env(safe-area-inset-bottom))] z-20 -mx-4 overflow-hidden rounded-t-[24px] lg:bottom-0 lg:pb-safe border border-b-0 border-line/70 bg-surface/90 shadow-dock backdrop-blur-xl dark:bg-surface/85 sm:mx-0">
      {timer && <TimerLine remaining={timer.remaining} total={timer.total} className="h-[3px]" />}
      <div key={node.id} className="feed-in px-4 pb-4 pt-3.5 sm:px-5 sm:pb-5">
        {error && (
          <p className="mb-3 rounded-xl bg-brand-soft px-3.5 py-2.5 text-sm text-ink ring-1 ring-inset ring-brand/25" role="alert">
            {error}
          </p>
        )}

        {(title || timer) && (
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              {title && <p className="font-semibold leading-tight">{title}</p>}
              {timer && <p className="text-xs text-muted">{node.type === 'input' ? 'Время на ответ идёт' : 'Время на решение идёт'}</p>}
            </div>
            {timer && <RingTimer remaining={timer.remaining} total={timer.total} className="h-12 w-12" />}
          </div>
        )}

        {node.type === 'scene' && (
          <>
            <Button
              size="lg"
              block
              onClick={onContinue}
              loading={busy === 'continue'}
              data-testid="continue"
              icon={busy === 'continue' ? undefined : <ArrowRight className="order-last h-5 w-5" aria-hidden />}
            >
              Далее
            </Button>
            <p className={cn('mt-2 hidden text-center text-xs text-muted', FINE_POINTER)}>или клавиша Enter</p>
          </>
        )}

        {node.type === 'choice' && (
          <>
            <div className="grid gap-2" role="group" aria-label="Ваше решение">
              {node.choices?.map((c, i) => (
                <button
                  key={c.id}
                  data-testid="choice"
                  disabled={!!busy}
                  onClick={() => choose(c.id)}
                  className={cn(
                    'press group flex min-h-[56px] w-full items-center gap-3 rounded-2xl border py-2.5 pl-2.5 pr-4 text-left leading-snug transition-[color,background-color,border-color,box-shadow,opacity,transform]',
                    picked === c.id
                      ? 'border-brand/40 bg-brand-soft text-ink shadow-[0_0_0_3px_rgb(var(--brand)/.12)]'
                      : 'border-line/80 bg-surface text-ink hover:border-ink/25 hover:bg-surface-2 dark:bg-surface-2/60 dark:hover:bg-surface-2',
                    busy && picked !== c.id && 'opacity-40',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-8 w-8 shrink-0 place-items-center rounded-xl font-display text-base font-semibold transition-colors',
                      picked === c.id ? 'bg-brand text-white' : 'bg-ink/[.06] text-muted group-hover:bg-ink/10 group-hover:text-ink',
                    )}
                    aria-hidden
                  >
                    {busy === 'choose' && picked === c.id ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    ) : (
                      LETTERS[i]
                    )}
                  </span>
                  <span className="flex-1">{c.text}</span>
                </button>
              ))}
            </div>
            <p className={cn('mt-2.5 hidden text-xs text-muted', FINE_POINTER)}>Можно выбирать клавишами 1–{node.choices?.length}</p>
          </>
        )}

        {node.type === 'input' && (
          <div>
            <label htmlFor="answer" className="sr-only">
              Ваш ответ
            </label>
            <div className="relative">
              <textarea
                id="answer"
                data-testid="answer-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim()) onAnswer()
                }}
                disabled={!!busy}
                rows={3}
                maxLength={2000}
                placeholder={node.placeholder || 'Что вы скажете или сделаете'}
                className="input min-h-[104px] resize-none rounded-2xl pb-8 text-base"
              />
              <span className="digits pointer-events-none absolute bottom-2.5 right-3.5 text-xs text-muted/80">{text.length}/2000</span>
            </div>
            <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center">
              <p className="flex-1 text-xs leading-snug text-muted">
                Ответ проверит ИИ-наставник по регламенту. Пишите так, как сказали бы в рейсе.
                <span className="hidden [@media(hover:hover)_and_(pointer:fine)]:inline"> Ctrl + Enter — отправить.</span>
              </p>
              <Button
                size="lg"
                onClick={onAnswer}
                disabled={!text.trim()}
                loading={busy === 'answer'}
                data-testid="answer-submit"
                className="w-full sm:w-auto"
                icon={busy === 'answer' ? undefined : <SendHorizontal className="order-last h-4 w-4" aria-hidden />}
              >
                {busy === 'answer' ? 'Проверяем' : 'Отправить'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
