import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Siren, Volume2 } from 'lucide-react'
import { api } from '@/api/client'
import type { EmergencyEvent } from '@/api/types'
import { useAuth } from '@/auth/AuthContext'
import { usePolling } from '@/hooks/usePolling'
import { useSpeech } from '@/hooks/useSpeech'
import { playSiren } from '@/lib/siren'
import { Button } from './Button'

const POLL_MS = 20_000

/** Global "специвент" alarm: polls for sudden emergencies and takes over the screen. */
export function EmergencyOverlay() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [event, setEvent] = useState<EmergencyEvent | null>(null)
  const [needsGesture, setNeedsGesture] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const emergencyRuns = useRef(new Set<string>())
  const { play, stop, speaking } = useSpeech()

  const playMatch = location.pathname.match(/^\/play\/(\d+)/)
  const onEmergencyRun = !!playMatch && emergencyRuns.current.has(playMatch[1])
  const enabled = user?.role === 'employee' && !event && !onEmergencyRun

  usePolling(
    async () => {
      const res = await api.pendingEmergency()
      if (res.event) setEvent(res.event)
    },
    POLL_MS,
    enabled,
  )

  // Siren, then the voice message. Browsers may block both without a user gesture.
  useEffect(() => {
    if (!event) return
    let cancelled = false
    ;(async () => {
      const sirenOk = await playSiren(2)
      await new Promise((r) => setTimeout(r, sirenOk ? 2100 : 300))
      if (cancelled) return
      const voiceOk = event.audio ? await play(event.audio) : true
      if (!cancelled) setNeedsGesture(!sirenOk || !voiceOk)
    })()
    if ('vibrate' in navigator) navigator.vibrate?.([300, 150, 300, 150, 600])
    return () => {
      cancelled = true
    }
  }, [event, play])

  if (!event) return null

  const accept = async () => {
    setAccepting(true)
    setError(null)
    try {
      stop()
      const run = await api.startRun(event.scenario.id)
      emergencyRuns.current.add(String(run.id))
      setEvent(null)
      navigate(`/play/${run.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось начать')
    } finally {
      setAccepting(false)
    }
  }

  const dismiss = () => {
    stop()
    setEvent(null)
  }

  const listen = async () => {
    setNeedsGesture(false)
    const ok = await play(event.audio)
    if (!ok) setNeedsGesture(true)
  }

  return (
    <div
      className="on-red fixed inset-0 z-[100] overflow-y-auto bg-[#E21A1A] text-white"
      role="alertdialog"
      aria-modal
      aria-labelledby="emergency-title"
      aria-describedby="emergency-alert"
    >
      <div className="mx-auto flex min-h-full w-full max-w-lg flex-col px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(40px+env(safe-area-inset-top))]">
        <div className="relative grid h-16 w-16 place-items-center">
          <span className="absolute inset-0 animate-ring rounded-full bg-white/40" aria-hidden />
          <span className="relative grid h-16 w-16 place-items-center rounded-full bg-white text-[#E21A1A] shadow-[0_8px_24px_-8px_rgb(0_0_0/.45)]">
            <Siren className="h-8 w-8" aria-hidden />
          </span>
        </div>

        <p className="mt-6 text-base">{event.source === 'lead' ? 'Вызов от руководителя' : 'Внезапная ситуация в рейсе'}</p>
        <h1 id="emergency-title" className="mt-1 text-3xl font-semibold">
          Экстренная ситуация
        </h1>
        <p className="mt-3 text-base font-medium">
          {event.scenario.cover} {event.scenario.title}
          {event.hard ? '. Сложный уровень' : ''}
        </p>

        <p id="emergency-alert" className="mt-5 border-l-2 border-white pl-3 text-lg leading-snug">
          {event.alert}
        </p>

        {event.audio && (
          <button
            onClick={listen}
            className="mt-5 flex min-h-[48px] items-center gap-2 self-start rounded-xl border border-white/70 px-4 font-medium hover:bg-white/10"
          >
            <Volume2 className="h-5 w-5 shrink-0" aria-hidden />
            <span>{speaking ? 'Воспроизводится голосовое' : needsGesture ? 'Прослушать голосовое' : 'Прослушать ещё раз'}</span>
          </button>
        )}

        {event.message && (
          <div className="mt-5">
            <p className="text-sm">Сообщение руководителя</p>
            <p className="mt-0.5 text-base font-medium">{event.message}</p>
          </div>
        )}

        <div className="mt-auto pt-10">
          {error && (
            <p className="mb-3 rounded-lg bg-white px-3 py-2 text-[#B80F1F]" role="alert">
              {error}. Попробуйте принять вызов ещё раз.
            </p>
          )}
          <Button size="lg" block variant="light" className="text-[#E21A1A]" loading={accepting} onClick={accept}>
            Принять вызов
          </Button>
          <button onClick={dismiss} className="mt-2 min-h-[48px] w-full font-medium underline decoration-white/60 underline-offset-4">
            Отклонить
          </button>
          <p className="mt-2 text-center text-sm">На решения в экстренной ситуации время ограничено.</p>
        </div>
      </div>
    </div>
  )
}
