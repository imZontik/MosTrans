import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts'
import type { Competency } from '@/api/types'
import { cn } from '@/lib/cn'
import { useChartColors } from '@/theme/chartColors'
import { categoryStyle } from '@/lib/category'
import { scaleTone, TONE_TEXT } from '@/lib/format'

const SHORT: Record<string, string> = {
  conflict: 'Конфликты',
  medical: 'Медицина',
  safety: 'Безопасность',
  technical: 'Техника',
  service: 'Сервис',
  teamwork: 'Команда',
}


export function CompetencyRadar({ items }: { items: Competency[] }) {
  const c = useChartColors()
  const data = items.map((it) => ({ subject: SHORT[it.category] ?? it.title, value: Math.round(it.mastery * 100) }))
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="70%">
          <PolarGrid stroke={c.grid} />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 13, fill: c.axis, fontFamily: 'Golos Text' }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar dataKey="value" stroke={c.ink} strokeWidth={1.5} fill={c.ink} fillOpacity={0.14} isAnimationActive={false} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Mastery per category: icon tile and bar in the category accent, the percentage keeps its signal colour. */
export function CompetencyBars({ items }: { items: Competency[] }) {
  return (
    <ul className="space-y-3">
      {items.map((c) => {
        const pct = Math.round(c.mastery * 100)
        const tone = c.runs ? scaleTone(pct) : null
        const cat = categoryStyle(c.category)
        const Icon = cat.icon
        return (
          <li key={c.category} className="flex items-center gap-3">
            <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset ring-ink/[.05]', cat.soft)} aria-hidden>
              <Icon className={cn('h-5 w-5', cat.text)} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate">{c.title}</span>
                <span className={cn('shrink-0', tone ? cn('digits text-base font-semibold', TONE_TEXT[tone]) : 'text-xs text-muted')}>
                  {c.runs ? `${pct}%` : 'Не начато'}
                </span>
              </div>
              <div className="track mt-1.5 h-1.5 overflow-hidden rounded-full">
                {c.runs > 0 && (
                  <div
                    className={cn('h-full rounded-full', cat.fill)}
                    style={{ width: `${Math.max(pct, 3)}%`, backgroundImage: 'linear-gradient(90deg, rgb(255 255 255 / .28), transparent)' }}
                  />
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
