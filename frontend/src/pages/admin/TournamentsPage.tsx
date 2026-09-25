import { useState } from 'react'
import { Flag, Play, Plus, Trophy } from 'lucide-react'
import { api } from '@/api/client'
import type { TournamentStatus, TournamentWithWinners } from '@/api/types'
import { useAsync } from '@/hooks/useAsync'
import { Badge, type Tone } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Card, PageHeader, SectionTitle } from '@/components/Card'
import { ErrorState, Loading } from '@/components/States'
import { fmtDate } from '@/lib/format'
import { pluralN, PEOPLE, QUESTIONS } from '@/lib/plural'

const STATUS: Record<TournamentStatus, { label: string; tone: Tone }> = {
  scheduled: { label: 'Запланирован', tone: 'info' },
  live: { label: 'Идёт', tone: 'brand' },
  finished: { label: 'Завершён', tone: 'neutral' },
}

function defaultStart() {
  const d = new Date(Date.now() + 60 * 60 * 1000)
  d.setMinutes(0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function AdminTournamentsPage() {
  const list = useAsync(() => api.admin.tournaments(), [])
  const [title, setTitle] = useState('')
  const [startsAt, setStartsAt] = useState(defaultStart)
  const [duration, setDuration] = useState(30)
  const [liveDuration, setLiveDuration] = useState(15)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  const act = async (key: string, fn: () => Promise<string>) => {
    setBusy(key)
    setNotice(null)
    try {
      const text = await fn()
      setNotice({ ok: true, text })
      await list.reload()
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : 'Ошибка' })
    } finally {
      setBusy(null)
    }
  }

  const create = () =>
    act('create', async () => {
      const t = await api.admin.createTournament({
        title: title.trim() || null,
        starts_at: new Date(startsAt).toISOString(),
        duration_min: duration,
      })
      setTitle('')
      return `Турнир «${t.title}» создан`
    })

  const startNow = (t: TournamentWithWinners) =>
    act(`start-${t.id}`, async () => {
      await api.admin.startTournament(t.id, liveDuration)
      return `«${t.title}» запущен на ${liveDuration} мин`
    })

  const finish = (t: TournamentWithWinners) => {
    if (!window.confirm(`Подвести итоги «${t.title}»? Топ-10 получат трофеи и очки.`)) return
    act(`finish-${t.id}`, async () => {
      const res = await api.admin.finishTournament(t.id)
      return `Итоги подведены: награждено ${pluralN(res.awarded.length, PEOPLE)}`
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Турниры" subtitle="Еженедельные турниры создаются автоматически. Здесь можно запустить внеплановый или подвести итоги." />

      {notice && (
        <p className={notice.ok ? 'rounded-xl bg-ok/10 px-4 py-3 text-sm font-semibold text-ok' : 'rounded-xl bg-bad/10 px-4 py-3 text-sm font-semibold text-bad'}>
          {notice.text}
        </p>
      )}

      <Card className="p-5">
        <SectionTitle>Новый турнир</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_220px_140px_auto] sm:items-end">
          <div>
            <label className="label">Название (необязательно)</label>
            <input className="input" placeholder="Турнир проводников, 39-я неделя" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="label">Начало</label>
            <input type="datetime-local" className="input" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
          <div>
            <label className="label">Минут</label>
            <input type="number" min={5} max={1440} className="input" value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>
          <Button onClick={create} loading={busy === 'create'} icon={<Plus className="h-4 w-4" />} disabled={!startsAt}>
            Создать
          </Button>
        </div>
      </Card>

      <section>
        <SectionTitle
          action={
            <label className="flex items-center gap-2 text-sm text-muted">
              «Запустить сейчас» на
              <input
                type="number"
                min={5}
                max={1440}
                className="input w-20 py-1.5"
                value={liveDuration}
                onChange={(e) => setLiveDuration(Number(e.target.value))}
              />
              мин
            </label>
          }
        >
          Все турниры
        </SectionTitle>
        {list.loading && !list.data ? (
          <Loading rows={3} />
        ) : list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : (
          <Card className="divide-y divide-line">
            {(list.data ?? []).map((t) => (
              <div key={t.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-bg">
                    <Trophy className="h-5 w-5 text-ink" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">{t.title}</p>
                      <Badge tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Badge>
                      {t.finalized && <Badge tone="ok">Итоги подведены</Badge>}
                    </div>
                    <p className="text-xs text-muted">
                      С {fmtDate(t.starts_at, true)} до {fmtDate(t.ends_at, true)}. {pluralN(t.questions_total, QUESTIONS)},{' '}
                      {pluralN(t.participants, PEOPLE)}
                    </p>
                    {t.winners.length > 0 && (
                      <p className="mt-1 text-xs">
                        {t.winners.map((w, i) => `${['🥇', '🥈', '🥉'][i]} ${w.full_name} (${w.score})`).join('   ')}
                      </p>
                    )}
                  </div>
                </div>
                {!t.finalized && (
                  <div className="flex shrink-0 gap-2">
                    {t.status !== 'live' && (
                      <Button size="sm" variant="secondary" loading={busy === `start-${t.id}`} onClick={() => startNow(t)} icon={<Play className="h-4 w-4" />}>
                        Запустить сейчас
                      </Button>
                    )}
                    <Button size="sm" variant="dark" loading={busy === `finish-${t.id}`} onClick={() => finish(t)} icon={<Flag className="h-4 w-4" />}>
                      Подвести итоги
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {(list.data ?? []).length === 0 && <p className="p-8 text-center text-muted">Турниров пока нет</p>}
          </Card>
        )}
      </section>
    </div>
  )
}
