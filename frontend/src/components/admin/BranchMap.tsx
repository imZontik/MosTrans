import type { ScenarioGraph } from '@/api/types'
import { cn } from '@/lib/cn'
import { edgesOf, layout, type EdgeKind } from '@/lib/graph'

const W = 150
const H = 50
const GAP_X = 64
const GAP_Y = 16
const PAD = 12

const EDGE: Record<EdgeKind, { stroke: string; fill: string; dash?: string; label: string }> = {
  best: { stroke: 'stroke-ok', fill: 'fill-ok', label: 'Лучший ответ' },
  ok: { stroke: 'stroke-warn', fill: 'fill-warn', label: 'Допустимый' },
  bad: { stroke: 'stroke-brand', fill: 'fill-brand', label: 'Ошибка' },
  next: { stroke: 'stroke-muted', fill: 'fill-muted', label: 'Далее' },
  score: { stroke: 'stroke-muted', fill: 'fill-muted', dash: '6 3 1 3', label: 'По оценке ответа' },
  timeout: { stroke: 'stroke-muted', fill: 'fill-muted', dash: '5 4', label: 'Таймаут' },
  route: { stroke: 'stroke-ink', fill: 'fill-ink', dash: '1.5 3.5', label: 'Условие' },
}
const KINDS = Object.keys(EDGE) as EdgeKind[]

const TYPE_LABEL = { scene: 'Сцена', choice: 'Выбор', input: 'Ответ', end: 'Финал' } as const
const END_TONE = { success: 'stroke-ok', partial: 'stroke-warn', fail: 'stroke-brand', auto: 'stroke-ink/40' } as const

const clip = (text: string, n: number) => (text.length > n ? `${text.slice(0, n - 1)}…` : text)

/** The scenario as a map of branches: columns are steps from the start, lines are the ways between them. */
export function BranchMap({ graph, selected, onSelect }: { graph: ScenarioGraph; selected?: string | null; onSelect?: (id: string) => void }) {
  const { col, row, columns } = layout(graph)
  const tallest = Math.max(1, ...columns.map((c) => c.length))
  const height = PAD * 2 + tallest * H + (tallest - 1) * GAP_Y
  const width = PAD * 2 + columns.length * W + (columns.length - 1) * GAP_X
  const x = (id: string) => PAD + col[id] * (W + GAP_X)
  const y = (id: string) => {
    const size = columns[col[id]].length
    const offset = ((tallest - size) * (H + GAP_Y)) / 2
    return PAD + offset + row[id] * (H + GAP_Y)
  }

  // one line per pair of nodes; the most telling kind wins (a mistake over a neutral «next»)
  const priority: EdgeKind[] = ['bad', 'best', 'ok', 'route', 'timeout', 'score', 'next']
  const pairs = new Map<string, { from: string; to: string; kind: EdgeKind }>()
  for (const [id, node] of Object.entries(graph.nodes)) {
    for (const e of edgesOf(id, node)) {
      if (!graph.nodes[e.to]) continue
      const key = `${e.from}>${e.to}`
      const prev = pairs.get(key)
      if (!prev || priority.indexOf(e.kind) < priority.indexOf(prev.kind)) pairs.set(key, e)
    }
  }
  const used = new Set([...pairs.values()].map((e) => e.kind))

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-2xl border border-line bg-bg/60">
        <svg width={width} height={height + 40} className="block" role="img" aria-label="Схема веток сценария">
          <defs>
            {KINDS.map((k) => (
              <marker key={k} id={`arrow-${k}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L8,4 L0,8 z" className={EDGE[k].fill} />
              </marker>
            ))}
          </defs>

          {[...pairs.values()].map((e) => {
            const sx = x(e.from)
            const sy = y(e.from)
            const tx = x(e.to)
            const ty = y(e.to)
            let d: string
            if (col[e.to] === col[e.from]) {
              // a neighbour in the same column: a short bow on the right side
              const bow = sx + W + 26 + Math.min(40, Math.abs(ty - sy) / 6)
              d = `M${sx + W},${sy + H / 2} C${bow},${sy + H / 2} ${bow},${ty + H / 2} ${sx + W + 2},${ty + H / 2}`
            } else if (col[e.to] > col[e.from]) {
              const x1 = sx + W
              const y1 = sy + H / 2
              const x2 = tx - 2
              const y2 = ty + H / 2
              const mid = (x1 + x2) / 2
              d = `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`
            } else {
              // a way back (a loop or a jump to an earlier step) goes around below the map
              const x1 = sx + W / 2
              const x2 = tx + W / 2
              const low = height + 28
              d = `M${x1},${sy + H} C${x1},${low} ${x2},${low} ${x2},${ty + H + 2}`
            }
            const style = EDGE[e.kind]
            return (
              <path
                key={`${e.from}>${e.to}`}
                d={d}
                fill="none"
                strokeWidth={e.kind === 'next' ? 1.5 : 2}
                strokeDasharray={style.dash}
                strokeLinecap="round"
                className={cn(style.stroke, e.kind === 'next' && 'opacity-60')}
                markerEnd={`url(#arrow-${e.kind})`}
              />
            )
          })}

          {Object.entries(graph.nodes).map(([id, node]) => {
            const isStart = id === graph.start
            const isSel = id === selected
            const title =
              node.type === 'end'
                ? node.outcome === 'auto'
                  ? 'Исход по решениям'
                  : node.title || TYPE_LABEL.end
                : node.text || ''
            return (
              <g
                key={id}
                transform={`translate(${x(id)},${y(id)})`}
                className={cn(onSelect && 'cursor-pointer', 'group')}
                onClick={() => onSelect?.(id)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return
                  e.preventDefault()
                  onSelect?.(id)
                }}
                tabIndex={onSelect ? 0 : undefined}
                role={onSelect ? 'button' : undefined}
                aria-label={`${id}: ${TYPE_LABEL[node.type]}. ${title}`}
              >
                <title>{`${id} · ${TYPE_LABEL[node.type]}\n${title}`}</title>
                <rect
                  width={W}
                  height={H}
                  rx={12}
                  className={cn(
                    'fill-surface transition-[stroke-width]',
                    isSel ? 'stroke-brand' : node.type === 'end' ? END_TONE[node.outcome ?? 'auto'] : isStart ? 'stroke-brand/60' : 'stroke-line',
                    onSelect && 'group-hover:stroke-ink/50 group-focus-visible:stroke-ink',
                  )}
                  strokeWidth={isSel ? 2.5 : node.type === 'end' ? 2 : 1.25}
                  strokeDasharray={node.type === 'end' && node.outcome === 'auto' ? '4 3' : undefined}
                />
                <text x={10} y={19} className="fill-ink font-mono text-[11px] font-semibold">
                  {clip(id, 12)}
                  <tspan className="fill-muted font-sans font-normal">{`  ${isStart ? 'старт · ' : ''}${TYPE_LABEL[node.type]}`}</tspan>
                </text>
                <text x={10} y={37} className="fill-muted text-[11px]">
                  {clip(title, 22)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {KINDS.filter((k) => used.has(k)).map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <svg width="22" height="6" aria-hidden>
              <line x1="1" y1="3" x2="21" y2="3" strokeWidth="2" strokeDasharray={EDGE[k].dash} strokeLinecap="round" className={EDGE[k].stroke} />
            </svg>
            {EDGE[k].label}
          </li>
        ))}
      </ul>
    </div>
  )
}
