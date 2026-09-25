import { useTheme } from './ThemeContext'

export interface ChartColors {
  ink: string
  axis: string
  grid: string
  surface: string
  cursor: string
  success: string
  partial: string
  fail: string
}

/** Recharts needs literal colours: one set per theme, matching the CSS tokens. */
const PALETTE: Record<'light' | 'dark', ChartColors> = {
  light: {
    ink: '#1C2430',
    axis: '#5B6673',
    grid: '#D6DBE1',
    surface: '#FFFFFF',
    cursor: 'rgba(28,36,48,.05)',
    success: '#13854E',
    partial: '#E8A317',
    fail: '#E21A1A',
  },
  dark: {
    ink: '#E6EAF1',
    axis: '#96A2B6',
    grid: '#27334C',
    surface: '#121A2B',
    cursor: 'rgba(230,234,241,.06)',
    success: '#3DCC84',
    partial: '#F2B62D',
    fail: '#FF4D4D',
  },
}

export function useChartColors(): ChartColors {
  return PALETTE[useTheme().theme]
}

/** Tooltip box that follows the theme. */
export function tooltipStyle(c: ChartColors) {
  return {
    borderRadius: 12,
    border: `1px solid ${c.grid}`,
    background: c.surface,
    color: c.ink,
    fontSize: 13,
    fontFamily: 'Golos Text',
    boxShadow: '0 12px 28px -12px rgba(0,0,0,.35)',
  }
}
