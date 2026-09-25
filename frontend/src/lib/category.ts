import { HeartPulse, Handshake, MessagesSquare, ShieldCheck, Sparkles, Wrench, type LucideIcon } from 'lucide-react'

/**
 * Category accents: six muted hues for tiles, chips and competency bars.
 * Never used for semantic signals (those stay green / yellow / red).
 * Class strings are literal so Tailwind can see them.
 */
export interface CategoryStyle {
  icon: LucideIcon
  /** Accent text/icon colour. */
  text: string
  /** Soft tint background. */
  soft: string
  /** Solid accent background (bars, dots). */
  fill: string
  /** Accent border. */
  border: string
  /** Hex for charts. */
  hex: string
  short: string
}

const STYLES: Record<string, CategoryStyle> = {
  conflict: {
    icon: MessagesSquare,
    text: 'text-cat-conflict',
    soft: 'bg-cat-conflict-soft',
    fill: 'bg-cat-conflict',
    border: 'border-cat-conflict',
    hex: '#94507F',
    short: 'Конфликты',
  },
  medical: {
    icon: HeartPulse,
    text: 'text-cat-medical',
    soft: 'bg-cat-medical-soft',
    fill: 'bg-cat-medical',
    border: 'border-cat-medical',
    hex: '#1E7D83',
    short: 'Медицина',
  },
  safety: {
    icon: ShieldCheck,
    text: 'text-cat-safety',
    soft: 'bg-cat-safety-soft',
    fill: 'bg-cat-safety',
    border: 'border-cat-safety',
    hex: '#3763A0',
    short: 'Безопасность',
  },
  technical: {
    icon: Wrench,
    text: 'text-cat-technical',
    soft: 'bg-cat-technical-soft',
    fill: 'bg-cat-technical',
    border: 'border-cat-technical',
    hex: '#56657B',
    short: 'Техника',
  },
  service: {
    icon: Sparkles,
    text: 'text-cat-service',
    soft: 'bg-cat-service-soft',
    fill: 'bg-cat-service',
    border: 'border-cat-service',
    hex: '#6A57A6',
    short: 'Сервис',
  },
  teamwork: {
    icon: Handshake,
    text: 'text-cat-teamwork',
    soft: 'bg-cat-teamwork-soft',
    fill: 'bg-cat-teamwork',
    border: 'border-cat-teamwork',
    hex: '#9A7440',
    short: 'Команда',
  },
}

export function categoryStyle(code: string | null | undefined): CategoryStyle {
  return (code && STYLES[code]) || STYLES.technical
}
