import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type MascotMood = 'happy' | 'thinking' | 'wink' | 'alarm' | 'laugh' | 'proud' | 'serious'
/** What Вова has in his right hand. */
export type MascotHolding = 'wrench' | 'finger' | 'thumb' | 'radio' | 'stopwatch' | 'firstaid' | 'clipboard'
/** A little sign over his head that bobs gently. */
export type MascotEffect = 'none' | 'bulb' | 'exclaim' | 'question' | 'sparkles' | 'snow' | 'sweat'

const INK = '#2b1a10'
const SKIN = '#f7cda6'
const SKIN_SHADE = '#e9a57c'
const UNIFORM = '#1C2430'
const STEEL = '#A7B0BA'

/** Faces: eyes (with `blink` if they are open ones) and the mouth. */
function face(mood: MascotMood): { eyes: ReactNode; blink: boolean; mouth: ReactNode } {
  const arc = (x: number, w = 2.6) => <path d={`M${x} 58 q4 -5 8 0`} stroke={INK} strokeWidth={w} fill="none" strokeLinecap="round" />
  const dot = (x: number) => <ellipse cx={x} cy="57" rx="2.8" ry="3.4" fill={INK} />
  const smile = <path d="M52 78 q8 8 16 0" stroke="#8a2b22" strokeWidth="2.6" fill="#fff" strokeLinecap="round" />
  switch (mood) {
    case 'wink':
      return { eyes: <>{dot(51)}{arc(65)}</>, blink: false, mouth: smile }
    case 'alarm':
      return {
        eyes: (
          <>
            <circle cx="51" cy="57" r="4" fill="#fff" stroke={INK} strokeWidth="1.5" />
            <circle cx="69" cy="57" r="4" fill="#fff" stroke={INK} strokeWidth="1.5" />
            <circle cx="51" cy="57" r="1.8" fill={INK} />
            <circle cx="69" cy="57" r="1.8" fill={INK} />
          </>
        ),
        blink: true,
        mouth: <ellipse cx="60" cy="80" rx="4" ry="4.5" fill="#8a2b22" />,
      }
    case 'thinking':
      return {
        eyes: <>{dot(51)}{dot(69)}</>,
        blink: true,
        mouth: <path d="M55 80 q5 1 10 -1" stroke="#8a2b22" strokeWidth="2.4" fill="none" strokeLinecap="round" />,
      }
    case 'laugh':
      return {
        eyes: <>{arc(46.5, 3)}{arc(65.5, 3)}</>,
        blink: false,
        mouth: (
          <>
            <path d="M50 76 Q60 91 70 76 Z" fill="#8a2b22" />
            <path d="M52.5 76.6 H67.5 L66.4 79.4 H53.6 Z" fill="#fff" />
            <path d="M55.5 85 q4.5 -3.4 9 0 q-4.5 2.4 -9 0 Z" fill="#e0706a" />
          </>
        ),
      }
    case 'proud':
      return {
        // relaxed, half-lidded eyes and a sideways smirk
        eyes: (
          <>
            <path d="M47 57 q4 2.6 8 0" stroke={INK} strokeWidth="2.8" fill="none" strokeLinecap="round" />
            <path d="M65 57 q4 2.6 8 0" stroke={INK} strokeWidth="2.8" fill="none" strokeLinecap="round" />
          </>
        ),
        blink: false,
        mouth: <path d="M53 79 q8 4.5 14 -3" stroke="#8a2b22" strokeWidth="2.6" fill="none" strokeLinecap="round" />,
      }
    case 'serious':
      return {
        eyes: (
          <>
            <ellipse cx="51" cy="57.5" rx="2.6" ry="3" fill={INK} />
            <ellipse cx="69" cy="57.5" rx="2.6" ry="3" fill={INK} />
            <path d="M46.5 53.6 l8.5 1.8 M73.5 53.6 l-8.5 1.8" stroke="#7a4a2a" strokeWidth="2.4" strokeLinecap="round" />
          </>
        ),
        blink: true,
        mouth: <path d="M54 80.5 h12" stroke="#8a2b22" strokeWidth="2.6" strokeLinecap="round" />,
      }
    default:
      return { eyes: <>{arc(47)}{arc(65)}</>, blink: false, mouth: smile }
  }
}

/** The right arm raised from the shoulder, for things held up high. */
const raisedArm = (toX: number, toY: number) => <path d={`M88 110 L${toX} ${toY}`} stroke={UNIFORM} strokeWidth="11" strokeLinecap="round" />

function hand(holding: MascotHolding, id: string): ReactNode {
  switch (holding) {
    case 'finger': // «внимание!»
      return (
        <>
          {raisedArm(97, 88)}
          <rect x="94.6" y="67" width="5" height="17" rx="2.5" fill={SKIN} />
          <circle cx="97" cy="86" r="7" fill={SKIN} />
          <path d="M91.5 85 q5.5 2 11 0" stroke={SKIN_SHADE} strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </>
      )
    case 'thumb': // «класс!»
      return (
        <>
          {raisedArm(97, 90)}
          <rect x="97.2" y="70" width="5" height="15" rx="2.5" fill={SKIN} transform="rotate(12 99.7 84)" />
          <circle cx="97" cy="87" r="7.5" fill={SKIN} />
          <path d="M91 86 h11 M91 89.6 h11" stroke={SKIN_SHADE} strokeWidth="1.3" strokeLinecap="round" />
        </>
      )
    case 'radio': // служебная связь
      return (
        <>
          {raisedArm(95, 94)}
          {/* a light rim, so the dark radio still reads on the dark theme */}
          <rect x="99" y="54" width="2.4" height="13" rx="1.2" fill="#2B3646" stroke="#7D8AA0" strokeWidth=".8" />
          <rect x="88" y="64" width="15" height="26" rx="3.5" fill="#2B3646" stroke="#7D8AA0" strokeWidth="1" />
          <rect x="90.5" y="72.5" width="10" height="9" rx="1.5" fill={UNIFORM} />
          <path d="M92.3 75.5 h6.4 M92.3 78.5 h6.4" stroke="#56657B" strokeWidth="1" strokeLinecap="round" />
          <circle cx="92.6" cy="68.2" r="1.5" fill="#E21A1A" />
          <circle cx="95.5" cy="91" r="6.5" fill={SKIN} />
        </>
      )
    case 'stopwatch':
      return (
        <>
          <rect x="95" y="63.5" width="4" height="3.4" rx="1" fill="#E21A1A" />
          <rect x="95.8" y="66.5" width="2.4" height="3" fill={STEEL} />
          <circle cx="97" cy="80" r="11" fill="#EEF1F6" stroke={STEEL} strokeWidth="2.2" />
          <path d="M97 80 V72.6" stroke={UNIFORM} strokeWidth="1.8" strokeLinecap="round" />
          <path d="M97 80 L102.2 83" stroke="#E21A1A" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="97" cy="80" r="1.5" fill={UNIFORM} />
          <circle cx="93" cy="97" r="7" fill={SKIN} />
        </>
      )
    case 'firstaid':
      return (
        <>
          <rect x="92" y="82" width="8" height="5" rx="1.8" fill="none" stroke={STEEL} strokeWidth="2" />
          <rect x="83" y="86" width="26" height="19" rx="3.5" fill="#fff" stroke="#D6DBE1" strokeWidth="1.5" />
          <rect x="94" y="89.5" width="4" height="12" rx="1" fill="#E21A1A" />
          <rect x="90" y="93.5" width="12" height="4" rx="1" fill="#E21A1A" />
          <circle cx="86" cy="104" r="6.5" fill={SKIN} />
        </>
      )
    case 'clipboard':
      return (
        <>
          <g transform="rotate(-8 96 90)">
            <rect x="85" y="74" width="22" height="29" rx="2.5" fill="#9A7440" />
            <rect x="87.5" y="78" width="17" height="22" rx="1" fill="#fff" />
            <rect x="91.5" y="72" width="9" height="5" rx="1.5" fill={STEEL} />
            <path d="M90 83 h11 M90 87 h11 M90 91 h8" stroke={STEEL} strokeWidth="1.3" strokeLinecap="round" />
            <path d="M89.5 95.3 l1.8 1.8 l3.4 -3.6" stroke="#13854E" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <circle cx="93" cy="101" r="6.5" fill={SKIN} />
        </>
      )
    default: // the wrench
      return (
        <>
          <g transform="translate(96 86) rotate(28)">
            <g mask={`url(#jaw-${id})`}>
              <circle cx="0" cy="-10" r="9" fill={STEEL} />
            </g>
            <rect x="-3.5" y="-3" width="7" height="30" rx="3.5" fill={STEEL} />
            <rect x="-1.2" y="4" width="2.4" height="18" rx="1.2" fill="#7D8792" />
          </g>
          <circle cx="93" cy="97" r="7" fill={SKIN} />
        </>
      )
  }
}

const star = (x: number, y: number, s: number) => `M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s} Z`

function sign(effect: MascotEffect): ReactNode {
  switch (effect) {
    case 'bulb': // an idea
      return (
        <>
          <path d="M104 10.5 a7.6 7.6 0 0 1 4.6 13.6 c-1 .8-1.4 1.8-1.4 3 h-6.4 c0-1.2-.4-2.2-1.4-3 A7.6 7.6 0 0 1 104 10.5 Z" fill="#FFD34D" />
          <rect x="100.8" y="27.8" width="6.4" height="3.2" rx="1" fill={STEEL} />
          <path d="M104 3.5 v3 M94 8 l2 2 M114 8 l-2 2 M91.5 17.8 h3 M116.5 17.8 h-3" stroke="#FFD34D" strokeWidth="1.7" strokeLinecap="round" />
        </>
      )
    case 'exclaim':
      return (
        <>
          <circle cx="104" cy="19" r="9" fill="#E21A1A" />
          <rect x="102.6" y="12.4" width="2.8" height="8.6" rx="1.4" fill="#fff" />
          <circle cx="104" cy="24.6" r="1.6" fill="#fff" />
        </>
      )
    case 'question':
      return (
        <>
          <circle cx="104" cy="19" r="9" fill="#3763A0" />
          <path d="M100.6 16.4 a3.5 3.5 0 1 1 5.4 2.9 c-1.2 .8-2 1.5-2 3" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <circle cx="104" cy="25.4" r="1.5" fill="#fff" />
        </>
      )
    case 'sparkles':
      return (
        <>
          <path d={star(104, 15, 7)} fill="#F2C94C" />
          <path d={star(113, 28, 4)} fill="#F2C94C" />
          <path d={star(95, 27, 2.6)} fill="#F2C94C" opacity=".8" />
        </>
      )
    case 'snow': // the air conditioner
      return (
        <g stroke="#7FD6E6" strokeWidth="2" strokeLinecap="round">
          <path d="M104 10 v18 M96.2 14.5 l15.6 9 M96.2 23.5 l15.6 -9" />
          <path d="M101.6 11.8 l2.4 2 l2.4 -2 M101.6 26.2 l2.4 -2 l2.4 2" strokeWidth="1.5" fill="none" />
        </g>
      )
    case 'sweat': // a drop on the temple
      return (
        <>
          <path d="M40 56.5 q3.2 4.6 3.2 6.8 a3.2 3.2 0 0 1 -6.4 0 q0 -2.2 3.2 -6.8 Z" fill="#8FD0FF" />
          <circle cx="38.9" cy="62.6" r=".9" fill="#fff" />
        </>
      )
    default:
      return null
  }
}

/**
 * «Вова-механик» — the friendly train electromechanic mascot. `mood` sets the face, `holding` what's in his
 * right hand (a wrench by default), `effect` a sign over his head. He blinks now and then when his eyes are open.
 */
export function Mascot({
  className,
  mood = 'happy',
  holding = 'wrench',
  effect = 'none',
}: {
  className?: string
  mood?: MascotMood
  holding?: MascotHolding
  effect?: MascotEffect
}) {
  const id = useId().replace(/:/g, '')
  const { eyes, blink, mouth } = face(mood)
  const fx = sign(effect)

  return (
    <svg viewBox="0 0 120 120" className={cn('select-none', className)} role="img" aria-label="Вова-механик">
      <defs>
        <mask id={`jaw-${id}`}>
          <rect x="-20" y="-30" width="40" height="80" fill="#fff" />
          <rect x="-4" y="-18" width="8" height="12" fill="#000" />
        </mask>
      </defs>
      {/* body */}
      <path d="M20 120 C22 98 38 90 60 90 C82 90 98 98 100 120 Z" fill={UNIFORM} />
      <path d="M48 90 L60 104 L72 90 Z" fill="#FFFFFF" />
      <path d="M56 97 L60 104 L64 97 L60 94 Z" fill="#E21A1A" />
      <rect x="36" y="104" width="10" height="12" rx="2" fill={STEEL} />
      {/* ears */}
      <circle cx="32" cy="62" r="6" fill="#efb88c" />
      <circle cx="88" cy="62" r="6" fill="#efb88c" />
      {/* head */}
      <circle cx="60" cy="62" r="28" fill={SKIN} />
      {/* cheeks */}
      <circle cx="43" cy="68" r="4.5" fill="#f59f93" opacity=".55" />
      <circle cx="77" cy="68" r="4.5" fill="#f59f93" opacity=".55" />
      <g className={blink ? 'mascot-blink' : undefined}>{eyes}</g>
      {/* nose */}
      <ellipse cx="60" cy="65" rx="4.2" ry="3.6" fill={SKIN_SHADE} />
      {mouth}
      {/* moustache */}
      <path d="M41 73 C46 66 55 67 60 71 C65 67 74 66 79 73 C73 77 66 76 60 73.5 C54 76 47 77 41 73 Z" fill="#7a4a2a" />
      {/* cap: pushed to one side when he's pleased with himself */}
      <g transform={mood === 'proud' ? 'rotate(-7 60 46)' : undefined}>
        <path d="M31 52 C31 30 45 22 60 22 C75 22 89 30 89 52 Z" fill="#2B3646" />
        <path d="M31 52 C45 47 75 47 89 52 L89 49 C75 44 45 44 31 49 Z" fill="#E21A1A" />
        <path d="M27 54 C45 47 80 47 98 56 C96 60 92 60 88 58 C74 53 46 53 30 58 C27 58 26 56 27 54 Z" fill={UNIFORM} />
        <circle cx="60" cy="36" r="6.5" fill="#fff" />
        <path d="M57 36.5 L61 31 L60.2 35.4 L63 35.4 L59 41 L59.8 36.5 Z" fill="#E21A1A" />
      </g>
      {hand(holding, id)}
      {fx && <g className="mascot-fx">{fx}</g>}
    </svg>
  )
}
