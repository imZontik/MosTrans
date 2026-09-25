import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, ChevronsUpDown, Search, TrendingDown, TrendingUp } from 'lucide-react'
import { api } from '@/api/client'
import type { EmployeeRow } from '@/api/types'
import { useAsync } from '@/hooks/useAsync'
import { Avatar } from '@/components/Avatar'
import { Card, PageHeader } from '@/components/Card'
import { ErrorState, Loading } from '@/components/States'
import { cn } from '@/lib/cn'
import { fmtNumber, fmtPercent, fmtRelative, fmtScore } from '@/lib/format'
import { EMPLOYEES, pluralN } from '@/lib/plural'

type Key = keyof Pick<
  EmployeeRow,
  'full_name' | 'position_title' | 'level' | 'points' | 'points_week' | 'runs' | 'success_rate' | 'avg_safety' | 'safety_trend' | 'avg_loyalty' | 'last_active_at'
>

const COLUMNS: { key: Key; title: string; align?: 'right' }[] = [
  { key: 'full_name', title: 'Сотрудник' },
  { key: 'position_title', title: 'Должность' },
  { key: 'level', title: 'Ур.', align: 'right' },
  { key: 'points', title: 'Очки', align: 'right' },
  { key: 'points_week', title: 'За неделю', align: 'right' },
  { key: 'runs', title: 'Прох.', align: 'right' },
  { key: 'success_rate', title: 'Успех', align: 'right' },
  { key: 'avg_safety', title: '🛡️ Безоп.', align: 'right' },
  { key: 'safety_trend', title: 'Динамика', align: 'right' },
  { key: 'avg_loyalty', title: '💙 Лоял.', align: 'right' },
  { key: 'last_active_at', title: 'Активность', align: 'right' },
]

export default function EmployeesPage() {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: 'points', dir: -1 })
  const navigate = useNavigate()

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(search.trim()), 300)
    return () => window.clearTimeout(t)
  }, [search])

  const list = useAsync(() => api.admin.employees(query || undefined), [query])

  const rows = useMemo(() => {
    const data = [...(list.data ?? [])]
    data.sort((a, b) => {
      const va = a[sort.key]
      const vb = b[sort.key]
      if (va === null || va === undefined) return 1
      if (vb === null || vb === undefined) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sort.dir
      return String(va).localeCompare(String(vb), 'ru') * sort.dir
    })
    return data
  }, [list.data, sort])

  const toggle = (key: Key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'full_name' || key === 'position_title' ? 1 : -1 }))

  return (
    <div>
      <PageHeader
        title="Сотрудники"
        subtitle={list.data ? pluralN(list.data.length, EMPLOYEES) : 'Прогресс команды'}
        action={
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input className="input pl-9" placeholder="Поиск по имени, почте, команде" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        }
      />

      {list.loading && !list.data ? (
        <Loading rows={5} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-ink/[.03]">
                <tr>
                  {COLUMNS.map((c) => (
                    <th key={c.key} className={cn('whitespace-nowrap px-2.5 py-3 text-xs font-semibold text-muted', c.align === 'right' ? 'text-right' : 'text-left')}>
                      <button onClick={() => toggle(c.key)} className={cn('inline-flex items-center gap-1 hover:text-ink', sort.key === c.key && 'text-ink')}>
                        {c.title}
                        {sort.key === c.key ? (
                          sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((e) => (
                  <tr key={e.id} onClick={() => navigate(`/admin/employees/${e.id}`)} className="cursor-pointer transition hover:bg-surface-2">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={e.full_name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{e.full_name}</p>
                          <p className="truncate text-xs text-muted">{e.team || e.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted">{e.position_title}</td>
                    <td className="px-3 py-2.5 text-right font-display font-semibold">{e.level}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtNumber(e.points)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtNumber(e.points_week)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{e.runs}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{e.runs ? fmtPercent(e.success_rate) : '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtScore(e.avg_safety)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Trend value={e.safety_trend} />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{fmtScore(e.avg_loyalty)}</td>
                    <td className="px-3 py-2.5 text-right text-xs text-muted">{fmtRelative(e.last_active_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <p className="py-10 text-center text-muted">Никого не нашли</p>}
          </div>
        </Card>
      )}
    </div>
  )
}

export function Trend({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className="text-muted">—</span>
  if (value === 0) return <span className="text-muted">0</span>
  const up = value > 0
  return (
    <span className={cn('inline-flex items-center gap-0.5 font-semibold tabular-nums', up ? 'text-ok' : 'text-bad')}>
      {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {up ? '+' : '−'}
      {Math.abs(value)}
    </span>
  )
}
