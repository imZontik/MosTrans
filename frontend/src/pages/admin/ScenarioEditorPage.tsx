import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, CheckCircle2, Eye, Save, ShieldCheck } from 'lucide-react'
import { api } from '@/api/client'
import type { ScenarioFull, ScenarioGraph, ScenarioInput } from '@/api/types'
import { useAsync } from '@/hooks/useAsync'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { ErrorState, Loading } from '@/components/States'
import { GraphEditor } from '@/components/admin/GraphEditor'
import { cn } from '@/lib/cn'
import { CATEGORY_TITLES, POSITION_TITLES } from '@/lib/format'

type Meta = Omit<ScenarioInput, 'graph'>

const toMeta = (s: ScenarioFull): Meta => ({
  title: s.title,
  description: s.description,
  category: s.category,
  position: s.position,
  kind: s.kind,
  difficulty: s.difficulty,
  cover: s.cover,
  estimated_minutes: s.estimated_minutes,
  is_published: s.is_published,
})

export default function ScenarioEditorPage() {
  const { scenarioId } = useParams()
  const id = Number(scenarioId)
  const navigate = useNavigate()
  const loaded = useAsync(() => api.admin.scenario(id), [id])
  const [meta, setMeta] = useState<Meta | null>(null)
  const [graph, setGraph] = useState<ScenarioGraph | null>(null)
  const [tab, setTab] = useState<'nodes' | 'json'>('nodes')
  const [json, setJson] = useState('')
  const [jsonError, setJsonError] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[] | null>(null)
  const [busy, setBusy] = useState<'validate' | 'save' | 'preview' | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (loaded.data) {
      setMeta(toMeta(loaded.data))
      setGraph(loaded.data.graph)
      setDirty(false)
    }
  }, [loaded.data])

  if (loaded.loading && !loaded.data) return <Loading rows={4} />
  if (loaded.error || !loaded.data) return <ErrorState message={loaded.error ?? 'Не найдено'} onRetry={loaded.reload} />
  if (!meta || !graph) return <Loading rows={4} />

  /** Current graph, parsing the JSON tab if it is open. */
  const currentGraph = (): ScenarioGraph | null => {
    if (tab !== 'json') return graph
    try {
      const parsed = JSON.parse(json) as ScenarioGraph
      setJsonError(null)
      return parsed
    } catch (e) {
      setJsonError(`Некорректный JSON: ${e instanceof Error ? e.message : e}`)
      return null
    }
  }

  const switchTab = (next: 'nodes' | 'json') => {
    if (next === tab) return
    if (next === 'json') {
      setJson(JSON.stringify(graph, null, 2))
      setTab('json')
    } else {
      const g = currentGraph()
      if (g) {
        setGraph(g)
        setTab('nodes')
      }
    }
  }

  const updateGraph = (g: ScenarioGraph) => {
    setGraph(g)
    setDirty(true)
  }
  const updateMeta = (patch: Partial<Meta>) => {
    setMeta({ ...meta, ...patch })
    setDirty(true)
  }

  const validate = async () => {
    const g = currentGraph()
    if (!g) return
    setBusy('validate')
    try {
      const res = await api.admin.validate(g)
      setErrors(res.errors)
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'Ошибка проверки'])
    } finally {
      setBusy(null)
    }
  }

  const save = async (): Promise<boolean> => {
    const g = currentGraph()
    if (!g) return false
    setBusy('save')
    setMessage(null)
    try {
      const saved = await api.admin.updateScenario(id, { ...meta, graph: g })
      loaded.setData(saved)
      setErrors(null)
      setMessage({ ok: true, text: 'Сохранено' })
      return true
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Не удалось сохранить' })
      return false
    } finally {
      setBusy(null)
    }
  }

  const preview = async () => {
    if (dirty && !(await save())) return
    setBusy('preview')
    try {
      const r = await api.startRun(id, true)
      navigate(`/play/${r.id}`)
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Не удалось запустить' })
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      <Link to="/admin/scenarios" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink coarse:min-h-[44px]">
        <ArrowLeft className="h-4 w-4" /> Все сценарии
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-4xl">{meta.cover}</span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-semibold">{meta.title}</h1>
            <p className="text-sm text-muted">
              {meta.is_published ? 'Опубликован' : 'Черновик'}
              {dirty && '. Есть несохранённые изменения'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={validate} loading={busy === 'validate'} icon={<ShieldCheck className="h-4 w-4" />}>
            Проверить
          </Button>
          <Button variant="secondary" onClick={preview} loading={busy === 'preview'} icon={<Eye className="h-4 w-4" />}>
            Предпросмотр
          </Button>
          <Button onClick={save} loading={busy === 'save'} icon={<Save className="h-4 w-4" />}>
            Сохранить
          </Button>
        </div>
      </div>

      {message && (
        <p className={cn('rounded-xl px-4 py-3 text-sm font-semibold', message.ok ? 'bg-ok/10 text-ok' : 'bg-bad/10 text-bad')}>{message.text}</p>
      )}
      {errors && (
        <div className={cn('rounded-xl px-4 py-3 text-sm', errors.length ? 'bg-bad/10 text-bad' : 'bg-ok/10 text-ok')}>
          {errors.length === 0 ? (
            <p className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4" /> Граф корректен: все узлы достижимы, финалы на месте.
            </p>
          ) : (
            <>
              <p className="mb-1 flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" /> Найдено ошибок: {errors.length}
              </p>
              <ul className="list-inside list-disc space-y-0.5">
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <Card className="grid gap-4 p-5 md:grid-cols-4">
        <div className="md:col-span-3">
          <label className="label">Название</label>
          <input className="input" value={meta.title} onChange={(e) => updateMeta({ title: e.target.value })} />
        </div>
        <div>
          <label className="label">Обложка (эмодзи)</label>
          <input className="input text-center text-xl" value={meta.cover} maxLength={16} onChange={(e) => updateMeta({ cover: e.target.value })} />
        </div>
        <div className="md:col-span-4">
          <label className="label">Описание</label>
          <textarea className="input" rows={2} value={meta.description} onChange={(e) => updateMeta({ description: e.target.value })} />
        </div>
        <div>
          <label className="label">Категория</label>
          <select className="input" value={meta.category} onChange={(e) => updateMeta({ category: e.target.value })}>
            {Object.entries(CATEGORY_TITLES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.icon} {v.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Должность</label>
          <select className="input" value={meta.position} onChange={(e) => updateMeta({ position: e.target.value })}>
            {Object.entries(POSITION_TITLES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Тип</label>
          <select className="input" value={meta.kind} onChange={(e) => updateMeta({ kind: e.target.value as Meta['kind'] })}>
            <option value="training">Тренировка</option>
            <option value="emergency">Специвент</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Сложность</label>
            <select className="input" value={meta.difficulty} onChange={(e) => updateMeta({ difficulty: Number(e.target.value) })}>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </div>
          <div>
            <label className="label">Минут</label>
            <input
              type="number"
              min={1}
              max={60}
              className="input"
              value={meta.estimated_minutes}
              onChange={(e) => updateMeta({ estimated_minutes: Number(e.target.value) })}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold md:col-span-4 coarse:min-h-[44px]">
          <input type="checkbox" className="h-4 w-4 accent-[#e30b17]" checked={meta.is_published} onChange={(e) => updateMeta({ is_published: e.target.checked })} />
          Опубликован (виден сотрудникам)
        </label>
      </Card>

      <div className="flex gap-1 rounded-xl bg-ink/5 p-1 sm:w-fit">
        {(
          [
            ['nodes', 'Узлы сценария'],
            ['json', 'JSON'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => switchTab(k)}
            className={cn('flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition coarse:min-h-[44px]', tab === k ? 'bg-surface shadow-sm' : 'text-muted')}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'nodes' ? (
        <GraphEditor graph={graph} onChange={updateGraph} />
      ) : (
        <div className="space-y-2">
          <textarea
            className="input min-h-[480px] font-mono text-xs leading-relaxed"
            spellCheck={false}
            value={json}
            onChange={(e) => {
              setJson(e.target.value)
              setDirty(true)
            }}
          />
          {jsonError && <p className="text-sm font-semibold text-bad">{jsonError}</p>}
          <p className="text-xs text-muted">
            Формат: start, initial {'{loyalty, safety}'}, characters, nodes (scene | choice | input | end). Нажмите «Проверить», чтобы
            валидировать граф на сервере.
          </p>
        </div>
      )}
    </div>
  )
}
