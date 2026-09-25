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
  /** Faint inset ring in the accent, for tiles. */
  ring: string
  /** Hex for charts (light / dark theme). */
  hex: string
  hexDark: string
  short: string
}

const STYLES: Record<string, CategoryStyle> = {
  conflict: {
    icon: MessagesSquare,
    text: 'text-cat-conflict',
    soft: 'bg-cat-conflict-soft',
    fill: 'bg-cat-conflict',
    border: 'border-cat-conflict',
    ring: 'ring-cat-conflict/20',
    hex: '#94507F',
    hexDark: '#DA88BE',
    short: 'Конфликты',
  },
  medical: {
    icon: HeartPulse,
    text: 'text-cat-medical',
    soft: 'bg-cat-medical-soft',
    fill: 'bg-cat-medical',
    border: 'border-cat-medical',
    ring: 'ring-cat-medical/20',
    hex: '#1E7D83',
    hexDark: '#4EC4C8',
    short: 'Медицина',
  },
  safety: {
    icon: ShieldCheck,
    text: 'text-cat-safety',
    soft: 'bg-cat-safety-soft',
    fill: 'bg-cat-safety',
    border: 'border-cat-safety',
    ring: 'ring-cat-safety/20',
    hex: '#3763A0',
    hexDark: '#74A2E8',
    short: 'Безопасность',
  },
  technical: {
    icon: Wrench,
    text: 'text-cat-technical',
    soft: 'bg-cat-technical-soft',
    fill: 'bg-cat-technical',
    border: 'border-cat-technical',
    ring: 'ring-cat-technical/20',
    hex: '#56657B',
    hexDark: '#9CACC4',
    short: 'Техника',
  },
  service: {
    icon: Sparkles,
    text: 'text-cat-service',
    soft: 'bg-cat-service-soft',
    fill: 'bg-cat-service',
    border: 'border-cat-service',
    ring: 'ring-cat-service/20',
    hex: '#6A57A6',
    hexDark: '#A692EC',
    short: 'Сервис',
  },
  teamwork: {
    icon: Handshake,
    text: 'text-cat-teamwork',
    soft: 'bg-cat-teamwork-soft',
    fill: 'bg-cat-teamwork',
    border: 'border-cat-teamwork',
    ring: 'ring-cat-teamwork/20',
    hex: '#9A7440',
    hexDark: '#DAAE70',
    short: 'Команда',
  },
}

export function categoryStyle(code: string | null | undefined): CategoryStyle {
  return (code && STYLES[code]) || STYLES.technical
}

/** A known category code (unknown ones fall back to «technical», like `categoryStyle`). Used for `--cat-<code>` CSS vars. */
export function categoryKey(code: string | null | undefined): string {
  return code && STYLES[code] ? code : 'technical'
}
