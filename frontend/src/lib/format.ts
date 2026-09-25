import type { Outcome, Quality, Rarity } from '@/api/types'

export const fmtNumber = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : new Intl.NumberFormat('ru-RU').format(n)

export const fmtPercent = (share: number | null | undefined, digits = 0) =>
  share === null || share === undefined ? '—' : `${(share * 100).toFixed(digits).replace('.', ',')}%`

export const fmtScore = (n: number | null | undefined) => (n === null || n === undefined ? '—' : String(Math.round(n)))

export function fmtDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

export function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return 'никогда'
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'только что'
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`
  const days = Math.floor(diff / 86400)
  if (days === 1) return 'вчера'
  if (days < 30) return `${days} дн назад`
  return fmtDate(iso)
}

/** "1:05", "12:03:44", "2 д 04:10:00" */
export function fmtDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const days = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (x: number) => String(x).padStart(2, '0')
  if (days > 0) return `${days} д ${pad(h)}:${pad(m)}:${pad(sec)}`
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`
  return `${m}:${pad(sec)}`
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

export function firstName(fullName: string): string {
  const parts = fullName.split(/\s+/).filter(Boolean)
  // "Фамилия Имя Отчество" → Имя; "Имя Фамилия" → Имя
  return parts.length >= 3 ? parts[1] : parts[0] ?? ''
}

export const OUTCOME_META: Record<Outcome, { label: string; tone: 'ok' | 'warn' | 'bad'; emoji: string }> = {
  success: { label: 'Успех', tone: 'ok', emoji: '🏆' },
  partial: { label: 'Частично', tone: 'warn', emoji: '⚖️' },
  fail: { label: 'Провал', tone: 'bad', emoji: '⚠️' },
}

export const QUALITY_META: Record<Quality, { label: string; tone: 'ok' | 'warn' | 'bad' }> = {
  best: { label: 'Верно', tone: 'ok' },
  ok: { label: 'Допустимо', tone: 'warn' },
  bad: { label: 'Ошибка', tone: 'bad' },
}

/** Rarity: a word plus a tinted ring (grey, blue, violet, gold) around the medallion. */
export const RARITY_META: Record<Rarity, { label: string; ring: string; plate: string; text: string }> = {
  common: {
    label: 'Обычное',
    ring: 'ring-2 ring-rarity-common/80',
    plate: 'bg-gradient-to-b from-surface to-surface-2',
    text: 'text-muted',
  },
  rare: {
    label: 'Редкое',
    ring: 'ring-2 ring-rarity-rare',
    plate: 'bg-gradient-to-br from-rarity-rare-soft via-surface to-rarity-rare-soft',
    text: 'text-rarity-rare',
  },
  epic: {
    label: 'Эпическое',
    ring: 'ring-[3px] ring-rarity-epic shadow-[0_0_16px_rgb(124_77_201/.35)]',
    plate: 'bg-gradient-to-br from-rarity-epic-soft via-surface to-rarity-epic-soft',
    text: 'text-rarity-epic',
  },
  legendary: {
    label: 'Легендарное',
    ring: 'ring-[3px] ring-rarity-legendary shadow-[0_0_18px_rgb(212_160_23/.5)]',
    plate: 'bg-gradient-to-br from-rarity-legendary-soft via-surface to-rarity-legendary-soft',
    text: 'text-rarity-legendary-ink',
  },
}

export const rarityMeta = (r: string) => RARITY_META[(r as Rarity) in RARITY_META ? (r as Rarity) : 'common']

export const MODE_LABEL: Record<string, string> = {
  training: 'Тренировка',
  qualification: 'Повышение квалификации',
  emergency: 'Специвент',
  locked: 'Закрыт',
}

export const POSITION_ORDER = ['conductor', 'senior_conductor', 'train_chief'] as const
export const POSITION_TITLES: Record<string, string> = {
  conductor: 'Проводник',
  senior_conductor: 'Старший проводник',
  train_chief: 'Начальник поезда',
}
export const nextPosition = (p: string): string | null => {
  const i = POSITION_ORDER.indexOf(p as (typeof POSITION_ORDER)[number])
  return i >= 0 && i < POSITION_ORDER.length - 1 ? POSITION_ORDER[i + 1] : null
}

export const CATEGORY_TITLES: Record<string, { title: string; icon: string }> = {
  conflict: { title: 'Конфликты с пассажирами', icon: '🗣️' },
  medical: { title: 'Медицинские инциденты', icon: '🩺' },
  safety: { title: 'Безопасность', icon: '🛡️' },
  technical: { title: 'Технические неисправности', icon: '🔧' },
  service: { title: 'Премиальный сервис', icon: '⭐' },
  teamwork: { title: 'Зоны ответственности', icon: '🤝' },
}

/** Signal colour for a 0..100 scale value: ≥70 green, 40–69 yellow, <40 red. */
export function scaleTone(value: number): 'bad' | 'warn' | 'ok' {
  if (value < 40) return 'bad'
  if (value < 70) return 'warn'
  return 'ok'
}

export const TONE_TEXT = { ok: 'text-ok', warn: 'text-warn-ink', bad: 'text-bad' } as const
export const TONE_BG = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad' } as const
