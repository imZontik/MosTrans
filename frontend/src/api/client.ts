import type {
  AchievementCatalogItem,
  AnswerAction,
  AnswerResponse,
  AssistantResponse,
  Catalog,
  CurrentTournament,
  DispatchResponse,
  EmergencyEvent,
  EmployeeDetail,
  EmployeeRow,
  GeneratedDraft,
  GenerateRequest,
  JoinResponse,
  Leaderboard,
  LeaderboardScope,
  LeaderboardUnits,
  LoginResponse,
  Me,
  Overview,
  PublicProfile,
  Recommended,
  RunHistoryItem,
  RunView,
  ScenarioBrief,
  ScenarioFull,
  ScenarioGraph,
  ScenarioInput,
  Tournament,
  TournamentAnswerResponse,
  TournamentLeaderboard,
  TournamentWithWinners,
  UserFull,
} from './types'

const TOKEN_KEY = 'm400_token'
export const LOGOUT_EVENT = 'm400:logout'

export const tokenStore = {
  get: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set: (token: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      /* storage unavailable (private mode) */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignore */
    }
  },
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function detailMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail: unknown }).detail
    if (typeof detail === 'string') return detail
    // FastAPI validation errors: [{loc, msg, ...}]
    if (Array.isArray(detail)) {
      return detail
        .map((d) => (d && typeof d === 'object' && 'msg' in d ? String((d as { msg: unknown }).msg) : String(d)))
        .join('; ')
    }
  }
  if (status >= 500) return 'Сервер временно недоступен. Попробуйте ещё раз.'
  return `Ошибка запроса (${status})`
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = tokenStore.get()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Нет соединения с сервером', 0)
  }

  if (response.status === 204) return undefined as T
  const data = parseBody(await response.text())
  if (!response.ok) fail(response.status, data, token)
  return data as T
}

function parseBody(text: string): unknown {
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function fail(status: number, body: unknown, token: string | null): never {
  if (status === 401 && token) {
    tokenStore.clear()
    window.dispatchEvent(new Event(LOGOUT_EVENT))
  }
  throw new ApiError(detailMessage(body, status), status)
}

/** Downloads a file from the API: the token goes in a header, so a plain <a href> would not do. */
async function download(path: string, fallbackName: string): Promise<void> {
  const token = tokenStore.get()
  let response: Response
  try {
    response = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  } catch {
    throw new ApiError('Нет соединения с сервером', 0)
  }
  if (!response.ok) fail(response.status, parseBody(await response.text()), token)

  const name = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '')?.[1] ?? fallbackName
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const get = <T>(path: string) => request<T>('GET', path)
const post = <T>(path: string, body: unknown = {}) => request<T>('POST', path, body)
const patch = <T>(path: string, body: unknown) => request<T>('PATCH', path, body)
const del = <T>(path: string) => request<T>('DELETE', path)

export const api = {
  // auth & profile
  login: (email: string, password: string) => post<LoginResponse>('/auth/login', { email, password }),
  me: () => get<Me>('/me'),
  myRuns: () => get<RunHistoryItem[]>('/me/runs'),
  achievements: () => get<AchievementCatalogItem[]>('/achievements'),
  user: (id: number) => get<PublicProfile>(`/users/${id}`),

  // scenarios & runs
  scenarios: () => get<Catalog>('/scenarios'),
  recommended: () => get<Recommended | null>('/scenarios/recommended'),
  startRun: (scenario_id: number, restart = false) => post<RunView>('/runs', { scenario_id, restart }),
  run: (id: number) => get<RunView>(`/runs/${id}`),
  answer: (id: number, body: { node_id: string; action: AnswerAction; choice_id?: string; text?: string }) =>
    post<AnswerResponse>(`/runs/${id}/answer`, body),
  abandon: (id: number) => post<RunView>(`/runs/${id}/abandon`),

  // leaderboard & tournaments
  leaderboard: (period: 'week' | 'all', scope: LeaderboardScope = 'company', unit?: string) =>
    get<Leaderboard>(
      `/leaderboard?period=${period}&scope=${scope}&limit=100${unit ? `&unit=${encodeURIComponent(unit)}` : ''}`,
    ),
  leaderboardUnits: () => get<LeaderboardUnits>('/leaderboard/units'),
  currentTournament: () => get<CurrentTournament>('/tournaments/current'),
  tournaments: () => get<TournamentWithWinners[]>('/tournaments'),
  joinTournament: (id: number) => post<JoinResponse>(`/tournaments/${id}/join`),
  tournamentAnswer: (id: number, index: number, option: number | null) =>
    post<TournamentAnswerResponse>(`/tournaments/${id}/answer`, { index, option }),
  tournamentLeaderboard: (id: number) => get<TournamentLeaderboard>(`/tournaments/${id}/leaderboard?limit=20`),

  // emergencies
  pendingEmergency: () => get<{ event: EmergencyEvent | null }>('/emergencies/pending'),

  admin: {
    overview: () => get<Overview>('/admin/analytics/overview'),
    employees: (search?: string) =>
      get<EmployeeRow[]>(`/admin/employees${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    employee: (id: number) => get<EmployeeDetail>(`/admin/employees/${id}`),
    updateEmployee: (id: number, body: { position?: string; role?: string; team?: string }) =>
      patch<UserFull>(`/admin/employees/${id}`, body),
    scenarios: () => get<ScenarioFull[]>('/admin/scenarios'),
    scenario: (id: number) => get<ScenarioFull>(`/admin/scenarios/${id}`),
    createScenario: (body: ScenarioInput) => post<ScenarioFull>('/admin/scenarios', body),
    updateScenario: (id: number, body: Partial<ScenarioInput>) => patch<ScenarioFull>(`/admin/scenarios/${id}`, body),
    deleteScenario: (id: number) => del<void>(`/admin/scenarios/${id}`),
    validate: (graph: ScenarioGraph) => post<{ errors: string[] }>('/admin/scenarios/validate', { graph }),
    generate: (body: GenerateRequest) => post<GeneratedDraft>('/admin/scenarios/generate', body),
    tournaments: () => get<TournamentWithWinners[]>('/admin/tournaments'),
    createTournament: (body: { title?: string | null; starts_at: string; duration_min: number }) =>
      post<Tournament>('/admin/tournaments', body),
    startTournament: (id: number, duration_min: number) =>
      post<Tournament>(`/admin/tournaments/${id}/start-now`, { duration_min }),
    finishTournament: (id: number) =>
      post<{ awarded: { user_id: number; place: number; bonus: number }[] }>(`/admin/tournaments/${id}/finish`),
    emergencies: () => get<ScenarioBrief[]>('/admin/emergencies'),
    dispatch: (body: { scenario_id: number; user_ids?: number[] | null; message?: string | null }) =>
      post<DispatchResponse>('/admin/emergencies/dispatch', body),
    assistant: (message: string) => post<AssistantResponse>('/admin/assistant', { message }),
    downloadReport: (days: number) => download(`/admin/reports/training.xlsx?days=${days}`, `m400-training-${days}d.xlsx`),
  },
}
