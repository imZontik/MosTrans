import { useState, type ReactNode } from 'react'
import { ChevronDown, Clock, Flag, MessageSquare, Plus, Trash2, Type, Volume2 } from 'lucide-react'
import type { GraphChoice, GraphNode, Quality, ScenarioGraph } from '@/api/types'
import { cn } from '@/lib/cn'
import { Badge, type Tone } from '../Badge'

const TYPE_META: Record<GraphNode['type'], { label: string; tone: Tone; icon: ReactNode }> = {
  scene: { label: 'Сцена', tone: 'neutral', icon: <MessageSquare className="h-3 w-3" /> },
  choice: { label: 'Выбор', tone: 'info', icon: <ChevronDown className="h-3 w-3" /> },
  input: { label: 'Свободный ответ', tone: 'neutral', icon: <Type className="h-3 w-3" /> },
  end: { label: 'Финал', tone: 'dark', icon: <Flag className="h-3 w-3" /> },
}

const QUALITY: Record<Quality, { label: string; cls: string }> = {
  best: { label: 'Лучший', cls: 'bg-ok/10 text-ok border-ok/30' },
  ok: { label: 'Допустимый', cls: 'bg-warn/10 text-warn-ink border-warn/30' },
  bad: { label: 'Ошибка', cls: 'bg-bad/10 text-bad border-bad/30' },
}

/** Readable (and optionally editable) list of scenario nodes, in walk order from `start`. */
export function GraphEditor({
  graph,
  onChange,
  readOnly = false,
}: {
  graph: ScenarioGraph
  onChange?: (g: ScenarioGraph) => void
  readOnly?: boolean
}) {
  const ids = orderedIds(graph)
  const speakers = ['narrator', ...Object.keys(graph.characters ?? {})]
  const edit = !readOnly && !!onChange

  const setNode = (id: string, node: GraphNode) => onChange?.({ ...graph, nodes: { ...graph.nodes, [id]: node } })
  const removeNode = (id: string) => {
    const nodes = { ...graph.nodes }
    delete nodes[id]
    onChange?.({ ...graph, nodes })
  }
  const addNode = (type: GraphNode['type']) => {
    let i = ids.length + 1
    while (graph.nodes[`n${i}`]) i++
    const id = `n${i}`
    const node: GraphNode =
      type === 'end'
        ? { type, outcome: 'success', title: 'Финал', text: '' }
        : type === 'choice'
          ? {
              type,
              speaker: 'narrator',
              text: 'Ваши действия?',
              timer: 20,
              choices: [
                { id: 'a', text: 'Вариант А', next: graph.start, quality: 'best', points: 20, effects: {}, feedback: '' },
                { id: 'b', text: 'Вариант Б', next: graph.start, quality: 'bad', points: 0, effects: {}, feedback: '' },
              ],
            }
          : type === 'input'
            ? { type, speaker: 'narrator', text: 'Опишите свои действия', next: graph.start, rubric: 'Критерии оценки…', ideal: '', keywords: [], max_points: 30, timer: 60 }
            : { type, speaker: 'narrator', text: 'Новая сцена', next: graph.start }
    onChange?.({ ...graph, nodes: { ...graph.nodes, [id]: node } })
  }

  return (
    <div className="space-y-3">
      {graph.characters && Object.keys(graph.characters).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(graph.characters).map(([key, c]) => (
            <span key={key} className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm">
              <span className="text-lg leading-none">{c.avatar}</span>
              <b>{c.name}</b>
              {c.role && <span className="text-muted">, {c.role}</span>}
              <code className="text-xs text-muted">{key}</code>
            </span>
          ))}
        </div>
      )}

      {ids.map((id) => (
        <NodeCard
          key={id}
          id={id}
          node={graph.nodes[id]}
          isStart={graph.start === id}
          nodeIds={Object.keys(graph.nodes)}
          speakers={speakers}
          characters={graph.characters ?? {}}
          edit={edit}
          onChange={(n) => setNode(id, n)}
          onRemove={() => removeNode(id)}
        />
      ))}

      {edit && (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-dashed border-line p-3">
          <span className="self-center text-sm font-semibold text-muted">Добавить узел:</span>
          {(['scene', 'choice', 'input', 'end'] as const).map((t) => (
            <button key={t} onClick={() => addNode(t)} className="chip border border-line bg-surface text-ink/80 hover:border-ink/30">
              <Plus className="h-3.5 w-3.5" /> {TYPE_META[t].label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function orderedIds(graph: ScenarioGraph): string[] {
  const seen: string[] = []
  const queue = [graph.start]
  while (queue.length) {
    const id = queue.shift()!
    if (!id || seen.includes(id) || !graph.nodes[id]) continue
    seen.push(id)
    const n = graph.nodes[id]
    const targets = [n.next, ...(n.choices ?? []).map((c) => c.next), n.timeout?.next, ...(n.branches ?? []).map((b) => b.next)]
    targets.forEach((t) => t && queue.push(t))
  }
  return [...seen, ...Object.keys(graph.nodes).filter((id) => !seen.includes(id))]
}

function NodeCard({
  id,
  node,
  isStart,
  nodeIds,
  speakers,
  characters,
  edit,
  onChange,
  onRemove,
}: {
  id: string
  node: GraphNode
  isStart: boolean
  nodeIds: string[]
  speakers: string[]
  characters: NonNullable<ScenarioGraph['characters']>
  edit: boolean
  onChange: (n: GraphNode) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(true)
  const meta = TYPE_META[node.type] ?? TYPE_META.scene
  const speaker = node.speaker && node.speaker !== 'narrator' ? characters[node.speaker] : null
  const set = (patch: Partial<GraphNode>) => onChange({ ...node, ...patch })

  return (
    <div id={`node-${id}`} className={cn('rounded-2xl border bg-surface', isStart ? 'border-brand/40' : 'border-line')}>
      <div className="flex items-center gap-2 px-4 py-3">
        <button onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-2 text-left coarse:min-h-[44px]">
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted transition', !open && '-rotate-90')} />
          <code className="rounded-md bg-bg px-1.5 py-0.5 text-xs font-semibold">{id}</code>
          <Badge tone={meta.tone} icon={meta.icon}>
            {meta.label}
          </Badge>
          {isStart && <Badge tone="brand">Старт</Badge>}
          {node.timer ? (
            <span className="flex items-center gap-0.5 text-xs font-semibold text-muted">
              <Clock className="h-3 w-3" /> {node.timer}с
            </span>
          ) : null}
          {node.audio && <Volume2 className="h-3.5 w-3.5 text-muted" />}
          {!open && <span className="truncate text-sm text-muted">{node.text || node.title}</span>}
        </button>
        {edit && !isStart && (
          <button onClick={onRemove} className="rounded-lg p-1.5 text-muted hover:bg-bad/10 hover:text-bad coarse:p-3.5" title="Удалить узел">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="space-y-3 border-t border-line px-4 py-3">
          {node.type !== 'end' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_minmax(0,1fr)_110px]">
              <Field label="Говорит">
                {edit ? (
                  <select className="input py-2" value={node.speaker ?? 'narrator'} onChange={(e) => set({ speaker: e.target.value })}>
                    {speakers.map((s) => (
                      <option key={s} value={s}>
                        {s === 'narrator' ? 'Рассказчик' : `${characters[s]?.avatar ?? ''} ${characters[s]?.name ?? s}`}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="py-2 text-sm font-semibold">{speaker ? `${speaker.avatar ?? ''} ${speaker.name}` : 'Рассказчик'}</p>
                )}
              </Field>
              <Field label="Текст">
                <TextArea value={node.text ?? ''} edit={edit} onChange={(text) => set({ text })} />
              </Field>
              {node.type !== 'scene' && (
                <Field label="Таймер, с">
                  {edit ? (
                    <input
                      type="number"
                      min={5}
                      max={120}
                      className="input py-2"
                      value={node.timer ?? ''}
                      placeholder="нет"
                      onChange={(e) => set({ timer: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  ) : (
                    <p className="py-2 text-sm">{node.timer ? `${node.timer} с` : '—'}</p>
                  )}
                </Field>
              )}
            </div>
          )}

          {(node.type === 'scene' || node.type === 'input') && (
            <NextSelect label="Следующий узел" value={node.next} ids={nodeIds} edit={edit} onChange={(next) => set({ next })} />
          )}

          {node.type === 'choice' && (
            <div className="space-y-2">
              {(node.choices ?? []).map((c, i) => (
                <ChoiceRow
                  key={c.id + i}
                  choice={c}
                  ids={nodeIds}
                  edit={edit}
                  onChange={(nc) => set({ choices: (node.choices ?? []).map((x, j) => (j === i ? nc : x)) })}
                  onRemove={() => set({ choices: (node.choices ?? []).filter((_, j) => j !== i) })}
                />
              ))}
              {edit && (
                <button
                  onClick={() => {
                    const used = new Set((node.choices ?? []).map((c) => c.id))
                    let code = 97
                    while (used.has(String.fromCharCode(code))) code++
                    set({
                      choices: [
                        ...(node.choices ?? []),
                        { id: String.fromCharCode(code), text: 'Новый вариант', next: node.choices?.[0]?.next ?? id, quality: 'ok', points: 5, effects: {}, feedback: '' },
                      ],
                    })
                  }}
                  className="flex items-center gap-1 text-sm font-semibold text-brand coarse:min-h-[44px]"
                >
                  <Plus className="h-4 w-4" /> Вариант ответа
                </button>
              )}
              {node.timeout && (
                <p className="rounded-xl bg-bg px-3 py-2 text-xs text-muted">
                  ⏱ По таймауту → <code>{node.timeout.next}</code>
                  {node.timeout.feedback ? `, «${node.timeout.feedback}»` : ''}
                </p>
              )}
            </div>
          )}

          {node.type === 'input' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Рубрика оценивания (для ИИ)">
                <TextArea value={node.rubric ?? ''} edit={edit} onChange={(rubric) => set({ rubric })} />
              </Field>
              <Field label="Эталонный ответ">
                <TextArea value={node.ideal ?? ''} edit={edit} onChange={(ideal) => set({ ideal })} />
              </Field>
              <Field label="Ключевые слова (через запятую)">
                {edit ? (
                  <input
                    className="input py-2"
                    value={(node.keywords ?? []).join(', ')}
                    onChange={(e) => set({ keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                  />
                ) : (
                  <p className="py-2 text-sm">{(node.keywords ?? []).join(', ') || '—'}</p>
                )}
              </Field>
              <Field label="Макс. очков">
                {edit ? (
                  <input type="number" className="input py-2" value={node.max_points ?? 30} onChange={(e) => set({ max_points: Number(e.target.value) })} />
                ) : (
                  <p className="py-2 text-sm">{node.max_points ?? 30}</p>
                )}
              </Field>
            </div>
          )}

          {node.type === 'end' &&
            (node.outcome === 'auto' ? (
              <div className="grid gap-2 sm:grid-cols-3">
                {(['success', 'partial', 'fail'] as const).map((o) => (
                  <div key={o} className="rounded-xl bg-bg p-3 text-sm">
                    <p className="text-xs font-semibold text-muted">{{ success: 'Успех', partial: 'Частично', fail: 'Провал' }[o]}</p>
                    <p className="font-semibold">{node.variants?.[o]?.title}</p>
                    <p className="text-muted">{node.variants?.[o]?.text}</p>
                  </div>
                ))}
                <p className="text-xs text-muted sm:col-span-3">Исход определяется автоматически по доле оптимальных решений.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
                <Field label="Исход">
                  {edit ? (
                    <select className="input py-2" value={node.outcome ?? 'success'} onChange={(e) => set({ outcome: e.target.value as GraphNode['outcome'] })}>
                      <option value="success">Успех</option>
                      <option value="partial">Частично</option>
                      <option value="fail">Провал</option>
                    </select>
                  ) : (
                    <p className="py-2 text-sm font-semibold">{node.outcome}</p>
                  )}
                </Field>
                <Field label="Заголовок">
                  {edit ? (
                    <input className="input py-2" value={node.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
                  ) : (
                    <p className="py-2 text-sm font-semibold">{node.title}</p>
                  )}
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Текст">
                    <TextArea value={(node.text as string) ?? ''} edit={edit} onChange={(text) => set({ text })} />
                  </Field>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

function ChoiceRow({
  choice,
  ids,
  edit,
  onChange,
  onRemove,
}: {
  choice: GraphChoice
  ids: string[]
  edit: boolean
  onChange: (c: GraphChoice) => void
  onRemove: () => void
}) {
  const q = QUALITY[choice.quality ?? 'ok']
  const set = (patch: Partial<GraphChoice>) => onChange({ ...choice, ...patch })
  const effect = (k: 'loyalty' | 'safety', v: string) => {
    const effects = { ...(choice.effects ?? {}) }
    if (v === '' || Number(v) === 0) delete effects[k]
    else effects[k] = Number(v)
    set({ effects })
  }
  return (
    <div className={cn('rounded-xl border p-3', q.cls)}>
      <div className="flex items-start gap-2">
        <code className="mt-2 rounded bg-surface/70 px-1.5 text-xs font-semibold text-ink">{choice.id}</code>
        <div className="min-w-0 flex-1 space-y-2 text-ink">
          {edit ? (
            <input className="input bg-surface py-2" value={choice.text} onChange={(e) => set({ text: e.target.value })} />
          ) : (
            <p className="text-sm font-semibold">{choice.text}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {edit ? (
              <>
                <select className="input w-auto bg-surface py-1.5 text-xs" value={choice.quality ?? 'ok'} onChange={(e) => set({ quality: e.target.value as Quality })}>
                  <option value="best">Лучший</option>
                  <option value="ok">Допустимый</option>
                  <option value="bad">Ошибка</option>
                </select>
                <MiniNum label="очки" value={choice.points ?? 0} onChange={(v) => set({ points: Number(v) })} />
                <MiniNum label="💙" value={choice.effects?.loyalty ?? 0} onChange={(v) => effect('loyalty', v)} />
                <MiniNum label="🛡️" value={choice.effects?.safety ?? 0} onChange={(v) => effect('safety', v)} />
                <NextSelect value={choice.next} ids={ids} edit onChange={(next) => set({ next })} compact />
                <button onClick={onRemove} className="ml-auto rounded-lg p-1.5 text-muted hover:bg-bad/10 hover:text-bad coarse:p-[15px]" title="Удалить вариант">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                <span className="rounded-full bg-surface/70 px-2 py-0.5 font-semibold">{q.label}</span>
                <span className="rounded-full bg-surface/70 px-2 py-0.5 font-semibold">+{choice.points ?? 0} очк.</span>
                {!!choice.effects?.loyalty && <span className="rounded-full bg-surface/70 px-2 py-0.5">💙 {fmtSigned(choice.effects.loyalty)}</span>}
                {!!choice.effects?.safety && <span className="rounded-full bg-surface/70 px-2 py-0.5">🛡️ {fmtSigned(choice.effects.safety)}</span>}
                <span className="text-muted">→ {choice.next}</span>
              </>
            )}
          </div>
          {edit ? (
            <input className="input bg-surface py-1.5 text-xs" placeholder="Обратная связь игроку" value={choice.feedback ?? ''} onChange={(e) => set({ feedback: e.target.value })} />
          ) : (
            choice.feedback && <p className="text-xs text-muted">{choice.feedback}</p>
          )}
        </div>
      </div>
    </div>
  )
}

const fmtSigned = (n: number) => (n > 0 ? `+${n}` : String(n))

function MiniNum({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-1 rounded-lg bg-surface px-2 py-1 font-semibold text-ink ring-1 ring-line coarse:py-2.5">
      {label}
      <input type="number" className="w-12 bg-transparent text-right outline-none" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

function NextSelect({
  label,
  value,
  ids,
  edit,
  onChange,
  compact,
}: {
  label?: string
  value: string | undefined
  ids: string[]
  edit: boolean
  onChange: (v: string) => void
  compact?: boolean
}) {
  if (!edit) return <p className="text-sm text-muted">{label ?? '→'} <code>{value}</code></p>
  return (
    <label className={cn('flex items-center gap-2 text-sm font-semibold', compact && 'rounded-lg bg-surface px-2 py-1 text-xs ring-1 ring-line coarse:py-2.5')}>
      {label ?? '→'}
      <select className={cn(compact ? 'bg-transparent outline-none' : 'input w-auto py-1.5')} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {!ids.includes(value ?? '') && <option value={value ?? ''}>{value || '—'}</option>}
        {ids.map((i) => (
          <option key={i} value={i}>
            {i}
          </option>
        ))}
      </select>
    </label>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="label">{label}</p>
      {children}
    </div>
  )
}

function TextArea({ value, edit, onChange }: { value: string; edit: boolean; onChange: (v: string) => void }) {
  if (!edit) return <p className="whitespace-pre-wrap py-1 text-sm leading-relaxed">{value || '—'}</p>
  return (
    <textarea
      className="input min-h-[64px] resize-y py-2 text-sm"
      rows={Math.min(6, Math.max(2, Math.ceil(value.length / 70)))}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
