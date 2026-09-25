import type { LevelInfo } from '@/api/types'
import { points } from './plural'

/**
 * «Маршрут»: levels 1..8 are stations of the Moscow — St Petersburg line.
 * `km` is the approximate distance from Leningradsky station, used to space the ticks.
 */
export interface Station {
  name: string
  /** Genitive, for «до …». */
  to: string
  km: number
}

export const STATIONS: Station[] = [
  { name: 'Москва', to: 'Москвы', km: 0 },
  { name: 'Зеленоград', to: 'Зеленограда', km: 36 },
  { name: 'Клин', to: 'Клина', km: 90 },
  { name: 'Тверь', to: 'Твери', km: 167 },
  { name: 'Вышний Волочёк', to: 'Вышнего Волочка', km: 287 },
  { name: 'Бологое', to: 'Бологого', km: 331 },
  { name: 'Малая Вишера', to: 'Малой Вишеры', km: 488 },
  { name: 'Санкт-Петербург', to: 'Санкт-Петербурга', km: 650 },
]

export const ROUTE_KM = STATIONS[STATIONS.length - 1].km

/** Station for a 1-based level (clamped to the line). */
export function stationFor(level: number): Station {
  const i = Math.min(STATIONS.length, Math.max(1, Math.round(level))) - 1
  return STATIONS[i]
}

export interface RoutePosition {
  index: number // 0-based current station
  station: Station
  next: Station | null
  /** Train position along the line, 0..1 (by km). */
  share: number
  /** Station tick positions, 0..1. */
  ticks: number[]
  arrived: boolean
}

export function routePosition(level: number, progress: number): RoutePosition {
  const index = Math.min(STATIONS.length, Math.max(1, Math.round(level))) - 1
  const station = STATIONS[index]
  const next = STATIONS[index + 1] ?? null
  const p = Math.max(0, Math.min(1, progress))
  const km = next ? station.km + (next.km - station.km) * p : station.km
  return {
    index,
    station,
    next,
    share: km / ROUTE_KM,
    ticks: STATIONS.map((s) => s.km / ROUTE_KM),
    arrived: !next,
  }
}

/** «Уровень 3 из 8, до Вышнего Волочка 148 очков» */
export function routeSentence(info: Pick<LevelInfo, 'level' | 'points' | 'next_threshold'>): string {
  const pos = routePosition(info.level, 0)
  const head = `Уровень ${pos.index + 1} из ${STATIONS.length}`
  if (!pos.next || info.next_threshold === null) return `${head}, вы прибыли в Санкт-Петербург`
  return `${head}, до ${pos.next.to} ${points(Math.max(0, info.next_threshold - info.points))}`
}
