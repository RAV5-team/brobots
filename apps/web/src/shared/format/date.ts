const LOCALE = 'ru-RU'

/** Часовой пояс организации: демо-данные и макеты — по Москве. Станет настройкой организации вместе с профилем. */
const ORG_TIME_ZONE = 'Europe/Moscow'

const DAY_TIME = new Intl.DateTimeFormat(LOCALE, {
  timeZone: ORG_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function part(parts: readonly Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((p) => p.type === type)?.value ?? ''
}

/** Момент изменения без года, как в списках: «15.09 14:32». */
export function formatDayTime(iso: string): string {
  const parts = DAY_TIME.formatToParts(new Date(iso))
  return `${part(parts, 'day')}.${part(parts, 'month')} ${part(parts, 'hour')}:${part(parts, 'minute')}`
}

/** Календарная дата YYYY-MM-DD как «15.09.2026»; без перевода в часовой пояс — день не сдвигается. */
export function formatDate(isoDate: string): string {
  const [year = '', month = '', day = ''] = isoDate.split('-')
  return `${day}.${month}.${year}`
}

const TIME = new Intl.DateTimeFormat(LOCALE, { timeZone: ORG_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** Время по Москве: «14:41» — плашка «Черновик сохранён» (D-21). */
export function formatTime(iso: string): string {
  const parts = TIME.formatToParts(new Date(iso))
  return `${part(parts, 'hour')}:${part(parts, 'minute')}`
}

const DAY = new Intl.DateTimeFormat(LOCALE, { timeZone: ORG_TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric' })

/** Календарный день момента по Москве: «12.08.2026» — колонка «Обновлено» каталога (А1). */
export function formatDateOf(iso: string): string {
  const parts = DAY.formatToParts(new Date(iso))
  return `${part(parts, 'day')}.${part(parts, 'month')}.${part(parts, 'year')}`
}

const TYPED_DATE = /^(\d{2})\.(\d{2})\.(\d{4})$/

/** Дата, введённая как «19.09.2026», — в календарную YYYY-MM-DD; несуществующий день или другой формат — null. */
export function parseDate(typed: string): string | null {
  const match = TYPED_DATE.exec(typed.trim())
  if (!match) return null
  const [, day = '', month = '', year = ''] = match
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  const isReal = date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day)
  return isReal ? `${year}-${month}-${day}` : null
}
