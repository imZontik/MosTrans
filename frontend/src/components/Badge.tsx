import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'bad' | 'info' | 'dark' | 'violet'

const TONES: Record<Tone, string> = {
  neutral: 'bg-ink/[.06] text-ink',
  brand: 'bg-brand-soft text-brand',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn-ink',
  bad: 'bg-brand-soft text-brand',
  info: 'bg-ink/[.06] text-ink',
  dark: 'bg-ink text-inverse',
  violet: 'bg-ink/[.06] text-ink',
}

export function Badge({
  tone = 'neutral',
  icon,
  children,
  className,
}: {
  tone?: Tone
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium leading-none',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

export function ProviderBadge({ provider }: { provider: string }) {
  const map: Record<string, { label: string; tone: Tone }> = {
    template: { label: 'Шаблон', tone: 'neutral' },
    rules: { label: 'Правила и данные', tone: 'neutral' },
    heuristic: { label: 'Эвристика', tone: 'neutral' },
    offline: { label: 'Офлайн', tone: 'warn' },
    gigachat: { label: 'GigaChat', tone: 'ok' },
    'ollama-qwen': { label: 'Qwen (Ollama)', tone: 'neutral' },
  }
  const meta = map[provider] ?? { label: provider, tone: 'neutral' as Tone }
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}
