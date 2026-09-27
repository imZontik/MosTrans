import { useMemo, useState } from 'react'
import { CheckCircle2, Globe2, Play, Search, Siren, Volume2 } from 'lucide-react'
import { api } from '@/api/client'
import { useAsync } from '@/hooks/useAsync'
import { useSpeech } from '@/hooks/useSpeech'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Card, PageHeader, SectionTitle } from '@/components/Card'
import { Mascot } from '@/components/Mascot'
import { DifficultyDots } from '@/components/Progress'
import { Loading } from '@/components/States'
import { Segmented } from '@/components/Segmented'
import { cn } from '@/lib/cn'
import { EMPLOYEES, pluralN } from '@/lib/plural'

export default function EmergenciesPage() {
  const scenarios = useAsync(() => api.admin.emergencies(), [])
  const employees = useAsync(() => api.admin.employees(), [])
  const [scenarioId, setScenarioId] = useState<number | null>(null)
  const [target, setTarget] = useState<'all' | 'selected'>('all')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [previewing, setPreviewing] = useState<number | null>(null)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const { play, stop, speaking } = useSpeech()

  const chosen = scenarioId ?? scenarios.data?.[0]?.id ?? null
  const filtered = useMemo(
    () => (employees.data ?? []).filter((e) => e.full_name.toLowerCase().includes(search.toLowerCase())),
    [employees.data, search],
  )

  const toggle = (id: number) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const listen = async (id: number) => {
    if (speaking && previewing === id) {
      stop()
      return
    }
    setPreviewing(id)
    try {
      const full = await api.admin.scenario(id)
      const audio = full.graph.alert_audio ?? { text: full.graph.alert ?? full.description, lang: 'ru-RU' }
      await play(audio)
    } catch {
      /* preview is optional */
    }
  }

  const dispatch = async () => {
    if (!chosen) return
    setBusy(true)
    setResult(null)
    try {
      const res = await api.admin.dispatch({
        scenario_id: chosen,
        user_ids: target === 'selected' ? [...selected] : null,
        message: message.trim() || null,
      })
      setResult({
        ok: true,
        text: `Специвент «${res.scenario.title}» отправлен: ${pluralN(res.dispatched, EMPLOYEES)}. Тревога появится у них в течение 20 секунд.`,
      })
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : 'Ошибка отправки' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Специвенты" subtitle="Внезапные экстренные ситуации посреди рабочего дня" />

      {/* the gist in one card; the details open on demand instead of filling a phone's first screen */}
      <section className="card flex items-start gap-3.5 p-4 sm:p-5">
        <Mascot className="h-14 w-14 shrink-0" mood="alarm" />
        <div className="min-w-0">
          <h2 className="font-semibold">Как это работает</h2>
          <p className="mt-0.5 text-sm text-muted">Тревога на весь экран, голосовое сообщение и решение под таймером. Результаты — в аналитике.</p>
          <details className="group mt-1.5 text-sm">
            <summary className="inline-flex min-h-[40px] cursor-pointer list-none items-center gap-1 font-medium text-ink/80 hover:text-ink [&::-webkit-details-marker]:hidden">
              Подробнее
              <span className="transition-transform group-open:rotate-180" aria-hidden>
                ▾
              </span>
            </summary>
            <p className="max-w-2xl text-muted">
              У сотрудника посреди рабочего дня срабатывает тревога: на весь экран — сирена и заранее записанное голосовое
              сообщение (например, от коллеги из другого вагона). Нужно быстро принять решение под таймером. На уровне
              <b> Hard</b> голосовое приходит на английском — от иностранного пассажира. Результаты попадают в аналитику как
              «Специвенты».
            </p>
          </details>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section>
          <SectionTitle>1. Ситуация</SectionTitle>
          {scenarios.loading ? (
            <Loading rows={3} avatar="tile" />
          ) : (
            <div className="space-y-2">
              {(scenarios.data ?? []).map((s) => {
                const active = chosen === s.id
                const hard = s.tags.includes('english')
                return (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setScenarioId(s.id)}
                    onKeyDown={(e) => e.key === 'Enter' && setScenarioId(s.id)}
                    className={cn(
                      'card flex cursor-pointer items-center gap-3 p-4 transition-colors',
                      active ? 'border-ink ring-1 ring-ink' : 'hover:border-ink',
                    )}
                  >
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-bg text-2xl">{s.cover}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{s.title}</p>
                        {hard && (
                          <Badge tone="dark" icon={<Globe2 className="h-3 w-3" />}>
                            Hard
                          </Badge>
                        )}
                      </div>
                      <p className="line-clamp-2 text-sm text-muted">{s.description}</p>
                      <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                        {s.category_title}, сложность <DifficultyDots value={s.difficulty} />
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        listen(s.id)
                      }}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full btn-ink"
                      aria-label="Прослушать голосовое"
                      title="Прослушать голосовое"
                    >
                      {speaking && previewing === s.id ? <Volume2 className="h-4 w-4 animate-pulse" /> : <Play className="h-4 w-4" />}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="space-y-6">
          <div>
            <SectionTitle>2. Получатели</SectionTitle>
            <Card className="p-4">
              <Segmented
                label="Получатели"
                value={target}
                onChange={setTarget}
                options={[
                  ['all', 'Все сотрудники'],
                  ['selected', `Выбранные${selected.size ? ` (${selected.size})` : ''}`],
                ]}
              />
              {target === 'selected' && (
                <div className="mt-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input className="input py-2 pl-9" placeholder="Найти сотрудника" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                  <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
                    {filtered.map((e) => (
                      <li key={e.id}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
                          <input type="checkbox" className="h-4 w-4 accent-[#e30b17]" checked={selected.has(e.id)} onChange={() => toggle(e.id)} />
                          <Avatar name={e.full_name} size="xs" />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{e.full_name}</span>
                          <span className="text-xs text-muted">ур. {e.level}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </div>

          <div>
            <SectionTitle>3. Сообщение</SectionTitle>
            <Card className="p-4">
              <textarea
                className="input"
                rows={3}
                maxLength={500}
                placeholder="Например: «Коллеги, внеплановая проверка готовности. Действуйте по регламенту!»"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <Button
                className="mt-4"
                size="lg"
                block
                loading={busy}
                disabled={!chosen || (target === 'selected' && selected.size === 0)}
                onClick={dispatch}
                icon={<Siren className="h-5 w-5" />}
              >
                Отправить специвент
              </Button>
              {result && (
                <p
                  className={cn(
                    'mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-sm font-semibold',
                    result.ok ? 'bg-ok/10 text-ok' : 'bg-bad/10 text-bad',
                  )}
                >
                  {result.ok && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
                  {result.text}
                </p>
              )}
            </Card>
          </div>
        </section>
      </div>
    </div>
  )
}
