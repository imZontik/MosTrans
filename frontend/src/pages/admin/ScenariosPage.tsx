import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { api } from '@/api/client'
import type { ScenarioFull, ScenarioInput } from '@/api/types'
import { useAsync } from '@/hooks/useAsync'
import { Badge } from '@/components/Badge'
import { Button, ButtonLink } from '@/components/Button'
import { Card, PageHeader } from '@/components/Card'
import { DifficultyDots } from '@/components/Progress'
import { ErrorState, Loading } from '@/components/States'
import { cn } from '@/lib/cn'
import { fmtDate } from '@/lib/format'
import { ENDINGS, FORKS, pluralN } from '@/lib/plural'

const BLANK: ScenarioInput = {
  title: 'Новый сценарий',
  description: '',
  category: 'conflict',
  position: 'conductor',
  kind: 'training',
  difficulty: 1,
  cover: '🚄',
  estimated_minutes: 5,
  is_published: false,
  // the smallest branching scenario: the answer decides which way the story goes
  graph: {
    start: 'n1',
    initial: { loyalty: 60, safety: 70 },
    characters: { passenger: { name: 'Пассажир', role: 'пассажир', avatar: '🧑' } },
    nodes: {
      n1: { type: 'scene', speaker: 'narrator', text: 'Опишите завязку ситуации.', next: 'n2' },
      n2: {
        type: 'choice',
        speaker: 'passenger',
        text: 'Реплика пассажира…',
        timer: 20,
        choices: [
          { id: 'a', text: 'Правильное действие', next: 'n3', quality: 'best', points: 20, effects: { loyalty: 10 }, feedback: 'Верно!' },
          { id: 'b', text: 'Ошибочное действие', next: 'n3b', quality: 'bad', points: 0, effects: { loyalty: -10 }, feedback: 'Так делать не стоит.' },
        ],
      },
      n3: { type: 'scene', speaker: 'passenger', text: 'Реакция на верное действие.', next: 'end' },
      n3b: { type: 'scene', speaker: 'passenger', text: 'Реакция на ошибку: ситуация обостряется.', next: 'end_fail' },
      end: {
        type: 'end',
        outcome: 'auto',
        variants: {
          success: { title: 'Отлично', text: 'Ситуация решена по регламенту.' },
          partial: { title: 'Неплохо', text: 'Есть что улучшить.' },
          fail: { title: 'Провал', text: 'Разберите ошибки и попробуйте снова.' },
        },
      },
      end_fail: { type: 'end', outcome: 'fail', title: 'Конфликт разгорелся', text: 'Опишите последствия ошибки.' },
    },
  },
}

type Filter = 'all' | 'published' | 'draft' | 'emergency'

export default function AdminScenariosPage() {
  const list = useAsync(() => api.admin.scenarios(), [])
  const [filter, setFilter] = useState<Filter>('all')
  const [busy, setBusy] = useState<number | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const items = useMemo(() => {
    const all = list.data ?? []
    if (filter === 'published') return all.filter((s) => s.is_published)
    if (filter === 'draft') return all.filter((s) => !s.is_published)
    if (filter === 'emergency') return all.filter((s) => s.kind === 'emergency')
    return all
  }, [list.data, filter])

  const run = async (id: number | 'new', fn: () => Promise<unknown>) => {
    setBusy(id)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(null)
    }
  }

  const togglePublish = (s: ScenarioFull) =>
    run(s.id, async () => {
      const updated = await api.admin.updateScenario(s.id, { is_published: !s.is_published })
      list.setData((list.data ?? []).map((x) => (x.id === s.id ? updated : x)))
    })

  const remove = (s: ScenarioFull) => {
    if (!window.confirm(`Удалить черновик «${s.title}»?`)) return
    run(s.id, async () => {
      await api.admin.deleteScenario(s.id)
      list.setData((list.data ?? []).filter((x) => x.id !== s.id))
    })
  }

  const preview = (s: ScenarioFull) =>
    run(s.id, async () => {
      const r = await api.startRun(s.id, true)
      navigate(`/play/${r.id}`)
    })

  const create = () =>
    run('new', async () => {
      const s = await api.admin.createScenario(BLANK)
      navigate(`/admin/scenarios/${s.id}`)
    })

  return (
    <div>
      <PageHeader
        title="Сценарии"
        subtitle="Контент тренажёра: публикация, редактирование и предпросмотр"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={create} loading={busy === 'new'} icon={<Plus className="h-4 w-4" />}>
              Создать
            </Button>
            <ButtonLink to="/admin/scenarios/generate" icon={<Sparkles className="h-4 w-4" />}>
              Сгенерировать с ИИ
            </ButtonLink>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ['all', 'Все'],
            ['published', 'Опубликованные'],
            ['draft', 'Черновики'],
            ['emergency', 'Специвенты'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={cn('chip border', filter === k ? 'btn-ink border-transparent' : 'border-line bg-surface text-ink shadow-card hover:border-ink/40')}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 card border-l-4 border-l-brand px-4 py-3" role="alert">{error}</p>}

      {list.loading && !list.data ? (
        <Loading rows={5} />
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : (
        <Card className="divide-y divide-line">
          {items.map((s) => (
            <div key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <Link to={`/admin/scenarios/${s.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-bg text-2xl">{s.cover}</span>
                <div className="min-w-0">
                  <p className="truncate font-semibold hover:underline">{s.title}</p>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    <span>
                      {s.category_title}, {s.position_title.toLowerCase()}, {Object.keys(s.graph?.nodes ?? {}).length} узлов,{' '}
                      {pluralN(s.forks ?? 0, FORKS)}, {pluralN(s.endings ?? 0, ENDINGS)}
                      {s.updated_at ? `, изменён ${fmtDate(s.updated_at)}` : ''}
                    </span>
                    <DifficultyDots value={s.difficulty} />
                    {s.kind === 'emergency' && <Badge tone="bad">Специвент</Badge>}
                  </p>
                </div>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => togglePublish(s)}
                  disabled={busy === s.id}
                  className={cn(
                    // 28px switch, 44px tap area
                    'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition after:absolute after:-inset-2',
                    s.is_published ? 'bg-ok' : 'bg-ink/15',
                  )}
                  title={s.is_published ? 'Снять с публикации' : 'Опубликовать'}
                >
                  <span className={cn('h-5 w-5 rounded-full bg-white transition', s.is_published ? 'translate-x-6' : 'translate-x-1')} />
                </button>
                <span className={cn('w-24 text-xs font-semibold', s.is_published ? 'text-ok' : 'text-muted')}>
                  {s.is_published ? 'Опубликован' : 'Черновик'}
                </span>
                <Button size="sm" variant="ghost" onClick={() => preview(s)} title="Предпросмотр" disabled={busy === s.id}>
                  <Eye className="h-4 w-4" />
                </Button>
                <ButtonLink to={`/admin/scenarios/${s.id}`} size="sm" variant="secondary">
                  <Pencil className="h-4 w-4" />
                </ButtonLink>
                {!s.is_published && (
                  <Button size="sm" variant="danger" onClick={() => remove(s)} title="Удалить" disabled={busy === s.id}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="p-8 text-center text-muted">Нет сценариев</p>}
        </Card>
      )}
    </div>
  )
}
