import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
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
  FileSpreadsheet,
  Loader2,
  MessageSquareWarning,
  Sparkles,
  UserRoundX,
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
import { ErrorState, Loading } from '@/components/States'
import { DashboardSkeleton } from '@/components/Skeleton'
import { cn } from '@/lib/cn'
import { categoryStyle } from '@/lib/category'
import { fmtDate, fmtNumber, scaleTone } from '@/lib/format'
import { EMPLOYEES, RUNS, plural } from '@/lib/plural'
import { useChartColors, type ChartColors } from '@/theme/chartColors'

const DAYS: [string, string, string] = ['день', 'дня', 'дней']
const TIMES: [string, string, string] = ['раз', 'раза', 'раз']

type Tone = 'ok' | 'warn' | 'bad'

/** Sections slide in one after another, top to bottom. */
const rise = (i: number): CSSProperties => ({ animationDelay: `${i * 80}ms` })

/**
 * The lead's dashboard, read top to bottom: what the week was like (one sentence, four numbers),
 * who to talk to, how the team trained, which directions are weak, and what to discuss at the
 * briefing. One idea per block, each number with a plain-language line under it.
 */
export default function DashboardPage() {
  const { user } = useAuth()
  const overview = useAsync(() => api.admin.overview(), [])
  const employees = useAsync(() => api.admin.employees(), [])
  const data = overview.data

  if (overview.loading && !data) return <DashboardSkeleton />
  if (overview.error || !data) return <ErrorState message={overview.error ?? 'Нет данных'} onRetry={overview.reload} />

  return (
    <div className="space-y-6">
      <header className="row-in flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.005em] lg:text-[40px] lg:leading-[1.05]">{greeting(user?.full_name)}</h1>
          <p className="mt-1.5 text-muted">Сводка по обучению команды · обновлено {fmtDate(data.generated_at, true)}</p>
        </div>
        <ReportMenu />
      </header>

      <Pulse data={data} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Activity data={data} style={rise(2)} />
        <Attention rows={employees.data} loading={employees.loading && !employees.data} style={rise(3)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <Directions data={data} style={rise(4)} />
        <Mistakes items={data.top_mistakes} style={rise(5)} />
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

/** Card header used by every block: icon, title, one line of what it shows, an optional action. */
function Head({ id, icon, tint, tone, title, hint, action }: { id: string; icon: LucideIcon; tint: string; tone: string; title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <IconPlate icon={icon} tint={tint} tone={tone} className="mt-0.5" />
        <div className="min-w-0">
          <h2 id={id} className="flex flex-wrap items-center gap-2 text-lg font-semibold leading-tight">
            {title}
          </h2>
          {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

// --- pulse -------------------------------------------------------------------------

const ON_DARK: Record<Tone, { text: string; fill: string }> = {
  ok: { text: 'text-[#5FD39A]', fill: 'bg-[#5FD39A]' },
  warn: { text: 'text-[#FFC94D]', fill: 'bg-[#FFC94D]' },
  bad: { text: 'text-[#FF8A7A]', fill: 'bg-[#FF8A7A]' },
}

/** The week in one sentence and four numbers, on the night line. */
function Pulse({ data }: { data: Overview }) {
  const active = data.employees ? data.active_7d / data.employees : 0
  const idle = Math.max(0, data.employees - data.active_7d)
  const weakest = [...data.categories].filter((c) => c.runs > 0).sort((a, b) => a.success_rate - b.success_rate)[0]
  const weakestPct = weakest ? Math.round(weakest.success_rate * 100) : null
  const perDay = data.runs_by_day.map((d) => d.runs)
  const week = perDay.slice(-7).reduce((a, b) => a + b, 0)
  const weekBefore = perDay.slice(-14, -7).reduce((a, b) => a + b, 0)
  const trend = weekBefore > 0 ? Math.round(((week - weekBefore) / weekBefore) * 100) : null
  const success = Math.round(data.success_rate_30d * 100)
  const safety = data.avg_safety_30d === null ? null : Math.round(data.avg_safety_30d)

  return (
    <NightPanel aria-labelledby="pulse" className="row-in -mx-2 px-5 py-5 sm:mx-0 sm:px-7 sm:py-7" style={rise(1)}>
      <SpeedLines rows={[14]} />
      <div className="relative max-w-3xl">
        <h2 id="pulse" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.1em] text-white/55">
          <Sparkles className="h-4 w-4 text-[#FFC94D]" aria-hidden />
          Главное за неделю
        </h2>
        <p className="mt-3 text-xl font-semibold leading-snug text-white sm:text-[26px] sm:leading-[34px]">
          {data.active_7d} из {data.employees} {plural(data.employees, EMPLOYEES)} занимались на этой неделе.
        </p>
        {weakest && weakestPct !== null && (
          <p className="mt-1.5 text-base text-white/70">
            {weakestPct < 70 ? (
              <>
                Стоит подтянуть{' '}
                <a
                  href="#directions"
                  className="font-semibold text-[#FFC94D] underline decoration-[#FFC94D]/40 underline-offset-4 transition-colors hover:decoration-[#FFC94D]"
                >
                  {weakest.title.toLowerCase()}
                </a>{' '}
                — успешно только {weakestPct}% прохождений.
              </>
            ) : (
              'Во всех направлениях больше 70% успешных прохождений — так держать.'
            )}
          </p>
        )}
      </div>

      <dl className="relative mt-6 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <Kpi
          label="Занимались"
          value={
            <>
              <CountUp value={data.active_7d} />
              <Unit>из {data.employees}</Unit>
            </>
          }
          note={idle > 0 ? `ещё ${idle} — без занятий 7 дней` : 'занимается вся команда'}
          visual={<Meter value={active} tone={active >= 0.7 ? 'ok' : 'warn'} />}
        />
        <Kpi
          label="Прохождений"
          value={<CountUp value={data.runs_week} />}
          note={
            trend !== null ? (
              <span className="inline-flex items-center gap-1">
                <span className={cn('inline-flex items-center font-semibold', trend >= 0 ? ON_DARK.ok.text : ON_DARK.bad.text)}>
                  {trend >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> : <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />}
                  {Math.abs(trend)}%
                </span>
                к прошлой неделе
              </span>
            ) : (
              `${fmtNumber(data.runs_30d)} за 30 дней`
            )
          }
          visual={<Sparkline values={perDay} className="h-7 w-full" />}
        />
        <Kpi
          label="Успешных"
          value={
            <>
              <CountUp value={success} />
              <Unit tight>%</Unit>
            </>
          }
          note={`за 30 дней · таймауты ${(data.timeout_rate_30d * 100).toFixed(1).replace('.', ',')}%`}
          visual={<Meter value={data.success_rate_30d} tone={success >= 60 ? 'ok' : success >= 40 ? 'warn' : 'bad'} />}
        />
        <Kpi
          label="Безопасность"
          value={
            safety === null ? (
              '—'
            ) : (
              <>
                <CountUp value={safety} />
                <Unit>из 100</Unit>
              </>
            )
          }
          note={`норма от 70${data.avg_loyalty_30d === null ? '' : ` · лояльность ${Math.round(data.avg_loyalty_30d)}`}`}
          visual={safety === null ? null : <Meter value={safety / 100} tone={scaleTone(safety)} mark={0.7} />}
        />
      </dl>
    </NightPanel>
  )
}

function Unit({ children, tight }: { children: ReactNode; tight?: boolean }) {
  return <span className={cn('font-sans font-medium text-white/50', tight ? 'ml-0.5 text-lg' : 'ml-1.5 text-sm')}>{children}</span>
}

/** One number on the hero: label, value, a plain line of context, a small picture at the bottom. */
function Kpi({ label, value, note, visual }: { label: string; value: ReactNode; note: ReactNode; visual: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl bg-white/[.055] px-4 pb-4 pt-3.5 ring-1 ring-inset ring-white/10 transition-colors duration-200 hover:bg-white/[.085] sm:px-5">
      <dt className="text-sm text-white/60">{label}</dt>
      <dd className="contents">
        <p className="digits mt-1 flex items-baseline text-[34px] font-bold leading-none text-white sm:text-[40px]">{value}</p>
        <p className="mt-2 text-xs text-white/55">{note}</p>
        <div className="mt-auto flex h-7 items-end pt-3">{visual}</div>
      </dd>
    </div>
  )
}

/** A thin bar on the night line; `mark` draws the norm as a tick. */
function Meter({ value, tone, mark }: { value: number; tone: Tone; mark?: number }) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="relative h-1.5 w-full rounded-full bg-white/10" aria-hidden>
      <div className="absolute inset-0 overflow-hidden rounded-full">
        <div className={cn('bar-grow h-full rounded-full', ON_DARK[tone].fill)} style={{ width: `${v * 100}%`, animationDelay: '250ms' }} />
      </div>
      {mark !== undefined && <span className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-white/60" style={{ left: `${mark * 100}%` }} />}
    </div>
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
          <stop offset="0" stopColor="#FF6A3D" stopOpacity=".4" />
          <stop offset="1" stopColor="#FF6A3D" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L100 30 L0 30 Z`} fill={`url(#${id}-a)`} className="spark-fade" />
      <path d={line} fill="none" stroke="#FF7A4D" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" pathLength={1} className="spark-draw" />
    </svg>
  )
}

// --- attention ------------------------------------------------------------------------

type FlagKind = 'low' | 'drop' | 'idle'

interface Flag {
  e: EmployeeRow
  kind: FlagKind
  weight: number
  text: string
}

const FLAG: Record<FlagKind, { icon: LucideIcon; tone: 'bad' | 'warn' }> = {
  low: { icon: AlertTriangle, tone: 'bad' },
  drop: { icon: ArrowDownRight, tone: 'warn' },
  idle: { icon: UserRoundX, tone: 'warn' },
}

const DAY_MS = 86_400_000

/** Who to talk to this week: low or falling safety, or not training at all. */
function flagsOf(rows: EmployeeRow[]): Flag[] {
  const now = Date.now()
  const out: Flag[] = []
  for (const e of rows) {
    const idle = e.last_active_at ? Math.floor((now - new Date(e.last_active_at).getTime()) / DAY_MS) : null
    if (idle === null || idle >= 7) {
      out.push({ e, kind: 'idle', weight: 3, text: idle === null ? 'ещё не начинал обучение' : `не занимается ${idle} ${plural(idle, DAYS)}` })
    } else if (e.safety_30d !== null && e.safety_30d < 70) {
      out.push({ e, kind: 'low', weight: 4 + (70 - e.safety_30d) / 10, text: `безопасность ${Math.round(e.safety_30d)} из 100` })
    } else if (e.safety_trend !== null && e.safety_trend <= -3) {
      out.push({ e, kind: 'drop', weight: 2 + Math.abs(e.safety_trend) / 10, text: `безопасность −${Math.round(Math.abs(e.safety_trend))} за месяц` })
    }
  }
  return out.sort((a, b) => b.weight - a.weight)
}

const ATTENTION_SHOWN = 5

function Attention({ rows, loading, style }: { rows: EmployeeRow[] | undefined; loading: boolean; style?: CSSProperties }) {
  const flags = useMemo(() => flagsOf(rows ?? []), [rows])

  return (
    <section className="card row-in flex min-w-0 flex-col p-5 sm:p-6" aria-labelledby="attention" style={style}>
      <Head
        id="attention"
        icon={AlertTriangle}
        tint="bg-warn-soft"
        tone="text-warn-ink"
        title={
          <>
            Кому нужна помощь
            {flags.length > 0 && <span className="digits rounded-full bg-warn-soft px-2 py-0.5 text-sm font-semibold text-warn-ink">{flags.length}</span>}
          </>
        }
        hint="С кем поговорить первым"
        action={<AllLink to="/admin/employees">Все</AllLink>}
      />

      {loading ? (
        <Loading rows={4} bare />
      ) : flags.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl bg-ok-soft/70 px-4 py-4 ring-1 ring-inset ring-ok/20">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-ok" aria-hidden />
          <p>
            <span className="font-semibold">Всё в порядке.</span> <span className="text-muted">Все занимаются, безопасность в норме.</span>
          </p>
        </div>
      ) : (
        <>
          <ul className="-mx-2 space-y-0.5">
            {flags.slice(0, ATTENTION_SHOWN).map((f, i) => {
              const meta = FLAG[f.kind]
              return (
                <li key={f.e.id} className="row-in" style={{ animationDelay: `${300 + i * 60}ms` }}>
                  <Link to={`/admin/employees/${f.e.id}`} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-ink/[.04]">
                    <Avatar name={f.e.full_name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{f.e.full_name}</span>
                      <span className={cn('flex items-center gap-1 text-xs', meta.tone === 'bad' ? 'text-bad' : 'text-warn-ink')}>
                        <meta.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{f.text}</span>
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted/50 transition-[transform,color] group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>
          {flags.length > ATTENTION_SHOWN && (
            <Link
              to="/admin/employees"
              className="group mt-auto inline-flex min-h-[44px] items-center gap-1 self-start pt-3 text-sm text-muted transition-colors hover:text-ink"
            >
              Ещё {flags.length - ATTENTION_SHOWN} — в списке сотрудников
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          )}
        </>
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
type OutcomeKey = (typeof OUTCOMES)[number]['key']

interface Day {
  label: string
  runs: number
  success: number
  partial: number
  fail: number
}

const outcomeColor = (C: ChartColors): Record<OutcomeKey, string> => ({ success: C.success, partial: C.partial, fail: C.fail })

function Activity({ data, style }: { data: Overview; style?: CSSProperties }) {
  const C = useChartColors()
  const byDay: Day[] = data.runs_by_day.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', ''),
    partial: Math.max(0, d.runs - d.success - d.fail),
  }))
  const sum = (k: OutcomeKey | 'runs') => byDay.reduce((s, d) => s + d[k], 0)
  const total = sum('runs')
  const avg = byDay.length ? Math.round(total / byDay.length) : 0
  const color = outcomeColor(C)

  return (
    <section className="card row-in flex min-w-0 flex-col p-5 sm:p-6" aria-labelledby="activity" style={style}>
      <Head
        id="activity"
        icon={BarChart3}
        tint="bg-ok-soft"
        tone="text-ok"
        title="Активность"
        hint={
          <>
            {fmtNumber(total)} {plural(total, RUNS)} за {byDay.length} {plural(byDay.length, DAYS)}, в среднем {avg} в день
          </>
        }
      />
      <ul className="-mt-1 mb-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted" aria-label="Исходы">
        {OUTCOMES.map((o) => (
          <li key={o.key} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color[o.key] }} aria-hidden />
            {o.label} <b className="digits text-base text-ink">{sum(o.key)}</b>
            <span className="text-xs">· {total ? Math.round((sum(o.key) / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
      <div className="h-64 min-h-64 sm:h-72 xl:h-auto xl:flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={byDay} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barCategoryGap="26%">
            <CartesianGrid vertical={false} stroke={C.grid} strokeDasharray="3 4" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: C.axis }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: C.axis }} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: C.cursor, radius: 8 }} content={<DayTooltip colors={C} />} />
            {OUTCOMES.map((o) => (
              <Bar
                key={o.key}
                dataKey={o.key}
                name={o.label}
                stackId="a"
                fill={color[o.key]}
                animationDuration={800}
                animationEasing="ease-out"
                shape={(p: unknown) => <StackSegment {...(p as SegmentProps)} k={o.key} />}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

interface SegmentProps {
  x?: number
  y?: number
  width?: number
  height?: number
  fill?: string
  payload?: Day
}

/** A stacked segment; only the topmost non-empty one of the day gets the rounded top. */
function StackSegment({ x = 0, y = 0, width = 0, height = 0, fill, payload, k }: SegmentProps & { k: OutcomeKey }) {
  if (height <= 0 || width <= 0) return null
  const top = payload ? (['fail', 'partial', 'success'] as const).find((key) => payload[key] > 0) : undefined
  const r = top === k ? Math.min(6, width / 2, height) : 0
  const d = `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`
  return <path d={d} fill={fill} />
}

function DayTooltip({ active, payload, label, colors }: TooltipProps<number, string> & { colors: ChartColors }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as Day
  const color = outcomeColor(colors)
  return (
    <div className="min-w-[168px] rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm shadow-lift">
      <p className="font-semibold">{label}</p>
      <p className="text-xs text-muted">
        {d.runs} {plural(d.runs, RUNS)}
      </p>
      <ul className="mt-1.5 space-y-0.5">
        {OUTCOMES.map((o) => (
          <li key={o.key} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: color[o.key] }} aria-hidden />
            <span className="text-muted">{o.label}</span>
            <span className="digits ml-auto pl-4 font-semibold">{d[o.key]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// --- directions ---------------------------------------------------------------------------

const TEXT: Record<Tone, string> = { ok: 'text-ok', warn: 'text-warn-ink', bad: 'text-bad' }

/**
 * Success per direction, weakest first: the first rows are what to train next. Only the ones
 * below the team average are coloured, so the eye lands on them and not on six bars at once.
 */
function Directions({ data, style }: { data: Overview; style?: CSSProperties }) {
  const rows = [...data.categories].sort((a, b) => (a.runs ? a.success_rate : 2) - (b.runs ? b.success_rate : 2))
  const avg = Math.round(data.success_rate_30d * 100)
  return (
    <section id="directions" className="card row-in min-w-0 scroll-mt-6 p-5 sm:p-6" aria-labelledby="directions-title" style={style}>
      <Head
        id="directions-title"
        icon={Compass}
        tint="bg-cat-medical-soft"
        tone="text-cat-medical"
        title="Направления"
        hint={
          <>
            Доля успешных прохождений, сначала слабые.{' '}
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span className="inline-block h-3 w-0.5 rounded-full bg-ink/45" aria-hidden />
              среднее по команде {avg}%
            </span>
          </>
        }
      />
      <ul className="space-y-4">
        {rows.map((c, i) => {
          const cat = categoryStyle(c.category)
          const pct = Math.round(c.success_rate * 100)
          const below = c.runs > 0 && pct < avg
          return (
            <li key={c.category} className="flex items-center gap-3.5">
              <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset ring-ink/[.05]', cat.soft)} aria-hidden>
                <cat.icon className={cn('h-5 w-5', cat.text)} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{c.title}</span>
                    {i === 0 && below && <span className="shrink-0 rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn-ink">подтянуть</span>}
                  </span>
                  <span className={cn('digits shrink-0 text-lg font-semibold', !c.runs ? 'text-muted' : below ? 'text-warn-ink' : 'text-ink')}>{c.runs ? `${pct}%` : '—'}</span>
                </div>
                <div className="relative mt-1.5 h-2" aria-hidden>
                  <div className="track absolute inset-0 overflow-hidden rounded-full">
                    <div className={cn('bar-grow h-full rounded-full', below ? 'bar-warn' : 'bg-ink/30')} style={{ width: `${pct}%`, animationDelay: `${400 + i * 70}ms` }} />
                  </div>
                  <span className="absolute -top-0.5 h-3 w-0.5 -translate-x-1/2 rounded-full bg-ink/45" style={{ left: `${avg}%` }} />
                </div>
                <p className="mt-1.5 flex flex-wrap gap-x-1.5 gap-y-0.5 text-xs text-muted">
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
  return (
    <span className="whitespace-nowrap">
      · {label} <span className={cn('digits font-semibold', TEXT[scaleTone(value)])}>{Math.round(value)}</span>
    </span>
  )
}

// --- mistakes ------------------------------------------------------------------------------

const MISTAKES_FOLDED = 4

/** Frequent mistakes as an accordion: the question first, the typical wrong answer on a click. */
function Mistakes({ items, style }: { items: Overview['top_mistakes']; style?: CSSProperties }) {
  const [all, setAll] = useState(false)
  const [open, setOpen] = useState<number | null>(0)
  const shown = all ? items : items.slice(0, MISTAKES_FOLDED)
  const max = Math.max(1, ...items.map((m) => m.count))

  return (
    <section className="card row-in min-w-0 p-5 sm:p-6" aria-labelledby="mistakes" style={style}>
      <Head id="mistakes" icon={MessageSquareWarning} tint="bg-brand-soft" tone="text-brand" title="Частые ошибки" hint="Темы для разбора на планёрке" />
      {items.length === 0 ? (
        <p className="text-muted">Ошибок за период не зафиксировано.</p>
      ) : (
        <ol className="-mx-2 divide-y divide-line/60">
          {shown.map((m, i) => {
            const isOpen = open === i
            return (
              <li key={i} className="row-in py-1" style={{ animationDelay: `${450 + i * 60}ms` }}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="group flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-ink/[.035]"
                >
                  <span
                    className={cn(
                      'digits mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm font-semibold transition-colors',
                      isOpen ? 'bg-brand text-white' : 'bg-ink/[.06] text-muted',
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block font-medium leading-snug', !isOpen && 'line-clamp-2')}>{m.prompt}</span>
                    <span className="mt-1 block text-xs text-muted">{m.scenario}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
                    <span className="flex items-baseline gap-1 text-xs text-muted">
                      <b className="digits text-lg leading-none text-bad">{m.count}</b>
                      {plural(m.count, TIMES)}
                    </span>
                    <span className="track hidden h-1 w-12 overflow-hidden rounded-full sm:block" aria-hidden>
                      <span className="bar-bad bar-grow block h-full rounded-full" style={{ width: `${(m.count / max) * 100}%`, animationDelay: `${500 + i * 60}ms` }} />
                    </span>
                  </span>
                  <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-muted/60 transition-transform duration-300', isOpen && 'rotate-180')} aria-hidden />
                </button>
                <div className={cn('grid transition-[grid-template-rows,opacity] duration-300 ease-out', isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
                  <div className="overflow-hidden">
                    <p className="mb-2 ml-12 mr-2 rounded-xl border-l-[3px] border-bad/60 bg-ink/[.035] px-3 py-2 text-sm text-muted">
                      Чаще всего отвечают: <span className="text-ink">«{m.typical_answer}»</span>
                    </p>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}
      {items.length > MISTAKES_FOLDED && (
        <Button variant="ghost" size="sm" block className="mt-2 text-muted" onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? 'Свернуть' : `Показать все (${items.length})`}
          <ChevronDown className={cn('h-4 w-4 transition-transform', all && 'rotate-180')} aria-hidden />
        </Button>
      )}
    </section>
  )
}

// --- report ----------------------------------------------------------------------------------

const PERIODS: [number, string, string][] = [
  [7, 'За неделю', 'последние 7 дней'],
  [30, 'За месяц', 'последние 30 дней'],
  [90, 'За квартал', 'последние 90 дней'],
]

/** Excel report for HR in one menu: pick the period and the file downloads. */
function ReportMenu() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function download(days: number) {
    setBusy(days)
    setError(null)
    try {
      await api.admin.downloadReport(days)
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сформировать отчёт')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div ref={box} className="relative w-full sm:w-auto">
      <Button
        variant="secondary"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        icon={<Download className="h-4 w-4" />}
        className="w-full sm:w-auto"
      >
        Отчёт в Excel
        <ChevronDown className={cn('h-4 w-4 text-muted transition-transform duration-200', open && 'rotate-180')} aria-hidden />
      </Button>
      {open && (
        <div role="menu" aria-label="Период отчёта" className="pop-in absolute right-0 top-full z-30 mt-2 w-full origin-top-right rounded-2xl border border-line bg-surface p-1.5 shadow-lift sm:w-72">
          <p className="flex items-center gap-2 px-3 pb-1.5 pt-2 text-xs text-muted">
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            Сводка, сотрудники, компетенции и ошибки
          </p>
          {PERIODS.map(([days, label, hint]) => (
            <button
              key={days}
              role="menuitem"
              type="button"
              onClick={() => download(days)}
              disabled={busy !== null}
              className="group flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-ink/[.05] disabled:opacity-60"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
              {busy === days ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted" aria-hidden />
              ) : (
                <Download className="h-4 w-4 text-muted/60 transition-[transform,color] group-hover:translate-y-0.5 group-hover:text-ink" aria-hidden />
              )}
            </button>
          ))}
          {error && (
            <p className="px-3 pb-2 pt-1 text-sm text-bad" role="alert">
              {error}
            </p>
          )}
        </div>
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
