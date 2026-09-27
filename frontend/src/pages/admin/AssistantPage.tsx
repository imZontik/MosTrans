import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Send, Sparkles } from 'lucide-react'
import { api } from '@/api/client'
import type { AssistantResponse, AssistantTable } from '@/api/types'
import { useAuth } from '@/auth/AuthContext'
import { Avatar } from '@/components/Avatar'
import { ProviderBadge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Mascot } from '@/components/Mascot'
import { cn } from '@/lib/cn'
import { fmtRelative } from '@/lib/format'
import { Trend } from './EmployeesPage'

const SUGGESTIONS = [
  'Покажи всех проводников, у кого упал рейтинг безопасности за месяц',
  'Кто лидирует на этой неделе?',
  'Кто давно не тренировался?',
  'Какие ошибки самые частые?',
  'Сделай сводку по обучению',
]

interface Message {
  id: number
  role: 'user' | 'assistant'
  text: string
  data?: AssistantResponse
  error?: boolean
}

const ISO = /^\d{4}-\d{2}-\d{2}T/

export default function AssistantPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy])

  const ask = async (text: string) => {
    const q = text.trim()
    if (q.length < 2 || busy) return
    setInput('')
    setMessages((m) => [...m, { id: Date.now(), role: 'user', text: q }])
    setBusy(true)
    try {
      const data = await api.admin.assistant(q)
      setMessages((m) => [...m, { id: Date.now() + 1, role: 'assistant', text: data.answer, data }])
    } catch (e) {
      setMessages((m) => [
        ...m,
        { id: Date.now() + 1, role: 'assistant', text: e instanceof Error ? e.message : 'Ассистент недоступен', error: true },
      ])
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    ask(input)
  }

  return (
    <div className="flex min-h-[calc(100dvh-172px-env(safe-area-inset-bottom))] flex-col lg:min-h-[calc(100vh-4rem)]">
      <div className="mb-4 flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.005em] lg:text-[40px] lg:leading-[1.05]">ИИ-ассистент</h1>
          <p className="mt-1 text-muted">Спросите о команде обычными словами. Ответ строится по текущим данным.</p>
        </div>
      </div>

      <div className="flex-1 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-start gap-3 py-2">
            <Mascot className="h-16 w-16 shrink-0" mood="wink" />
            <div className="pt-1">
              <p className="text-base font-semibold">Задайте вопрос о команде</p>
              <p className="mt-1 max-w-md text-muted">
                Ассистент видит уровни, шкалы безопасности и лояльности, активность и частые ошибки всех сотрудников. Начните с
                готового вопроса.
              </p>
            </div>
          </div>
        )}
        {messages.length === 0 && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  onClick={() => ask(q)}
                  disabled={busy}
                  className="card lift flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left text-[15px] leading-snug disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                  <span className="flex-1">{q}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end gap-2">
              <div className="max-w-[85%] rounded-[20px] rounded-br-md bg-brand-soft px-4 py-3 text-[15px] text-ink ring-1 ring-inset ring-brand/20">{m.text}</div>
              {user && <Avatar name={user.full_name} size="sm" />}
            </div>
          ) : (
            <div key={m.id} className="flex gap-2">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-inverse" aria-hidden>
                <Bot className="h-4 w-4" />
              </div>
              <div className={cn('min-w-0 max-w-full flex-1 rounded-[20px] rounded-bl-md border bg-surface p-4 shadow-card sm:max-w-[90%] dark:bg-surface-2', m.error ? 'border-bad/30' : 'border-line/80')}>
                <p className={cn('whitespace-pre-wrap text-[15px] leading-relaxed', m.error && 'text-bad')}>{m.text}</p>
                {m.data?.table && m.data.table.rows.length > 0 && <ResultTable table={m.data.table} />}
                {m.data && (
                  <div className="mt-3 flex items-center gap-2">
                    <ProviderBadge provider={m.data.provider} />
                    {m.data.table && <span className="text-xs text-muted">{m.data.table.rows.length} строк</span>}
                  </div>
                )}
              </div>
            </div>
          ),
        )}

        {busy && (
          <div className="flex gap-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-inverse" aria-hidden>
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-1 rounded-2xl border border-line bg-surface px-4 py-3">
              {[0, 1, 2].map((i) => (
                <span key={i} className="typing-dot h-2 w-2 rounded-full bg-ink" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      <div className="sticky bottom-[calc(58px+env(safe-area-inset-bottom))] -mx-4 mt-6 bg-bg/85 px-4 pb-3 pt-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:bottom-0 lg:mx-0 lg:px-0 lg:pb-4">
        {messages.length > 0 && (
        <div className="scrollbar-none -mx-4 mb-2 flex gap-2 overflow-x-auto px-4 [mask-image:linear-gradient(90deg,black_calc(100%-32px),transparent)] sm:mx-0 sm:px-0">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              disabled={busy}
              className="chip border-line bg-surface text-ink shadow-card hover:border-ink/40 hover:bg-surface-2 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
        )}
        <form onSubmit={submit} className="flex gap-2">
          <input
            className="input h-12 rounded-2xl"
            placeholder="Спросите о команде"
            value={input}
            maxLength={1000}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="submit" disabled={input.trim().length < 2} loading={busy} className="h-12 w-12 shrink-0 rounded-2xl px-0" aria-label="Спросить">
            {!busy && <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  )
}

function ResultTable({ table }: { table: AssistantTable }) {
  const navigate = useNavigate()
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[480px] text-sm">
        <thead className="bg-ink/[.03]">
          <tr>
            {table.columns.map((c) => (
              <th key={c.key} className="px-3 py-2 text-left text-xs text-muted">
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {table.rows.map((row, i) => {
            const id = typeof row.id === 'number' ? row.id : null
            return (
              <tr
                key={i}
                onClick={id ? () => navigate(`/admin/employees/${id}`) : undefined}
                className={cn(id !== null && 'cursor-pointer hover:bg-surface-2')}
              >
                {table.columns.map((c) => (
                  <td key={c.key} className="px-3 py-2">
                    <Cell k={c.key} value={row[c.key]} />
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Cell({ k, value }: { k: string; value: unknown }) {
  if (value === null || value === undefined || value === '') return <span className="text-muted">—</span>
  if (k === 'safety_trend' && typeof value === 'number') return <Trend value={value} />
  if (typeof value === 'string' && ISO.test(value)) return <span className="text-muted">{fmtRelative(value)}</span>
  if (typeof value === 'number') return <span className="tabular-nums">{Number.isInteger(value) ? value : value.toFixed(1)}</span>
  if (k === 'name') return <span className="font-semibold">{String(value)}</span>
  return <span>{String(value)}</span>
}
