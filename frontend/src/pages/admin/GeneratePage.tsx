import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Info, Save, Sparkles, Wand2 } from 'lucide-react'
import { api } from '@/api/client'
import type { GeneratedDraft, GenerateRequest } from '@/api/types'
import { ProviderBadge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Card, PageHeader } from '@/components/Card'
import { Mascot } from '@/components/Mascot'
import { GraphEditor } from '@/components/admin/GraphEditor'
import { CATEGORY_TITLES, POSITION_TITLES } from '@/lib/format'

const EXAMPLES = [
  'Пассажир бизнес-класса требует пересадить его в купе повышенной комфортности, мест нет. Он раздражён и угрожает жалобой в соцсетях.',
  'У ребёнка в вагоне 3 поднялась температура и начались судороги. Родители в панике, до станции 25 минут.',
  'В вагоне пропало электричество: не работают розетки и освещение. Пассажиры с ноутбуками возмущаются. Нужно понять, к кому обратиться.',
]

export default function GeneratePage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<GenerateRequest>({ spec: '', category: 'conflict', position: 'conductor', difficulty: 2 })
  const [draft, setDraft] = useState<GeneratedDraft | null>(null)
  const [busy, setBusy] = useState<'generate' | 'save' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    setBusy('generate')
    setError(null)
    setDraft(null)
    try {
      setDraft(await api.admin.generate(form))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сгенерировать')
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    if (!draft) return
    setBusy('save')
    setError(null)
    try {
      const s = await api.admin.createScenario({
        title: draft.title.slice(0, 255),
        description: draft.description,
        category: form.category,
        position: form.position,
        kind: 'training',
        difficulty: form.difficulty,
        cover: (draft.cover || '🚄').slice(0, 16),
        estimated_minutes: 5,
        graph: draft.graph,
        is_published: false,
      })
      navigate(`/admin/scenarios/${s.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить')
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Генератор сценариев"
        subtitle="Опишите ситуацию своими словами — ИИ соберёт черновик ветвящегося сценария с оценками и таймерами."
      />

      <Card className="p-5">
        <label className="label">Техническое задание</label>
        <textarea
          className="input min-h-[140px]"
          placeholder="Например: пассажир бизнес-класса отказывается выключить громкую музыку, соседи жалуются…"
          value={form.spec}
          maxLength={6000}
          onChange={(e) => setForm({ ...form, spec: e.target.value })}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {EXAMPLES.map((ex, i) => (
            <button key={i} onClick={() => setForm({ ...form, spec: ex })} className="chip border border-line bg-bg text-xs text-ink/70 hover:border-ink/20">
              <Wand2 className="h-3 w-3" /> Пример {i + 1}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Категория</label>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {Object.entries(CATEGORY_TITLES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.icon} {v.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Должность</label>
            <select className="input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}>
              {Object.entries(POSITION_TITLES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Сложность</label>
            <select className="input" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: Number(e.target.value) })}>
              <option value={1}>1 — базовая</option>
              <option value={2}>2 — средняя</option>
              <option value={3}>3 — сложная</option>
            </select>
          </div>
        </div>

        <Button
          className="mt-5"
          size="lg"
          loading={busy === 'generate'}
          disabled={form.spec.trim().length < 10}
          onClick={generate}
          icon={<Sparkles className="h-5 w-5" />}
        >
          Сгенерировать с ИИ
        </Button>
        {form.spec.trim().length > 0 && form.spec.trim().length < 10 && (
          <p className="mt-2 text-xs text-muted">Опишите ситуацию подробнее (минимум 10 символов)</p>
        )}
      </Card>

      {error && <p className="border-l-2 border-brand bg-surface px-4 py-3" role="alert">{error}</p>}

      {busy === 'generate' && (
        <Card className="flex items-center gap-4 p-6">
          <Mascot className="h-16 w-16 shrink-0" mood="thinking" />
          <div>
            <p className="text-lg font-semibold">ИИ собирает сценарий</p>
            <p className="text-sm text-muted">Персонажи, ветки решений, баллы и обратная связь. Это может занять до минуты.</p>
          </div>
        </Card>
      )}

      {draft && (
        <section className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-bg text-3xl">{draft.cover}</span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ProviderBadge provider={draft.provider} />
                    <span className="text-xs text-muted">{Object.keys(draft.graph.nodes ?? {}).length} узлов</span>
                  </div>
                  <h2 className="mt-1 font-display text-xl font-semibold">{draft.title}</h2>
                  <p className="text-sm text-muted">{draft.description}</p>
                </div>
              </div>
              <Button onClick={save} loading={busy === 'save'} disabled={draft.errors.length > 0} icon={<Save className="h-4 w-4" />}>
                Сохранить как черновик
              </Button>
            </div>
            {draft.note && (
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-info/10 px-3 py-2 text-sm text-info">
                <Info className="mt-0.5 h-4 w-4 shrink-0" /> {draft.note}
              </p>
            )}
            {draft.errors.length > 0 ? (
              <div className="mt-3 rounded-xl bg-bad/10 px-3 py-2 text-sm text-bad">
                <p className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" /> Черновик содержит ошибки — сгенерируйте заново или поправьте после сохранения через JSON
                </p>
                <ul className="mt-1 list-inside list-disc">
                  {draft.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-ok">
                <CheckCircle2 className="h-4 w-4" /> Граф прошёл проверку
              </p>
            )}
          </Card>
          <GraphEditor graph={draft.graph} readOnly />
        </section>
      )}
    </div>
  )
}
