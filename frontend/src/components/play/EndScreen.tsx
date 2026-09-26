import { Check, Minus, X } from 'lucide-react'
import type { Quality, RunView } from '@/api/types'
import { cn } from '@/lib/cn'
import { fmtNumber, OUTCOME_META, QUALITY_META, scaleTone, TONE_TEXT } from '@/lib/format'
import { plural, POINTS } from '@/lib/plural'
import { stationFor } from '@/lib/route'
import { AchievementRow } from '../AchievementBadge'
import { Button, ButtonLink } from '../Button'
import { Confetti } from '../Confetti'
import { CountUp } from '../CountUp'
import { Mascot } from '../Mascot'
import { NightPanel, SpeedLines } from '../NightPanel'
import { ScoreRing } from '../ScoreRing'

const LAMPS = [
  { tone: 'bad', on: 'bg-[#FF3B3B] shadow-[0_0_18px_4px_rgb(255_59_59/.6)]' },
  { tone: 'warn', on: 'bg-[#FFC233] shadow-[0_0_18px_4px_rgb(255_194_51/.55)]' },
  { tone: 'ok', on: 'bg-[#2FD17F] shadow-[0_0_18px_4px_rgb(47_209_127/.55)]' },
] as const
const LABEL_ON_DARK = { ok: 'text-[#5FD39A]', warn: 'text-[#FFC233]', bad: 'text-[#FF7A7A]' } as const

/** A three-lamp railway signal with the outcome's lamp lit. */
function Semaphore({ tone }: { tone: 'ok' | 'warn' | 'bad' }) {
  return (
    <div className="flex shrink-0 flex-col items-center" aria-hidden>
      <div className="flex flex-col gap-2 rounded-full bg-[#05080F] p-2 ring-1 ring-white/15">
        {LAMPS.map((l) => (
          <span key={l.tone} className={cn('h-5 w-5 rounded-full', l.tone === tone ? l.on : 'bg-white/[.08]')} />
        ))}
      </div>
      <span className="h-6 w-1 bg-white/20" />
    </div>
  )
}

export function EndScreen({
  run,
  onRestart,
  restarting,
  backTo,
}: {
  run: RunView
  onRestart: () => void
  restarting: boolean
  backTo: string
}) {
  const summary = run.summary
  const outcome = summary?.outcome ?? run.outcome ?? 'partial'
  const meta = OUTCOME_META[outcome]
  const backLabel = backTo.startsWith('/admin')
    ? 'К редактору сценария'
    : backTo === '/profile/history'
      ? 'К истории рейсов'
      : backTo === '/profile'
        ? 'В профиль'
        : 'К расписанию'

  const actions = (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button size="lg" block onClick={onRestart} loading={restarting}>
        Пройти ещё раз
      </Button>
      <ButtonLink to={backTo} size="lg" variant="secondary" className="w-full sm:w-full">
        {backLabel}
      </ButtonLink>
    </div>
  )

  if (!summary) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12">
        <Mascot className="h-24 w-24" mood="thinking" />
        <h1 className="mt-4 text-2xl font-semibold">{run.status === 'abandoned' ? 'Рейс прерван' : 'Рейс завершён'}</h1>
        <div className="mt-6">{actions}</div>
      </div>
    )
  }

  const r = summary.reward
  const breakdown = [
    { label: 'За решения', value: `+${r.decision_points}` },
    { label: 'Бонус за шкалы', value: `+${r.scales_bonus}` },
    { label: 'Бонус за исход', value: `+${r.outcome_bonus}` },
    ...(r.mode_multiplier !== 1
      ? [{ label: run.mode === 'qualification' ? 'Повышение квалификации' : 'Экстренная ситуация', value: `×${String(r.mode_multiplier).replace('.', ',')}` }]
      : []),
    ...(r.repeat_multiplier !== 1 ? [{ label: 'Повторное прохождение', value: `×${String(r.repeat_multiplier).replace('.', ',')}` }] : []),
  ]
  const st = summary.stats

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-16 pt-6 sm:pt-8">
      {outcome === 'success' && <Confetti />}

      {/* outcome on the night line */}
      <NightPanel stripe={outcome === 'success'} className="-mx-2 px-5 pb-6 pt-6 sm:mx-0">
        <SpeedLines rows={[18, 64]} />
        <div className="relative flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className={cn('text-base font-semibold', LABEL_ON_DARK[meta.tone])}>{meta.label}</p>
            <h1 className="mt-1.5 text-[34px] font-bold leading-[1] sm:text-[44px]">{summary.title}</h1>
          </div>
          <Semaphore tone={meta.tone} />
        </div>
        <p className="relative mt-2 max-w-prose text-base leading-relaxed text-white/80">{summary.text}</p>
        <div className="relative mt-5 flex items-end justify-between gap-4 border-t border-white/15 pt-4">
          <p className="digits text-[56px] font-bold leading-[.9]">
            +<CountUp value={r.total} duration={1400} />
            <span className="ml-2 font-sans text-base font-normal text-white/70">{plural(r.total, POINTS)}</span>
          </p>
          <p className="pb-1 text-right text-white/70">
            Всего <span className="digits text-lg font-semibold text-white">{fmtNumber(summary.points_total)}</span>
          </p>
        </div>
      </NightPanel>

      {/* the two scales as rings, and where the points came from */}
      <section className="card p-5 sm:p-6">
        <div className="grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-8">
          <div className="flex justify-center gap-6 sm:justify-start">
            <Scale label="Пассажир" value={run.loyalty} />
            <Scale label="Безопасность" value={run.safety} />
          </div>
          <div>
            <ul className="divide-y divide-line/60">
              {breakdown.map((b) => (
                <li key={b.label} className="flex items-center justify-between py-2">
                  <span className="text-muted">{b.label}</span>
                  <span className="digits text-base font-semibold">{b.value}</span>
                </li>
              ))}
              <li className="flex items-center justify-between pt-2.5">
                <span className="font-semibold">Итого</span>
                <span className="digits text-xl font-bold">+{r.total}</span>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-4 flex flex-wrap gap-2 border-t border-line/60 pt-4 text-xs">
          <Stat label="решений" value={st.decisions} />
          <Stat label="верных" value={st.best} tone="text-ok" />
          <Stat label="быстрых" value={st.fast} tone="text-cat-safety" />
          <Stat label="без ответа" value={st.timeouts} tone={st.timeouts ? 'text-bad' : undefined} />
        </p>
      </section>

      {/* level up: the train reached a new station */}
      {summary.level_up && (
        <section className="card relative overflow-hidden border-l-4 border-l-brand p-5">
          <p className="text-muted">Новая станция на маршруте</p>
          <p className="mt-1 text-2xl font-semibold leading-none">{stationFor(summary.level_after).name}</p>
          <p className="mt-1.5">
            Уровень {summary.level_after}, {summary.level_title}
          </p>
        </section>
      )}

      {summary.achievements.length > 0 && (
        <section className="card p-5">
          <h2 className="text-lg font-semibold">Новые достижения</h2>
          <ul className="mt-1 divide-y divide-line/70">
            {summary.achievements.map((a) => (
              <AchievementRow key={a.code} achievement={a} />
            ))}
          </ul>
        </section>
      )}

      {/* debrief: each decision that wasn't the best, with what the regulations recommend */}
      <section className="card p-5 sm:p-6" aria-labelledby="debrief">
        <h2 id="debrief" className="text-lg font-semibold">
          Разбор
        </h2>
        {summary.debrief.length === 0 ? (
          <p className="mt-2 text-muted">Все решения верные. Разбирать нечего.</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {summary.debrief.map((d, i) => {
              const q = QUALITY_META[d.quality]
              const Icon = QUALITY_ICON[d.quality]
              return (
                <li key={d.node_id + i} className="rounded-2xl bg-ink/[.025] p-4 ring-1 ring-inset ring-line/60">
                  <div className="flex items-start gap-3">
                    <span className={cn('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full', QUALITY_BADGE[d.quality])} aria-hidden>
                      <Icon className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-xs font-semibold', TONE_TEXT[q.tone])}>{q.label}</p>
                      <p className="mt-0.5 font-medium leading-snug">{d.prompt}</p>
                    </div>
                  </div>
                  <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className={cn('rounded-xl border-l-[3px] bg-surface px-3 py-2 dark:bg-surface-2/60', QUALITY_LINE[d.quality])}>
                      <dt className="text-xs text-muted">Ваш ответ</dt>
                      <dd className="mt-0.5 leading-snug">{d.answer}</dd>
                    </div>
                    {d.recommended && (
                      <div className="rounded-xl border-l-[3px] border-ok bg-ok-soft/70 px-3 py-2">
                        <dt className="text-xs text-muted">Рекомендуется</dt>
                        <dd className="mt-0.5 leading-snug">{d.recommended}</dd>
                      </div>
                    )}
                  </dl>
                  {(d.feedback || d.explanation) && (
                    <p className="mt-3 text-sm leading-relaxed text-muted">
                      {d.feedback}
                      {d.explanation ? ` ${d.explanation}` : ''}
                    </p>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </section>

      {actions}
    </div>
  )
}

const QUALITY_ICON: Record<Quality, typeof Check> = { best: Check, ok: Minus, bad: X }
const QUALITY_BADGE: Record<Quality, string> = { best: 'bg-ok text-white', ok: 'bg-warn text-[#1C2430]', bad: 'bg-bad text-white' }
const QUALITY_LINE: Record<Quality, string> = { best: 'border-ok', ok: 'border-warn', bad: 'border-bad' }

/** A 0..100 scale as a ring in its signal colour. */
function Scale({ label, value }: { label: string; value: number }) {
  const tone = scaleTone(value)
  return (
    <div className="flex flex-col items-center gap-2">
      <ScoreRing value={value / 100} tone={tone} size={84} stroke={8} label={`${label}: ${value} из 100`}>
        <span className="digits text-2xl font-bold leading-none">{value}</span>
      </ScoreRing>
      <span className="text-sm text-muted">{label}</span>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <span className="rounded-full bg-ink/[.04] px-2.5 py-1 text-muted ring-1 ring-inset ring-line/60">
      <span className={cn('digits text-sm font-semibold text-ink', tone)}>{value}</span> {label}
    </span>
  )
}
