/** Russian pluralization: plural(5, ['очко', 'очка', 'очков']) → 'очков'. */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(Math.trunc(n))
  const mod10 = abs % 10
  const mod100 = abs % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1]
  return forms[2]
}

export const pluralN = (n: number, forms: [string, string, string]) => `${formatNumber(n)} ${plural(n, forms)}`

export const POINTS: [string, string, string] = ['очко', 'очка', 'очков']
export const MINUTES: [string, string, string] = ['минута', 'минуты', 'минут']
export const RUNS: [string, string, string] = ['прохождение', 'прохождения', 'прохождений']
export const PEOPLE: [string, string, string] = ['участник', 'участника', 'участников']
export const EMPLOYEES: [string, string, string] = ['сотрудник', 'сотрудника', 'сотрудников']
export const SCENARIOS: [string, string, string] = ['сценарий', 'сценария', 'сценариев']
export const QUESTIONS: [string, string, string] = ['вопрос', 'вопроса', 'вопросов']
export const FORKS: [string, string, string] = ['развилка', 'развилки', 'развилок']
export const ENDINGS: [string, string, string] = ['финал', 'финала', 'финалов']

export const points = (n: number) => pluralN(n, POINTS)

function formatNumber(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n)
}
