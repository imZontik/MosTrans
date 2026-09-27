import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { api } from '@/api/client'
import type { AppNotification, UnreadCounts } from '@/api/types'
import { useAuth } from '@/auth/AuthContext'
import { NotificationDialog } from '@/components/NotificationDialog'
import { usePolling } from '@/hooks/usePolling'
import { cn } from '@/lib/cn'
import { PRIORITY_META } from '@/lib/notifications'

const POLL_MS = 30_000
const TOAST_MS = 7_000
const ZERO: UnreadCounts = { total: 0, high: 0, normal: 0, low: 0 }

interface NotificationsState {
  unread: UnreadCounts
  /** Bumps when a new notification arrives, so an open inbox can reload. */
  version: number
  setUnread: (u: UnreadCounts) => void
  refresh: () => Promise<void>
}

const Ctx = createContext<NotificationsState>({ unread: ZERO, version: 0, setUnread: () => {}, refresh: async () => {} })

export const useNotifications = () => useContext(Ctx)

/** Polls the unread counters for the bell and pops a toast when something new and not minor arrives. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  const [unread, setUnread] = useState<UnreadCounts>(ZERO)
  const [version, setVersion] = useState(0)
  const [toast, setToast] = useState<AppNotification | null>(null)
  // a toast opened in full
  const [viewing, setViewing] = useState<AppNotification | null>(null)
  const closeViewing = useCallback(() => setViewing(null), [])
  // newest unread id we have already seen; null until the first answer (no toast for what was there before)
  const seen = useRef<number | null>(null)

  const refresh = useCallback(async () => {
    const s = await api.notificationSummary()
    setUnread(s.unread)
    const latest = s.latest
    if (seen.current === null) {
      seen.current = latest?.id ?? 0
      return
    }
    if (latest && latest.id > seen.current) {
      seen.current = latest.id
      setVersion((v) => v + 1)
      // special events have their own full-screen alarm; minor news waits in the inbox
      if (latest.priority !== 'low' && latest.kind !== 'emergency') setToast(latest)
    }
  }, [])

  usePolling(refresh, POLL_MS, !!user)

  // things happen on the server after the player acts (a level, a trophy): check when the page changes
  useEffect(() => {
    if (user && seen.current !== null) refresh().catch(() => {})
  }, [location.pathname, user, refresh])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(t)
  }, [toast])

  const hideToast = location.pathname.startsWith('/play/') || location.pathname === '/notifications'

  return (
    <Ctx.Provider value={{ unread, version, setUnread, refresh }}>
      {children}
      {toast && !hideToast && (
        <Toast
          item={toast}
          onClose={() => setToast(null)}
          onOpen={() => {
            setViewing(toast)
            setToast(null)
          }}
          onRead={(u) => setUnread(u)}
        />
      )}
      <NotificationDialog item={viewing} onClose={closeViewing} />
    </Ctx.Provider>
  )
}

function Toast({ item, onClose, onOpen, onRead }: { item: AppNotification; onClose: () => void; onOpen: () => void; onRead: (u: UnreadCounts) => void }) {
  const meta = PRIORITY_META[item.priority]
  const open = async () => {
    onOpen()
    try {
      onRead((await api.readNotification(item.id)).unread)
    } catch {
      /* the inbox will show it as unread */
    }
  }
  return (
    <div
      role="status"
      aria-live="polite"
      className="toast-in fixed inset-x-3 bottom-[calc(74px+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md lg:inset-x-auto lg:bottom-6 lg:right-6"
    >
      <div className="card flex items-start gap-3 p-3.5 pr-2 shadow-lift">
        <button type="button" onClick={open} aria-haspopup="dialog" className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink/[.05] text-xl" aria-hidden>
            {item.icon}
          </span>
          <span className="min-w-0">
            <span className={cn('flex items-center gap-1.5 text-xs font-semibold', meta.text)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} aria-hidden />
              {meta.label}
              {item.sender && <span className="font-normal text-muted">· {item.sender}</span>}
            </span>
            <span className="mt-0.5 block font-semibold leading-snug">{item.title}</span>
            {item.body && <span className="mt-0.5 line-clamp-2 block text-sm text-muted">{item.body}</span>}
          </span>
        </button>
        <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-ink/[.06] hover:text-ink" aria-label="Скрыть">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
