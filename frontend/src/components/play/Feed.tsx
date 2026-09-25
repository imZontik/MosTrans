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

/** A line from a character or the narrator. */
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
  if (speaker === 'narrator' || !name) {
    const c = categoryStyle(category)
    return (
      <div className={cn('border-l-[3px] pl-3', current ? cn(c.border, 'text-ink') : 'border-line text-muted')}>
        <p className="text-base leading-relaxed">{text}</p>
        {onReplay && <ReplayButton onClick={onReplay} speaking={speaking} className="mt-2" />}
      </div>
    )
  }
  return (
    <div className="flex max-w-[92%] items-end gap-2 sm:max-w-[80%]">
      <SpeakerAvatar name={name} avatar={avatar} category={category} />
      <div className="min-w-0">
        <p className="mb-1 ml-1 text-xs text-muted">
          <span className="font-medium text-ink">{name}</span>
          {role && `, ${role}`}
        </p>
        <div
          className={cn(
            'rounded-2xl rounded-bl-[4px] border px-3.5 py-2.5 leading-relaxed',
            current ? 'card rounded-bl-[4px] text-base text-ink' : 'border-transparent bg-surface/70 text-muted',
          )}
        >
          {text}
          {onReplay && <ReplayButton onClick={onReplay} speaking={speaking} className="mt-2" />}
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
        'flex min-h-[40px] coarse:min-h-[44px] items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink transition-colors hover:border-ink/40 hover:bg-surface-2',
        className,
      )}
    >
      <Volume2 className="h-4 w-4" aria-hidden />
      {speaking ? 'Воспроизводится' : 'Прослушать голосовое'}
    </button>
  )
}

export function AnswerBubble({ text, timedOut }: { text: string; timedOut?: boolean }) {
  return (
    <div className="ml-auto flex max-w-[88%] justify-end sm:max-w-[75%]">
      <div
        className={cn(
          'rounded-2xl rounded-br-[4px] px-3.5 py-2.5 leading-relaxed',
          timedOut ? 'border border-dashed border-muted text-muted' : 'border-r-[3px] border-brand bg-ink text-inverse shadow-card',
        )}
      >
        {text}
      </div>
    </div>
  )
}

const QUALITY_TEXT: Record<Quality, string> = { best: 'text-ok', ok: 'text-warn-ink', bad: 'text-bad' }
const QUALITY_ICON: Record<Quality, { icon: typeof Check; className: string }> = {
  best: { icon: Check, className: 'bg-ok text-white' },
  ok: { icon: Minus, className: 'bg-warn text-[#1C2430]' },
  bad: { icon: X, className: 'bg-bad text-white' },
}

function signed(v: number) {
  return v >= 0 ? `+${v}` : `−${Math.abs(v)}`
}

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
          <span key={k} className="whitespace-nowrap">
            {label} <span className={cn('digits text-sm font-semibold', v > 0 ? 'text-ok' : 'text-bad')}>{signed(v)}</span>
          </span>
        )
      })}
    </>
  )
}

/** Compact result line under an answer: quality word, points, effects. */
export function FeedbackChip({
  quality,
  points,
  effects,
  feedback,
  fast,
  timedOut,
  grade,
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
  return (
    <div className="ml-auto max-w-[92%] text-right sm:max-w-[75%]">
      <p className="flex flex-wrap items-baseline justify-end gap-x-3 gap-y-0.5 text-xs text-muted">
        <span className={cn('flex items-center gap-1.5 text-sm font-semibold', QUALITY_TEXT[quality])}>
          <QualityIcon quality={quality} />
          {timedOut ? 'Время вышло' : QUALITY_META[quality].label}
        </span>
        <span className="digits text-sm font-semibold text-ink">
          {signed(points)} {plural(points, POINTS)}
        </span>
        {fast && <span>быстро, +5</span>}
        {grade && <span>ИИ: {String(grade.score).replace('.', ',')} из 10</span>}
        <EffectPills effects={effects} />
      </p>
      {feedback && <p className="mt-1 text-left text-sm text-muted sm:text-right">{feedback}</p>}
    </div>
  )
}

function QualityIcon({ quality }: { quality: Quality }) {
  const { icon: Icon, className } = QUALITY_ICON[quality]
  return (
    <span className={cn('grid h-[18px] w-[18px] place-items-center rounded-full', className)} aria-hidden>
      <Icon className="h-3 w-3" strokeWidth={3} />
    </span>
  )
}

export function HistoryEntry({ item, category }: { item: HistoryItem; fresh?: boolean; category?: string }) {
  return (
    <div className="space-y-2.5">
      <PromptBubble speaker={item.speaker} name={item.speaker_name} avatar={item.avatar} text={item.text} category={category} />
      {item.type !== 'scene' && item.answer && <AnswerBubble text={item.answer} timedOut={item.timed_out} />}
      {item.type !== 'scene' && item.quality && (
        <FeedbackChip
          quality={item.quality}
          points={item.points}
          effects={item.effects}
          feedback={item.feedback}
          fast={item.fast}
          timedOut={item.timed_out}
          grade={item.grade}
        />
      )}
    </div>
  )
}

export function GradingIndicator() {
  return (
    <div className="ml-auto flex max-w-[88%] items-center justify-end gap-2 text-muted sm:max-w-[75%]" role="status">
      <span>ИИ-наставник проверяет ответ</span>
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="typing-dot h-1.5 w-1.5 rounded-full bg-ink" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </span>
    </div>
  )
}
