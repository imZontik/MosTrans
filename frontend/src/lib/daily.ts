import type { Catalog, CatalogItem, RunHistoryItem } from '@/api/types'

/**
 * «Задание дня»: every day one direction and one condition, the same for the whole day and
 * different tomorrow. It counts when a run of that direction finished today meets the condition,
 * so the check needs nothing but the run history: the series, the week pass and the tokens are
 * all worked out from the runs the server already keeps, and they match on every device.
 */

export type GoalCode = 'success' | 'loyalty' | 'safety' | 'balance'

export interface Goal {
  code: GoalCode
  /** the goal as a headline */
  title: string
  /** the condition, one line */
  rule: string
  /** what a finished run shows against the condition, e.g. «безопасность 70» */
  measure: (r: RunLike) => string
  test: (r: RunLike) => boolean
}

type RunLike = Pick<RunHistoryItem, 'outcome' | 'loyalty' | 'safety'>

export const GOALS: Goal[] = [
  {
    code: 'success',
    title: 'Лучшая развязка',
    rule: 'Доведите рейс до лучшего финала',
    measure: (r) => (r.outcome === 'success' ? 'лучший финал' : r.outcome === 'partial' ? 'финал с оговорками' : 'провал'),
    test: (r) => r.outcome === 'success',
  },
  {
    code: 'loyalty',
    title: 'Пассажир доволен',
    rule: 'Лояльность пассажира — 80 и выше',
    measure: (r) => `лояльность ${r.loyalty}`,
    test: (r) => r.loyalty >= 80,
  },
  {
    code: 'safety',
    title: 'Ноль риска',
    rule: 'Безопасность — 90 и выше',
    measure: (r) => `безопасность ${r.safety}`,
    test: (r) => r.safety >= 90,
  },
  {
    code: 'balance',
    title: 'Обе шкалы в зелёной зоне',
    rule: 'Лояльность и безопасность — от 70, без провала',
    measure: (r) => `лояльность ${r.loyalty}, безопасность ${r.safety}`,
    test: (r) => r.loyalty >= 70 && r.safety >= 70 && r.outcome !== 'fail',
  },
]

export interface DailyTask {
  day: string
  category: { code: string; title: string }
  goal: Goal
  /** the run we suggest for it; any run of the direction counts */
  scenario: CatalogItem | null
  why: string
}

// --- days -----------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0')
/** The local calendar day, «2026-09-27». */
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const parseDay = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
/** Days since the epoch for the local date: the task rotation counts in these. */
const dayNumber = (d: Date) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000)

/** FNV-1a: a small stable hash, so the same person gets the same task on every device. */
export function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// --- the task -------------------------------------------------------------------------

const playable = (catalog: Catalog) => catalog.items.filter((i) => !i.locked && i.kind === 'training')

/**
 * The task for a date. Directions go round in a personal order, so none repeats until all have
 * been; the condition goes round too, so the same direction comes back with a new angle.
 */
export function taskFor(date: Date, userId: number, catalog: Catalog): DailyTask | null {
  const pool = playable(catalog)
  const cats = catalog.categories.filter((c) => pool.some((i) => i.category === c.code))
  if (!cats.length) return null
  const n = dayNumber(date)
  const order = [...cats].sort((a, b) => hash(`${userId}:${a.code}`) - hash(`${userId}:${b.code}`))
  const category = order[n % order.length]
  const goal = GOALS[(n + (hash(`goal:${userId}`) % GOALS.length)) % GOALS.length]
  const day = dayKey(date)

  // suggest what reinforces most: a run that went wrong before, then one already passed, then a new one
  const rank = (i: CatalogItem) => (i.finishes > 0 && i.best_outcome !== 'success' ? 0 : i.finishes > 0 ? 1 : 2)
  const candidates = pool
    .filter((i) => i.category === category.code)
    .sort((a, b) => rank(a) - rank(b) || hash(`${day}:${a.id}`) - hash(`${day}:${b.id}`))
  const scenario = candidates[0] ?? null
  const why = !scenario
    ? ''
    : rank(scenario) === 0
      ? 'В прошлый раз вышло не идеально — закрепим'
      : rank(scenario) === 1
        ? 'Вы его уже проходили — пройдите под новым углом'
        : 'Новый для вас рейс'
  return { day, category: { code: category.code, title: category.title }, goal, scenario, why }
}

/** Did this run do the day's task? */
export function fulfils(task: DailyTask, run: RunHistoryItem): boolean {
  return !!run.finished_at && dayKey(new Date(run.finished_at)) === task.day && run.scenario.category === task.category.code && task.goal.test(run)
}

// --- the journal: series, week, tokens ------------------------------------------------

export interface WeekDay {
  day: string
  date: Date
  done: boolean
  today: boolean
  future: boolean
}

export interface Journal {
  today: DailyTask | null
  /** the run that did today's task */
  doneBy: RunHistoryItem | null
  /** today's runs of the direction that fell short, newest first */
  tries: RunHistoryItem[]
  /** days in a row, up to today (or up to yesterday while today is still open) */
  streak: number
  best: number
  total: number
  week: WeekDay[]
  /** every day with the task done, oldest first */
  days: string[]
}

const STORE = (userId: number) => `m400-daily-${userId}`

/**
 * Days already counted, kept per browser as well: the history the API returns is the latest 50
 * runs, so older days would otherwise drop out of the best series and the total.
 */
function readDays(userId: number): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORE(userId)) ?? '[]')
    return Array.isArray(v) ? v.filter((d) => typeof d === 'string') : []
  } catch {
    return []
  }
}

function writeDays(userId: number, days: string[]) {
  try {
    localStorage.setItem(STORE(userId), JSON.stringify(days.slice(-400)))
  } catch {
    /* storage blocked: the history alone still gives the series */
  }
}

export function journal(userId: number, catalog: Catalog, runs: RunHistoryItem[], now = new Date()): Journal {
  const todayKey = dayKey(now)
  const byDay = new Map<string, RunHistoryItem[]>()
  for (const r of runs) {
    if (!r.finished_at) continue
    const k = dayKey(new Date(r.finished_at))
    byDay.set(k, [...(byDay.get(k) ?? []), r])
  }

  const done = new Set(readDays(userId).filter((d) => d <= todayKey))
  for (const [k, list] of byDay) {
    const task = taskFor(parseDay(k), userId, catalog)
    if (task && list.some((r) => fulfils(task, r))) done.add(k)
  }
  const days = [...done].sort()
  writeDays(userId, days)

  const today = taskFor(now, userId, catalog)
  const todayRuns = byDay.get(todayKey) ?? []
  const doneBy = today ? (todayRuns.find((r) => fulfils(today, r)) ?? null) : null
  const tries = today && !doneBy ? todayRuns.filter((r) => r.scenario.category === today.category.code) : []

  let streak = 0
  for (let d = done.has(todayKey) ? now : addDays(now, -1); done.has(dayKey(d)); d = addDays(d, -1)) streak++

  let best = 0
  let run = 0
  let prev: Date | null = null
  for (const k of days) {
    const d = parseDay(k)
    run = prev && dayKey(addDays(prev, 1)) === k ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }

  // Monday to Sunday of this week
  const monday = addDays(now, -((now.getDay() + 6) % 7))
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i)
    const k = dayKey(date)
    return { day: k, date, done: done.has(k), today: k === todayKey, future: k > todayKey }
  })

  return { today, doneBy, tries, streak, best: Math.max(best, streak), total: days.length, week, days }
}

// --- tokens: what the series earns ----------------------------------------------------

export type Metal = 'bronze' | 'silver' | 'gold' | 'platinum'

export interface Token {
  code: string
  title: string
  text: string
  emoji: string
  metal: Metal
  /** what `need` counts: days in a row or tasks done */
  unit: 'days' | 'tasks'
  /** progress towards it, 0..need */
  have: (j: Journal) => number
  need: number
}

export const TOKENS: Token[] = [
  { code: 'first', title: 'Первый компостер', text: 'Выполнить задание дня', emoji: '🎫', metal: 'bronze', need: 1, unit: 'tasks', have: (j) => j.total },
  { code: 'three', title: 'Три станции', text: 'Серия 3 дня подряд', emoji: '🚉', metal: 'bronze', need: 3, unit: 'days', have: (j) => j.best },
  { code: 'week', title: 'Неделя в пути', text: 'Серия 7 дней подряд', emoji: '🗓️', metal: 'silver', need: 7, unit: 'days', have: (j) => j.best },
  { code: 'ten', title: 'Десять билетов', text: '10 заданий дня за всё время', emoji: '🎟️', metal: 'silver', need: 10, unit: 'tasks', have: (j) => j.total },
  { code: 'far', title: 'Дальний рейс', text: 'Серия 14 дней подряд', emoji: '🛤️', metal: 'gold', need: 14, unit: 'days', have: (j) => j.best },
  { code: 'legend', title: 'Легенда расписания', text: 'Серия 30 дней подряд', emoji: '🏅', metal: 'platinum', need: 30, unit: 'days', have: (j) => j.best },
]

export const tokenEarned = (t: Token, j: Journal) => t.have(j) >= t.need

/** The next token a series or a total is working towards. */
export const nextToken = (j: Journal) => TOKENS.find((t) => !tokenEarned(t, j)) ?? null

/** Time left until the task changes, «5 ч 12 мин». */
export function untilTomorrow(now = new Date()): string {
  const left = Math.max(0, addDays(now, 1).getTime() - now.getTime())
  const h = Math.floor(left / 3_600_000)
  const m = Math.floor((left % 3_600_000) / 60_000)
  return h ? `${h} ч ${m} мин` : `${m} мин`
}

// --- warm-up: a card from your own past decisions -------------------------------------

export const recallSeed = (userId: number, day: string) => hash(`recall:${userId}:${day}`)
export const pick = <T,>(list: T[], seed: number): T => list[seed % list.length]
