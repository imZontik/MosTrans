import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/**
 * Theme: «Системная» follows prefers-color-scheme, «Светлая» / «Тёмная» are pinned and saved in localStorage.
 * The inline script in index.html applies the same logic before first paint, so there's no flash.
 */
export type ThemePref = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

const KEY = 'm400-theme'
const THEME_COLOR: Record<Theme, string> = { light: '#E9ECEF', dark: '#0B1220' }

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* storage blocked: fall back to system */
  }
  return 'system'
}

function writePref(p: ThemePref) {
  try {
    if (p === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, p)
  } catch {
    /* storage blocked: the choice lives for this tab only */
  }
}

const media = () => (typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: dark)') : undefined)
const systemTheme = (): Theme => (media()?.matches ? 'dark' : 'light')

function applyTheme(t: Theme) {
  const root = document.documentElement
  root.classList.toggle('dark', t === 'dark')
  root.style.colorScheme = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[t])
}

interface ThemeState {
  pref: ThemePref
  theme: Theme
  setPref: (p: ThemePref) => void
}

const Ctx = createContext<ThemeState | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(readPref)
  const [system, setSystem] = useState<Theme>(systemTheme)
  const theme: Theme = pref === 'system' ? system : pref

  useEffect(() => {
    const mq = media()
    if (!mq) return
    const on = () => setSystem(mq.matches ? 'dark' : 'light')
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])

  // another tab changed the theme
  useEffect(() => {
    const on = (e: StorageEvent) => e.key === KEY && setPrefState(readPref())
    window.addEventListener('storage', on)
    return () => window.removeEventListener('storage', on)
  }, [])

  useEffect(() => applyTheme(theme), [theme])

  const setPref = useCallback((p: ThemePref) => {
    writePref(p)
    setPrefState(p)
  }, [])

  const value = useMemo(() => ({ pref, theme, setPref }), [pref, theme, setPref])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme(): ThemeState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTheme outside ThemeProvider')
  return v
}
