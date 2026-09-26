import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpCircle, CheckCircle2, Siren } from 'lucide-react'
import { api } from '@/api/client'
import { useAsync } from '@/hooks/useAsync'
import { AchievementBadge } from '@/components/AchievementBadge'
import { Avatar } from '@/components/Avatar'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Card, SectionTitle } from '@/components/Card'
import { CompetencyBars, CompetencyRadar } from '@/components/Competencies'
import { Progress } from '@/components/Progress'
import { RunHistory } from '@/components/RunHistory'
import { ErrorState, Loading } from '@/components/States'
import { fmtNumber, fmtPercent, fmtRelative, fmtScore, nextPosition, POSITION_TITLES } from '@/lib/format'

export default function EmployeeDetailPage() {
  const { userId } = useParams()
  const id = Number(userId)
  const emp = useAsync(() => api.admin.employee(id), [id])
  const emergencies = useAsync(() => api.admin.emergencies(), [])
  const [promoting, setPromoting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scenarioId, setScenarioId] = useState<number | ''>('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  if (emp.loading && !emp.data) return <Loading rows={4} />
  if (emp.error || !emp.data) return <ErrorState message={emp.error ?? 'Не найдено'} onRetry={emp.reload} />
  const e = emp.data
  const next = nextPosition(e.position)
  const q = e.qualification

  const promote = async () => {
    if (!next) return
    setPromoting(true)
    setError(null)
    try {
      await api.admin.updateEmployee(e.id, { position: next })
      setNotice(`${e.full_name} повышен(а) до «${POSITION_TITLES[next]}»`)
      await emp.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setPromoting(false)
    }
  }

  const dispatch = async () => {
    const sid = scenarioId || emergencies.data?.[0]?.id
    if (!sid) return
    setSending(true)
    setError(null)
    try {
      const res = await api.admin.dispatch({ scenario_id: sid, user_ids: [e.id], message: message.trim() || null })
      setNotice(`Специвент «${res.scenario.title}» отправлен. Сотрудник получит его в течение 20 секунд.`)
      setMessage('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/employees" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink coarse:min-h-[44px]">
        <ArrowLeft className="h-4 w-4" /> Все сотрудники
      </Link>

      <Card className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        <Avatar name={e.full_name} size="xl" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold">{e.full_name}</h1>
          <p className="text-muted">
            {e.position_title}
            {e.team ? `, ${e.team}` : ''}
            {e.depot ? `, ${e.depot}` : ''}. {e.email}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone="dark">
              Уровень {e.level}, {e.level_title}
            </Badge>
            <Badge>{fmtNumber(e.points)} очков</Badge>
            {e.rank && <Badge tone="brand">#{e.rank} в рейтинге</Badge>}
            <Badge>Активность: {fmtRelative(e.last_active_at)}</Badge>
          </div>
        </div>
      </Card>

      {notice && (
        <p className="flex items-center gap-2 card border-l-4 border-l-ok px-4 py-3" role="status">
          <CheckCircle2 className="h-4 w-4" /> {notice}
        </p>
      )}
      {error && <p className="card border-l-4 border-l-brand px-4 py-3" role="alert">{error}</p>}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Mini label="Прохождений" value={String(e.stats.runs_finished)} />
        <Mini label="Успешных" value={fmtPercent(e.stats.success_rate)} />
        <Mini label="Безопасность" value={fmtScore(e.stats.avg_safety)} />
        <Mini label="Лояльность" value={fmtScore(e.stats.avg_loyalty)} />
        <Mini label="Специвентов" value={String(e.stats.emergencies_handled)} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle>Компетенции</SectionTitle>
          <CompetencyRadar items={e.competencies} />
          <CompetencyBars items={e.competencies} />
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle>Квалификация</SectionTitle>
            {q ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted">
                    Сценарии должности «{q.next_position_title}»: {q.passed} из {q.total}
                  </p>
                  {q.ready && <Badge tone="ok">Готов к повышению</Badge>}
                </div>
                <Progress value={q.total ? q.passed / q.total : 0} className="mt-3" />
                {next && (
                  <Button
                    className="mt-4"
                    variant={q.ready ? 'primary' : 'secondary'}
                    loading={promoting}
                    onClick={promote}
                    icon={<ArrowUpCircle className="h-4 w-4" />}
                  >
                    Повысить до «{POSITION_TITLES[next]}»
                  </Button>
                )}
                {!q.ready && <p className="mt-2 text-xs text-muted">Рекомендуем повышать после прохождения всех сценариев.</p>}
              </>
            ) : (
              <p className="text-sm text-muted">Сотрудник на высшей должности — «{e.position_title}».</p>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitle>Отправить специвент</SectionTitle>
            <p className="mb-3 text-sm text-muted">
              Внезапная экстренная ситуация с голосовым сообщением появится у сотрудника прямо во время работы.
            </p>
            <div className="space-y-3">
              <select className="input" value={scenarioId} onChange={(ev) => setScenarioId(ev.target.value ? Number(ev.target.value) : '')}>
                {(emergencies.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.cover} {s.title}
                  </option>
                ))}
              </select>
              <input className="input" placeholder="Сообщение от руководителя (необязательно)" value={message} maxLength={500} onChange={(ev) => setMessage(ev.target.value)} />
              <Button variant="dark" loading={sending} onClick={dispatch} icon={<Siren className="h-4 w-4" />} disabled={!emergencies.data?.length}>
                Отправить специвент
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {e.achievements.length > 0 && (
        <section>
          <SectionTitle>Достижения</SectionTitle>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {e.achievements.map((a) => (
              <AchievementBadge key={a.code} achievement={a} compact />
            ))}
          </div>
        </section>
      )}

      <Card className="p-5">
        <SectionTitle>История прохождений</SectionTitle>
        <RunHistory items={e.history} />
      </Card>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="digits mt-1 text-xl font-semibold">{value}</p>
    </div>
  )
}
