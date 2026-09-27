import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpCircle, CheckCircle2, MessageSquare, Siren, History } from 'lucide-react'
import { api } from '@/api/client'
import { useAsync } from '@/hooks/useAsync'
import { AchievementBadge } from '@/components/AchievementBadge'
import { Avatar } from '@/components/Avatar'
import { Button, ButtonLink } from '@/components/Button'
import { Card, SectionTitle } from '@/components/Card'
import { CompetencyBars, CompetencyRadar } from '@/components/Competencies'
import { Disclosure } from '@/components/Disclosure'
import { RunHistory } from '@/components/RunHistory'
import { ErrorState } from '@/components/States'
import { EmployeeSkeleton } from '@/components/Skeleton'
import { NightPanel, SpeedLines } from '@/components/NightPanel'
import { cn } from '@/lib/cn'
import { fmtNumber, fmtPercent, fmtRelative, fmtScore, nextPosition, POSITION_TITLES, teamName } from '@/lib/format'

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

  if (emp.loading && !emp.data) return <EmployeeSkeleton />
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

  const where = [e.position_title, e.team && teamName(e.team), e.depot].filter(Boolean).join(' · ')

  return (
    <div className="space-y-6">
      <Link
        to="/admin/employees"
        className="-ml-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-muted transition-colors hover:bg-ink/[.05] hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Все сотрудники
      </Link>

      {/* who, where, and the five numbers on the night line */}
      <NightPanel aria-labelledby="emp-name" className="-mx-2 px-5 pb-5 pt-5 sm:mx-0 sm:px-7 sm:pb-6 sm:pt-6">
        <SpeedLines rows={[18, 62]} />
        <div className="relative flex flex-wrap items-start gap-4">
          <Avatar name={e.full_name} size="lg" onDark />
          <div className="min-w-0 flex-1">
            <h1 id="emp-name" className="text-[26px] font-bold leading-[1.05] sm:text-[32px]">
              {e.full_name}
            </h1>
            <p className="mt-1.5 text-sm text-white/70 sm:text-base">{where}</p>
            <p className="mt-0.5 truncate text-xs text-white/50">{e.email}</p>
          </div>
          <ButtonLink
            to={`/admin/broadcasts?user=${e.id}`}
            variant="light"
            icon={<MessageSquare className="h-4 w-4" />}
            className="w-full shrink-0 sm:w-auto"
          >
            Написать
          </ButtonLink>
        </div>
        <div className="relative mt-4 flex flex-wrap gap-2 text-xs">
          <HeroChip>
            Ур. {e.level} · {e.level_title}
          </HeroChip>
          <HeroChip>{fmtNumber(e.points)} очков</HeroChip>
          {e.rank && <HeroChip accent>#{e.rank} в рейтинге</HeroChip>}
          <HeroChip>Активность: {fmtRelative(e.last_active_at)}</HeroChip>
        </div>
        <dl className="relative mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 ring-1 ring-inset ring-white/10 sm:grid-cols-5">
          <Cell label="Прохождений">{e.stats.runs_finished}</Cell>
          <Cell label="Успешных">{e.stats.runs_finished ? fmtPercent(e.stats.success_rate) : '—'}</Cell>
          <Cell label="Безопасность" tone={e.stats.avg_safety}>
            {fmtScore(e.stats.avg_safety)}
          </Cell>
          <Cell label="Лояльность" tone={e.stats.avg_loyalty}>
            {fmtScore(e.stats.avg_loyalty)}
          </Cell>
          <Cell label="Специвентов" className="col-span-2 sm:col-span-1">
            {e.stats.emergencies_handled}
          </Cell>
        </dl>
      </NightPanel>

      {notice && (
        <p className="flex items-start gap-2.5 rounded-2xl bg-ok-soft px-4 py-3 ring-1 ring-inset ring-ok/25" role="status">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" /> {notice}
        </p>
      )}
      {error && (
        <p className="rounded-2xl bg-brand-soft px-4 py-3 ring-1 ring-inset ring-brand/25" role="alert">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <Card className="p-5 sm:p-6">
          <SectionTitle>Компетенции</SectionTitle>
          {/* the radar needs room for its labels: from sm; on a phone the bars say the same */}
          <div className="hidden sm:block">
            <CompetencyRadar items={e.competencies} />
          </div>
          <CompetencyBars items={e.competencies} />
        </Card>

        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <SectionTitle>Квалификация</SectionTitle>
            {q ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-muted">Следующая должность</p>
                    <p className="font-semibold leading-snug">{q.next_position_title}</p>
                  </div>
                  <p className="digits shrink-0 text-2xl font-bold leading-none">
                    {q.passed}
                    <span className="text-base font-semibold text-muted">/{q.total}</span>
                  </p>
                </div>
                <div className="mt-3 flex gap-1.5" aria-hidden>
                  {Array.from({ length: Math.max(1, q.total) }, (_, i) => (
                    <span key={i} className={cn('h-2 flex-1 rounded-full', i < q.passed ? 'bg-cat-service' : 'track')} />
                  ))}
                </div>
                <p className={cn('mt-3 flex items-center gap-2 text-sm', q.ready ? 'font-medium text-ok' : 'text-muted')}>
                  {q.ready && <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />}
                  {q.ready ? 'Все сценарии повышения пройдены — можно повышать' : 'Рекомендуем повышать после прохождения всех сценариев'}
                </p>
                {next && (
                  <Button
                    className="mt-4 w-full sm:w-auto"
                    variant={q.ready ? 'primary' : 'secondary'}
                    loading={promoting}
                    onClick={promote}
                    icon={<ArrowUpCircle className="h-4 w-4" />}
                  >
                    Повысить до «{POSITION_TITLES[next]}»
                  </Button>
                )}
              </>
            ) : (
              <p className="text-sm text-muted">Сотрудник на высшей должности — «{e.position_title}».</p>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <SectionTitle>Отправить специвент</SectionTitle>
            <p className="mb-4 text-sm text-muted">Внезапная экстренная ситуация с голосовым сообщением появится у сотрудника прямо во время работы.</p>
            <div className="space-y-3">
              <label className="block">
                <span className="label">Ситуация</span>
                <select className="input" value={scenarioId} onChange={(ev) => setScenarioId(ev.target.value ? Number(ev.target.value) : '')}>
                  {(emergencies.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.cover} {s.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">Сообщение (необязательно)</span>
                <input className="input" placeholder="Например: проверка готовности смены" value={message} maxLength={500} onChange={(ev) => setMessage(ev.target.value)} />
              </label>
              <Button
                variant="dark"
                loading={sending}
                onClick={dispatch}
                icon={<Siren className="h-4 w-4" />}
                disabled={!emergencies.data?.length}
                className="w-full sm:w-auto"
              >
                Отправить специвент
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {e.achievements.length > 0 && (
        <Card className="p-5 sm:p-6">
          <SectionTitle>Достижения · {e.achievements.length}</SectionTitle>
          <div className="grid grid-cols-3 gap-x-2 gap-y-4 min-[400px]:grid-cols-4 sm:grid-cols-6 xl:grid-cols-8">
            {e.achievements.map((a) => (
              <AchievementBadge key={a.code} achievement={a} compact className="w-auto" />
            ))}
          </div>
        </Card>
      )}

      {/* long on a phone: folded, with how many and how they went */}
      <Disclosure
        icon={History}
        title="История прохождений"
        disabled={!e.history.length}
        summary={
          e.history.length
            ? `${e.history.length} · успешных ${e.history.filter((r) => r.outcome === 'success').length}`
            : 'Завершённых прохождений пока нет'
        }
      >
        <RunHistory items={e.history} />
      </Disclosure>
    </div>
  )
}

function HeroChip({ accent = false, children }: { accent?: boolean; children: ReactNode }) {
  return (
    <span className={cn('rounded-full px-2.5 py-1 font-medium ring-1 ring-inset', accent ? 'bg-brand/25 text-white ring-brand/40' : 'bg-white/[.07] text-white/80 ring-white/10')}>
      {children}
    </span>
  )
}

function Cell({ label, tone, className, children }: { label: string; tone?: number | null; className?: string; children: ReactNode }) {
  const color = tone === undefined || tone === null ? 'text-white' : tone >= 70 ? 'text-[#5FD39A]' : tone >= 40 ? 'text-[#FFC94D]' : 'text-[#FF8A7A]'
  return (
    <div className={cn('min-w-0 bg-[#0e1628]/70 px-4 py-3', className)}>
      <dt className="text-[11px] font-medium uppercase tracking-[.08em] text-white/50">{label}</dt>
      <dd className={cn('digits mt-1 text-2xl font-semibold leading-tight', color)}>{children}</dd>
    </div>
  )
}

