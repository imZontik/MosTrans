import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Brain, CalendarClock, Check, Eye, Flame, Target, X } from 'lucide-react'
import { useDaily, useMinute, useRecall, type RecallAnswer, type RecallCard } from '@/hooks/useDaily'
import { BackLink } from '@/components/BackLink'
import { Button } from '@/components/Button'
import { CoverTile } from '@/components/Category'
import { DailyTicket, DailyTicketSkeleton, TokenDisc, Tokens, WeekPass } from '@/components/Daily'
import { Mascot } from '@/components/Mascot'
import { Loading, Sk, SkCard, SkText } from '@/components/Skeleton'
import { ErrorState } from '@/components/States'
import { cn } from '@/lib/cn'
import { TOKENS, tokenEarned } from '@/lib/daily'

/**
 * «Задание дня»: the ticket, the series with this week's pass, a warm-up card from your own past
 * decisions, and the tokens the series earns. The task changes at midnight.
 */
export default function DailyPage() {
  const now = useMinute()
  const { journal: j, loading, error, reload, runs } = useDaily()
  const top = j ? [...TOKENS].reverse().find((t) => tokenEarned(t, j)) : null

  return (
    <div className="mx-auto max-w-5xl space-y-5 lg:space-y-6">
      <div>
        <BackLink to="/">Главная</BackLink>
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-[-0.005em] lg:text-[40px] lg:leading-[1.05]">Задание дня</h1>
            <p className="mt-1.5 max-w-xl text-muted">
              Каждый день — новое направление и новое условие. Даже знакомый рейс приходится пройти под другим углом.
            </p>
          </div>
          {top && (
            <div className="hidden shrink-0 items-center gap-3 rounded-2xl bg-surface px-3 py-2 ring-1 ring-inset ring-line/70 sm:flex dark:bg-surface-2">
              <TokenDisc token={top} earned size="sm" />
              <p className="leading-tight">
                <span className="block text-xs text-muted">Ваш жетон</span>
                <span className="text-sm font-semibold">{top.title}</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !j ? (
        <PageSkeleton />
      ) : !j.today ? (
        <section className="card flex items-center gap-4 p-5 sm:p-6">
          <Mascot mood="thinking" className="h-20 w-20 shrink-0" />
          <p>Пока нет доступных рейсов для задания. Загляните в расписание — как только они появятся, здесь будет задание.</p>
        </section>
      ) : (
        <>
          <DailyTicket j={j} now={now} from="/daily" />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
            <WeekPass j={j} />
            <Recall runs={runs} />
          </div>
          <Tokens j={j} />
          <Rules />
        </>
      )}
    </div>
  )
}

function PageSkeleton() {
  return (
    <>
      <DailyTicketSkeleton />
      <Loading label="Загружаем серию" className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
        <SkCard title={false}>
          <Sk className="h-5 w-24 rounded-md" />
          <Sk className="mt-4 h-14 w-48 rounded-2xl" />
          <div className="mt-6 grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }, (_, i) => (
              <Sk key={i} className="aspect-square w-full rounded-full" />
            ))}
          </div>
        </SkCard>
        <SkCard title={false}>
          <Sk className="h-5 w-32 rounded-md" />
          <SkText lines={3} className="mt-4" />
          <Sk className="mt-4 h-12 w-full rounded-xl" />
          <Sk className="mt-2 h-12 w-full rounded-xl" />
        </SkCard>
      </Loading>
    </>
  )
}

// --- warm-up ------------------------------------------------------------------------------

function Recall({ runs }: { runs: Parameters<typeof useRecall>[0] }) {
  const { card, loading, answer, setAnswer } = useRecall(runs)

  return (
    <section className="card flex flex-col p-5 sm:p-6" aria-labelledby="recall">
      <div className="flex items-center justify-between gap-3">
        <h2 id="recall" className="flex items-center gap-2 text-lg font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-cat-service-soft text-cat-service" aria-hidden>
            <Brain className="h-[18px] w-[18px]" />
          </span>
          Разминка
        </h2>
        <span className="text-xs text-muted">1 вопрос · из ваших рейсов</span>
      </div>

      {loading ? (
        <Loading label="Подбираем вопрос" className="mt-4">
          <SkText lines={3} />
          <Sk className="mt-4 h-12 w-full rounded-xl" />
          <Sk className="mt-2 h-12 w-full rounded-xl" />
        </Loading>
      ) : !card ? (
        <div className="mt-4 flex flex-1 items-center gap-4">
          <Mascot mood="wink" holding="clipboard" className="h-20 w-20 shrink-0" />
          <p className="text-muted">Пройдите первый рейс — и здесь каждый день будет вопрос из ваших собственных решений.</p>
        </div>
      ) : (
        <RecallBody card={card} answer={answer} onAnswer={setAnswer} />
      )}
    </section>
  )
}

function RecallBody({ card, answer, onAnswer }: { card: RecallCard; answer: RecallAnswer | null; onAnswer: (a: RecallAnswer) => void }) {
  const [shown, setShown] = useState(false)
  const picked = answer && 'picked' in answer ? answer.picked : null
  const recalled = answer && 'recalled' in answer ? answer.recalled : null
  const revealed = card.mode === 'quiz' ? picked !== null : shown || recalled !== null
  const right = picked !== null && card.options[picked] === card.correct

  return (
    <div className="mt-4 flex flex-1 flex-col">
      <Link
        to={`/play/${card.runId}`}
        state={{ from: '/daily' }}
        className="-mx-1 flex min-w-0 max-w-full items-center gap-2.5 self-start rounded-lg px-1 py-0.5 text-sm text-muted transition-colors hover:text-ink"
      >
        <CoverTile cover={card.scenario.cover} category={card.scenario.category} size="sm" className="h-8 w-8 rounded-[10px] text-base" />
        <span className="min-w-0 truncate">Из рейса «{card.scenario.title}»</span>
      </Link>

      <blockquote className="mt-3 rounded-2xl rounded-tl-md bg-ink/[.035] px-4 py-3 leading-snug ring-1 ring-inset ring-line/60 dark:bg-white/[.03]">
        {card.context && card.prompt.length < 90 && <span className="mb-1.5 block text-sm text-muted">{card.context}</span>}
        {card.prompt}
      </blockquote>
      <p className="mt-3 text-sm font-semibold">{card.mode === 'quiz' ? 'Какое решение верное?' : 'Вспомните верное решение, потом проверьте себя'}</p>

      {card.mode === 'quiz' ? (
        <ul className="mt-2 space-y-2">
          {card.options.map((o, i) => {
            const isRight = o === card.correct
            const mine = picked === i
            return (
              <li key={i}>
                <button
                  type="button"
                  disabled={revealed}
                  onClick={() => onAnswer({ picked: i })}
                  className={cn(
                    'flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-[15px] leading-snug ring-1 ring-inset transition-colors',
                    !revealed && 'bg-surface ring-line hover:bg-surface-2 hover:ring-ink/30 dark:bg-surface-2',
                    revealed && isRight && 'bg-ok-soft ring-ok/50',
                    revealed && !isRight && mine && 'bg-brand-soft ring-brand/40',
                    revealed && !isRight && !mine && 'opacity-60 ring-line/60',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm font-bold',
                      revealed && isRight ? 'bg-ok text-white' : revealed && mine ? 'bg-brand text-white' : 'bg-ink/[.06] text-ink',
                    )}
                    aria-hidden
                  >
                    {revealed && isRight ? <Check className="h-4 w-4" strokeWidth={3} /> : revealed && mine ? <X className="h-4 w-4" strokeWidth={3} /> : 'АБ'[i]}
                  </span>
                  <span className="flex-1">{o}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : revealed ? (
        <p className="reveal-in mt-2 rounded-xl bg-ok-soft px-3.5 py-2.5 text-[15px] leading-snug ring-1 ring-inset ring-ok/40">{card.correct}</p>
      ) : (
        <Button variant="secondary" className="mt-2 self-start" onClick={() => setShown(true)} icon={<Eye className="h-4 w-4" aria-hidden />}>
          Показать ответ
        </Button>
      )}

      {revealed && (
        <div className="reveal-in mt-3 space-y-2" aria-live="polite">
          {card.mode === 'quiz' && (
            <p className={cn('text-sm font-semibold', right ? 'text-ok' : 'text-bad')}>
              {right
                ? card.yours === card.correct
                  ? 'Верно!'
                  : 'Верно! В рейсе вы тогда ответили иначе — теперь закрепили.'
                : 'Не то. Именно здесь вы ошиблись и в рейсе — запомните верный ход.'}
            </p>
          )}
          {card.note && <p className="text-sm leading-relaxed text-muted">{card.note}</p>}
          {card.mode === 'flash' &&
            (recalled === null ? (
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={() => onAnswer({ recalled: true })} icon={<Check className="h-4 w-4" aria-hidden />}>
                  Помню
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onAnswer({ recalled: false })}>
                  Не помню
                </Button>
              </div>
            ) : (
              <p className={cn('text-sm font-semibold', recalled ? 'text-ok' : 'text-muted')}>
                {recalled ? 'Отлично, знание на месте.' : 'Ничего: завтра будет новая карточка.'}
              </p>
            ))}
          <p className="text-xs text-muted">Новый вопрос — завтра.</p>
        </div>
      )}
    </div>
  )
}

// --- how it works ---------------------------------------------------------------------------

const RULES = [
  { icon: CalendarClock, title: 'Новое каждый день', text: 'В полночь — другое направление и другое условие. Задание одно на весь день.' },
  { icon: Target, title: 'Подходит любой рейс', text: 'Засчитывается любой рейс направления, выполнивший условие, — предложенный или свой.' },
  { icon: Flame, title: 'Серия и жетоны', text: 'Дни подряд складываются в серию. Пропустили день — серия начнётся заново, жетоны останутся.' },
]

function Rules() {
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="daily-rules">
      <h2 id="daily-rules" className="text-lg font-semibold">
        Как это работает
      </h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-3">
        {RULES.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand" aria-hidden>
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold leading-tight">{title}</p>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
