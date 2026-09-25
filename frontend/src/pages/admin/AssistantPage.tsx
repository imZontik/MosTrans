import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Send } from 'lucide-react'
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
    <div className="flex min-h-[calc(100vh-11rem)] flex-col lg:min-h-[calc(100vh-4rem)]">
      <div className="mb-4 flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold">ИИ-ассистент</h1>
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
                готового вопроса внизу.
              </p>
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end gap-2">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-3 text-[15px] text-white">{m.text}</div>
              {user && <Avatar name={user.full_name} size="sm" />}
            </div>
          ) : (
            <div key={m.id} className="flex gap-2">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-white" aria-hidden>
                <Bot className="h-4 w-4" />
              </div>
              <div className={cn('min-w-0 max-w-full flex-1 rounded-2xl rounded-bl-md border bg-surface p-4 sm:max-w-[90%]', m.error ? 'border-bad/30' : 'border-line')}>
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
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-white" aria-hidden>
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

      <div className="sticky bottom-0 -mx-4 mt-6 bg-bg px-4 pb-4 pt-2 sm:mx-0 sm:px-0">
        <div className="scrollbar-none mb-2 flex gap-2 overflow-x-auto">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              disabled={busy}
              className="chip border-line bg-surface text-ink hover:border-ink disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex gap-2">
          <input
            className="input"
            placeholder="Например: у кого низкая лояльность пассажиров?"
            value={input}
            maxLength={1000}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="submit" disabled={input.trim().length < 2} loading={busy} className="shrink-0 px-4">
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
        <thead className="bg-bg">
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
                className={cn(id !== null && 'cursor-pointer hover:bg-bg')}
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
