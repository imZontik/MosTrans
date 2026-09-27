import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, Megaphone, Search, Send, UserPlus, Users, X } from 'lucide-react'
import { api } from '@/api/client'
import type { Audience, AudiencePreview, Broadcast, EmployeeRow, NotificationPriority } from '@/api/types'
import { useAsync } from '@/hooks/useAsync'
import { Button } from '@/components/Button'
import { Card, PageHeader, SectionTitle } from '@/components/Card'
import { Progress } from '@/components/Progress'
import { Segmented } from '@/components/Segmented'
import { EmptyState, ErrorState, Loading } from '@/components/States'
import { cn } from '@/lib/cn'
import { fmtDate, fmtPercent, teamName } from '@/lib/format'
import { PRIORITIES, PRIORITY_META } from '@/lib/notifications'
import { EMPLOYEES, plural, pluralN } from '@/lib/plural'

type Mode = Audience['mode']

const LINKS: [string, string][] = [
  ['', 'Без ссылки'],
  ['/scenarios', 'Сценарии'],
  ['/tournament', 'Турнир'],
  ['/leaderboard', 'Рейтинг'],
  ['/profile', 'Профиль'],
  ['/profile/achievements', 'Достижения'],
]

const PRIORITY_HINT: Record<NotificationPriority, string> = {
  high: 'красная метка и всплывающее окно',
  normal: 'всплывающее окно',
  low: 'тихо, только в списке',
}

const INACTIVE: [number | null, string][] = [
  [null, 'Любая активность'],
  [7, 'Не тренировались 7+ дней'],
  [14, 'Не тренировались 14+ дней'],
  [30, 'Не тренировались 30+ дней'],
]

export default function BroadcastsPage() {
  const [params] = useSearchParams()
  const options = useAsync(() => api.admin.broadcastOptions(), [])
  const history = useAsync(() => api.admin.broadcasts(), [])

  const [mode, setMode] = useState<Mode>(params.get('user') ? 'users' : 'all')
  const [positions, setPositions] = useState<string[]>([])
  const [depots, setDepots] = useState<string[]>([])
  const [teams, setTeams] = useState<string[]>([])
  const [inactive, setInactive] = useState<number | null>(null)
  const [people, setPeople] = useState<{ id: number; name: string }[]>([])

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState<NotificationPriority>('normal')
  const [link, setLink] = useState('')

  const [preview, setPreview] = useState<AudiencePreview | null>(null)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // «Написать» from an employee card: that person is already picked
  useEffect(() => {
    const id = Number(params.get('user'))
    if (!id) return
    api.admin.employee(id).then((e) => setPeople((p) => (p.some((x) => x.id === id) ? p : [...p, { id, name: e.full_name }])), () => {})
  }, [params])

  const audience: Audience = useMemo(
    () =>
      mode === 'users'
        ? { mode, user_ids: people.map((p) => p.id) }
        : mode === 'segment'
          ? { mode, positions, depots, teams, inactive_days: inactive }
          : { mode },
    [mode, people, positions, depots, teams, inactive],
  )

  // who will get it, recounted as the slice changes
  useEffect(() => {
    if (mode === 'users' && people.length === 0) {
      setPreview({ count: 0, label: 'Никто не выбран', sample: [] })
      return
    }
    let cancelled = false
    const t = window.setTimeout(() => {
      api.admin.previewAudience(audience).then(
        (p) => !cancelled && setPreview(p),
        () => !cancelled && setPreview(null),
      )
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [audience, mode, people.length])

  const teamOptions = (options.data?.teams ?? []).filter((t) => !depots.length || depots.includes(t.depot))
  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value])

  const count = preview?.count ?? 0
  const canSend = title.trim().length >= 2 && count > 0 && !sending

  const send = async () => {
    if (!canSend) return
    if (count > 1 && !window.confirm(`Отправить «${title.trim()}» — ${pluralN(count, EMPLOYEES)}?`)) return
    setSending(true)
    setError(null)
    setNotice(null)
    try {
      const b = await api.admin.sendBroadcast({ title: title.trim(), body: body.trim(), priority, link, audience })
      setNotice(`Отправлено: ${pluralN(b.recipients, EMPLOYEES)}. ${b.audience_label}.`)
      setTitle('')
      setBody('')
      history.setData([b, ...(history.data ?? [])])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Рассылки" subtitle="Сообщения сотрудникам: всем, срезу по должности, депо, бригаде и активности, или лично." />

      {notice && (
        <p className="card flex items-center gap-2 border-l-4 border-l-ok px-4 py-3" role="status">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" /> {notice}
        </p>
      )}
      {error && (
        <p className="card border-l-4 border-l-brand px-4 py-3" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <Card className="space-y-6 p-5 sm:p-6">
          <div>
            <p className="label">Кому</p>
            <Segmented<Mode>
              label="Кому"
              value={mode}
              onChange={setMode}
              options={[
                ['all', 'Всем сотрудникам'],
                ['segment', 'Срез'],
                ['users', 'Лично'],
              ]}
            />
          </div>

          {mode === 'segment' &&
            (options.error ? (
              <ErrorState message={options.error} onRetry={options.reload} />
            ) : !options.data ? (
              <Loading rows={2} />
            ) : (
              <div className="space-y-4">
                <ChipGroup label="Должность">
                  {options.data.positions.map((p) => (
                    <Chip key={p.code} active={positions.includes(p.code)} onClick={() => toggle(positions, setPositions, p.code)}>
                      {p.title}
                    </Chip>
                  ))}
                </ChipGroup>
                <ChipGroup label="Депо">
                  {options.data.depots.map((d) => (
                    <Chip
                      key={d}
                      active={depots.includes(d)}
                      onClick={() => {
                        const next = depots.includes(d) ? depots.filter((x) => x !== d) : [...depots, d]
                        setDepots(next)
                        // brigades of a depot that is no longer picked drop out
                        const allowed = new Set((options.data?.teams ?? []).filter((t) => !next.length || next.includes(t.depot)).map((t) => t.team))
                        setTeams((ts) => ts.filter((t) => allowed.has(t)))
                      }}
                    >
                      {d}
                    </Chip>
                  ))}
                </ChipGroup>
                <ChipGroup label="Бригада">
                  {teamOptions.map((t) => (
                    <Chip key={t.team} active={teams.includes(t.team)} onClick={() => toggle(teams, setTeams, t.team)} title={t.team}>
                      {teamName(t.team)}
                    </Chip>
                  ))}
                </ChipGroup>
                <div>
                  <p className="label">Активность</p>
                  <select className="input sm:w-auto" value={inactive ?? ''} onChange={(e) => setInactive(e.target.value ? Number(e.target.value) : null)}>
                    {INACTIVE.map(([v, l]) => (
                      <option key={l} value={v ?? ''}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-muted">Внутри группы подходит любой из вариантов, группы складываются: «старшие проводники из депо Москва».</p>
              </div>
            ))}

          {mode === 'users' && <PeoplePicker people={people} onChange={setPeople} />}

          <div className="space-y-4 border-t border-line/70 pt-5">
            <div>
              <label className="label" htmlFor="bc-title">
                Заголовок
              </label>
              <input id="bc-title" className="input" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: учения по эвакуации в пятницу" />
            </div>
            <div>
              <label className="label" htmlFor="bc-body">
                Текст <span className="font-normal">({body.length}/2000)</span>
              </label>
              <textarea id="bc-body" className="input min-h-[120px]" maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <div>
              <p className="label">Важность</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Важность">
                {PRIORITIES.map((p) => (
                  <Chip key={p} active={priority === p} onClick={() => setPriority(p)} role="radio">
                    <span className={cn('h-2 w-2 rounded-full', PRIORITY_META[p].dot, priority === p && p !== 'high' && 'bg-inverse')} aria-hidden />
                    {PRIORITY_META[p].label}
                  </Chip>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted">Сотрудник увидит: {PRIORITY_HINT[priority]}.</p>
            </div>
            <div>
              <label className="label" htmlFor="bc-link">
                Кнопка в уведомлении ведёт
              </label>
              <select id="bc-link" className="input sm:w-auto" value={link} onChange={(e) => setLink(e.target.value)}>
                {LINKS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        <div className="space-y-4 lg:sticky lg:top-6">
          <Card className="p-5">
            <SectionTitle icon={Users}>Получат</SectionTitle>
            <p className="digits text-4xl font-bold leading-none">{preview ? preview.count : '…'}</p>
            <p className="mt-1 text-sm text-muted">{preview ? `${plural(preview.count, EMPLOYEES)} · ${preview.label}` : 'Считаем…'}</p>
            {preview && preview.sample.length > 0 && (
              <p className="mt-3 text-sm leading-relaxed">
                {preview.sample.join(', ')}
                {preview.count > preview.sample.length && <span className="text-muted"> и ещё {preview.count - preview.sample.length}</span>}
              </p>
            )}
            <Button className="mt-5" block size="lg" onClick={send} loading={sending} disabled={!canSend} icon={<Send className="h-4 w-4" />}>
              Отправить
            </Button>
            {!title.trim() && <p className="mt-2 text-center text-xs text-muted">Добавьте заголовок</p>}
          </Card>

          <Card className="p-4">
            <p className="label">Так увидит сотрудник</p>
            <div className="flex items-start gap-3 rounded-xl bg-bg p-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink/[.05] text-xl" aria-hidden>
                📣
              </span>
              <div className="min-w-0">
                <p className={cn('flex items-center gap-1.5 text-xs font-semibold', PRIORITY_META[priority].text)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_META[priority].dot)} aria-hidden />
                  {PRIORITY_META[priority].label}
                  <span className="font-normal text-muted">· от вас</span>
                </p>
                <p className="mt-0.5 break-words font-semibold leading-snug">{title.trim() || 'Заголовок сообщения'}</p>
                {body.trim() && <p className="mt-0.5 line-clamp-4 whitespace-pre-line break-words text-sm text-muted">{body.trim()}</p>}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <section>
        <SectionTitle icon={Megaphone}>Отправленные</SectionTitle>
        {history.error ? (
          <ErrorState message={history.error} onRetry={history.reload} />
        ) : !history.data ? (
          <Loading rows={3} />
        ) : history.data.length === 0 ? (
          <Card className="px-5 py-4">
            <EmptyState title="Рассылок пока не было" text="Отправленные сообщения и то, сколько сотрудников их прочитали, появятся здесь." />
          </Card>
        ) : (
          <ul className="card divide-y divide-line/70">
            {history.data.map((b) => (
              <HistoryRow key={b.id} b={b} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function HistoryRow({ b }: { b: Broadcast }) {
  const meta = PRIORITY_META[b.priority]
  const share = b.recipients ? b.read / b.recipients : 0
  return (
    <li className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_200px] sm:items-center">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          <span className={cn('inline-flex items-center gap-1 font-semibold', meta.text)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} aria-hidden />
            {meta.label}
          </span>
          <span>{fmtDate(b.created_at, true)}</span>
          {b.sender && <span>· {b.sender}</span>}
        </p>
        <p className="mt-1 font-semibold leading-snug">{b.title}</p>
        {b.body && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{b.body}</p>}
        <p className="mt-1.5 text-xs text-muted">{b.audience_label}</p>
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="text-muted">Прочитали</span>
          <span className="digits font-semibold">
            {b.read} из {b.recipients}
          </span>
        </div>
        <Progress value={share} className="mt-1.5" barClassName={share >= 0.7 ? 'bg-ok' : 'bar-brand'} />
        <p className="digits mt-1 text-right text-xs text-muted">{fmtPercent(share)}</p>
      </div>
    </li>
  )
}

function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function Chip({ active, onClick, children, title, role }: { active: boolean; onClick: () => void; children: ReactNode; title?: string; role?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      role={role}
      aria-pressed={role ? undefined : active}
      aria-checked={role ? active : undefined}
      className={cn('chip', active ? 'btn-ink border-transparent' : 'border-line bg-surface text-ink shadow-card hover:border-ink/40')}
    >
      {children}
    </button>
  )
}

/** Personal messages: search employees by name or email and collect recipients. */
function PeoplePicker({ people, onChange }: { people: { id: number; name: string }[]; onChange: (p: { id: number; name: string }[]) => void }) {
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<EmployeeRow[] | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setFound(null)
      return
    }
    let cancelled = false
    const t = window.setTimeout(() => {
      api.admin.employees(q).then((rows) => !cancelled && setFound(rows.slice(0, 8)), () => !cancelled && setFound([]))
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [query])

  const picked = new Set(people.map((p) => p.id))
  return (
    <div className="space-y-3">
      {people.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {people.map((p) => (
            <span key={p.id} className="inline-flex min-h-[40px] items-center gap-1 rounded-full bg-ink px-3.5 pr-1.5 text-sm font-medium text-inverse">
              {p.name}
              <button
                type="button"
                onClick={() => onChange(people.filter((x) => x.id !== p.id))}
                className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/15"
                aria-label={`Убрать ${p.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input className="input pl-10" placeholder="Имя или почта сотрудника" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Найти сотрудника" />
      </div>
      {found && (
        <ul className="divide-y divide-line/70 rounded-xl border border-line">
          {found.length === 0 && <li className="px-4 py-3 text-sm text-muted">Никого не нашли</li>}
          {found.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{e.full_name}</p>
                <p className="truncate text-xs text-muted">
                  {e.position_title}
                  {e.team ? ` · ${teamName(e.team)}` : ''}
                </p>
              </div>
              <Button
                size="sm"
                variant={picked.has(e.id) ? 'ghost' : 'secondary'}
                disabled={picked.has(e.id)}
                onClick={() => onChange([...people, { id: e.id, name: e.full_name }])}
                icon={<UserPlus className="h-4 w-4" />}
              >
                {picked.has(e.id) ? 'Выбран' : 'Добавить'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
