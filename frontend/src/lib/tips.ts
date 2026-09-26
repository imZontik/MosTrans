import type { MascotEffect, MascotHolding, MascotMood } from '@/components/Mascot'

/** Вова's tips, each with how he looks while saying it: his face, what's in his hand, a sign over his head. */
export const TIPS: { text: string; mood: MascotMood; holding?: MascotHolding; effect?: MascotEffect }[] = [
  {
    text: 'Если в вагоне не работает кондиционер — это моя зона! Опишите точно: номер вагона, что именно не так, и с какого времени.',
    mood: 'proud',
    effect: 'snow',
  },
  {
    text: 'Бесхозная сумка? Не трогайте её, отведите людей и доложите начальнику поезда. Геройство тут не нужно.',
    mood: 'alarm',
    holding: 'finger',
    effect: 'exclaim',
  },
  {
    text: 'Конфликт лучше гасить без зрителей: пригласите пассажира в тамбур — ему проще уступить, не теряя лица.',
    mood: 'thinking',
    effect: 'bulb',
  },
  {
    text: 'Пассажир без сознания — первым делом проверьте дыхание. Нашатырь не поможет при остановке сердца.',
    mood: 'serious',
    holding: 'firstaid',
  },
  { text: 'Быстрое верное решение приносит бонус +5 очков. Но точность важнее скорости!', mood: 'happy', holding: 'stopwatch', effect: 'sparkles' },
  {
    text: 'Каждый шаг влияет на две шкалы: лояльность пассажира и безопасность. Держите обе в зелёной зоне.',
    mood: 'wink',
    holding: 'clipboard',
  },
  {
    text: 'Проходите сценарии следующей должности — это засчитывается в повышение квалификации.',
    mood: 'laugh',
    holding: 'thumb',
    effect: 'sparkles',
  },
  {
    text: 'Повторное прохождение даёт меньше очков. Рейтинг любит широту навыков, а не зубрёжку.',
    mood: 'thinking',
    holding: 'finger',
    effect: 'question',
  },
  // from the scenarios' best answers
  {
    text: 'Запахло гарью — сначала доклад начальнику поезда и мне по служебной связи. Потом уводите людей от очага и закрывайте двери тамбура.',
    mood: 'serious',
    holding: 'radio',
    effect: 'sweat',
  },
  {
    text: 'Поезд задерживается? Не ждите вопросов: сами подойдите к пассажирам — причина, новое время прибытия, извинения и напиток.',
    mood: 'proud',
    holding: 'stopwatch',
  },
  {
    text: 'Сломалось оборудование — зовите меня, это моя зона. А пролитый кофе — ваша: салфетки и сменный чехол.',
    mood: 'wink',
    effect: 'bulb',
  },
  {
    text: 'Долгая остановка? Скажите, что известно, и когда будет следующее объявление. Неизвестность пугает сильнее задержки.',
    mood: 'happy',
    holding: 'radio',
  },
]

/** Today's tip: the same for everyone during a day. */
export const tipIndexOfTheDay = () => Math.floor(Date.now() / 86_400_000) % TIPS.length
