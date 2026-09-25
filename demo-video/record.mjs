// Records a walkthrough of the mobile app (iPhone-size viewport) with Playwright.
// Frames are captured as 2x screenshots via CDP (Playwright's own video is 1x in
// headless mode). Output: out/frames/*.jpg + out/frames.json + out/captions.json.
import { chromium } from 'playwright'
import fs from 'node:fs'

const BASE = process.env.BASE_URL || 'http://nginx'
const OUT = new URL('./out/', import.meta.url).pathname
const TOURNAMENT_ANSWERS = JSON.parse(fs.readFileSync(new URL('./tournament-answers.json', import.meta.url)))

// Optimal choices in the scenarios shown in the video (substring match)
const BEST_CHOICES = [
  'попросить показать билет',
  'предложить плед',
  'поговорить в тамбуре',
  'EpiPen',
  'Остаться рядом, следить за дыханием',
]
const ENGLISH_ANSWER = 'Please stay calm, sir, I am here to help you. Do you have an EpiPen? A doctor is coming right now.'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const captions = []
let t0 = 0
const cap = (title, sub = '') => {
  captions.push({ t: (Date.now() - t0) / 1000, title, sub })
  console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${title}`)
}

// Visible "finger" for every tap
const TAP_INDICATOR = `
  window.addEventListener('pointerdown', (e) => {
    const d = document.createElement('div')
    Object.assign(d.style, {
      position: 'fixed', left: (e.clientX - 22) + 'px', top: (e.clientY - 22) + 'px',
      width: '44px', height: '44px', borderRadius: '50%', pointerEvents: 'none', zIndex: 2147483647,
      background: 'rgba(28,36,48,.22)', border: '2px solid rgba(28,36,48,.55)',
      transition: 'transform .5s ease-out, opacity .5s ease-out',
    })
    document.documentElement.appendChild(d)
    requestAnimationFrame(() => { d.style.transform = 'scale(1.7)'; d.style.opacity = '0' })
    setTimeout(() => d.remove(), 600)
  }, true)
`

async function api(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(BASE + '/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

async function smoothScroll(page, dy, steps = 25) {
  for (let i = 0; i < steps; i++) {
    await page.evaluate((d) => window.scrollBy(0, d), dy / steps)
    await sleep(28)
  }
}

async function scrollAll(page, pause = 900) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
  for (let y = 0; y < height; y += 420) {
    await smoothScroll(page, 420)
    await sleep(pause)
  }
}

const tab = (page, name) => page.getByRole('link', { name, exact: true }).or(page.getByRole('button', { name, exact: true })).last()

async function visible(locator) {
  return (await locator.count()) > 0 && (await locator.first().isVisible())
}

/** Plays the current run to its end screen, choosing optimal answers. */
async function playRun(page, { englishAnswer, onFirstChoice, onFirstFeedback, onInput }) {
  let choiceSeen = false
  let feedbackSeen = false
  for (let guard = 0; guard < 40; guard++) {
    if (await visible(page.getByRole('button', { name: /Пройти ещё раз/ }))) return
    const cont = page.getByTestId('continue')
    const choices = page.getByTestId('choice')
    const input = page.getByTestId('answer-input')
    if (await visible(choices)) {
      if (!choiceSeen) { choiceSeen = true; onFirstChoice?.() }
      await sleep(2600)
      const texts = await choices.allInnerTexts()
      let index = texts.findIndex((t) => BEST_CHOICES.some((b) => t.includes(b)))
      if (index < 0) index = 0
      await choices.nth(index).tap()
      await sleep(900)
      if (!feedbackSeen) { feedbackSeen = true; onFirstFeedback?.() }
      await sleep(2200)
    } else if (await visible(input)) {
      onInput?.()
      await sleep(1500)
      await input.first().tap()
      await input.first().pressSequentially(englishAnswer, { delay: 28 })
      await sleep(600)
      await page.getByTestId('answer-submit').first().tap()
      await page.getByTestId('answer-input').first().waitFor({ state: 'detached', timeout: 60000 }).catch(() => {})
      await sleep(3200)
    } else if (await visible(cont)) {
      await sleep(1500)
      await cont.first().tap()
      await sleep(700)
    } else {
      await sleep(500)
    }
  }
  throw new Error('Run did not reach the end screen')
}

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'ru-RU',
  timezoneId: 'Europe/Moscow',
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
})
await context.addInitScript(TAP_INDICATOR)
const page = await context.newPage()
page.setDefaultTimeout(20000)
t0 = Date.now()

// Frame capture loop (~15 fps at 780x1688)
const frames = []
let capturing = true
const session = await context.newCDPSession(page)
fs.mkdirSync(OUT + 'frames', { recursive: true })
const capture = (async () => {
  while (capturing) {
    try {
      const { cssVisualViewport: v } = await session.send('Page.getLayoutMetrics')
      const shot = await session.send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 88,
        clip: { x: v.pageX, y: v.pageY, width: v.clientWidth, height: v.clientHeight, scale: 2 },
      })
      const name = String(frames.length).padStart(5, '0') + '.jpg'
      fs.writeFileSync(OUT + 'frames/' + name, Buffer.from(shot.data, 'base64'))
      frames.push({ name, t: (Date.now() - t0) / 1000 })
    } catch {
      await sleep(30)
    }
  }
})()

try {
  // 1. Login
  await page.goto(BASE + '/login')
  await page.waitForLoadState('networkidle')
  cap('Магистраль 400', 'Тренажёр для проводников ВСМ в телефоне')
  await sleep(2500)
  cap('Вход', 'Демо-аккаунт проводника')
  await sleep(1200)
  await page.getByRole('button', { name: /Проводник/ }).first().tap()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'))

  // 2. Home — route
  cap('Маршрут', 'Уровни — это станции линии Москва — Петербург')
  await sleep(4000)
  cap('Следующий рейс', 'ИИ подбирает сценарий по вашим ошибкам')
  await scrollAll(page, 1100)
  await sleep(800)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await sleep(900)

  // 3. Scenarios
  await tab(page, 'Сценарии').tap()
  cap('Расписание рейсов', 'Сценарии по должностям и категориям')
  await sleep(2200)
  await smoothScroll(page, 500, 30)
  await sleep(1500)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  await sleep(700)
  await page.locator('[data-testid="scenario-row"][data-slug="conflict-seat"]').first().tap()
  await sleep(800)
  if (!page.url().includes('/play/')) {
    await page.getByRole('button', { name: /Начать|Продолжить|Пройти/ }).first().tap()
  }
  await page.waitForURL(/\/play\//)

  // 4. Scenario run
  cap('Рейс «Чужое место»', 'Нелинейный диалог с пассажирами')
  await playRun(page, {
    onFirstChoice: () => cap('Решение на время', 'Таймер, лояльность пассажира и безопасность'),
    onFirstFeedback: () => cap('Последствия', 'Каждое решение сразу меняет шкалы'),
  })
  cap('Итог рейса', 'Очки компетенций, ачивки и разбор ошибок')
  await sleep(3500)
  await scrollAll(page, 1200)
  await sleep(800)

  // 5. Emergency sent by a lead
  const lead = await api('/auth/login', { method: 'POST', body: { email: 'lead@m400.ru', password: 'lead123' } })
  const demoToken = await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (/token/i.test(k)) return localStorage.getItem(k)
    return null
  })
  const me = await api('/me', { token: demoToken })
  const emergencies = await api('/admin/emergencies', { token: lead.access_token })
  const english = emergencies.find((s) => (s.tags || []).includes('english'))
  await api('/admin/emergencies/dispatch', {
    token: lead.access_token,
    method: 'POST',
    body: { scenario_id: english.id, user_ids: [me.id], message: 'Проверка готовности смены' },
  })
  await page.goto(BASE + '/')
  await page.getByRole('button', { name: /Принять вызов/ }).waitFor({ timeout: 30000 })
  cap('Специвент', 'Внезапный вызов посреди смены с голосовым сообщением')
  await sleep(4500)
  cap('Hard: голосовое на английском', 'Пассажир из Индии просит помощи')
  await sleep(2500)
  await page.getByRole('button', { name: /Принять вызов/ }).tap()
  await page.waitForURL(/\/play\//)
  await playRun(page, {
    englishAnswer: ENGLISH_ANSWER,
    onInput: () => cap('Ответ на английском', 'ИИ-наставник оценивает ответ по регламенту'),
  })
  cap('Специвент пройден', 'Результат идёт в рейтинг')
  await sleep(3500)

  // 6. Weekly tournament
  await page.goto(BASE + '/tournament')
  cap('Турнир недели', 'Все отвечают одновременно, топ-10 получают трофей и +100 очков')
  await sleep(3000)
  await page.getByRole('button', { name: /Участвовать/ }).first().tap()
  for (let q = 0; q < 10; q++) {
    const options = page.getByTestId('t-option')
    const ok = await options.first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false)
    if (!ok) break
    await sleep(1400)
    const body = await page.locator('body').innerText()
    const correct = Object.entries(TOURNAMENT_ANSWERS).find(([text]) => body.includes(text))?.[1]
    const texts = await options.allInnerTexts()
    let index = correct ? texts.findIndex((t) => t.includes(correct)) : 0
    if (index < 0) index = 0
    if (q === 0) cap('Скорость решает', 'Чем быстрее верный ответ, тем больше очков')
    await options.nth(index).tap()
    await sleep(q < 2 ? 2600 : 1300)
    const next = page.getByRole('button', { name: /Следующий вопрос|Показать результат|Дальше/ })
    if (await visible(next)) await next.first().tap()
  }
  cap('Живая таблица лидеров', 'Обновляется во время турнира')
  await sleep(2000)
  await scrollAll(page, 1000)
  await sleep(1000)

  // 7. Leaderboard
  await page.evaluate(() => window.scrollTo({ top: 0 }))
  await tab(page, 'Рейтинг').tap()
  cap('Рейтинг проводников', 'За неделю и за всё время')
  await sleep(2500)
  await smoothScroll(page, 700, 40)
  await sleep(1500)

  // 8. Profile
  await page.evaluate(() => window.scrollTo({ top: 0 }))
  await tab(page, 'Профиль').tap()
  cap('Профиль', 'Компетенции, ачивки и история рейсов')
  await sleep(2500)
  await scrollAll(page, 1100)
  await sleep(800)

  // 9. Lead panel on the phone
  await page.goto(BASE + '/admin?token=' + lead.access_token)
  cap('Панель руководителя', 'Метрики обучения по всей команде')
  await sleep(3000)
  await scrollAll(page, 900)
  await page.goto(BASE + '/admin/assistant')
  cap('ИИ-ассистент', 'У кого упал рейтинг безопасности за месяц?')
  await sleep(1800)
  await page.getByRole('button', { name: /упал рейтинг безопасности/ }).first().tap()
  await sleep(4500)
  await smoothScroll(page, 500, 30)
  await sleep(2500)
  cap('Магистраль 400', 'Команда «Кокаманы»')
  await sleep(3000)
} catch (error) {
  console.error('Recording failed:', error)
  await page.screenshot({ path: OUT + 'failure.png' })
  process.exitCode = 1
} finally {
  capturing = false
  await capture
  const duration = (Date.now() - t0) / 1000
  await context.close()
  await browser.close()
  fs.writeFileSync(OUT + 'captions.json', JSON.stringify({ duration, captions }, null, 1))
  fs.writeFileSync(OUT + 'frames.json', JSON.stringify(frames))
  console.log(`Frames: ${frames.length}, ${(frames.length / duration).toFixed(1)} fps, ${duration.toFixed(1)} s`)
}
