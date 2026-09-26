// Mirrors of backend response dicts (backend/app/business/services/*.py).
// Datetimes arrive as ISO strings.

export type Role = 'employee' | 'lead' | 'admin'
export type Position = 'conductor' | 'senior_conductor' | 'train_chief'
export type Outcome = 'success' | 'partial' | 'fail'
export type Quality = 'best' | 'ok' | 'bad'
export type RunMode = 'training' | 'qualification' | 'emergency'
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'
export type CategoryCode = 'conflict' | 'medical' | 'safety' | 'technical' | 'service' | 'teamwork'

// --- users ------------------------------------------------------------------

export interface UserBrief {
  id: number
  full_name: string
  position: Position | string
  position_title: string
  team: string
  depot: string
  level: number
  level_title: string
  points: number
}

export interface LevelInfo {
  level: number
  title: string
  points: number
  current_threshold: number
  next_threshold: number | null
  progress: number // 0..1
}

export interface UserFull extends UserBrief {
  email: string
  role: Role
  level_info: LevelInfo
  created_at: string
  last_active_at: string | null
}

export interface Achievement {
  code: string
  title: string
  description: string
  icon: string
  rarity: Rarity | string
  awarded_at?: string | null
}

export interface AchievementCatalogItem extends Achievement {
  unlocked: boolean
}

export interface ProfileStats {
  runs_finished: number
  success_rate: number
  avg_loyalty: number | null
  avg_safety: number | null
  emergencies_handled: number
}

export interface Competency {
  category: CategoryCode | string
  title: string
  icon: string
  mastery: number // 0..1
  runs: number
}

export interface Qualification {
  next_position: Position | string
  next_position_title: string
  passed: number
  total: number
  ready: boolean
}

interface ProfileExtras {
  rank: number | null
  stats: ProfileStats
  competencies: Competency[]
  qualification: Qualification | null
  achievements: Achievement[]
}

export type Me = UserFull & ProfileExtras
export type PublicProfile = UserBrief & ProfileExtras

export interface LoginResponse {
  access_token: string
  token_type: string
  user: UserFull
}

// --- scenarios --------------------------------------------------------------

export interface ScenarioBrief {
  id: number
  slug: string
  title: string
  description: string
  category: CategoryCode | string
  category_title: string
  position: Position | string
  position_title: string
  kind: 'training' | 'emergency'
  difficulty: number
  cover: string
  estimated_minutes: number
  is_published: boolean
  tags: string[]
  /** steps that lead to more than one place */
  forks?: number
  /** endings a player can reach (each outcome of an «auto» ending counts) */
  endings?: number
}

export interface CatalogItem extends ScenarioBrief {
  mode: RunMode | 'locked'
  locked: boolean
  finishes: number
  best_outcome: Outcome | null
  best_points: number
  active_run_id: number | null
}

export interface Catalog {
  items: CatalogItem[]
  positions: { code: string; rank: number; title: string }[]
  categories: { code: string; title: string; icon: string }[]
}

export interface Recommended {
  scenario: ScenarioBrief
  reason: string
}

export interface Character {
  name: string
  role?: string
  avatar?: string
}

// --- runs -------------------------------------------------------------------

export interface Audio {
  text: string
  lang?: string
  src?: string
}

export interface PublicNode {
  id: string
  type: 'scene' | 'choice' | 'input' | 'end'
  speaker: string
  speaker_name: string | null
  speaker_role: string | null
  avatar: string | null
  text: string
  timer: number | null
  audio: Audio | null
  image: string | null
  hint: string | null
  choices?: { id: string; text: string }[]
  placeholder?: string
  deadline?: string
  // end nodes
  title?: string | null
  outcome?: Outcome | null
}

export type Effects = Partial<Record<'loyalty' | 'safety', number>>

export interface Grade {
  score: number
  verdict: string
  provider: string
}

export interface HistoryItem {
  speaker: string
  speaker_name: string | null
  avatar: string | null
  node_id: string
  type: 'scene' | 'choice' | 'input'
  text: string
  answer: string
  quality: Quality | null
  points: number
  effects: Effects
  feedback: string
  timed_out: boolean
  fast: boolean
  grade: Grade | null
}

export interface Reward {
  decision_points: number
  scales_bonus: number
  outcome_bonus: number
  mode_multiplier: number
  repeat_multiplier: number
  total: number
}

export interface DebriefItem {
  node_id: string
  prompt: string
  answer: string
  quality: Quality
  feedback: string
  recommended: string | null
  explanation: string | null
}

export interface RunSummary {
  outcome: Outcome
  title: string | null
  text: string
  reward: Reward
  achievements: Achievement[]
  level_before: number
  level_after: number
  level_title: string
  level_up: boolean
  points_total: number
  stats: { decisions: number; best: number; fast: number; timeouts: number }
  debrief: DebriefItem[]
  /** which ending this run reached and how many of the scenario's endings the player has seen */
  ending?: { key: string; new: boolean; found: number; total: number }
}

export interface RunView {
  id: number
  status: 'active' | 'finished' | 'abandoned'
  mode: RunMode
  outcome: Outcome | null
  loyalty: number
  safety: number
  score: number
  started_at: string
  finished_at: string | null
  server_now: string
  scenario: ScenarioBrief
  node: PublicNode
  history: HistoryItem[]
  summary: RunSummary | null
}

export interface AnswerResult {
  node_id: string
  quality: Quality
  points: number
  effects: Effects
  feedback: string
  timed_out: boolean
  fast: boolean
  grade: Grade | null
}

export interface AnswerResponse {
  result: AnswerResult
  run: RunView
}

export type AnswerAction = 'continue' | 'choose' | 'answer' | 'timeout'

export interface RunHistoryItem {
  id: number
  scenario: ScenarioBrief
  mode: RunMode
  outcome: Outcome | null
  loyalty: number
  safety: number
  points_awarded: number | null
  finished_at: string | null
}

// --- leaderboard ------------------------------------------------------------

export interface LeaderEntry extends UserBrief {
  rank: number | null
  value: number
  is_me: boolean
}

export type LeaderboardScope = 'company' | 'depot' | 'team'

export interface Leaderboard {
  period: 'week' | 'all'
  scope: LeaderboardScope
  /** depot or brigade name; null for the whole company or when the user has none */
  unit: string | null
  entries: LeaderEntry[]
  me: LeaderEntry | null
  participants: number
}

export interface LeaderboardUnits {
  depots: { name: string; members: number }[]
  teams: { name: string; depot: string; members: number }[]
}

// --- tournaments ------------------------------------------------------------

export type TournamentStatus = 'scheduled' | 'live' | 'finished'

export interface Tournament {
  id: number
  title: string
  week: string
  week_number: number
  starts_at: string
  ends_at: string
  status: TournamentStatus
  finalized: boolean
  questions_total: number
  participants: number
  server_now: string
  rewards: { top_n: number; top_bonus: number; winner_extra: number }
}

export interface TournamentWinner extends UserBrief {
  place: number | null
  score: number
}

export interface TournamentWithWinners extends Tournament {
  winners: TournamentWinner[]
}

export interface TournamentEntry {
  score: number
  correct: number
  answered: number
  total: number
  finished: boolean
  place: number | null
}

export interface TournamentQuestion {
  index: number
  total: number
  text: string
  options: string[]
  timer: number
  category: string | null
  deadline: string
  server_now: string
}

export interface CurrentTournament {
  tournament: Tournament | null
  entry: TournamentEntry | null
  question: TournamentQuestion | null
}

export interface JoinResponse {
  entry: TournamentEntry
  question: TournamentQuestion | null
}

export interface TournamentAnswerResponse {
  correct: boolean
  timed_out: boolean
  correct_option: number
  explanation: string
  points: number
  entry: TournamentEntry
  rank: number | null
  question: TournamentQuestion | null
}

export interface TournamentLeaderEntry extends UserBrief {
  rank: number
  score: number
  is_me: boolean
}

export interface TournamentLeaderboard {
  tournament_id: number
  entries: TournamentLeaderEntry[]
  my_rank: number | null
  participants: number
}

// --- emergencies ------------------------------------------------------------

export interface EmergencyEvent {
  scenario: ScenarioBrief
  source: 'lead' | 'random'
  message: string | null
  alert: string
  audio: Audio | null
  hard: boolean
}

// --- admin ------------------------------------------------------------------

export interface Overview {
  generated_at: string
  employees: number
  active_7d: number
  runs_30d: number
  runs_week: number
  success_rate_30d: number
  avg_loyalty_30d: number | null
  avg_safety_30d: number | null
  timeout_rate_30d: number
  emergencies_30d: number
  runs_by_day: { date: string; runs: number; success: number; fail: number }[]
  categories: {
    category: string
    title: string
    icon: string
    runs: number
    success_rate: number
    avg_loyalty: number | null
    avg_safety: number | null
  }[]
  positions: { position: string; title: string; count: number }[]
  top_mistakes: { scenario: string; prompt: string; typical_answer: string; count: number }[]
}

export interface EmployeeRow extends UserBrief {
  email: string
  last_active_at: string | null
  runs: number
  success_rate: number
  avg_loyalty: number | null
  avg_safety: number | null
  safety_30d: number | null
  safety_trend: number | null
  points_week: number
}

export type EmployeeDetail = Me & { history: RunHistoryItem[] }

// Scenario graph (authoring format, see backend/app/business/engine.py)
export interface RouteCondition {
  loyalty_below?: number
  loyalty_at_least?: number
  safety_below?: number
  safety_at_least?: number
  /** «node:choice» picked earlier in the run */
  chose?: string
}

/** Conditional jump checked after the answer; the first one that holds replaces the usual next step. */
export interface GraphRoute {
  if: RouteCondition
  next: string
}

export interface GraphChoice {
  id: string
  text: string
  next: string
  quality?: Quality
  points?: number
  effects?: Effects
  feedback?: string
  tags?: string[]
}

export interface GraphNode {
  type: 'scene' | 'choice' | 'input' | 'end'
  speaker?: string
  text?: string
  next?: string
  timer?: number
  audio?: Audio
  hint?: string
  choices?: GraphChoice[]
  timeout?: { next: string; effects?: Effects; feedback?: string; points?: number }
  // input
  rubric?: string
  ideal?: string
  keywords?: string[]
  max_points?: number
  effects_scale?: Effects
  branches?: { min_score: number; next: string }[]
  placeholder?: string
  // scene | choice | input
  routes?: GraphRoute[]
  lang?: string
  // end
  outcome?: Outcome | 'auto'
  title?: string
  variants?: Partial<Record<Outcome, { title: string; text: string }>>
  [key: string]: unknown
}

export interface ScenarioGraph {
  start: string
  initial?: { loyalty?: number; safety?: number }
  characters?: Record<string, Character>
  nodes: Record<string, GraphNode>
  alert?: string
  alert_audio?: Audio
  tags?: string[]
  lang?: string
  [key: string]: unknown
}

export interface ScenarioFull extends ScenarioBrief {
  graph: ScenarioGraph
  updated_at: string | null
}

export interface ScenarioInput {
  title: string
  description: string
  category: string
  position: string
  kind: 'training' | 'emergency'
  difficulty: number
  cover: string
  estimated_minutes: number
  graph: ScenarioGraph
  is_published: boolean
}

export interface GenerateRequest {
  spec: string
  category: string
  position: string
  difficulty: number
}

export interface GeneratedDraft {
  title: string
  description: string
  cover: string
  graph: ScenarioGraph
  provider: string
  note?: string
  errors: string[]
}

export interface DispatchResponse {
  dispatched: number
  scenario: ScenarioBrief
}

export interface AssistantTable {
  columns: { key: string; title: string }[]
  rows: Record<string, unknown>[]
}

export interface AssistantResponse {
  answer: string
  table?: AssistantTable | null
  provider: string
  intent?: string
}
