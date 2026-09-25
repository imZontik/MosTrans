import type { ReactNode } from 'react'
import { Activity, AlertTriangle, CheckCircle2, Heart, PlayCircle, ShieldCheck, Siren, Timer, Users } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '@/api/client'
import { useAsync } from '@/hooks/useAsync'
import { Card, PageHeader, SectionTitle } from '@/components/Card'
import { ErrorState, Loading } from '@/components/States'
import { cn } from '@/lib/cn'
import { categoryStyle } from '@/lib/category'
import { fmtDate, fmtNumber, fmtPercent, fmtScore } from '@/lib/format'

const C = {
  success: '#13854E',
  partial: '#E8A317',
  fail: '#E21A1A',
  bar: '#1C2430',
  grid: '#CDD3D9',
  axis: '#5B6673',
}

export default function DashboardPage() {
  const { data, error, loading, reload } = useAsync(() => api.admin.overview(), [])

  if (loading && !data) return <Loading rows={4} />
  if (error || !data) return <ErrorState message={error ?? 'Нет данных'} onRetry={reload} />

  const byDay = data.runs_by_day.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
    partial: Math.max(0, d.runs - d.success - d.fail),
  }))
  const cats = data.categories.map((c) => ({ ...c, short: categoryStyle(c.category).short, rate: Math.round(c.success_rate * 100) }))
  const totalPositions = data.positions.reduce((s, p) => s + p.count, 0) || 1

  return (
    <div className="space-y-6">
      <PageHeader
        title="Дашборд обучения"
        subtitle={`Данные за 30 дней, обновлено ${fmtDate(data.generated_at, true)}`}
      />

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-4">
        <Kpi icon={<Users />} label="Сотрудников" value={fmtNumber(data.employees)} />
        <Kpi icon={<Activity />} label="Активны за 7 дней" value={fmtNumber(data.active_7d)} hint={fmtPercent(data.active_7d / (data.employees || 1))} />
        <Kpi icon={<PlayCircle />} label="Прохождений за неделю" value={fmtNumber(data.runs_week)} hint={`${fmtNumber(data.runs_30d)} за 30 дн`} />
        <Kpi icon={<CheckCircle2 />} label="Успешных" value={fmtPercent(data.success_rate_30d)} tone={data.success_rate_30d >= 0.6 ? 'ok' : 'warn'} />
        <Kpi icon={<ShieldCheck />} label="Ср. безопасность" value={fmtScore(data.avg_safety_30d)} tone={tone100(data.avg_safety_30d)} />
        <Kpi icon={<Heart />} label="Ср. лояльность" value={fmtScore(data.avg_loyalty_30d)} tone={tone100(data.avg_loyalty_30d)} />
        <Kpi icon={<Timer />} label="Доля таймаутов" value={fmtPercent(data.timeout_rate_30d, 1)} tone={data.timeout_rate_30d > 0.15 ? 'bad' : 'ok'} />
        <Kpi icon={<Siren />} label="Специвентов" value={fmtNumber(data.emergencies_30d)} />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <SectionTitle>Прохождения по дням</SectionTitle>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byDay} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: C.axis }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: C.axis }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'rgba(15,23,42,.04)' }} contentStyle={{ borderRadius: 12, border: '1px solid #CDD3D9', fontSize: 13, fontFamily: 'Golos Text' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="success" name="Успех" stackId="a" fill={C.success} stroke="#fff" strokeWidth={1} />
                <Bar dataKey="partial" name="Частично" stackId="a" fill={C.partial} stroke="#fff" strokeWidth={1} />
                <Bar dataKey="fail" name="Провал" stackId="a" fill={C.fail} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle>Состав по должностям</SectionTitle>
          <ul className="space-y-4">
            {data.positions.map((p) => (
              <li key={p.position}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="font-semibold">{p.title}</span>
                  <span className="font-display font-semibold">{p.count}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-ink/10">
                  <div className="h-full rounded-full bg-ink" style={{ width: `${(p.count / totalPositions) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-6 border-t border-line pt-4 text-muted">
            Доля таймаутов показывает, как часто сотрудники не успевают принять решение — это индикатор стресса в
            нештатных ситуациях.
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle>Направления обучения</SectionTitle>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cats} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke={C.grid} />
                <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: C.axis }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="short" width={120} tick={{ fontSize: 12, fill: C.axis }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(15,23,42,.04)' }}
                  formatter={(v: number) => [`${v}%`, 'Успешных прохождений']}
                  contentStyle={{ borderRadius: 12, border: '1px solid #CDD3D9', fontSize: 13, fontFamily: 'Golos Text' }}
                />
                <Bar dataKey="rate" fill={C.bar} radius={[0, 4, 4, 0]} barSize={14}>
                  {cats.map((c) => (
                    <Cell key={c.category} fill={categoryStyle(c.category).hex} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="pb-2 font-semibold">Направление</th>
                  <th className="pb-2 text-right font-semibold">Прох.</th>
                  <th className="pb-2 text-right font-semibold">Успех</th>
                  <th className="pb-2 text-right font-semibold">🛡️</th>
                  <th className="pb-2 text-right font-semibold">💙</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.categories.map((c) => {
                  const cat = categoryStyle(c.category)
                  const Icon = cat.icon
                  return (
                  <tr key={c.category}>
                    <td className="py-2 pr-2 font-semibold">
                      <span className="flex items-center gap-2">
                        <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg', cat.soft)} aria-hidden>
                          <Icon className={cn('h-4 w-4', cat.text)} />
                        </span>
                        {c.title}
                      </span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{c.runs}</td>
                    <td className="py-2.5 text-right tabular-nums">{c.runs ? fmtPercent(c.success_rate) : '—'}</td>
                    <td className={cn('py-2.5 text-right tabular-nums', toneText(c.avg_safety))}>{fmtScore(c.avg_safety)}</td>
                    <td className={cn('py-2.5 text-right tabular-nums', toneText(c.avg_loyalty))}>{fmtScore(c.avg_loyalty)}</td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle>Самые частые ошибки</SectionTitle>
        {data.top_mistakes.length === 0 ? (
          <p className="text-sm text-muted">Ошибок за период не зафиксировано</p>
        ) : (
          <ol className="divide-y divide-line">
            {data.top_mistakes.map((m, i) => (
              <li key={i} className="flex gap-4 py-3">
                <span className="digits w-10 shrink-0 text-xl font-semibold text-bad" title="Сколько раз ошиблись">
                  {m.count}
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-muted">{m.scenario}</p>
                  <p className="mt-0.5 font-semibold leading-snug">{m.prompt}</p>
                  <p className="mt-1.5 flex items-start gap-1.5 text-sm text-muted">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn-ink" />
                    Типичный ответ: «{m.typical_answer}»
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}

type KpiTone = 'ok' | 'warn' | 'bad' | undefined

function tone100(v: number | null): KpiTone {
  if (v === null) return undefined
  return v >= 70 ? 'ok' : v >= 40 ? 'warn' : 'bad'
}
function toneText(v: number | null) {
  const t = tone100(v)
  return t === 'ok' ? 'text-ok' : t === 'warn' ? 'text-warn-ink' : t === 'bad' ? 'text-bad' : ''
}

function Kpi({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: string; hint?: string; tone?: KpiTone }) {
  return (
    <div className="bg-surface p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5" aria-hidden>
          {icon}
        </span>
        {label}
      </p>
      <p
        className={cn(
          'mt-2 font-display text-2xl font-semibold',
          tone === 'ok' && 'text-ok',
          tone === 'warn' && 'text-warn-ink',
          tone === 'bad' && 'text-bad',
        )}
      >
        {value}
      </p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
}
