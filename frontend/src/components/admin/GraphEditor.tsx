import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, Clock, Flag, GitBranch, MessageSquare, Plus, Trash2, Type, UserPlus, Volume2, X } from 'lucide-react'
import type { Character, Effects, GraphChoice, GraphNode, GraphRoute, Outcome, Quality, RouteCondition, ScenarioGraph } from '@/api/types'
import { cn } from '@/lib/cn'
import { CONDITIONS, firstEnd, freeId, graphShape, incoming, isFork, orderedIds } from '@/lib/graph'
import { ENDINGS, FORKS, pluralN } from '@/lib/plural'
import { Badge, type Tone } from '../Badge'
import { BranchMap } from './BranchMap'

type NodeType = GraphNode['type']

const TYPE_META: Record<NodeType, { label: string; tone: Tone; icon: ReactNode }> = {
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

const OUTCOMES: Record<Outcome, string> = { success: 'Успех', partial: 'Частично', fail: 'Провал' }

const NEW = '__new:'

interface Option {
  value: string
  label: string
}

/** Everything a node card needs to know about the rest of the graph. */
interface Ctx {
  edit: boolean
  nodes: Option[]
  choices: Option[]
  speakers: string[]
  characters: Record<string, Character>
  /** where a fresh link points until the author picks a place: the first ending */
  fallback: string
}

const clip = (text: string, n: number) => (text.length > n ? `${text.slice(0, n - 1)}…` : text)
const fmtSigned = (n: number) => (n > 0 ? `+${n}` : String(n))

/**
 * Scenario graph editor: the branch map on top, then every node as a card in walk order from `start`.
 * Branches are made right where a way out is chosen: «→ ＋ новая сцена / выбор / финал».
 */
export function GraphEditor({
  graph,
  onChange,
  readOnly = false,
}: {
  graph: ScenarioGraph
  onChange?: (g: ScenarioGraph) => void
  readOnly?: boolean
}) {
  const [focus, setFocus] = useState<{ id: string; tick: number } | null>(null)
  const edit = !readOnly && !!onChange
  const ids = orderedIds(graph)
  const refs = incoming(graph)
  const shape = graphShape(graph)
  const characters = graph.characters ?? {}

  const ctx: Ctx = {
    edit,
    speakers: ['narrator', ...Object.keys(characters)],
    characters,
    fallback: firstEnd(graph) ?? graph.start,
    nodes: ids.map((id) => ({ value: id, label: `${id} · ${nodeSummary(graph.nodes[id])}` })),
    choices: ids.flatMap((id) =>
      (graph.nodes[id].choices ?? []).map((c) => ({ value: `${id}:${c.id}`, label: `${id} · ${c.id}: ${clip(c.text, 40)}` })),
    ),
  }

  const select = (id: string) => setFocus({ id, tick: Date.now() })
  const setNode = (id: string, node: GraphNode) => onChange?.({ ...graph, nodes: { ...graph.nodes, [id]: node } })
  const removeNode = (id: string) => {
    const from = (refs[id] ?? []).filter((r) => r !== id)
    if (from.length && !window.confirm(`На узел ${id} ведут: ${from.join(', ')}. Удалить? Эти ссылки нужно будет перенаправить.`)) return
    const nodes = { ...graph.nodes }
    delete nodes[id]
    onChange?.({ ...graph, nodes })
  }
  const addNode = (type: NodeType) => {
    const id = freeId(graph)
    onChange?.({ ...graph, nodes: { ...graph.nodes, [id]: blankNode(type, firstEnd(graph) ?? graph.start) } })
    select(id)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={shape.forks ? 'ok' : 'warn'} icon={<GitBranch className="h-3 w-3" />}>
          {pluralN(shape.forks, FORKS)}
        </Badge>
        <Badge icon={<Flag className="h-3 w-3" />}>{pluralN(shape.endings, ENDINGS)}</Badge>
        {shape.forks === 0 && (
          <span className="text-sm text-warn-ink">
            Сценарий линейный.{edit && ' Чтобы ответ менял ход событий, выберите у варианта «→ ＋ новая сцена» или направьте его в другой узел.'}
          </span>
        )}
      </div>

      <BranchMap graph={graph} selected={focus?.id} onSelect={select} />

      <CharactersEditor
        characters={characters}
        used={new Set(Object.values(graph.nodes).map((n) => n.speaker ?? 'narrator'))}
        edit={edit}
        onChange={(c) => onChange?.({ ...graph, characters: c })}
      />

      <div className="space-y-3">
        {ids.map((id) => (
          <NodeCard
            key={id}
            id={id}
            node={graph.nodes[id]}
            isStart={graph.start === id}
            from={(refs[id] ?? []).filter((r) => r !== id)}
            focusTick={focus?.id === id ? focus.tick : 0}
            ctx={ctx}
            onSelect={select}
            onChange={(n) => setNode(id, n)}
            onRemove={() => removeNode(id)}
            // the new node and the link to it land in one update, so a fresh branch is never lost
            onCreate={(type, continueTo, relink) => {
              const newId = freeId(graph)
              const target = continueTo && graph.nodes[continueTo] && continueTo !== id ? continueTo : (firstEnd(graph) ?? graph.start)
              onChange?.({ ...graph, nodes: { ...graph.nodes, [newId]: blankNode(type, target), [id]: relink(newId) } })
              select(newId)
            }}
          />
        ))}
      </div>

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

function nodeSummary(node: GraphNode): string {
  if (node.type === 'end') return `финал: ${node.outcome === 'auto' ? 'по решениям' : clip(node.title || OUTCOMES[node.outcome as Outcome] || '', 28)}`
  return `${TYPE_META[node.type].label.toLowerCase()}: ${clip(node.text || '', 28)}`
}

function blankNode(type: NodeType, next: string): GraphNode {
  switch (type) {
    case 'end':
      return { type, outcome: 'partial', title: 'Новый финал', text: '' }
    case 'choice':
      return {
        type,
        speaker: 'narrator',
        text: 'Ваши действия?',
        timer: 20,
        choices: [
          { id: 'a', text: 'Вариант А', next, quality: 'best', points: 20, effects: {}, feedback: '' },
          { id: 'b', text: 'Вариант Б', next, quality: 'bad', points: 0, effects: {}, feedback: '' },
        ],
      }
    case 'input':
      return { type, speaker: 'narrator', text: 'Опишите свои действия', next, rubric: 'Критерии оценки…', ideal: '', keywords: [], max_points: 30, timer: 60 }
    default:
      return { type, speaker: 'narrator', text: 'Новая сцена', next }
  }
}

// --- characters ----------------------------------------------------------------

function CharactersEditor({
  characters,
  used,
  edit,
  onChange,
}: {
  characters: Record<string, Character>
  used: Set<string>
  edit: boolean
  onChange: (c: Record<string, Character>) => void
}) {
  const entries = Object.entries(characters)
  if (!edit) {
    if (!entries.length) return null
    return (
      <div className="flex flex-wrap gap-2">
        {entries.map(([key, c]) => (
          <span key={key} className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm">
            <span className="text-lg leading-none">{c.avatar}</span>
            <b>{c.name}</b>
            {c.role && <span className="text-muted">, {c.role}</span>}
            <code className="text-xs text-muted">{key}</code>
          </span>
        ))}
      </div>
    )
  }
  const set = (key: string, patch: Partial<Character>) => onChange({ ...characters, [key]: { ...characters[key], ...patch } })
  const add = () => {
    let i = entries.length + 1
    while (characters[`p${i}`]) i++
    onChange({ ...characters, [`p${i}`]: { name: 'Пассажир', role: 'пассажир', avatar: '🧑' } })
  }
  const remove = (key: string) => {
    const next = { ...characters }
    delete next[key]
    onChange(next)
  }
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="label">Персонажи</p>
      <div className="space-y-2">
        {entries.map(([key, c]) => (
          <div key={key} className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[56px_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <input className="input px-1 py-2 text-center text-lg" aria-label="Аватар" value={c.avatar ?? ''} maxLength={8} onChange={(e) => set(key, { avatar: e.target.value })} />
            <input className="input py-2" aria-label="Имя" placeholder="Имя" value={c.name} onChange={(e) => set(key, { name: e.target.value })} />
            <input
              className="input col-span-2 row-start-2 py-2 sm:col-span-1 sm:row-start-auto"
              aria-label="Роль"
              placeholder="Роль"
              value={c.role ?? ''}
              onChange={(e) => set(key, { role: e.target.value })}
            />
            <button
              onClick={() => remove(key)}
              disabled={used.has(key)}
              className="rounded-lg p-1.5 text-muted hover:bg-bad/10 hover:text-bad disabled:opacity-30 disabled:hover:bg-transparent coarse:p-3.5"
              title={used.has(key) ? `Персонаж ${key} говорит в сценарии` : `Удалить ${key}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button onClick={add} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-brand coarse:min-h-[44px]">
        <UserPlus className="h-4 w-4" /> Персонаж
      </button>
    </div>
  )
}

// --- node card -----------------------------------------------------------------

function NodeCard({
  id,
  node,
  isStart,
  from,
  focusTick,
  ctx,
  onSelect,
  onChange,
  onRemove,
  onCreate,
}: {
  id: string
  node: GraphNode
  isStart: boolean
  from: string[]
  focusTick: number
  ctx: Ctx
  onSelect: (id: string) => void
  onChange: (n: GraphNode) => void
  onRemove: () => void
  onCreate: CreateFn
}) {
  const [open, setOpen] = useState(true)
  const ref = useRef<HTMLDivElement>(null)
  const meta = TYPE_META[node.type] ?? TYPE_META.scene
  const speaker = node.speaker && node.speaker !== 'narrator' ? ctx.characters[node.speaker] : null
  const set = (patch: Partial<GraphNode>) => onChange({ ...node, ...patch })
  const { edit } = ctx

  useEffect(() => {
    if (!focusTick) return
    setOpen(true)
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [focusTick])

  return (
    <div
      ref={ref}
      id={`node-${id}`}
      className={cn(
        'scroll-mt-4 rounded-2xl border bg-surface transition-shadow',
        focusTick ? 'border-brand ring-4 ring-brand/15' : isStart ? 'border-brand/40' : 'border-line',
      )}
    >
      <div className="flex items-center gap-2 px-4 py-3">
        <button onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left coarse:min-h-[44px]">
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted transition', !open && '-rotate-90')} />
          <code className="rounded-md bg-bg px-1.5 py-0.5 text-xs font-semibold">{id}</code>
          <Badge tone={meta.tone} icon={meta.icon}>
            {meta.label}
          </Badge>
          {isStart && <Badge tone="brand">Старт</Badge>}
          {isFork(node) && (
            <Badge tone="ok" icon={<GitBranch className="h-3 w-3" />}>
              Развилка
            </Badge>
          )}
          {node.timer ? (
            <span className="flex items-center gap-0.5 text-xs font-semibold text-muted">
              <Clock className="h-3 w-3" /> {node.timer}с
            </span>
          ) : null}
          {node.audio && <Volume2 className="h-3.5 w-3.5 text-muted" />}
          {!open && <span className="min-w-0 flex-1 truncate text-sm text-muted">{node.text || node.title}</span>}
        </button>
        {edit && !isStart && (
          <button onClick={onRemove} className="rounded-lg p-1.5 text-muted hover:bg-bad/10 hover:text-bad coarse:p-3.5" title="Удалить узел">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="space-y-3 border-t border-line px-4 py-3">
          {from.length > 0 && (
            <p className="flex flex-wrap items-center gap-1 text-xs text-muted">
              Сюда ведут:
              {from.map((f) => (
                <button key={f} onClick={() => onSelect(f)} className="rounded-md bg-bg px-1.5 py-0.5 font-mono font-semibold text-ink hover:bg-ink/10 coarse:min-h-[44px] coarse:min-w-[44px] coarse:px-2.5">
                  {f}
                </button>
              ))}
            </p>
          )}
          {node.type !== 'end' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_minmax(0,1fr)_110px]">
              <Field label="Говорит">
                {edit ? (
                  <select className="input py-2" value={node.speaker ?? 'narrator'} onChange={(e) => set({ speaker: e.target.value })}>
                    {ctx.speakers.map((s) => (
                      <option key={s} value={s}>
                        {s === 'narrator' ? 'Рассказчик' : `${ctx.characters[s]?.avatar ?? ''} ${ctx.characters[s]?.name ?? s}`}
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

          {node.type === 'scene' && (
            <NextSelect
              label="Далее →"
              value={node.next}
              ctx={ctx}
              onChange={(next) => set({ next })}
              onCreate={(t) => onCreate(t, node.next, (nid) => ({ ...node, next: nid }))}
            />
          )}

          {node.type === 'choice' && (
            <ChoiceSection id={id} node={node} ctx={ctx} set={set} onCreate={onCreate} />
          )}

          {node.type === 'input' && <InputSection node={node} ctx={ctx} set={set} onCreate={onCreate} />}

          {node.type !== 'end' && (node.routes?.length || edit) ? (
            <RoutesEditor
              routes={node.routes ?? []}
              ctx={ctx}
              onChange={(routes) => set({ routes: routes.length ? routes : undefined })}
              onCreate={(i, t) =>
                onCreate(t, node.routes?.[i]?.next, (nid) => ({ ...node, routes: (node.routes ?? []).map((r, j) => (j === i ? { ...r, next: nid } : r)) }))
              }
            />
          ) : null}

          {node.type === 'end' && <EndSection node={node} edit={edit} set={set} />}
        </div>
      )}
    </div>
  )
}

type CreateFn = (type: NodeType, continueTo: string | undefined, relink: (newId: string) => GraphNode) => void

function ChoiceSection({ id, node, ctx, set, onCreate }: { id: string; node: GraphNode; ctx: Ctx; set: (p: Partial<GraphNode>) => void; onCreate: CreateFn }) {
  const choices = node.choices ?? []
  const withChoice = (i: number, patch: Partial<GraphChoice>) => ({ ...node, choices: choices.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
  const worst = choices.find((c) => c.quality === 'bad') ?? choices[choices.length - 1]
  const timeout = node.timeout
  const setTimeout = (patch: Partial<NonNullable<GraphNode['timeout']>>) => set({ timeout: { ...(timeout ?? { next: worst?.next ?? id }), ...patch } })

  return (
    <div className="space-y-2">
      {choices.map((c, i) => (
        <ChoiceRow
          key={c.id + i}
          choice={c}
          ctx={ctx}
          onChange={(nc) => set({ choices: choices.map((x, j) => (j === i ? nc : x)) })}
          onRemove={() => set({ choices: choices.filter((_, j) => j !== i) })}
          onCreate={(t) => onCreate(t, c.next, (nid) => withChoice(i, { next: nid }))}
        />
      ))}
      {ctx.edit && (
        <button
          onClick={() => {
            const used = new Set(choices.map((c) => c.id))
            let code = 97
            while (used.has(String.fromCharCode(code))) code++
            set({
              choices: [
                ...choices,
                { id: String.fromCharCode(code), text: 'Новый вариант', next: choices[0]?.next ?? id, quality: 'ok', points: 5, effects: {}, feedback: '' },
              ],
            })
          }}
          className="flex items-center gap-1 text-sm font-semibold text-brand coarse:min-h-[44px]"
        >
          <Plus className="h-4 w-4" /> Вариант ответа
        </button>
      )}

      {node.timer ? (
        <div className="rounded-xl bg-bg px-3 py-2.5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted" />
            <span className="font-semibold">Время вышло</span>
            {timeout ? (
              <>
                <NextSelect
                  value={timeout.next}
                  ctx={ctx}
                  compact
                  onChange={(next) => setTimeout({ next })}
                  onCreate={(t) => onCreate(t, timeout.next, (nid) => ({ ...node, timeout: { ...timeout, next: nid } }))}
                />
                {ctx.edit ? (
                  <>
                    <EffectNums effects={timeout.effects ?? {}} onChange={(effects) => setTimeout({ effects })} />
                    <button onClick={() => set({ timeout: undefined })} className="ml-auto rounded-lg p-1.5 text-muted hover:text-bad coarse:p-4" title="Убрать свою ветку таймаута">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <EffectChips effects={timeout.effects} />
                )}
              </>
            ) : (
              <span className="text-muted">
                засчитается как худший вариант → <code>{worst?.next}</code>, −10 к шкалам
                {ctx.edit && (
                  <button onClick={() => setTimeout({ feedback: 'Время вышло: промедление ухудшило ситуацию.', effects: { loyalty: -10, safety: -10 } })} className="ml-2 font-semibold text-brand">
                    Своя ветка
                  </button>
                )}
              </span>
            )}
          </div>
          {timeout &&
            (ctx.edit ? (
              <input
                className="input mt-2 bg-surface py-1.5 text-xs"
                placeholder="Обратная связь игроку"
                value={timeout.feedback ?? ''}
                onChange={(e) => setTimeout({ feedback: e.target.value })}
              />
            ) : (
              timeout.feedback && <p className="mt-1 text-xs text-muted">«{timeout.feedback}»</p>
            ))}
        </div>
      ) : null}
    </div>
  )
}

function InputSection({ node, ctx, set, onCreate }: { node: GraphNode; ctx: Ctx; set: (p: Partial<GraphNode>) => void; onCreate: CreateFn }) {
  const branches = node.branches ?? []
  const setBranch = (i: number, patch: Partial<{ min_score: number; next: string }>) =>
    set({ branches: branches.map((b, j) => (j === i ? { ...b, ...patch } : b)) })
  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-xl bg-bg px-3 py-2.5">
        <p className="text-xs font-semibold text-muted">Куда дальше — по оценке ответа ИИ-наставником (0–10)</p>
        {branches.map((b, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
            <span>Оценка не ниже</span>
            {ctx.edit ? (
              <input
                type="number"
                min={0}
                max={10}
                step={0.5}
                className="input w-20 bg-surface py-1.5"
                value={b.min_score}
                onChange={(e) => setBranch(i, { min_score: Number(e.target.value) })}
              />
            ) : (
              <b>{b.min_score}</b>
            )}
            <NextSelect
              value={b.next}
              ctx={ctx}
              compact
              onChange={(next) => setBranch(i, { next })}
              onCreate={(t) => onCreate(t, b.next, (nid) => ({ ...node, branches: branches.map((x, j) => (j === i ? { ...x, next: nid } : x)) }))}
            />
            {ctx.edit && (
              <button onClick={() => set({ branches: branches.filter((_, j) => j !== i) })} className="rounded-lg p-1.5 text-muted hover:text-bad coarse:p-3.5" title="Убрать ветку">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        <NextSelect
          label={branches.length ? 'Иначе →' : 'Далее →'}
          value={node.next}
          ctx={ctx}
          onChange={(next) => set({ next })}
          onCreate={(t) => onCreate(t, node.next, (nid) => ({ ...node, next: nid }))}
        />
        {ctx.edit && (
          <button
            onClick={() => set({ branches: [...branches, { min_score: 7, next: node.next ?? '' }] })}
            className="flex items-center gap-1 text-sm font-semibold text-brand coarse:min-h-[44px]"
          >
            <GitBranch className="h-4 w-4" /> Ветка по оценке
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Рубрика оценивания (для ИИ)">
          <TextArea value={node.rubric ?? ''} edit={ctx.edit} onChange={(rubric) => set({ rubric })} />
        </Field>
        <Field label="Эталонный ответ">
          <TextArea value={node.ideal ?? ''} edit={ctx.edit} onChange={(ideal) => set({ ideal })} />
        </Field>
        <Field label="Ключевые слова (через запятую)">
          {ctx.edit ? (
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
          {ctx.edit ? (
            <input type="number" className="input py-2" value={node.max_points ?? 30} onChange={(e) => set({ max_points: Number(e.target.value) })} />
          ) : (
            <p className="py-2 text-sm">{node.max_points ?? 30}</p>
          )}
        </Field>
      </div>
    </div>
  )
}

function RoutesEditor({
  routes,
  ctx,
  onChange,
  onCreate,
}: {
  routes: GraphRoute[]
  ctx: Ctx
  onChange: (r: GraphRoute[]) => void
  onCreate: (index: number, type: NodeType) => void
}) {
  const setRoute = (i: number, r: GraphRoute) => onChange(routes.map((x, j) => (j === i ? r : x)))
  return (
    <div className="rounded-xl border border-dashed border-line px-3 py-2.5">
      <p className="text-xs font-semibold text-muted">
        Условные переходы{' '}
        <span className="font-normal">— проверяются после ответа по порядку, первый подходящий меняет следующий шаг</span>
      </p>
      {routes.map((r, i) => {
        const [key, value] = (Object.entries(r.if ?? {})[0] ?? ['loyalty_below', 40]) as [keyof RouteCondition, number | string]
        const extra = Object.keys(r.if ?? {}).length - 1
        const cond = CONDITIONS.find((c) => c.key === key)
        const setCond = (k: keyof RouteCondition, v: number | string) => setRoute(i, { ...r, if: { [k]: v } })
        return (
          <div key={i} className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Если</span>
            {ctx.edit ? (
              <>
                <select
                  className="input w-auto bg-surface py-1.5"
                  value={key}
                  onChange={(e) => {
                    const k = e.target.value as keyof RouteCondition
                    setCond(k, k === 'chose' ? (ctx.choices[0]?.value ?? '') : typeof value === 'number' ? value : 40)
                  }}
                >
                  {CONDITIONS.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {key === 'chose' ? (
                  <select className="input w-auto max-w-full bg-surface py-1.5" value={String(value)} onChange={(e) => setCond(key, e.target.value)}>
                    {!ctx.choices.some((o) => o.value === value) && <option value={String(value)}>{String(value) || '—'}</option>}
                    {ctx.choices.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="input w-20 bg-surface py-1.5"
                    value={Number(value)}
                    onChange={(e) => setCond(key, Number(e.target.value))}
                  />
                )}
              </>
            ) : (
              <b>
                {cond?.short ?? key} {key === 'chose' ? <code>{String(value)}</code> : value}
              </b>
            )}
            {extra > 0 && <span className="text-xs text-muted">и ещё {extra} (в JSON)</span>}
            <NextSelect value={r.next} ctx={ctx} compact onChange={(next) => setRoute(i, { ...r, next })} onCreate={(t) => onCreate(i, t)} />
            {ctx.edit && (
              <button onClick={() => onChange(routes.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-muted hover:text-bad coarse:p-3.5" title="Убрать условие">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )
      })}
      {ctx.edit && (
        <button
          onClick={() => onChange([...routes, { if: { loyalty_below: 40 }, next: ctx.fallback }])}
          className="mt-2 flex items-center gap-1 text-sm font-semibold text-brand coarse:min-h-[44px]"
        >
          <Plus className="h-4 w-4" /> Условный переход
        </button>
      )}
    </div>
  )
}

function EndSection({ node, edit, set }: { node: GraphNode; edit: boolean; set: (p: Partial<GraphNode>) => void }) {
  const auto = node.outcome === 'auto'
  const variants = node.variants ?? {}
  const setVariant = (o: Outcome, patch: Partial<{ title: string; text: string }>) =>
    set({ variants: { ...variants, [o]: { title: variants[o]?.title ?? '', text: variants[o]?.text ?? '', ...patch } } })
  return (
    <div className="space-y-3">
      <Field label="Исход">
        {edit ? (
          <select
            className="input w-auto py-2"
            value={node.outcome ?? 'success'}
            onChange={(e) => {
              const outcome = e.target.value as GraphNode['outcome']
              if (outcome === 'auto' && !node.variants)
                set({
                  outcome,
                  variants: {
                    success: { title: node.title || 'Отлично', text: node.text as string || '' },
                    partial: { title: 'Есть что улучшить', text: '' },
                    fail: { title: 'Не справились', text: '' },
                  },
                })
              else set({ outcome })
            }}
          >
            <option value="success">Успех</option>
            <option value="partial">Частично</option>
            <option value="fail">Провал</option>
            <option value="auto">По решениям (авто)</option>
          </select>
        ) : (
          <p className="py-2 text-sm font-semibold">{auto ? 'По решениям' : OUTCOMES[node.outcome as Outcome]}</p>
        )}
      </Field>
      {auto ? (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            {(['success', 'partial', 'fail'] as const).map((o) => (
              <div key={o} className="space-y-2 rounded-xl bg-bg p-3 text-sm">
                <p className="text-xs font-semibold text-muted">{OUTCOMES[o]}</p>
                {edit ? (
                  <>
                    <input className="input bg-surface py-1.5" placeholder="Заголовок" value={variants[o]?.title ?? ''} onChange={(e) => setVariant(o, { title: e.target.value })} />
                    <TextArea value={variants[o]?.text ?? ''} edit onChange={(text) => setVariant(o, { text })} />
                  </>
                ) : (
                  <>
                    <p className="font-semibold">{variants[o]?.title}</p>
                    <p className="text-muted">{variants[o]?.text}</p>
                  </>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted">Исход определяется по доле лучших решений: от 75% — успех, от 40% — частично.</p>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          <Field label="Заголовок">
            {edit ? (
              <input className="input py-2" value={node.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
            ) : (
              <p className="py-2 text-sm font-semibold">{node.title}</p>
            )}
          </Field>
          <Field label="Текст">
            <TextArea value={(node.text as string) ?? ''} edit={edit} onChange={(text) => set({ text })} />
          </Field>
        </div>
      )}
    </div>
  )
}

function ChoiceRow({
  choice,
  ctx,
  onChange,
  onRemove,
  onCreate,
}: {
  choice: GraphChoice
  ctx: Ctx
  onChange: (c: GraphChoice) => void
  onRemove: () => void
  onCreate: (type: NodeType) => void
}) {
  const q = QUALITY[choice.quality ?? 'ok']
  const set = (patch: Partial<GraphChoice>) => onChange({ ...choice, ...patch })
  return (
    <div className={cn('rounded-xl border p-3', q.cls)}>
      <div className="flex items-start gap-2">
        <code className="mt-2 rounded bg-surface/70 px-1.5 text-xs font-semibold text-ink">{choice.id}</code>
        <div className="min-w-0 flex-1 space-y-2 text-ink">
          {ctx.edit ? (
            <input className="input bg-surface py-2" value={choice.text} onChange={(e) => set({ text: e.target.value })} />
          ) : (
            <p className="text-sm font-semibold">{choice.text}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {ctx.edit ? (
              <>
                <select className="input w-auto bg-surface py-1.5 text-xs" value={choice.quality ?? 'ok'} onChange={(e) => set({ quality: e.target.value as Quality })}>
                  <option value="best">Лучший</option>
                  <option value="ok">Допустимый</option>
                  <option value="bad">Ошибка</option>
                </select>
                <MiniNum label="очки" value={choice.points ?? 0} onChange={(v) => set({ points: Number(v) })} />
                <EffectNums effects={choice.effects ?? {}} onChange={(effects) => set({ effects })} />
                <NextSelect value={choice.next} ctx={ctx} onChange={(next) => set({ next })} onCreate={onCreate} compact />
                <button onClick={onRemove} className="ml-auto rounded-lg p-1.5 text-muted hover:bg-bad/10 hover:text-bad coarse:p-[15px]" title="Удалить вариант">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                <span className="rounded-full bg-surface/70 px-2 py-0.5 font-semibold">{q.label}</span>
                <span className="rounded-full bg-surface/70 px-2 py-0.5 font-semibold">+{choice.points ?? 0} очк.</span>
                <EffectChips effects={choice.effects} />
                <span className="font-semibold text-ink">
                  → <code>{choice.next}</code>
                </span>
              </>
            )}
          </div>
          {ctx.edit ? (
            <input className="input bg-surface py-1.5 text-xs" placeholder="Обратная связь игроку" value={choice.feedback ?? ''} onChange={(e) => set({ feedback: e.target.value })} />
          ) : (
            choice.feedback && <p className="text-xs text-muted">{choice.feedback}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function EffectNums({ effects, onChange }: { effects: Effects; onChange: (e: Effects) => void }) {
  const effect = (k: 'loyalty' | 'safety', v: string) => {
    const next = { ...effects }
    if (v === '' || Number(v) === 0) delete next[k]
    else next[k] = Number(v)
    onChange(next)
  }
  return (
    <>
      <MiniNum label="💙" value={effects.loyalty ?? 0} onChange={(v) => effect('loyalty', v)} />
      <MiniNum label="🛡️" value={effects.safety ?? 0} onChange={(v) => effect('safety', v)} />
    </>
  )
}

function EffectChips({ effects }: { effects?: Effects }) {
  return (
    <>
      {!!effects?.loyalty && <span className="rounded-full bg-surface/70 px-2 py-0.5">💙 {fmtSigned(effects.loyalty)}</span>}
      {!!effects?.safety && <span className="rounded-full bg-surface/70 px-2 py-0.5">🛡️ {fmtSigned(effects.safety)}</span>}
    </>
  )
}

function MiniNum({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-1 rounded-lg bg-surface px-2 py-1 font-semibold text-ink ring-1 ring-line coarse:py-2.5">
      {label}
      <input type="number" className="w-12 bg-transparent text-right outline-none" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

/** Where a way out leads: an existing node, or a new one created right here (that is how branches are made). */
function NextSelect({
  label,
  value,
  ctx,
  onChange,
  onCreate,
  compact,
}: {
  label?: string
  value: string | undefined
  ctx: Ctx
  onChange: (v: string) => void
  onCreate?: (type: NodeType) => void
  compact?: boolean
}) {
  if (!ctx.edit)
    return (
      <p className="text-sm text-muted">
        {label ?? '→'} <code className="font-semibold text-ink">{value}</code>
      </p>
    )
  return (
    <label className={cn('flex max-w-full items-center gap-2 text-sm font-semibold', compact && 'rounded-lg bg-surface px-2 py-1 text-xs ring-1 ring-line coarse:py-3')}>
      <span className="shrink-0">{label ?? '→'}</span>
      <select
        className={cn('min-w-0 max-w-[16rem]', compact ? 'bg-transparent outline-none' : 'input w-auto py-1.5')}
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value
          if (v.startsWith(NEW)) onCreate?.(v.slice(NEW.length) as NodeType)
          else onChange(v)
        }}
      >
        {!ctx.nodes.some((o) => o.value === value) && <option value={value ?? ''}>{value || '—'}</option>}
        <optgroup label="Узлы">
          {ctx.nodes.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </optgroup>
        {onCreate && (
          <optgroup label="Новая ветка">
            <option value={`${NEW}scene`}>＋ новая сцена</option>
            <option value={`${NEW}choice`}>＋ новый выбор</option>
            <option value={`${NEW}input`}>＋ новый свободный ответ</option>
            <option value={`${NEW}end`}>＋ новый финал</option>
          </optgroup>
        )}
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
