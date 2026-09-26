import { useId, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Compass,
  Download,
  Heart,
  Siren,
  Sparkles,
  Timer,
  UserRoundX,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts'
import { api } from '@/api/client'
import type { EmployeeRow, Overview } from '@/api/types'
import { useAuth } from '@/auth/AuthContext'
import { useAsync } from '@/hooks/useAsync'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/Button'
import { IconPlate } from '@/components/Card'
import { CountUp } from '@/components/CountUp'
import { NightPanel, SpeedLines } from '@/components/NightPanel'
import { ScoreRing } from '@/components/ScoreRing'
import { Segmented } from '@/components/Segmented'
import { ErrorState, Loading } from '@/components/States'
import { cn } from '@/lib/cn'
import { categoryStyle } from '@/lib/category'
import { fmtDate, fmtNumber, scaleTone } from '@/lib/format'
import { EMPLOYEES, plural } from '@/lib/plural'
import { useChartColors, type ChartColors } from '@/theme/chartColors'

const RUNS: [string, string, string] = ['прохождение', 'прохождения', 'прохождений']
const DAYS: [string, string, string] = ['день', 'дня', 'дней']

/**
 * The lead's dashboard. First what the team is like in one sentence and four numbers, then who
 * needs attention, then activity, the directions from the weakest, and the frequent mistakes.
 * Operational dashboards answer «what needs attention right now?» — so that goes near the top.
 */
export default function DashboardPage() {
  const { user } = useAuth()
  const overview = useAsync(() => api.admin.overview(), [])
  const employees = useAsync(() => api.admin.employees(), [])
  const data = overview.data

  if (overview.loading && !data) return <Loading rows={4} />
  if (overview.error || !data) return <ErrorState message={overview.error ?? 'Нет данных'} onRetry={overview.reload} />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.005em] lg:text-[40px] lg:leading-[1.05]">{greeting(user?.full_name)}</h1>
          <p className="mt-1.5 text-muted">Обучение команды за 30 дней · обновлено {fmtDate(data.generated_at, true)}</p>
        </div>
        <ReportDownload />
      </div>

      <Pulse data={data} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Activity data={data} />
        <Attention rows={employees.data} loading={employees.loading && !employees.data} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <Directions data={data} />
        <Mistakes items={data.top_mistakes} />
      </div>
    </div>
  )
}

/** «Добрый вечер, Елена Викторовна» */
function greeting(fullName: string | undefined) {
  const h = new Date().getHours()
  const hello = h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер'
  const parts = (fullName ?? '').split(' ').filter(Boolean)
  const name = parts.length >= 3 ? `${parts[0]} ${parts[1]}` : parts[0]
  return name ? `${hello}, ${name}` : hello
}

// --- pulse -------------------------------------------------------------------------

/** The team in one sentence and four numbers, on the night line. */
function Pulse({ data }: { data: Overview }) {
  const active = data.employees ? data.active_7d / data.employees : 0
  const weakest = [...data.categories].filter((c) => c.runs > 0).sort((a, b) => a.success_rate - b.success_rate)[0]
  const perDay = data.runs_by_day.map((d) => d.runs)
  const week = perDay.slice(-7).reduce((a, b) => a + b, 0)
  const weekBefore = perDay.slice(-14, -7).reduce((a, b) => a + b, 0)
  const trend = weekBefore > 0 ? Math.round(((week - weekBefore) / weekBefore) * 100) : null
  const total = data.positions.reduce((s, p) => s + p.count, 0)

  return (
    <NightPanel aria-labelledby="pulse" className="-mx-2 px-5 pb-5 pt-5 sm:mx-0 sm:px-7 sm:pb-6 sm:pt-6">
      <SpeedLines rows={[16, 58]} />
      <div className="relative flex flex-wrap items-start gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <h2 id="pulse" className="flex items-center gap-2 text-sm font-medium text-white/60">
            <Sparkles className="h-4 w-4 text-[#FFC94D]" aria-hidden />
            Пульс команды
          </h2>
          <p className="mt-2 max-w-3xl text-lg leading-snug text-white sm:text-xl">
            {data.active_7d} из {data.employees} {plural(data.employees, EMPLOYEES)} занимались на этой неделе
            {weakest ? (
              <>
                . Слабее всего — <span className="font-semibold text-[#FFC94D]">{weakest.title.toLowerCase()}</span>: {Math.round(weakest.success_rate * 100)}% успешных.
              </>
            ) : (
              '.'
            )}
          </p>
        </div>
      </div>

      <dl className="relative mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 ring-1 ring-inset ring-white/10 lg:grid-cols-4">
        <Cell label="Активны за неделю">
          <RingValue value={active} tone={active >= 0.7 ? 'ok' : 'warn'}>
            <CountUp value={data.active_7d} />
            <span className="text-base font-semibold text-white/50">/{data.employees}</span>
          </RingValue>
        </Cell>
        <Cell label="Прохождений за неделю">
          <div className="flex items-end justify-between gap-3">
            <p className="digits text-[34px] font-bold leading-none">
              <CountUp value={data.runs_week} />
            </p>
            <Sparkline values={perDay} className="mb-1 h-9 w-24 sm:w-28" />
          </div>
          <p className="mt-1.5 flex items-center gap-1 text-xs text-white/55">
            {trend !== null && (
              <span className={cn('inline-flex items-center font-semibold', trend >= 0 ? 'text-[#5FD39A]' : 'text-[#FF8A7A]')}>
                {trend >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />}
                {Math.abs(trend)}%
              </span>
            )}
            {trend !== null ? 'к прошлой неделе' : `${fmtNumber(data.runs_30d)} за 30 дней`}
          </p>
        </Cell>
        <Cell label="Успешных">
          <RingValue value={data.success_rate_30d} tone={data.success_rate_30d >= 0.6 ? 'ok' : 'warn'}>
            <CountUp value={Math.round(data.success_rate_30d * 100)} />
            <span className="text-base font-semibold text-white/50">%</span>
          </RingValue>
        </Cell>
        <Cell label="Безопасность">
          <RingValue value={(data.avg_safety_30d ?? 0) / 100} tone={data.avg_safety_30d === null ? 'brand' : scaleTone(data.avg_safety_30d)}>
            {data.avg_safety_30d === null ? '—' : <CountUp value={Math.round(data.avg_safety_30d)} />}
          </RingValue>
        </Cell>
      </dl>

      <div className="relative mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/60">
        <Aside icon={Heart}>
          Лояльность <b className="digits text-white">{data.avg_loyalty_30d === null ? '—' : Math.round(data.avg_loyalty_30d)}</b>
        </Aside>
        <Aside icon={Timer}>
          Таймауты <b className="digits text-white">{(data.timeout_rate_30d * 100).toFixed(1).replace('.', ',')}%</b>
        </Aside>
        <Aside icon={Siren}>
          Специвентов <b className="digits text-white">{data.emergencies_30d}</b>
        </Aside>
        {total > 0 && <Team positions={data.positions} total={total} />}
      </div>
    </NightPanel>
  )
}

const POSITION_WORDS: Record<string, [string, string, string]> = {
  conductor: ['проводник', 'проводника', 'проводников'],
  senior_conductor: ['старший', 'старших', 'старших'],
  train_chief: ['начальник поезда', 'начальника поезда', 'начальников поезда'],
}
const POSITION_COLOR = ['bg-white/80', 'bg-[#FFC94D]', 'bg-[#FF8A7A]']

/** The team by post: one bar split by post, and the counts beside it. */
function Team({ positions, total }: { positions: Overview['positions']; total: number }) {
  const shown = positions.map((p, i) => ({ ...p, color: POSITION_COLOR[i % POSITION_COLOR.length] })).filter((p) => p.count > 0)
  return (
    <div className="flex min-w-[240px] flex-1 flex-wrap items-center gap-x-3 gap-y-1.5 sm:max-w-md">
      <Users className="h-4 w-4 shrink-0" aria-hidden />
      <div className="flex h-2 min-w-[80px] flex-1 gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {shown.map((p) => (
          <span key={p.position} className={cn('bar-grow h-full first:rounded-l-full last:rounded-r-full', p.color)} style={{ width: `${(p.count / total) * 100}%` }} />
        ))}
      </div>
      <span className="flex flex-wrap gap-x-3 text-xs">
        {shown.map((p) => (
          <span key={p.position} className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className={cn('h-1.5 w-1.5 rounded-full', p.color)} aria-hidden />
            <b className="digits text-sm text-white">{p.count}</b> {plural(p.count, POSITION_WORDS[p.position] ?? [p.title, p.title, p.title])}
          </span>
        ))}
      </span>
    </div>
  )
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 bg-[#0e1628]/70 px-4 py-4 sm:px-5">
      <dt className="text-[11px] font-medium uppercase tracking-[.08em] text-white/50">{label}</dt>
      <dd className="mt-2.5">{children}</dd>
    </div>
  )
}

/** A number with a small ring beside it. */
function RingValue({ value, tone, children }: { value: number; tone: 'ok' | 'warn' | 'bad' | 'brand'; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="digits text-[34px] font-bold leading-none">{children}</p>
      <ScoreRing value={Math.max(0, Math.min(1, value))} tone={tone} size={44} stroke={5} label="" className="shrink-0 [&_g>circle:first-child]:stroke-white/15" />
    </div>
  )
}

function Aside({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Icon className="h-4 w-4" aria-hidden />
      {children}
    </span>
  )
}

/** Runs per day as a line that draws itself, with a soft area under it. */
function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const id = useId().replace(/:/g, '')
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 30 - (v / max) * 26 - 2] as const)
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-a`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#FF6A3D" stopOpacity=".45" />
          <stop offset="1" stopColor="#FF6A3D" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L100 30 L0 30 Z`} fill={`url(#${id}-a)`} className="spark-fade" />
      <path d={line} fill="none" stroke="#FF7A4D" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" pathLength={1} className="spark-draw" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.2" fill="#fff" className="spark-fade" />
    </svg>
  )
}

// --- attention ------------------------------------------------------------------------

interface Flag {
  e: EmployeeRow
  weight: number
  icon: LucideIcon
  text: string
  tone: 'bad' | 'warn'
}

const DAY_MS = 86_400_000

/** Who to talk to this week: low or falling safety, or not training at all. */
function flagsOf(rows: EmployeeRow[]): Flag[] {
  const now = Date.now()
  const out: Flag[] = []
  for (const e of rows) {
    const idle = e.last_active_at ? Math.floor((now - new Date(e.last_active_at).getTime()) / DAY_MS) : null
    if (idle === null || idle >= 7) {
      out.push({ e, weight: 3, icon: UserRoundX, text: idle === null ? 'ещё не начинал обучение' : `не занимается ${idle} ${plural(idle, DAYS)}`, tone: 'warn' })
    } else if (e.safety_30d !== null && e.safety_30d < 70) {
      out.push({ e, weight: 4 + (70 - e.safety_30d) / 10, icon: AlertTriangle, text: `безопасность ${Math.round(e.safety_30d)} из 100`, tone: 'bad' })
    } else if (e.safety_trend !== null && e.safety_trend <= -3) {
      out.push({ e, weight: 2 + Math.abs(e.safety_trend) / 10, icon: ArrowDownRight, text: `безопасность −${Math.round(Math.abs(e.safety_trend))} за месяц`, tone: 'warn' })
    }
  }
  return out.sort((a, b) => b.weight - a.weight)
}

const ATTENTION_SHOWN = 5

function Attention({ rows, loading }: { rows: EmployeeRow[] | undefined; loading: boolean }) {
  const flags = useMemo(() => flagsOf(rows ?? []), [rows])
  return (
    <section className="card min-w-0 p-5 sm:p-6" aria-labelledby="attention">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="attention" className="flex min-w-0 items-center gap-2.5 text-lg font-semibold leading-tight min-[400px]:whitespace-nowrap">
          <IconPlate icon={AlertTriangle} tint="bg-warn-soft" tone="text-warn-ink" />
          Требуют внимания
          {flags.length > 0 && <span className="digits rounded-full bg-warn-soft px-2 py-0.5 text-sm font-semibold text-warn-ink">{flags.length}</span>}
        </h2>
        <AllLink to="/admin/employees">Все</AllLink>
      </div>
      {loading ? (
        <Loading rows={3} />
      ) : flags.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl bg-ok-soft/70 px-4 py-4 ring-1 ring-inset ring-ok/20">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-ok" aria-hidden />
          <p>
            <span className="font-semibold">Всё в порядке.</span> <span className="text-muted">Все занимаются, безопасность в норме.</span>
          </p>
        </div>
      ) : (
        <ul className="-mx-2 space-y-1">
          {flags.slice(0, ATTENTION_SHOWN).map((f, i) => (
            <li key={f.e.id} className="row-in" style={{ animationDelay: `${i * 50}ms` }}>
              <Link to={`/admin/employees/${f.e.id}`} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-ink/[.04]">
                <Avatar name={f.e.full_name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{f.e.full_name}</span>
                  <span className={cn('flex items-center gap-1 text-xs', f.tone === 'bad' ? 'text-bad' : 'text-warn-ink')}>
                    <f.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{f.text}</span>
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted/60 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {flags.length > ATTENTION_SHOWN && (
        <p className="mt-3 text-sm text-muted">
          И ещё {flags.length - ATTENTION_SHOWN} в списке{' '}
          <Link to="/admin/employees" className="font-medium text-ink underline decoration-line underline-offset-4">
            сотрудников
          </Link>
        </p>
      )}
    </section>
  )
}

// --- activity -------------------------------------------------------------------------

const OUTCOMES = [
  { key: 'success', label: 'Успех' },
  { key: 'partial', label: 'Частично' },
  { key: 'fail', label: 'Провал' },
] as const

function Activity({ data }: { data: Overview }) {
  const C = useChartColors()
  const byDay = data.runs_by_day.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', ''),
    partial: Math.max(0, d.runs - d.success - d.fail),
  }))
  const sum = (k: 'success' | 'partial' | 'fail' | 'runs') => byDay.reduce((s, d) => s + d[k], 0)
  const color = { success: C.success, partial: C.partial, fail: C.fail }

  return (
    <section className="card flex min-w-0 flex-col p-5 sm:p-6" aria-labelledby="activity">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="activity" className="flex items-center gap-2.5 text-lg font-semibold">
            <IconPlate icon={BarChart3} tint="bg-ok-soft" tone="text-ok" />
            Активность
          </h2>
          <p className="mt-1 text-sm text-muted">
            {fmtNumber(sum('runs'))} {plural(sum('runs'), RUNS)} за {byDay.length} {plural(byDay.length, DAYS)}
          </p>
        </div>
        <ul className="flex flex-wrap gap-2" aria-label="Исходы">
          {OUTCOMES.map((o) => (
            <li key={o.key} className="inline-flex items-center gap-1.5 rounded-full bg-ink/[.04] px-2.5 py-1 text-xs text-muted ring-1 ring-inset ring-line/60">
              <span className="h-2 w-2 rounded-full" style={{ background: color[o.key] }} aria-hidden />
              {o.label} <span className="digits text-sm font-semibold text-ink">{sum(o.key)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="h-64 min-h-64 sm:h-72 xl:h-auto xl:flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={byDay} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={C.grid} strokeDasharray="3 4" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.axis }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: C.axis }} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: C.cursor, radius: 8 }} content={<DayTooltip colors={C} />} />
            <Bar dataKey="success" name="Успех" stackId="a" fill={C.success} animationDuration={700} />
            <Bar dataKey="partial" name="Частично" stackId="a" fill={C.partial} animationDuration={700} />
            <Bar dataKey="fail" name="Провал" stackId="a" fill={C.fail} radius={[6, 6, 0, 0]} animationDuration={700} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function DayTooltip({ active, payload, label, colors }: TooltipProps<number, string> & { colors: ChartColors }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as { runs: number; success: number; partial: number; fail: number }
  return (
    <div className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm shadow-lift">
      <p className="font-semibold">{label}</p>
      <p className="text-xs text-muted">
        {d.runs} {plural(d.runs, RUNS)}
      </p>
      <ul className="mt-1.5 space-y-0.5">
        {OUTCOMES.map((o) => (
          <li key={o.key} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: { success: colors.success, partial: colors.partial, fail: colors.fail }[o.key] }} aria-hidden />
            <span className="text-muted">{o.label}</span>
            <span className="digits ml-auto pl-4 font-semibold">{d[o.key]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// --- directions ---------------------------------------------------------------------------

/** Success per direction, weakest first: the first rows are what to train next. */
function Directions({ data }: { data: Overview }) {
  const rows = [...data.categories].sort((a, b) => (a.runs ? a.success_rate : 2) - (b.runs ? b.success_rate : 2))
  return (
    <section className="card min-w-0 p-5 sm:p-6" aria-labelledby="directions">
      <h2 id="directions" className="flex items-center gap-2.5 text-lg font-semibold">
        <IconPlate icon={Compass} tint="bg-cat-medical-soft" tone="text-cat-medical" />
        Направления
      </h2>
      <p className="mb-4 mt-1 text-sm text-muted">Доля успешных прохождений, сначала слабые</p>
      <ul className="space-y-3.5">
        {rows.map((c, i) => {
          const cat = categoryStyle(c.category)
          const pct = Math.round(c.success_rate * 100)
          return (
            <li key={c.category} className="flex items-center gap-3">
              <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset ring-ink/[.05]', cat.soft)} aria-hidden>
                <cat.icon className={cn('h-5 w-5', cat.text)} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{c.title}</span>
                    {i === 0 && c.runs > 0 && <span className="shrink-0 rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn-ink">слабое место</span>}
                  </span>
                  <span className="digits shrink-0 text-base font-semibold">{c.runs ? `${pct}%` : '—'}</span>
                </div>
                <div className="track mt-1.5 h-1.5 overflow-hidden rounded-full" aria-hidden>
                  <div className={cn('bar-grow h-full rounded-full', cat.fill)} style={{ width: `${pct}%`, animationDelay: `${i * 70}ms` }} />
                </div>
                <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
                  <span>
                    {c.runs} {plural(c.runs, RUNS)}
                  </span>
                  <Score label="безопасность" value={c.avg_safety} />
                  <Score label="лояльность" value={c.avg_loyalty} />
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Score({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null
  const tone = scaleTone(value)
  return (
    <span className="whitespace-nowrap">
      {label} <span className={cn('digits font-semibold', { ok: 'text-ok', warn: 'text-warn-ink', bad: 'text-bad' }[tone])}>{Math.round(value)}</span>
    </span>
  )
}

// --- mistakes ------------------------------------------------------------------------------

const MISTAKES_FOLDED = 3

function Mistakes({ items }: { items: Overview['top_mistakes'] }) {
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, MISTAKES_FOLDED)
  const max = Math.max(1, ...items.map((m) => m.count))
  return (
    <section className="card min-w-0 p-5 sm:p-6" aria-labelledby="mistakes">
      <h2 id="mistakes" className="flex items-center gap-2.5 text-lg font-semibold">
        <IconPlate icon={AlertTriangle} tint="bg-brand-soft" tone="text-brand" />
        Частые ошибки
      </h2>
      <p className="mb-4 mt-1 text-sm text-muted">Где команда ошибается чаще всего — темы для разбора на планёрке</p>
      {items.length === 0 ? (
        <p className="text-muted">Ошибок за период не зафиксировано.</p>
      ) : (
        <ol className="space-y-3">
          {shown.map((m, i) => (
            <li key={i} className="row-in rounded-2xl bg-ink/[.025] p-4 ring-1 ring-inset ring-line/60" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-ink/[.05] px-2.5 py-0.5 text-xs font-medium text-muted">{m.scenario}</span>
                <span className="ml-auto flex items-center gap-2 text-xs text-muted">
                  <span className="track hidden h-1.5 w-16 overflow-hidden rounded-full sm:block" aria-hidden>
                    <span className="bar-bad bar-grow block h-full rounded-full" style={{ width: `${(m.count / max) * 100}%` }} />
                  </span>
                  <span className="digits text-lg font-semibold text-bad">{m.count}</span>
                  раз
                </span>
              </div>
              <p className="mt-2 font-medium leading-snug">{m.prompt}</p>
              <p className="mt-2 rounded-xl border-l-[3px] border-bad/60 bg-surface px-3 py-2 text-sm text-muted dark:bg-surface-2/60">
                Чаще всего отвечают: «{m.typical_answer}»
              </p>
            </li>
          ))}
        </ol>
      )}
      {items.length > MISTAKES_FOLDED && (
        <Button variant="ghost" size="sm" block className="mt-3 text-muted" onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? 'Свернуть' : `Показать все (${items.length})`}
          <ChevronDown className={cn('h-4 w-4 transition-transform', all && 'rotate-180')} aria-hidden />
        </Button>
      )}
    </section>
  )
}

// --- report ----------------------------------------------------------------------------------

/** Excel report for HR: summary, employees, competencies, frequent mistakes. */
function ReportDownload() {
  const [days, setDays] = useState<'7' | '30' | '90'>('30')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function download() {
    setBusy(true)
    setError(null)
    try {
      await api.admin.downloadReport(Number(days))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сформировать отчёт')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:items-end">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Segmented
          label="Период отчёта"
          value={days}
          onChange={setDays}
          options={[
            ['7', '7 дней'],
            ['30', '30 дней'],
            ['90', '90 дней'],
          ]}
        />
        <Button variant="secondary" onClick={download} loading={busy} icon={<Download className="h-4 w-4" />}>
          Отчёт в Excel
        </Button>
      </div>
      {error && (
        <p className="text-sm text-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function AllLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="-mr-2 inline-flex min-h-[40px] shrink-0 items-center gap-0.5 rounded-lg px-2 text-sm font-medium text-muted transition-colors hover:bg-ink/[.05] hover:text-ink coarse:min-h-[44px]"
    >
      {children}
      <ChevronRight className="h-4 w-4" aria-hidden />
    </Link>
  )
}
