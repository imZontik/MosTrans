import type { GraphNode, Quality, RouteCondition, ScenarioGraph } from '@/api/types'

/** How a step leads to the next one: a choice of some quality, a plain «next», a timer, a condition or a grade. */
export type EdgeKind = Quality | 'next' | 'timeout' | 'route' | 'score'

export interface Edge {
  from: string
  to: string
  kind: EdgeKind
}

export const CONDITIONS: { key: keyof RouteCondition; label: string; short: string }[] = [
  { key: 'loyalty_below', label: 'Лояльность ниже', short: 'лояльность <' },
  { key: 'loyalty_at_least', label: 'Лояльность не ниже', short: 'лояльность ≥' },
  { key: 'safety_below', label: 'Безопасность ниже', short: 'безопасность <' },
  { key: 'safety_at_least', label: 'Безопасность не ниже', short: 'безопасность ≥' },
  { key: 'chose', label: 'Ранее выбран вариант', short: 'выбран' },
]

/** Outgoing links of a node, the same ones the engine follows (backend/app/business/engine.py). */
export function edgesOf(id: string, node: GraphNode): Edge[] {
  const edges: Edge[] = []
  const add = (to: string | undefined, kind: EdgeKind) => to && edges.push({ from: id, to, kind })
  if (node.type === 'scene' || node.type === 'input') add(node.next, 'next')
  if (node.type === 'input') (node.branches ?? []).forEach((b) => add(b.next, 'score'))
  if (node.type === 'choice') {
    ;(node.choices ?? []).forEach((c) => add(c.next, c.quality ?? 'ok'))
    add(node.timeout?.next, 'timeout')
  }
  if (node.type !== 'end') (node.routes ?? []).forEach((r) => add(r.next, 'route'))
  return edges
}

export const targets = (node: GraphNode) => edgesOf('', node).map((e) => e.to)

/** A node that sends the player to more than one place. */
export const isFork = (node: GraphNode) => new Set(targets(node)).size > 1

/** Node ids in walk order from `start` (breadth first), unreachable ones at the end. */
export function orderedIds(graph: ScenarioGraph): string[] {
  const seen: string[] = []
  const queue = [graph.start]
  while (queue.length) {
    const id = queue.shift()!
    if (!id || seen.includes(id) || !graph.nodes[id]) continue
    seen.push(id)
    queue.push(...targets(graph.nodes[id]))
  }
  return [...seen, ...Object.keys(graph.nodes).filter((id) => !seen.includes(id))]
}

export function reachable(graph: ScenarioGraph): Set<string> {
  const seen = new Set<string>()
  const stack = [graph.start]
  while (stack.length) {
    const id = stack.pop()!
    if (seen.has(id) || !graph.nodes[id]) continue
    seen.add(id)
    stack.push(...targets(graph.nodes[id]))
  }
  return seen
}

/** Which nodes lead to each node: «← n2, n3b» on the cards. */
export function incoming(graph: ScenarioGraph): Record<string, string[]> {
  const refs: Record<string, string[]> = {}
  for (const [id, node] of Object.entries(graph.nodes)) {
    for (const to of new Set(targets(node))) (refs[to] ??= []).push(id)
  }
  return refs
}

/** Forks and endings, counted like the backend does for the catalog. */
export function graphShape(graph: ScenarioGraph): { forks: number; endings: number } {
  const alive = reachable(graph)
  let forks = 0
  let endings = 0
  for (const [id, node] of Object.entries(graph.nodes)) {
    if (isFork(node)) forks++
    if (node.type === 'end' && alive.has(id)) endings += node.outcome === 'auto' ? 3 : 1
  }
  return { forks, endings }
}

/** Next free id like n7 */
export function freeId(graph: ScenarioGraph, prefix = 'n'): string {
  let i = Object.keys(graph.nodes).length + 1
  while (graph.nodes[`${prefix}${i}`]) i++
  return `${prefix}${i}`
}

export const firstEnd = (graph: ScenarioGraph) => Object.keys(graph.nodes).find((id) => graph.nodes[id].type === 'end')

/**
 * Columns for the branch map: a node sits one column right of the nearest step that leads to it.
 * Within a column nodes follow their parents to keep lines from crossing.
 */
export function layout(graph: ScenarioGraph): { col: Record<string, number>; row: Record<string, number>; columns: string[][] } {
  const col: Record<string, number> = {}
  const order = orderedIds(graph)
  const queue: string[] = []
  if (graph.nodes[graph.start]) {
    col[graph.start] = 0
    queue.push(graph.start)
  }
  while (queue.length) {
    const id = queue.shift()!
    for (const to of targets(graph.nodes[id])) {
      if (graph.nodes[to] && col[to] === undefined) {
        col[to] = col[id] + 1
        queue.push(to)
      }
    }
  }
  const last = Math.max(-1, ...Object.values(col)) + 1
  for (const id of order) if (col[id] === undefined) col[id] = last

  const columns: string[][] = []
  for (const id of order) (columns[col[id]] ??= []).push(id)
  const parents = incoming(graph)
  const row: Record<string, number> = {}
  columns.forEach((ids, c) => {
    if (c > 0) {
      const weight = (id: string) => {
        const rows = (parents[id] ?? []).filter((p) => col[p] < c).map((p) => row[p])
        return rows.length ? rows.reduce((a, b) => a + b, 0) / rows.length : Number.MAX_SAFE_INTEGER
      }
      ids.sort((a, b) => weight(a) - weight(b) || order.indexOf(a) - order.indexOf(b))
    }
    ids.forEach((id, r) => (row[id] = r))
  })
  return { col, row, columns: columns.filter(Boolean) }
}
