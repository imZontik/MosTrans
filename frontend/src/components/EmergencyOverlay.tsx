import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Globe2, Pause, Play, PhoneIncoming, Siren, Timer, UserRound, X } from 'lucide-react'
import { api } from '@/api/client'
import type { EmergencyEvent } from '@/api/types'
import { useAuth } from '@/auth/AuthContext'
import { usePolling } from '@/hooks/usePolling'
import { useSpeech } from '@/hooks/useSpeech'
import { cn } from '@/lib/cn'
import { playSiren } from '@/lib/siren'
import { CoverTile } from './Category'

const POLL_MS = 20_000
// a voice-message waveform: fixed bar heights, animated while the message plays
const WAVE = [30, 55, 80, 45, 95, 60, 35, 70, 100, 50, 75, 40, 85, 55, 30, 65, 90, 45, 60, 35, 75, 50, 40, 25]

/**
 * Global «специвент» alarm: polls for sudden emergencies and takes over the screen like an incoming
 * call. Night background under a pulsing red glow, a hazard stripe running along the top, the siren
 * with rings going out, the voice message as a messenger voice note, and two big answers.
 */
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

  // the page under the alarm stays put
  useEffect(() => {
    if (!event) return
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [event])

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
    if (speaking) {
      stop()
      return
    }
    setNeedsGesture(false)
    const ok = await play(event.audio)
    if (!ok) setNeedsGesture(true)
  }

  const fromLead = event.source === 'lead'

  return (
    <div
      className="emergency fixed inset-0 z-[100] overflow-y-auto text-white"
      role="alertdialog"
      aria-modal
      aria-labelledby="emergency-title"
      aria-describedby="emergency-alert"
    >
      {/* red glow breathing behind everything, and a hazard stripe along the top */}
      <div className="emergency-glow pointer-events-none fixed inset-0" aria-hidden />
      <div className="emergency-stripe pointer-events-none fixed inset-x-0 top-0 h-1.5" aria-hidden />

      <div className="relative mx-auto flex min-h-full w-full max-w-lg flex-col px-5 pt-[calc(36px+env(safe-area-inset-top))] sm:justify-center sm:py-12 [@media(max-height:700px)]:pt-[calc(24px+env(safe-area-inset-top))]">
        {/* incoming: the siren with rings going out */}
        <div className="flex flex-col items-center text-center">
          <div className="relative grid h-28 w-28 place-items-center [@media(max-height:700px)]:h-20 [@media(max-height:700px)]:w-20">
            {[0, 1, 2].map((i) => (
              <span key={i} className="emergency-ring absolute inset-0 rounded-full border-2 border-[#FF4D4D]" style={{ animationDelay: `${i * 0.6}s` }} aria-hidden />
            ))}
            <span className="relative grid h-20 w-20 place-items-center rounded-full [@media(max-height:700px)]:h-14 [@media(max-height:700px)]:w-14 bg-gradient-to-b from-[#FF5A4D] to-[#C8101E] shadow-[0_0_0_6px_rgb(226_26_26/.25),0_18px_40px_-10px_rgb(226_26_26/.8)]">
              <Siren className="emergency-shake h-9 w-9 [@media(max-height:700px)]:h-7 [@media(max-height:700px)]:w-7" aria-hidden />
            </span>
          </div>

          <p className="mt-6 inline-flex items-center gap-2 rounded-full [@media(max-height:700px)]:mt-4 bg-[#E21A1A]/20 px-3 py-1 text-xs font-bold uppercase tracking-[.14em] text-[#FF8A7A] ring-1 ring-inset ring-[#FF4D4D]/40">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inset-0 animate-ping rounded-full bg-[#FF4D4D]" />
              <span className="relative h-2 w-2 rounded-full bg-[#FF4D4D]" />
            </span>
            Экстренная ситуация
          </p>
          <h1 id="emergency-title" className="mt-3 text-[30px] font-bold leading-[1.05] min-[360px]:text-[34px] sm:text-[40px]">
            {event.scenario.title}
          </h1>
          <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-white/65">
            <span className="inline-flex items-center gap-1.5">
              {fromLead ? <UserRound className="h-4 w-4" aria-hidden /> : <PhoneIncoming className="h-4 w-4" aria-hidden />}
              {fromLead ? 'Вызов от руководителя' : 'Внезапно, прямо в рейсе'}
            </span>
            {event.hard && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white ring-1 ring-inset ring-white/20">
                <Globe2 className="h-3.5 w-3.5" aria-hidden />
                Hard · на английском
              </span>
            )}
          </p>
        </div>

        {/* what happened */}
        <div className="mt-7 flex items-start gap-3.5 [@media(max-height:700px)]:mt-5 rounded-2xl bg-white/[.06] p-4 ring-1 ring-inset ring-white/10 backdrop-blur-sm">
          <CoverTile cover={event.scenario.cover} category={event.scenario.category} size="md" className="ring-white/10" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-white/50">{event.scenario.category_title}</p>
            <p id="emergency-alert" className="mt-0.5 text-[17px] font-medium leading-snug">
              {event.alert}
            </p>
          </div>
        </div>

        {/* the voice message, as a messenger voice note */}
        {event.audio && (
          <button
            type="button"
            onClick={listen}
            className="mt-3 flex min-h-[64px] w-full items-center gap-3 rounded-2xl bg-white/[.06] p-3 pr-4 text-left ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[.1]"
            aria-label={speaking ? 'Остановить голосовое' : 'Прослушать голосовое'}
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#C8101E] shadow-[0_6px_16px_-6px_rgb(0_0_0/.5)]">
              {speaking ? <Pause className="h-5 w-5 fill-current" aria-hidden /> : <Play className="ml-0.5 h-5 w-5 fill-current" aria-hidden />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex h-7 items-center gap-[3px]" aria-hidden>
                {WAVE.map((h, i) => (
                  <span
                    key={i}
                    className={cn('w-[3px] flex-1 rounded-full', speaking ? 'wave-bar bg-white' : 'bg-white/45')}
                    style={{ height: `${h}%`, animationDelay: `${(i % 8) * 0.09}s` }}
                  />
                ))}
              </span>
              <span className="mt-1 block text-xs text-white/60">
                {speaking ? 'Воспроизводится…' : needsGesture ? 'Нажмите, чтобы прослушать' : 'Голосовое · прослушать ещё раз'}
              </span>
            </span>
          </button>
        )}

        {event.message && (
          <figure className="mt-3 rounded-2xl border-l-[3px] border-[#FF4D4D] bg-white/[.06] px-4 py-3 ring-1 ring-inset ring-white/10">
            <figcaption className="text-xs font-medium text-white/55">Сообщение руководителя</figcaption>
            <blockquote className="mt-1 text-base font-medium leading-snug">{event.message}</blockquote>
          </figure>
        )}

        <div className="sticky bottom-0 -mx-5 mt-auto bg-gradient-to-t from-[#0a0e1a] from-75% to-transparent px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-10 sm:static sm:mx-0 sm:mt-8 sm:bg-none sm:px-0 sm:pb-0">
          {error && (
            <p className="mb-3 rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#B80F1F]" role="alert">
              {error}. Попробуйте принять вызов ещё раз.
            </p>
          )}
          <p className="mb-3 flex items-center justify-center gap-1.5 text-sm text-white/60 [@media(max-height:700px)]:hidden">
            <Timer className="h-4 w-4" aria-hidden />
            Решения — под таймером
          </p>
          {/* answer like a call: decline on the left, accept on the right, both big */}
          <div className="grid grid-cols-[auto_1fr] gap-3">
            <button
              type="button"
              onClick={dismiss}
              className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-white ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/15"
              aria-label="Отклонить"
              title="Отклонить"
            >
              <X className="h-6 w-6" aria-hidden />
            </button>
            <button
              type="button"
              onClick={accept}
              disabled={accepting}
              className="emergency-accept press relative flex h-14 items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-white text-lg font-bold text-[#C8101E] shadow-[0_14px_36px_-12px_rgb(226_26_26/.9)] transition-transform disabled:opacity-80"
            >
              {accepting ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#C8101E]/30 border-t-[#C8101E]" aria-hidden />
              ) : (
                <PhoneIncoming className="h-5 w-5" aria-hidden />
              )}
              {accepting ? 'Открываем' : 'Принять вызов'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
