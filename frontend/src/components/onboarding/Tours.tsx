import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { Tour, type Slide } from './Tour'
import {
  ActionsArt,
  AssistantArt,
  DailyArt,
  EventsArt,
  GeneratorArt,
  PulseArt,
  RouteArt,
  RunArt,
  SwitchArt,
  TeamArt,
  VovaArt,
  WelcomeArt,
} from './arts'

export type TourKind = 'employee' | 'lead'

const TOUR_EVENT = 'm400:tour'
const seenKey = (kind: TourKind, userId: number) => `m400-tour-${kind}-${userId}`

/** Opens the tour of this side of the app again (from the profile, the sidebar, «Ещё»). */
export function openTour(kind: TourKind) {
  window.dispatchEvent(new CustomEvent(TOUR_EVENT, { detail: kind }))
}

function seen(kind: TourKind, userId: number) {
  try {
    return localStorage.getItem(seenKey(kind, userId)) === '1'
  } catch {
    return true // storage blocked: don't show the tour on every visit
  }
}

function markSeen(kind: TourKind, userId: number) {
  try {
    localStorage.setItem(seenKey(kind, userId), '1')
  } catch {
    /* ignore */
  }
}

const EMPLOYEE: Slide[] = [
  {
    key: 'welcome',
    eyebrow: 'Добро пожаловать',
    title: 'Тренажёр проводника ВСМ',
    text: 'Здесь вы проходите нештатные ситуации рейса — от спора за место до задымления — и учитесь решать их без риска для пассажиров.',
    points: ['Короткие рейсы, 3–7 минут', 'Ошибаться можно: после рейса всё разберём', 'Удобно с телефона, прямо в смене'],
    art: <WelcomeArt />,
  },
  {
    key: 'run',
    eyebrow: 'Рейсы',
    title: 'Решения на время',
    text: 'Каждый рейс — диалог с развилками. На важные решения даётся 10–30 секунд, иногда нужно ответить своими словами — ответ оценит ИИ-наставник.',
    points: ['Две шкалы: лояльность пассажира и безопасность. Держите обе в зелёной зоне', 'После рейса — разбор: что было верно и почему'],
    art: <RunArt />,
  },
  {
    key: 'route',
    eyebrow: 'Маршрут',
    title: 'Очки ведут в Санкт-Петербург',
    text: 'За каждый рейс начисляются очки компетенций. Уровень — это станция на пути из Москвы в Санкт-Петербург.',
    points: [
      'Сценарии следующей должности дают ×1,5 очков и засчитываются в повышение',
      'Повтор даёт меньше очков: рейтинг любит широту навыков',
    ],
    art: <RouteArt />,
  },
  {
    key: 'daily',
    eyebrow: 'Каждый день',
    title: 'Задание дня и серия',
    text: 'Каждый день — новое направление и новое условие. Выполняйте подряд: растёт серия, открываются жетоны.',
    points: ['Разминка — вопрос из ваших прошлых ошибок', 'Задание обновляется в полночь'],
    art: <DailyArt />,
  },
  {
    key: 'events',
    eyebrow: 'Внезапно',
    title: 'Специвенты и турнир',
    text: 'Экстренная ситуация приходит в любой момент, как звонок, — с голосовым сообщением. Раз в неделю все вместе отвечают на вопросы на время.',
    points: ['Hard-уровень: голосовое на английском', 'Топ-10 турнира получают +100 к рейтингу'],
    art: <EventsArt />,
  },
  {
    key: 'vova',
    eyebrow: 'Вова рядом',
    title: 'Решить самому или позвать Вову?',
    text: 'Вова — поездной электромеханик. Техника — его зона, пассажиры и сервис — ваша. Он же даёт совет дня на главной.',
    points: ['Этот тур всегда можно открыть снова в профиле'],
    art: <VovaArt />,
  },
]

const LEAD: Slide[] = [
  {
    key: 'pulse',
    eyebrow: 'Панель руководителя',
    title: 'Вся команда на одном экране',
    text: 'Смотрите, как обучаются проводники, где ошибаются и кто готов к повышению, и запускайте тренировки сами.',
    points: ['Дашборд: активность, успешность, частые ошибки', 'Отчёт по обучению в Excel — одной кнопкой'],
    art: <PulseArt />,
  },
  {
    key: 'team',
    eyebrow: 'Сотрудники',
    title: 'Карточка каждого проводника',
    text: 'Уровень, шкалы, навыки по направлениям и история рейсов. Сразу видно, кто просел и кому пора расти.',
    points: ['Готов к повышению — переведите на должность выше', 'Поиск и сортировка по любому показателю'],
    art: <TeamArt />,
  },
  {
    key: 'generator',
    eyebrow: 'Сценарии',
    title: 'Новый сценарий за минуту',
    text: 'Опишите ситуацию своими словами — ИИ соберёт черновик с развилками. Поправьте ветки в редакторе и опубликуйте.',
    points: ['Черновик не виден сотрудникам до публикации', 'Сценарий можно пройти самому перед публикацией'],
    art: <GeneratorArt />,
  },
  {
    key: 'actions',
    eyebrow: 'Действия',
    title: 'Специвенты, турниры, рассылки',
    text: 'Запустите экстренную ситуацию всем или выбранным, проведите турнир, напишите срезу — по депо, бригаде или тем, кто давно не тренировался.',
    art: <ActionsArt />,
  },
  {
    key: 'assistant',
    eyebrow: 'ИИ-ассистент',
    title: 'Спросите о команде словами',
    text: 'Ассистент отвечает по данным обучения: кто просел, кто лидирует, в каких ситуациях ошибаются чаще.',
    points: ['Готовые вопросы — одним нажатием'],
    art: <AssistantArt />,
  },
  {
    key: 'switch',
    eyebrow: 'Всё рядом',
    title: 'Панель и обучение — в одно касание',
    text: 'Кнопка «Проводник» в шапке ведёт в приложение сотрудника, «Панель» — обратно. Тур можно открыть снова в меню «Ещё» или в боковом меню.',
    art: <SwitchArt />,
  },
]

/**
 * Shows the tour of its side of the app once per person (a little after the first screen appears),
 * and again whenever `openTour` asks for it.
 */
export function TourHost({ kind }: { kind: TourKind }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!user || seen(kind, user.id)) return
    const t = setTimeout(() => setOpen(true), 500)
    return () => clearTimeout(t)
  }, [kind, user])

  useEffect(() => {
    const onOpen = (e: Event) => {
      if ((e as CustomEvent).detail === kind) setOpen(true)
    }
    window.addEventListener(TOUR_EVENT, onOpen)
    return () => window.removeEventListener(TOUR_EVENT, onOpen)
  }, [kind])

  const close = useCallback(() => {
    if (user) markSeen(kind, user.id)
    setOpen(false)
  }, [kind, user])

  if (!open || !user) return null

  const firstTime = kind === 'employee' && 'stats' in user && (user as { stats?: { runs_finished: number } }).stats?.runs_finished === 0
  const finish =
    kind === 'lead'
      ? {
          label: 'К дашборду',
          onClick: () => (close(), navigate('/admin')),
        }
      : firstTime
        ? {
            label: 'Выбрать первый рейс',
            onClick: () => (close(), navigate('/scenarios')),
          }
        : { label: 'Поехали', onClick: close }

  return (
    <Tour
      slides={kind === 'lead' ? LEAD : EMPLOYEE}
      label={kind === 'lead' ? 'Как устроена панель руководителя' : 'Как устроено приложение'}
      onClose={close}
      finish={finish}
    />
  )
}
