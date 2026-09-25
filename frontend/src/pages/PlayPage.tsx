import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { api, ApiError } from '@/api/client'
import type { AnswerAction, PublicNode, RunView } from '@/api/types'
import { useAuth } from '@/auth/AuthContext'
import { useCountdown } from '@/hooks/useServerClock'
import { useSpeech } from '@/hooks/useSpeech'
import { Button } from '@/components/Button'
import { TimerDigits, TimerLine } from '@/components/Timer'
import { SignalBar } from '@/components/SignalBar'
import { CountUp } from '@/components/CountUp'
import { Mascot } from '@/components/Mascot'
import { EndScreen } from '@/components/play/EndScreen'
import { AnswerBubble, GradingIndicator, HistoryEntry, PromptBubble } from '@/components/play/Feed'
import { cn } from '@/lib/cn'

export default function PlayPage() {
  const { runId } = useParams()
  const id = Number(runId)
  const navigate = useNavigate()
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
  useEffect(() => {
    if (!bottomRef.current) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: reduce ? 'auto' : 'smooth' })
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

  const backTo = isStaff && run && !run.scenario.is_published ? `/admin/scenarios/${run.scenario.id}` : '/scenarios'

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
        <div className="grid min-h-screen place-items-center" role="status">
          <p className="text-muted">Загружаем рейс</p>
        </div>
      </Shell>
    )
  }

  const finished = run.status !== 'active'
  const emergency = run.mode === 'emergency'
  const modeNote = emergency ? 'Экстренная ситуация' : run.mode === 'qualification' ? 'Повышение квалификации' : run.scenario.category_title

  return (
    <Shell>
      {/* compact top bar */}
      <header className="night-line-flat sticky top-0 z-20 pt-[env(safe-area-inset-top)] shadow-[0_10px_30px_-18px_rgb(10_16_30/.8)] dark:shadow-[0_1px_0_rgb(255_255_255/.06),0_10px_30px_-18px_rgb(0_0_0/.9)]">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-2 pt-1.5">
          <button
            onClick={() => navigate(backTo)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-white hover:bg-white/10"
            aria-label="Закрыть рейс. Прогресс сохранится"
            title="Закрыть (прогресс сохранится)"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold leading-tight text-white">{run.scenario.title}</p>
            <p className={cn('truncate text-xs', emergency ? 'font-medium text-[#FF8A8A]' : 'text-white/70')}>{modeNote}</p>
          </div>
          <div className="shrink-0 pr-2 text-right">
            <p className="digits text-2xl font-semibold leading-none text-white">
              <CountUp value={run.score} duration={600} />
            </p>
            <p className="text-xs text-white/60">очков</p>
          </div>
        </div>
        <div className="mx-auto flex max-w-3xl gap-5 px-4 pb-3 pt-2">
          <SignalBar label="Пассажир" value={run.loyalty} showDelta dark />
          <SignalBar label="Безопасность" value={run.safety} showDelta dark />
        </div>
      </header>

      {finished ? (
        <EndScreen run={run} onRestart={restart} restarting={restarting} backTo={backTo} />
      ) : (
        <>
          <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 pb-6 pt-5 sm:pt-7" aria-live="polite">
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
                <AnswerBubble text={text} />
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
        </>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen flex-col">{children}</div>
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
        <p className="rounded-xl bg-warn-soft/70 px-3.5 py-2.5 text-muted ring-1 ring-inset ring-warn/25">
          <span className="font-medium text-ink">Подсказка: </span>
          {node.hint}
        </p>
      )}
    </div>
  )
}

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

  return (
    <div className="pb-safe sticky bottom-0 z-20 mx-auto w-full max-w-3xl overflow-hidden rounded-t-sheet border border-b-0 border-line/80 bg-surface/95 shadow-dock backdrop-blur-xl sm:rounded-b-none">
      {timer && <TimerLine remaining={timer.remaining} total={timer.total} />}
      <div className="px-4 pb-4 pt-3 sm:px-5">
        {error && (
          <p className="mb-3 border-l-2 border-brand pl-3 text-sm" role="alert">
            {error}
          </p>
        )}

        {timer && (
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-xs text-muted">{node.type === 'input' ? 'Время на ответ' : 'Время на решение'}</span>
            <TimerDigits remaining={timer.remaining} total={timer.total} />
          </div>
        )}

        {node.type === 'scene' && (
          <Button size="lg" block onClick={onContinue} loading={busy === 'continue'} data-testid="continue">
            Далее
          </Button>
        )}

        {node.type === 'choice' && (
          <div className="space-y-2" role="group" aria-label="Ваше решение">
            {node.choices?.map((c) => (
              <button
                key={c.id}
                data-testid="choice"
                disabled={!!busy}
                onClick={() => {
                  if (Date.now() - shownAt.current < 450) return // ignore a double-tap carried over from «Далее»
                  setPicked(c.id)
                  onChoose(c.id)
                }}
                className={cn(
                  'press flex min-h-[52px] w-full items-center rounded-xl border px-4 py-3 text-left leading-snug transition-[color,background-color,border-color,box-shadow,opacity,transform]',
                  picked === c.id ? 'btn-ink border-transparent' : 'border-line bg-surface text-ink shadow-card hover:border-ink/40 hover:bg-surface-2',
                  busy && picked !== c.id && 'opacity-40',
                )}
              >
                {c.text}
              </button>
            ))}
          </div>
        )}

        {node.type === 'input' && (
          <div className="space-y-2">
            <label htmlFor="answer" className="sr-only">
              Ваш ответ
            </label>
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
              className="input min-h-[92px] resize-none text-base"
            />
            <Button size="lg" block onClick={onAnswer} disabled={!text.trim()} loading={busy === 'answer'} data-testid="answer-submit">
              {busy === 'answer' ? 'ИИ-наставник проверяет ответ' : 'Отправить ответ'}
            </Button>
            <p className="text-xs text-muted">Ответ проверит ИИ-наставник по регламенту. Пишите так, как сказали бы в рейсе.</p>
          </div>
        )}
      </div>
    </div>
  )
}
