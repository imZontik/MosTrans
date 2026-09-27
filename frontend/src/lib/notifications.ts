import type { NotificationPriority } from '@/api/types'

/** The importance tags: a coloured dot, a chip on the notifications page, a badge in the broadcast history. */
export const PRIORITY_META: Record<NotificationPriority, { label: string; dot: string; text: string; soft: string }> = {
  high: { label: 'Важное', dot: 'bg-brand', text: 'text-brand', soft: 'bg-brand-soft text-brand' },
  normal: { label: 'Обычное', dot: 'bg-ink/70', text: 'text-ink', soft: 'bg-ink/[.06] text-ink' },
  low: { label: 'Инфо', dot: 'bg-muted/60', text: 'text-muted', soft: 'bg-ink/[.04] text-muted' },
}

export const PRIORITIES: NotificationPriority[] = ['high', 'normal', 'low']

const DAY = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })
const TIME = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' })

/** «Сегодня», «Вчера», «25 сентября» — the day headings of the inbox. */
export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((start(now) - start(d)) / 86_400_000)
  if (days === 0) return 'Сегодня'
  if (days === 1) return 'Вчера'
  return DAY.format(d)
}

export const timeLabel = (iso: string) => TIME.format(new Date(iso))
