import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  ClipboardList,
  Eye,
  EyeOff,
  Gauge,
  Loader2,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrainFront,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/Button'
import { Logo } from '@/components/Logo'
import { TrainArt } from '@/components/TrainArt'
import { cn } from '@/lib/cn'

const DEMO: { label: string; hint: string; email: string; password: string; icon: LucideIcon }[] = [
  { label: 'Проводник', hint: 'Сотрудник', email: 'demo@m400.ru', password: 'demo123', icon: TrainFront },
  { label: 'Руководитель', hint: 'Дашборд', email: 'lead@m400.ru', password: 'lead123', icon: ClipboardList },
  { label: 'HR', hint: 'Аналитика', email: 'hr@m400.ru', password: 'hr123', icon: BarChart3 },
  { label: 'Админ', hint: 'Контент', email: 'admin@m400.ru', password: 'admin123', icon: Settings2 },
]

const FEATURES: { icon: LucideIcon; text: string }[] = [
  { icon: Gauge, text: 'Нештатные ситуации на 400 км/ч' },
  { icon: Sparkles, text: 'ИИ-наставник проверяет ответы' },
  { icon: Trophy, text: 'Турнир каждую неделю' },
  { icon: ShieldCheck, text: 'Лояльность и безопасность в каждом решении' },
]

/** The train pulls into the scene once; oncoming wind keeps streaming past it. */
function TrainScene({ className, trainClassName }: { className?: string; trainClassName?: string }) {
  return (
    <div className={cn('pointer-events-none relative', className)} aria-hidden>
      <div className={cn('train-arrive relative', trainClassName)}>
        <TrainArt />
        <span className="headlight absolute -right-[7%] top-[30%] h-[34%] w-[22%] rounded-full blur-md" />
      </div>
    </div>
  )
}

export default function LoginPage() {
  const { user, ready, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  if (ready && user) return <Navigate to={user.role === 'employee' ? '/' : '/admin'} replace />

  const doLogin = async (e: string, p: string, key: string) => {
    setError(null)
    setLoading(key)
    try {
      const me = await login(e, p)
      const from = (location.state as { from?: string } | null)?.from
      const staff = me.role === 'lead' || me.role === 'admin'
      navigate(from && from !== '/' ? from : staff ? '/admin' : '/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? `${err.message.replace(/\.$/, '')}. Проверьте почту и пароль.` : 'Не удалось войти. Проверьте почту и пароль.')
    } finally {
      setLoading(null)
    }
  }

  const submit = (ev: FormEvent) => {
    ev.preventDefault()
    doLogin(email, password, 'form')
  }

  return (
    <div className="night-line relative min-h-screen min-h-[100dvh] overflow-x-hidden">
      <div className="relative z-10 mx-auto flex min-h-screen min-h-[100dvh] max-w-6xl flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_440px] lg:grid-rows-[auto_auto] lg:content-center lg:gap-x-16 lg:gap-y-8 lg:px-10 lg:py-12">
        {/* Hero */}
        <div className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-10 sm:pt-10 lg:col-start-1 lg:row-start-1 lg:px-0 lg:pt-0">
          <Logo light subtitle="Академия проводников ВСМ" />
          <h1 className="mt-8 max-w-2xl font-display text-[2.125rem] font-bold leading-[1.02] sm:mt-14 sm:text-[3.25rem] lg:mt-10 lg:text-[3rem] xl:text-[4rem]">
            Тренируйте решения на скорости{' '}
            <span className="whitespace-nowrap">
              <span className="text-brand">400</span> км/ч
            </span>
          </h1>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/70 sm:mt-5 sm:text-lg">
            Игровой тренажёр для проводников высокоскоростной магистрали: конфликты, медицина, безопасность и сервис.
          </p>
          <ul className="mt-7 hidden max-w-xl flex-wrap gap-2 sm:flex">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-3.5 py-2 text-sm text-white/85 ring-1 ring-white/10 backdrop-blur"
              >
                <Icon className="h-4 w-4 text-white/70" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        {/* Train: between the headline and the ticket; on desktop under the headline */}
        <TrainScene className="mt-6 sm:mt-10 lg:col-start-1 lg:row-start-2 lg:mt-0" trainClassName="w-[94%] sm:w-[80%] lg:w-full" />

        {/* Boarding-pass card: bottom sheet on phones, centered ticket on tablets, right column on desktop */}
        <div className="relative mt-auto w-full rounded-t-[28px] bg-surface text-ink shadow-[0_-24px_60px_rgba(0,0,0,.35)] sm:mx-auto sm:mb-12 sm:mt-10 sm:max-w-[520px] sm:rounded-[28px] sm:shadow-[0_30px_80px_rgba(0,0,0,.45)] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:m-0 lg:max-w-none lg:self-center">
          <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
          <div className="px-5 pt-4 sm:px-8 sm:pt-8">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-medium">Москва</span>
              <span className="relative h-px flex-1 bg-line">
                <TrainFront className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 bg-surface px-0.5 text-brand" />
              </span>
              <span className="font-medium">Санкт-Петербург</span>
            </div>

            <h2 className="mt-5 text-[1.75rem] sm:text-[2rem]">Вход в академию</h2>
            <p className="mt-1 text-sm text-muted">Корпоративная почта и пароль</p>

            <form onSubmit={submit} className="mt-5 space-y-3.5" noValidate>
              <div>
                <label className="label" htmlFor="email">
                  Почта
                </label>
                <input
                  id="email"
                  className="input min-h-[48px]"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  placeholder="name@m400.ru"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="password">
                  Пароль
                </label>
                <div className="relative">
                  <input
                    id="password"
                    className="input min-h-[48px] pr-12"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    enterKeyHint="go"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-muted hover:text-ink"
                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              {error && (
                <p className="rounded-xl bg-brand-soft px-3.5 py-2.5 text-sm text-brand-dark" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" size="lg" block loading={loading === 'form'} disabled={!email || !password || !!loading}>
                Войти
              </Button>
            </form>
          </div>

          <div className="ticket-perforation mt-7" aria-hidden />

          <div className="px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 sm:px-8 sm:pb-8">
            <h3 className="font-sans text-sm font-semibold">Демо-вход</h3>
            <p className="mt-0.5 text-sm text-muted">Одна кнопка — и вы внутри под готовой ролью</p>
            <div className="mt-3 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
              {DEMO.map(({ icon: Icon, ...d }) => (
                <button
                  key={d.email}
                  type="button"
                  disabled={!!loading}
                  onClick={() => {
                    setEmail(d.email)
                    setPassword(d.password)
                    doLogin(d.email, d.password, d.email)
                  }}
                  className={cn(
                    'group flex min-h-[56px] items-center gap-2 rounded-2xl border bg-surface px-2.5 py-2 text-left sm:gap-2.5 sm:px-3 transition-colors hover:border-ink disabled:opacity-60',
                    loading === d.email ? 'border-ink' : 'border-line',
                  )}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-bg sm:h-9 sm:w-9 text-ink transition-colors group-hover:bg-ink group-hover:text-white">
                    {loading === d.email ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold leading-tight min-[400px]:text-[15px] sm:text-base lg:text-[15px]">{d.label}</span>
                    <span className="block truncate text-xs text-muted">{loading === d.email ? 'Входим' : d.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="running-stripe pointer-events-none absolute inset-x-0 bottom-0 h-px" aria-hidden />
    </div>
  )
}
