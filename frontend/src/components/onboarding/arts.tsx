import type { ReactNode } from 'react'
import { Bot, Check, Flame, Megaphone, Siren, Sparkles, Trophy, Users } from 'lucide-react'
import { cn } from '@/lib/cn'
import { TOKENS } from '@/lib/daily'
import { Avatar } from '../Avatar'
import { TokenDisc } from '../Daily'
import { Mascot } from '../Mascot'
import { SpeedLines } from '../NightPanel'
import { RouteTrack } from '../RouteTrack'
import { TrophyArt } from '../tournament/TrophyArt'

/*
 * Pictures for the tours: small pieces of the real screens, drawn on the night line and floating a
 * little. Everything is sized for a 320px phone first; nothing here is interactive.
 */

const glass = 'rounded-2xl bg-white/[.08] ring-1 ring-inset ring-white/15 backdrop-blur-md'

function Stage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative flex h-full w-full flex-col items-center justify-center px-5 text-white', className)} aria-hidden>
      {/* a warm glow in the middle */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(226_26_26/.28),transparent_62%)]" />
      {children}
    </div>
  )
}

// a phase shift for the `tour-float` bob, so neighbours don't move in step
const float = (delay = 0) => ({ style: { animationDelay: `${delay}s` } })

// --- conductor ------------------------------------------------------------------------------

export function WelcomeArt() {
  return (
    <Stage>
      <SpeedLines rows={[18, 46, 78]} />
      <Mascot mood="happy" holding="thumb" effect="sparkles" className="tour-float h-36 w-36 min-[400px]:h-40 min-[400px]:w-40" />
      <p className={cn(glass, 'mt-1 flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium')}>
        Москва <span className="text-white/50">→</span> Санкт-Петербург
        <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold max-[359px]:hidden">400 км/ч</span>
      </p>
    </Stage>
  )
}

function Bar({ label, value, tone }: { label: string; value: number; tone: 'ok' | 'warn' }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between text-[11px] text-white/70">
        {label}
        <span className="digits text-xs font-semibold text-white">{value}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/15">
        <div
          className={cn('bar-grow h-full rounded-full', tone === 'ok' ? 'bg-[#2FD17F]' : 'bg-[#FFC233]')}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

export function RunArt() {
  return (
    <Stage>
      <div className="w-full max-w-[310px] space-y-2">
        <div className="tour-float flex items-end gap-2" {...float(0)}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 text-base">🧳</span>
          <p className={cn(glass, 'rounded-bl-md px-3 py-2 text-[13px] leading-snug')}>Извините, на моём месте 12А кто-то сидит!</p>
        </div>
        <div className="space-y-1.5 pl-10">
          <p className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[13px] font-medium leading-snug text-[#1C2430] shadow-[0_8px_20px_-10px_rgb(0_0_0/.6)]">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-[#13854E] text-white">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            Вежливо попросить билет
          </p>
          <p className="flex items-center gap-2 rounded-xl bg-white/[.06] px-3 py-2 text-[13px] leading-snug text-white/55 ring-1 ring-inset ring-white/10">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-white/10 text-[11px] font-bold">Б</span>
            Громко при всех выяснить
          </p>
        </div>
        <div className={cn(glass, 'tour-float flex items-center gap-3 px-3 py-2.5')} {...float(0.8)}>
          <Bar label="Пассажир" value={82} tone="ok" />
          <Bar label="Безопасность" value={64} tone="warn" />
          <span className="relative grid h-10 w-10 shrink-0 place-items-center">
            <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
              <circle cx="20" cy="20" r="17" fill="none" stroke="rgb(255 255 255 / .15)" strokeWidth="3.5" />
              <circle
                cx="20"
                cy="20"
                r="17"
                fill="none"
                stroke="#FF5A3D"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray="107"
                strokeDashoffset="45"
              />
            </svg>
            <span className="digits text-xs font-bold">12</span>
          </span>
        </div>
      </div>
    </Stage>
  )
}

export function RouteArt() {
  return (
    <Stage className="justify-center">
      <div className="flex w-full max-w-[360px] items-center justify-between gap-2">
        <p className={cn(glass, 'min-w-0 truncate rounded-full px-3 py-1 text-xs font-medium')}>Уровень 4 · Опытный проводник</p>
        <p className="points-pop digits shrink-0 whitespace-nowrap rounded-full bg-[#2FD17F] px-2.5 py-1 text-sm font-bold text-[#0A101E]">
          +46 очков
        </p>
      </div>
      <RouteTrack level={4} progress={0.62} animate className="mt-6 w-full max-w-[380px]" />
    </Stage>
  )
}

export function DailyArt() {
  const earned = TOKENS.slice(0, 3)
  return (
    <Stage>
      <div className="relative w-full max-w-[290px]">
        <div
          className="tour-float flex w-full overflow-hidden rounded-2xl bg-white text-[#1C2430] shadow-[0_18px_40px_-14px_rgb(0_0_0/.7)]"
          {...float(0)}
        >
          <div className="flex w-[72px] shrink-0 flex-col items-center justify-center bg-gradient-to-br from-[#FF5A3D] to-[#C8101E] py-4 text-white">
            <span className="text-[10px] font-semibold uppercase tracking-[.1em] text-white/80">вс</span>
            <span className="font-display text-[34px] font-bold leading-none">27</span>
            <span className="mt-1 flex items-center gap-0.5 text-xs font-semibold">
              <Flame className="h-3.5 w-3.5 fill-[#FFD166] text-[#FFD166]" /> 4
            </span>
          </div>
          <div className="min-w-0 flex-1 border-l-2 border-dashed border-[#D6DBE1] px-3.5 py-3.5 pr-10">
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#E21A1A]">Задание дня</p>
            <p className="mt-0.5 font-display text-xl font-bold leading-tight">Ноль риска</p>
            <p className="mt-1 text-xs text-[#5B6673]">Безопасность — 90 и выше</p>
          </div>
        </div>
        <span className="stamp stamp-in absolute -right-2 -top-3 grid h-16 w-16 place-items-center rounded-full border-[2.5px] bg-white/90 shadow-[0_6px_14px_-6px_rgb(0_0_0/.6)] border-[#E21A1A] font-display text-[10px] font-bold uppercase tracking-[.06em] text-[#E21A1A] opacity-90">
          Выполнено
        </span>
      </div>
      <div className="tour-float mt-4 flex items-center gap-2.5" {...float(0.7)}>
        {earned.map((t) => (
          <TokenDisc key={t.code} token={t} earned size="sm" />
        ))}
        <span className={cn(glass, 'whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium')}>жетоны за серию</span>
      </div>
    </Stage>
  )
}

export function EventsArt() {
  return (
    <Stage>
      <div className="grid w-full max-w-[330px] grid-cols-2 gap-3">
        <div className={cn(glass, 'tour-float flex flex-col items-center px-3 pb-3.5 pt-4 text-center')} {...float(0)}>
          <span className="relative grid h-16 w-16 place-items-center">
            {[0, 1].map((i) => (
              <span
                key={i}
                className="emergency-ring absolute inset-0 rounded-full border-2 border-[#FF4D4D]"
                style={{ animationDelay: `${i * 0.8}s` }}
              />
            ))}
            <span className="relative grid h-12 w-12 place-items-center rounded-full bg-gradient-to-b from-[#FF5A4D] to-[#C8101E]">
              <Siren className="emergency-shake h-6 w-6" />
            </span>
          </span>
          <p className="mt-3 text-sm font-semibold">Специвент</p>
          <p className="mt-0.5 text-[11px] leading-tight text-white/60">как входящий звонок</p>
        </div>
        <div className={cn(glass, 'tour-float flex flex-col items-center px-3 pb-3.5 pt-4 text-center')} {...float(0.6)}>
          <TrophyArt className="h-16 w-16" />
          <p className="mt-3 text-sm font-semibold">Турнир</p>
          <p className="mt-0.5 text-[11px] leading-tight text-white/60">раз в неделю, на время</p>
        </div>
      </div>
    </Stage>
  )
}

export function VovaArt() {
  return (
    <Stage>
      <div className="flex w-full max-w-[330px] items-end gap-1">
        <Mascot mood="wink" holding="radio" effect="bulb" className="tour-float h-32 w-32 shrink-0" />
        <p className="relative mb-12 rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[13px] leading-snug text-[#1C2430] shadow-[0_12px_28px_-12px_rgb(0_0_0/.7)]">
          Сломалось оборудование — зовите меня. Пролитый кофе — ваша зона!
        </p>
      </div>
      <div className="mt-1 flex gap-2">
        <span className={cn(glass, 'rounded-full px-3 py-1.5 text-xs font-medium')}>Решу сам</span>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#1C2430]">Позову Вову</span>
      </div>
    </Stage>
  )
}

// --- lead -----------------------------------------------------------------------------------

export function PulseArt() {
  const stats = [
    ['Активны', '28', 'из 35'],
    ['Успешность', '72%', '+6'],
    ['Безопасность', '81', '+3'],
  ]
  return (
    <Stage>
      <div className={cn(glass, 'tour-float w-full max-w-[330px] p-4')} {...float(0)}>
        <div className="grid grid-cols-3 gap-2">
          {stats.map(([k, v, d]) => (
            <div key={k} className="min-w-0">
              <p className="truncate text-[11px] text-white/60">{k}</p>
              <p className="digits mt-0.5 text-xl font-bold leading-none">{v}</p>
              <p className="mt-1 text-[11px] text-[#5FD39A]">{d}</p>
            </div>
          ))}
        </div>
        <svg viewBox="0 0 300 70" className="mt-3 h-[70px] w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="tour-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#FF5A3D" stopOpacity=".35" />
              <stop offset="1" stopColor="#FF5A3D" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0 58 L30 50 L60 54 L90 40 L120 44 L150 30 L180 34 L210 22 L240 26 L270 12 L300 16 L300 70 L0 70 Z"
            fill="url(#tour-area)"
          />
          <polyline
            className="spark-draw"
            points="0,58 30,50 60,54 90,40 120,44 150,30 180,34 210,22 240,26 270,12 300,16"
            fill="none"
            stroke="#FF5A3D"
            strokeWidth="2.5"
            strokeLinejoin="round"
            pathLength={1}
          />
        </svg>
      </div>
    </Stage>
  )
}

export function TeamArt() {
  const rows = [
    {
      name: 'Анна Смирнова',
      level: 'Уровень 6',
      chip: 'К повышению',
      tone: 'bg-[#2FD17F] text-[#0A101E]',
    },
    {
      name: 'Олег Петров',
      level: 'Уровень 3',
      chip: 'Безопасность ↓',
      tone: 'bg-[#FFC233] text-[#0A101E]',
    },
    {
      name: 'Мария Козлова',
      level: 'Уровень 4',
      chip: '12 рейсов',
      tone: 'bg-white/15 text-white',
    },
  ]
  return (
    <Stage>
      <ul className={cn(glass, 'tour-float w-full max-w-[330px] divide-y divide-white/10 px-3')} {...float(0)}>
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-2.5 py-2.5">
            <Avatar name={r.name} size="sm" onDark />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{r.name}</p>
              <p className="text-[11px] text-white/55">{r.level}</p>
            </div>
            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold', r.tone)}>{r.chip}</span>
          </li>
        ))}
      </ul>
    </Stage>
  )
}

export function GeneratorArt() {
  return (
    <Stage>
      <p className={cn(glass, 'tour-float flex w-full max-w-[310px] items-start gap-2 px-3 py-2.5 text-[13px] leading-snug')} {...float(0)}>
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#FFD166]" />
        Пассажиру плохо, врача в поезде нет, до станции 40 минут
      </p>
      {/* the draft's branches, left to right: the start, two forks, the endings in their signal colours */}
      <svg viewBox="0 0 250 96" className="mt-3 h-[96px] w-[250px]">
        <g stroke="rgb(255 255 255 / .35)" strokeWidth="2" fill="none" strokeLinecap="round">
          <path d="M22 48 C60 48 60 24 100 24 M22 48 C60 48 60 72 100 72 M100 24 C140 24 140 12 180 12 M100 24 C140 24 140 38 180 38 M100 72 H180 M180 12 H222 M180 38 H222 M180 72 H222" />
        </g>
        {(
          [
            [22, 48, '#FFFFFF'],
            [100, 24, '#FFFFFF'],
            [100, 72, '#FFFFFF'],
            [228, 12, '#2FD17F'],
            [228, 38, '#FFC233'],
            [228, 72, '#FF5A3D'],
          ] as const
        ).map(([x, y, c], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i > 2 ? 8 : 6}
            fill={c}
            stroke="#0A101E"
            strokeWidth="3"
            className="punch"
            style={{ animationDelay: `${0.15 + i * 0.1}s` }}
          />
        ))}
      </svg>
      <p className="mt-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#1C2430]">Черновик готов · 3 финала</p>
    </Stage>
  )
}

export function ActionsArt() {
  const items = [
    {
      icon: Siren,
      title: 'Специвент',
      text: 'всем или выбранным',
      tint: 'from-[#FF5A4D] to-[#C8101E]',
    },
    {
      icon: Trophy,
      title: 'Турнир',
      text: 'старт в один клик',
      tint: 'from-[#F5D06B] to-[#C9961A]',
    },
    {
      icon: Megaphone,
      title: 'Рассылка',
      text: 'по депо и бригадам',
      tint: 'from-[#74A2E8] to-[#3763A0]',
    },
  ]
  return (
    <Stage>
      <ul className="w-full max-w-[310px] space-y-2">
        {items.map(({ icon: Icon, title, text, tint }, i) => (
          <li key={title} className={cn(glass, 'tour-float flex items-center gap-3 px-3 py-2.5')} {...float(i * 0.4)}>
            <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-b', tint)}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-white/60">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </Stage>
  )
}

export function AssistantArt() {
  return (
    <Stage>
      <div className="w-full max-w-[320px] space-y-2">
        <p
          className="tour-float ml-auto w-fit max-w-[88%] rounded-2xl rounded-br-md bg-white px-3.5 py-2 text-[13px] leading-snug text-[#1C2430]"
          {...float(0)}
        >
          Кто хуже всех по безопасности за месяц?
        </p>
        <div className="tour-float flex items-start gap-2" {...float(0.6)}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#FF5A3D] to-[#C8101E]">
            <Bot className="h-4 w-4" />
          </span>
          <div className={cn(glass, 'min-w-0 flex-1 rounded-tl-md px-3 py-2.5')}>
            <p className="text-[13px] text-white/80">Просели двое:</p>
            {[
              ['Олег Петров', '54', '−12'],
              ['Игорь Лебедев', '61', '−8'],
            ].map(([n, v, d]) => (
              <p key={n} className="mt-1.5 flex items-center justify-between gap-2 text-[13px]">
                <span className="truncate font-medium">{n}</span>
                <span className="digits shrink-0">
                  {v} <span className="text-[#FF7A7A]">{d}</span>
                </span>
              </p>
            ))}
          </div>
        </div>
      </div>
    </Stage>
  )
}

export function SwitchArt() {
  return (
    <Stage>
      <div className={cn(glass, 'tour-float flex items-center gap-1 rounded-full p-1')} {...float(0)}>
        <span className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium text-white/70">
          <Users className="h-4 w-4" /> Проводник
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-semibold text-[#1C2430] shadow-[0_6px_16px_-8px_rgb(0_0_0/.6)]">
          <Sparkles className="h-4 w-4 text-[#E21A1A]" /> Панель
        </span>
      </div>
      <Mascot mood="proud" holding="clipboard" className="tour-float mt-3 h-28 w-28" />
    </Stage>
  )
}
