import type { RunView } from '@/api/types'
import { cn } from '@/lib/cn'
import { fmtNumber, OUTCOME_META, QUALITY_META, TONE_TEXT } from '@/lib/format'
import { plural, POINTS } from '@/lib/plural'
import { stationFor } from '@/lib/route'
import { AchievementRow } from '../AchievementBadge'
import { Button, ButtonLink } from '../Button'
import { Confetti } from '../Confetti'
import { CountUp } from '../CountUp'
import { Mascot } from '../Mascot'
import { NightPanel, SpeedLines } from '../NightPanel'
import { SignalBar } from '../SignalBar'

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

      {/* scales and points breakdown */}
      <section className="card p-5">
        <div className="flex gap-5">
          <SignalBar label="Пассажир" value={run.loyalty} />
          <SignalBar label="Безопасность" value={run.safety} />
        </div>
        <ul className="mt-4 divide-y divide-line/70 border-t border-line/70">
          {breakdown.map((b) => (
            <li key={b.label} className="flex items-center justify-between py-2.5">
              <span className="text-muted">{b.label}</span>
              <span className="digits text-base font-semibold">{b.value}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">
          Решений {st.decisions}: верных {st.best}, быстрых {st.fast}, не успели ответить {st.timeouts}.
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

      {/* debrief */}
      <section className="card p-5">
        <h2 className="text-lg font-semibold">Разбор</h2>
        {summary.debrief.length === 0 ? (
          <p className="mt-2 text-muted">Все решения верные. Разбирать нечего.</p>
        ) : (
          <ul className="mt-1 divide-y divide-line/70">
            {summary.debrief.map((d, i) => {
              const q = QUALITY_META[d.quality]
              return (
                <li key={d.node_id + i} className="py-4 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium leading-snug">{d.prompt}</p>
                    <span className={cn('shrink-0 text-xs font-semibold', TONE_TEXT[q.tone])}>{q.label}</span>
                  </div>
                  <dl className="mt-2 space-y-1.5">
                    <div>
                      <dt className="text-xs text-muted">Ваш ответ</dt>
                      <dd className={cn('border-l-2 pl-2', { best: 'border-ok', ok: 'border-warn', bad: 'border-bad' }[d.quality])}>{d.answer}</dd>
                    </div>
                    {d.recommended && (
                      <div>
                        <dt className="text-xs text-muted">Рекомендуется</dt>
                        <dd className="border-l-2 border-ok pl-2">{d.recommended}</dd>
                      </div>
                    )}
                  </dl>
                  {(d.feedback || d.explanation) && (
                    <p className="mt-2 text-muted">
                      {d.feedback}
                      {d.explanation ? ` ${d.explanation}` : ''}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {actions}
    </div>
  )
}
