import { Check, Minus, Volume2, X } from 'lucide-react'
import type { Effects, Grade, HistoryItem, Quality } from '@/api/types'
import { cn } from '@/lib/cn'
import { categoryStyle } from '@/lib/category'
import { QUALITY_META } from '@/lib/format'
import { plural, POINTS } from '@/lib/plural'
import { Mascot } from '../Mascot'

const isVova = (name: string | null | undefined) => !!name && name.startsWith('Вова')

/** 40px speaker circle on the scenario's category tint. */
export function SpeakerAvatar({ name, avatar, category }: { name: string | null; avatar: string | null; category?: string }) {
  const tint = categoryStyle(category).soft
  if (isVova(name)) {
    return (
      <div className={cn('grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full ring-2 ring-surface', tint)} aria-hidden>
        <Mascot className="h-11 w-11 translate-y-1" />
      </div>
    )
  }
  return (
    <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full text-[22px] ring-2 ring-surface', tint)} aria-hidden>
      <span className="leading-none">{avatar || '🎙️'}</span>
    </div>
  )
}

/**
 * A line from a character or the narrator. What's already happened steps back into muted text;
 * the current line is a lit card: the scene in the category's tint, a character in a bubble.
 */
export function PromptBubble({
  speaker,
  name,
  role,
  avatar,
  text,
  onReplay,
  speaking,
  current,
  category,
}: {
  speaker: string
  name: string | null
  role?: string | null
  avatar: string | null
  text: string
  onReplay?: () => void
  speaking?: boolean
  current?: boolean
  category?: string
}) {
  const c = categoryStyle(category)
  if (speaker === 'narrator' || !name) {
    return current ? (
      <div className={cn('feed-in rounded-2xl px-4 py-3.5 ring-1 ring-inset sm:px-5 sm:py-4', c.soft, c.ring)}>
        <p className="text-[17px] leading-relaxed text-ink">{text}</p>
        {onReplay && <ReplayButton onClick={onReplay} speaking={speaking} className="mt-3" />}
      </div>
    ) : (
      <p className="border-l-2 border-line pl-3.5 leading-relaxed text-muted">{text}</p>
    )
  }
  return (
    <div className={cn('flex max-w-[92%] items-end gap-2.5 sm:max-w-[82%]', current && 'feed-in')}>
      <SpeakerAvatar name={name} avatar={avatar} category={category} />
      <div className="min-w-0">
        <p className="mb-1 ml-1 text-xs text-muted">
          <span className="font-semibold text-ink/80">{name}</span>
          {role && ` · ${role}`}
        </p>
        <div
          className={cn(
            'rounded-[20px] rounded-bl-md px-4 py-2.5 leading-relaxed',
            current ? 'bg-surface text-[17px] text-ink shadow-card ring-1 ring-inset ring-line/80 dark:bg-surface-2' : 'bg-ink/[.04] text-muted',
          )}
        >
          {text}
          {onReplay && <ReplayButton onClick={onReplay} speaking={speaking} className="mt-2.5" />}
        </div>
      </div>
    </div>
  )
}

function ReplayButton({ onClick, speaking, className }: { onClick: () => void; speaking?: boolean; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex min-h-[40px] items-center gap-2 rounded-full bg-surface/80 px-3.5 text-sm font-medium text-ink ring-1 ring-inset ring-line transition-colors hover:bg-surface coarse:min-h-[44px]',
        className,
      )}
    >
      <Volume2 className={cn('h-4 w-4', speaking && 'animate-pulse text-brand')} aria-hidden />
      {speaking ? 'Воспроизводится' : 'Прослушать голосовое'}
    </button>
  )
}

/** Your answer, on the right in the «you» tint used across the app. */
export function AnswerBubble({ text, timedOut, fresh }: { text: string; timedOut?: boolean; fresh?: boolean }) {
  return (
    <div className={cn('ml-auto flex max-w-[88%] justify-end sm:max-w-[75%]', fresh && 'feed-in')}>
      <div
        className={cn(
          'rounded-[20px] rounded-br-md px-4 py-2.5 leading-relaxed',
          timedOut ? 'border border-dashed border-line text-muted' : 'bg-brand-soft text-ink ring-1 ring-inset ring-brand/20',
        )}
      >
        {timedOut ? 'Нет ответа' : text}
      </div>
    </div>
  )
}

const QUALITY_TONE: Record<Quality, { text: string; badge: string; line: string }> = {
  best: { text: 'text-ok', badge: 'bg-ok text-white', line: 'border-ok/50' },
  ok: { text: 'text-warn-ink', badge: 'bg-warn text-[#1C2430]', line: 'border-warn/60' },
  bad: { text: 'text-bad', badge: 'bg-bad text-white', line: 'border-bad/50' },
}
const QUALITY_ICON: Record<Quality, typeof Check> = { best: Check, ok: Minus, bad: X }

const signed = (v: number) => (v >= 0 ? `+${v}` : `−${Math.abs(v)}`)

/** «Пассажир +10» as soft chips in the signal colour of the change. */
export function EffectPills({ effects }: { effects: Effects }) {
  const items = (
    [
      ['loyalty', 'Пассажир'],
      ['safety', 'Безопасность'],
    ] as const
  ).filter(([k]) => effects[k])
  return (
    <>
      {items.map(([k, label]) => {
        const v = effects[k] ?? 0
        return (
          <span key={k} className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', v > 0 ? 'bg-ok-soft text-ok' : 'bg-brand-soft text-bad')}>
            {label} <span className="digits font-semibold">{signed(v)}</span>
          </span>
        )
      })}
    </>
  )
}

/** The verdict under an answer: quality, points, how the scales moved and why. */
export function FeedbackChip({
  quality,
  points,
  effects,
  feedback,
  fast,
  timedOut,
  grade,
  fresh,
}: {
  quality: Quality
  points: number
  effects: Effects
  feedback: string
  fast: boolean
  timedOut: boolean
  grade: Grade | null
  fresh?: boolean
}) {
  const t = QUALITY_TONE[quality]
  const Icon = QUALITY_ICON[quality]
  return (
    <div className={cn('ml-auto max-w-[92%] sm:max-w-[75%]', fresh && 'feed-in')} style={fresh ? { animationDelay: '120ms' } : undefined}>
      <div className={cn('rounded-2xl border-l-[3px] bg-surface/70 px-3.5 py-2.5 ring-1 ring-inset ring-line/60 dark:bg-surface-2/60', t.line)}>
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span className={cn('flex items-center gap-1.5 text-sm font-semibold', t.text)}>
            <span className={cn('grid h-[18px] w-[18px] place-items-center rounded-full', t.badge)} aria-hidden>
              <Icon className="h-3 w-3" strokeWidth={3} />
            </span>
            {timedOut ? 'Время вышло' : QUALITY_META[quality].label}
          </span>
          <span className={cn('digits text-sm font-semibold', fresh && 'points-pop')}>
            {signed(points)} <span className="font-sans font-normal text-muted">{plural(points, POINTS)}</span>
          </span>
          {fast && <span className="rounded-full bg-cat-safety-soft px-2 py-0.5 text-xs font-medium text-cat-safety">быстро +5</span>}
          {grade && <span className="text-xs text-muted">ИИ: {String(grade.score).replace('.', ',')} из 10</span>}
          <EffectPills effects={effects} />
        </p>
        {feedback && <p className="mt-1.5 text-sm leading-relaxed text-muted">{feedback}</p>}
      </div>
    </div>
  )
}

export function HistoryEntry({ item, category, fresh }: { item: HistoryItem; fresh?: boolean; category?: string }) {
  return (
    <div className="space-y-2.5">
      <PromptBubble speaker={item.speaker} name={item.speaker_name} avatar={item.avatar} text={item.text} category={category} />
      {item.type !== 'scene' && (item.answer || item.timed_out) && <AnswerBubble text={item.answer} timedOut={item.timed_out} fresh={fresh} />}
      {item.type !== 'scene' && item.quality && (
        <FeedbackChip
          quality={item.quality}
          points={item.points}
          effects={item.effects}
          feedback={item.feedback}
          fast={item.fast}
          timedOut={item.timed_out}
          grade={item.grade}
          fresh={fresh}
        />
      )}
    </div>
  )
}

/** «ИИ-наставник проверяет ответ» with the typing dots, where his verdict will appear. */
export function GradingIndicator() {
  return (
    <div className="feed-in ml-auto flex max-w-[88%] justify-end sm:max-w-[75%]" role="status">
      <span className="inline-flex items-center gap-2.5 rounded-2xl bg-ink/[.04] px-3.5 py-2.5 text-sm text-muted ring-1 ring-inset ring-line/60">
        ИИ-наставник проверяет ответ
        <span className="flex gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="typing-dot h-1.5 w-1.5 rounded-full bg-muted" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </span>
      </span>
    </div>
  )
}
