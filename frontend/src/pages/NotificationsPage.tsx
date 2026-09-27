import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCheck } from 'lucide-react'
import { api } from '@/api/client'
import type { AppNotification, NotificationPriority } from '@/api/types'
import { Button } from '@/components/Button'
import { PageHeader } from '@/components/Card'
import { NotificationDialog } from '@/components/NotificationDialog'
import { Segmented } from '@/components/Segmented'
import { EmptyState, ErrorState, Loading } from '@/components/States'
import { useSeen } from '@/hooks/useSeen'
import { cn } from '@/lib/cn'
import { dayLabel, PRIORITIES, PRIORITY_META, timeLabel } from '@/lib/notifications'
import { useNotifications } from '@/notifications/NotificationsContext'

type Show = 'all' | 'unread'

export default function NotificationsPage() {
  const [params, setParams] = useSearchParams()
  const show: Show = params.get('show') === 'unread' ? 'unread' : 'all'
  const tagParam = params.get('tag')
  const tag = PRIORITIES.includes(tagParam as NotificationPriority) ? (tagParam as NotificationPriority) : null
  const { unread, setUnread, version } = useNotifications()

  const [items, setItems] = useState<AppNotification[] | null>(null)
  const [next, setNext] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [marking, setMarking] = useState(false)
  const [viewing, setViewing] = useState<AppNotification | null>(null)
  const closeViewing = useCallback(() => setViewing(null), [])
  // read while this page is open: they keep the «new» tint until the person leaves
  const [fresh, setFresh] = useState<Set<number>>(() => new Set())

  // a notification that has been on screen counts as read, like in a messenger
  const markSeen = useCallback(
    (ids: number[]) => {
      setItems((prev) => prev?.map((x) => (ids.includes(x.id) ? { ...x, read: true } : x)) ?? null)
      setFresh((prev) => new Set([...prev, ...ids]))
      api.readNotifications(ids).then(
        (r) => setUnread(r.unread),
        () => {
          /* stays unread on the server and shows up as new next time */
        },
      )
    },
    [setUnread],
  )
  const watch = useSeen(markSeen)

  const setFilter = (key: 'show' | 'tag', value: string | null) => {
    const p = new URLSearchParams(params)
    if (value) p.set(key, value)
    else p.delete(key)
    setParams(p, { replace: true })
  }

  const load = async (before: number | null = null) => {
    setLoading(true)
    setError(null)
    try {
      const page = await api.notifications({ unread: show === 'unread', priority: tag, before })
      setItems((prev) => (before && prev ? [...prev, ...page.items] : page.items))
      setNext(page.next_before)
      setUnread(page.unread)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить уведомления')
    } finally {
      setLoading(false)
    }
  }

  // the filters, or something new arrived while the page is open
  useEffect(() => {
    load()
  }, [show, tag, version]) // eslint-disable-line react-hooks/exhaustive-deps

  const open = (n: AppNotification) => {
    if (!n.read) {
      setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? null)
      api.readNotification(n.id).then((r) => setUnread(r.unread), () => {})
    }
    setViewing({ ...n, read: true })
  }

  const readAll = async () => {
    setMarking(true)
    try {
      const r = await api.readAllNotifications(tag)
      setUnread(r.unread)
      setItems((prev) => (show === 'unread' ? [] : (prev?.map((x) => (!tag || x.priority === tag ? { ...x, read: true } : x)) ?? null)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отметить')
    } finally {
      setMarking(false)
    }
  }

  const unreadHere = tag ? unread[tag] : unread.total
  const groups: { day: string; items: AppNotification[] }[] = []
  for (const n of items ?? []) {
    const day = dayLabel(n.created_at)
    const last = groups[groups.length - 1]
    if (last?.day === day) last.items.push(n)
    else groups.push({ day, items: [n] })
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Уведомления"
        subtitle="Новые сценарии, турниры, достижения и сообщения от руководителя"
        action={
          <Button variant="secondary" size="sm" onClick={readAll} loading={marking} disabled={!unreadHere} icon={<CheckCheck className="h-4 w-4" />}>
            {tag ? `Прочитать «${PRIORITY_META[tag].label}»` : 'Прочитать все'}
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented<Show>
          label="Какие показывать"
          value={show}
          onChange={(v) => setFilter('show', v === 'all' ? null : v)}
          options={[
            ['all', 'Все'],
            ['unread', <span key="u">Непрочитанные{unread.total ? <span className="digits ml-1.5 text-muted">{unread.total}</span> : null}</span>],
          ]}
        />
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Важность">
          <TagChip active={!tag} onClick={() => setFilter('tag', null)}>
            Любая важность
          </TagChip>
          {PRIORITIES.map((p) => (
            <TagChip key={p} active={tag === p} onClick={() => setFilter('tag', tag === p ? null : p)}>
              <span className={cn('h-2 w-2 rounded-full', PRIORITY_META[p].dot)} aria-hidden />
              {PRIORITY_META[p].label}
              {unread[p] > 0 && <span className="digits text-xs text-muted">{unread[p]}</span>}
            </TagChip>
          ))}
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={() => load()} />}
      {!items && !error && <Loading rows={5} avatar="tile" />}
      {items && items.length === 0 && !error && (
        <div className="card px-5 py-4">
          <EmptyState
            title={show === 'unread' ? 'Всё прочитано' : 'Пока пусто'}
            text={show === 'unread' ? 'Новые уведомления появятся здесь.' : 'Здесь будут новости о рейсах, турнирах и достижениях.'}
          />
        </div>
      )}

      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g.day} aria-label={g.day}>
            <h2 className="mb-2 px-1 text-sm font-semibold text-muted">{g.day}</h2>
            <ul className="card divide-y divide-line/70 overflow-hidden">
              {g.items.map((n) => (
                <li key={n.id} data-seen-id={n.id} ref={n.read ? undefined : watch}>
                  <Item n={n} fresh={fresh.has(n.id)} onOpen={() => open(n)} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {next && (
        <div className="mt-5 flex justify-center">
          <Button variant="secondary" onClick={() => load(next)} loading={loading}>
            Показать ещё
          </Button>
        </div>
      )}

      <NotificationDialog item={viewing} onClose={closeViewing} />
    </div>
  )
}

function TagChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn('chip', active ? 'btn-ink border-transparent' : 'border-line bg-surface text-ink shadow-card hover:border-ink/40')}
    >
      {children}
    </button>
  )
}

function Item({ n, fresh, onOpen }: { n: AppNotification; fresh: boolean; onOpen: () => void }) {
  const meta = PRIORITY_META[n.priority]
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className={cn(
        'relative flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-ink/[.03] sm:px-5',
        (!n.read || fresh) && 'bg-brand-soft/25 dark:bg-white/[.03]',
      )}
    >
      {/* the unread mark fades once the notification has been seen */}
      {(!n.read || fresh) && (
        <span
          className={cn('absolute bottom-4 left-0 top-4 w-[3px] rounded-r-full bg-brand transition-opacity duration-700', n.read && 'opacity-0')}
          aria-hidden
        />
      )}
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink/[.05] text-xl" aria-hidden>
        {n.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className={cn('inline-flex items-center gap-1 font-semibold', meta.text)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} aria-hidden />
            {meta.label}
          </span>
          {n.sender && <span className="text-muted">от {n.sender}</span>}
          <span className="digits text-muted">{timeLabel(n.created_at)}</span>
          {!n.read && <span className="sr-only">, не прочитано</span>}
        </span>
        <span className={cn('mt-1 block leading-snug', n.read ? 'font-medium text-ink/85' : 'font-semibold text-ink')}>{n.title}</span>
        {n.body && <span className="mt-1 line-clamp-2 block text-sm leading-relaxed text-muted">{n.body}</span>}
      </span>
    </button>
  )
}
