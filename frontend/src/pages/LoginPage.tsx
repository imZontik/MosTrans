import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Gauge, ShieldCheck, Sparkles, Trophy } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/Button'
import { Logo } from '@/components/Logo'
import { TrainArt } from '@/components/TrainArt'
import { cn } from '@/lib/cn'

const DEMO = [
  { label: 'Проводник', hint: 'Играет рейсы', email: 'demo@m400.ru', password: 'demo123' },
  { label: 'Руководитель', hint: 'Начальник смены', email: 'lead@m400.ru', password: 'lead123' },
  { label: 'HR', hint: 'Смотрит обучение', email: 'hr@m400.ru', password: 'hr123' },
  { label: 'Админ', hint: 'Правит сценарии', email: 'admin@m400.ru', password: 'admin123' },
]

const FEATURES = [
  { icon: Gauge, text: 'Нештатные ситуации на скорости 400 км/ч' },
  { icon: Sparkles, text: 'ИИ-наставник оценивает ответы' },
  { icon: Trophy, text: 'Еженедельные турниры и рейтинг' },
  { icon: ShieldCheck, text: 'Лояльность и безопасность — в каждом решении' },
]

export default function LoginPage() {
  const { user, ready, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    <div className="min-h-screen lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="login-hero relative flex flex-col overflow-hidden px-6 pb-10 pt-8 text-white sm:px-10 lg:min-h-screen lg:px-14 lg:py-12">
        <Logo light subtitle="Академия проводников ВСМ" />
        <div className="mt-10 max-w-xl lg:mt-auto">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[.2em] text-white/80 ring-1 ring-white/15">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" /> ВСМ · премиум-сервис
          </p>
          <h1 className="mt-5 font-display text-3xl font-bold leading-[1.05] sm:text-4xl xl:text-5xl">
            Тренируйте решения на скорости{' '}
            <span className="whitespace-nowrap">
              <span className="text-brand">400</span> км/ч
            </span>
          </h1>
          <p className="mt-4 max-w-md text-base text-white/70 sm:text-lg">
            Игровой тренажёр для проводников высокоскоростной магистрали: конфликты, медицина, безопасность и сервис
            мирового уровня.
          </p>
        </div>
        <TrainArt className="-mx-6 mt-8 sm:-mx-10 lg:-mx-14 lg:mt-10" />
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:mb-auto">
          {FEATURES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm text-white/80">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/10">
                <Icon className="h-4 w-4 text-white" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex justify-center px-4 py-8 sm:px-10 lg:items-center">
        <div className="w-full max-w-md">
          <h2 className="text-xl font-semibold">Вход</h2>
          <p className="mt-1 text-muted">Корпоративная почта и пароль</p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Почта
              </label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="username"
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
              <input
                id="password"
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="border-l-2 border-brand pl-3" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" block loading={loading === 'form'}>
              Войти
            </Button>
          </form>

          <div className="mt-10">
            <h3 className="font-sans text-base font-semibold">Демо-вход</h3>
            <p className="mt-0.5 text-muted">Войти одной кнопкой под готовой ролью</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {DEMO.map((d) => (
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
                    'flex min-h-[60px] flex-col justify-center rounded-xl border bg-surface px-3.5 py-2 text-left transition-colors hover:border-ink disabled:opacity-60',
                    loading === d.email ? 'border-ink' : 'border-line',
                  )}
                >
                  <span className="font-semibold">{d.label}</span>
                  <span className="text-xs text-muted">{loading === d.email ? 'Входим' : d.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
