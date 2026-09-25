import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, LOGOUT_EVENT, tokenStore } from '@/api/client'
import type { Me } from '@/api/types'

interface AuthValue {
  user: Me | null
  ready: boolean
  isStaff: boolean
  login: (email: string, password: string) => Promise<Me>
  logout: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

/** Web-view embedding: `?token=...` on any page logs the user in and is stripped from the URL. */
function consumeUrlToken() {
  const url = new URL(window.location.href)
  const token = url.searchParams.get('token')
  if (!token) return
  tokenStore.set(token)
  url.searchParams.delete('token')
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null)
      return
    }
    try {
      setUser(await api.me())
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    consumeUrlToken()
    refresh().finally(() => setReady(true))
    const onLogout = () => setUser(null)
    window.addEventListener(LOGOUT_EVENT, onLogout)
    return () => window.removeEventListener(LOGOUT_EVENT, onLogout)
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password)
    tokenStore.set(res.access_token)
    const me = await api.me()
    setUser(me)
    return me
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      user,
      ready,
      isStaff: user?.role === 'lead' || user?.role === 'admin',
      login,
      logout,
      refresh,
    }),
    [user, ready, login, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
