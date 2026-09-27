import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/api/client'
import type { RunHistoryItem, RunView, ScenarioBrief } from '@/api/types'
import { useAuth } from '@/auth/AuthContext'
import { dayKey, hash, journal, pick, recallSeed } from '@/lib/daily'
import { useAsync } from './useAsync'

/** The day's task with the series around it, from the catalog and the run history. */
export function useDaily() {
  const { user } = useAuth()
  const data = useAsync(() => Promise.all([api.scenarios(), api.myRuns()]), [user?.id])
  const [catalog, runs] = data.data ?? []
  const j = useMemo(() => (user && catalog && runs ? journal(user.id, catalog, runs) : null), [user, catalog, runs])
  return { loading: data.loading, error: data.error, reload: data.reload, journal: j, runs }
}

/** Re-renders every minute, for «новое задание через…» and for the day turning over at midnight. */
export function useMinute() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

// --- warm-up: one decision from your own runs ------------------------------------------

export interface RecallCard {
  /** quiz: pick the right one of two; flash: recall it, then look */
  mode: 'quiz' | 'flash'
  prompt: string
  /** the scene just before the question, when there was one */
  context: string | null
  correct: string
  /** quiz only: both answers in the day's order */
  options: string[]
  /** what you answered back then */
  yours: string | null
  note: string
  scenario: ScenarioBrief
  runId: number
}

export type RecallAnswer = { picked: number } | { recalled: boolean }

const recallKey = (userId: number, day: string) => `m400-recall-${userId}-${day}`

/**
 * «Разминка»: a decision from a run you already finished. A mistake comes back as a two-way
 * question (the recommended answer against yours); with no mistakes, a right decision comes back as
 * a card to recall. The same card all day; the answer stays for the day.
 */
export function useRecall(runs: RunHistoryItem[] | undefined) {
  const { user } = useAuth()
  const day = dayKey(new Date())
  const [card, setCard] = useState<RecallCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [answer, setAnswerState] = useState<RecallAnswer | null>(null)

  useEffect(() => {
    if (!user || !runs) return
    let cancelled = false
    setLoading(true)
    try {
      const saved = localStorage.getItem(recallKey(user.id, day))
      setAnswerState(saved ? (JSON.parse(saved) as RecallAnswer) : null)
    } catch {
      setAnswerState(null)
    }
    ;(async () => {
      const found = await loadCard(user.id, day, runs).catch(() => null)
      if (!cancelled) {
        setCard(found)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, runs, day])

  const setAnswer = useCallback(
    (a: RecallAnswer) => {
      setAnswerState(a)
      if (!user) return
      try {
        localStorage.setItem(recallKey(user.id, day), JSON.stringify(a))
      } catch {
        /* the answer lives for this visit */
      }
    },
    [user, day],
  )

  return { card, loading, answer, setAnswer }
}

async function loadCard(userId: number, day: string, runs: RunHistoryItem[]): Promise<RecallCard | null> {
  const seed = recallSeed(userId, day)
  // the day's order of runs; the ones that went less than perfectly first, they hold the mistakes
  const order = runs
    .filter((r) => r.finished_at)
    .sort((a, b) => Number(a.outcome === 'success') - Number(b.outcome === 'success') || hash(`${day}:${a.id}`) - hash(`${day}:${b.id}`))
    .slice(0, 6)
  const views = (await Promise.all(order.map((r) => api.run(r.id).catch(() => null)))).filter((v): v is RunView => !!v)

  const quiz: RecallCard[] = []
  const recall: RecallCard[] = []
  const right: RecallCard[] = []
  for (const run of views) {
    const at = new Map(run.history.map((h, i) => [h.node_id, i]))
    const contextOf = (i: number | undefined) => {
      const before = i !== undefined ? run.history[i - 1] : undefined
      return before && before.type === 'scene' ? before.text : null
    }
    for (const d of run.summary?.debrief ?? []) {
      if (!d.recommended || d.recommended === d.answer) continue
      const i = at.get(d.node_id)
      const h = i !== undefined ? run.history[i] : undefined
      const base = { prompt: d.prompt, context: contextOf(i), correct: d.recommended, note: [d.feedback, d.explanation].filter(Boolean).join(' '), scenario: run.scenario, runId: run.id }
      // a real wrong choice makes a two-way question; a timeout or a typed answer, a card to recall
      if (h?.type === 'choice' && !h.timed_out) {
        quiz.push({ ...base, mode: 'quiz', options: seed % 2 ? [d.recommended, d.answer] : [d.answer, d.recommended], yours: d.answer })
      } else {
        recall.push({ ...base, mode: 'flash', options: [], yours: null })
      }
    }
    run.history.forEach((h, i) => {
      if (h.quality === 'best' && h.type === 'choice' && h.answer) {
        right.push({ mode: 'flash', prompt: h.text, context: contextOf(i), correct: h.answer, options: [], yours: null, note: h.feedback, scenario: run.scenario, runId: run.id })
      }
    })
  }
  const pool = quiz.length ? quiz : recall.length ? recall : right
  return pool.length ? pick(pool, seed) : null
}
