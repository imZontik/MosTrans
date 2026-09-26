import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import { TrainArt } from './TrainArt'

// Every 12–30 s the train drops back to a random point along the free track (the track keeps its pace),
// stays there for 2 s and rolls back into place.
const DRIFT_MIN_MS = 12_000
const DRIFT_MAX_MS = 30_000
const BACK_MS = 1600
const HOLD_MS = 2000
const RETURN_MS = 2200
const SMOOTH = 'cubic-bezier(.45,0,.25,1)'
const TRAIN_RIGHT = 28 // right-7
const NAME_GAP = 16 // how close to the station name the train may drop back

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** How far back this time: 30–85% of the free track behind the train, at least 40px, so it's clearly seen. */
function driftDistance(ride: HTMLElement, train: HTMLElement): number {
  const free = ride.clientWidth - train.offsetWidth - TRAIN_RIGHT - NAME_GAP
  if (train.offsetWidth === 0 || free < 24) return 0 // hidden train or no room
  return Math.round(Math.min(free, Math.max(40, free * (0.3 + Math.random() * 0.55))))
}

function drift(train: HTMLElement, dx: number) {
  const total = BACK_MS + HOLD_MS + RETURN_MS
  train.animate(
    [
      { transform: 'translateX(0)', easing: SMOOTH },
      { transform: `translateX(${-dx}px)`, offset: BACK_MS / total },
      { transform: `translateX(${-dx}px)`, offset: (BACK_MS + HOLD_MS) / total, easing: SMOOTH },
      { transform: 'translateX(0)' },
    ],
    { duration: total },
  )
}

/**
 * Home hero: the track runs from the station name to the panel edge and the train rides it.
 * The sleepers and the catenary masts stream past at a steady pace (.ride-track in index.css);
 * now and then the train drifts back and returns. On a track too short for it the train steps
 * aside and only the rails remain.
 */
export function HeroRide({ className }: { className?: string }) {
  const rideRef = useRef<HTMLDivElement>(null)
  const trainRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let timer = 0
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          const ride = rideRef.current
          const train = trainRef.current
          if (ride && train && !reducedMotion()) {
            const dx = driftDistance(ride, train)
            if (dx > 0) drift(train, dx)
          }
          schedule()
        },
        DRIFT_MIN_MS + Math.random() * (DRIFT_MAX_MS - DRIFT_MIN_MS),
      )
    }
    schedule()
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div ref={rideRef} className={cn('ride pointer-events-none relative h-3', className)} aria-hidden>
      {/* the track fades in from the station name */}
      <div className="absolute inset-x-0 -top-[68px] bottom-0 [mask-image:linear-gradient(90deg,transparent,black_56px)]">
        {/* catenary: masts streaming past under a wire, fading out upwards */}
        <div className="ride-track absolute inset-x-0 top-0 h-[68px] bg-[repeating-linear-gradient(90deg,rgb(255_255_255/.09)_0_2px,transparent_2px_160px)] [mask-image:linear-gradient(180deg,transparent,black_60%)]" />
        <div className="absolute inset-x-0 top-[14px] h-px bg-white/[.07]" />
        {/* sleepers between the rails */}
        <div className="ride-track absolute inset-x-0 top-[70px] h-[8px] bg-[repeating-linear-gradient(90deg,rgb(255_255_255/.16)_0_3px,transparent_3px_16px)]" />
        {/* rails */}
        <div className="absolute inset-x-0 top-[68px] h-[3px] rounded-full bg-white/40" />
        <div className="absolute inset-x-0 top-[77px] h-[2px] rounded-full bg-white/15" />
      </div>

      {/* the train, wheels on the upper rail */}
      {/* phones: a shorter train, so there is track behind it to drop back onto */}
      <div ref={trainRef} className="ride-train absolute bottom-[calc(100%-1px)] right-7 w-[62%] sm:w-[min(calc(100%-72px),400px)]">
        <div className="absolute -inset-x-[10%] -inset-y-[40%] -z-10 bg-[radial-gradient(55%_55%_at_65%_50%,rgb(226_26_26/.38),transparent_70%)]" />
        <TrainArt rails={false} />
        <span className="headlight absolute -right-[5%] top-[52%] h-[30%] w-[16%] rounded-full blur-md" />
      </div>
    </div>
  )
}
