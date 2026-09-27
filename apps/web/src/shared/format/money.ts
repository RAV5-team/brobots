import { formatNumber, roundHalfUp } from './number'

const RUB = '\u00a0₽'

const SCALES = [
  { from: 1_000_000_000, label: 'млрд' },
  { from: 1_000_000, label: 'млн' },
  { from: 1_000, label: 'тыс.' },
] as const

/** До 10 единиц шкалы — один знак после запятой («9,2 млн»), дальше — целые («591 млн»). */
const COMPACT_PRECISION_LIMIT = 10

/** Сумма в рублях целиком: «2 700 000 ₽». */
export function formatRub(value: number): string {
  return `${formatNumber(value)}${RUB}`
}

interface CompactOptions {
  /** Добавить «/год». */
  readonly perYear?: boolean
  /** Знаков после запятой; по умолчанию один до 10 единиц шкалы и ноль дальше. Форма процесса 09а — «46,9 млн». */
  readonly fractionDigits?: number
  /** Хвостовые нули не убирать: «84,0 млн ₽» в колонке с «6,1 млн ₽» (A1). */
  readonly fixed?: boolean
}

/** Крупные суммы, как на дашборде: «591 млн ₽», «9,2 млн ₽/год», «850 тыс. ₽». */
export function formatRubCompact(value: number, { perYear = false, fractionDigits, fixed = false }: CompactOptions = {}): string {
  const suffix = perYear ? '/год' : ''
  const scale = SCALES.find((s) => Math.abs(value) >= s.from)
  if (!scale) return `${formatRub(value)}${suffix}`
  const scaled = value / scale.from
  const digits = fractionDigits ?? (Math.abs(scaled) < COMPACT_PRECISION_LIMIT ? 1 : 0)
  return `${formatNumber(scaled, digits, { fixed })}\u00a0${scale.label}${RUB}${suffix}`
}

const MILLION = 1_000_000
const MILLIONS = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Цена в каталоге — миллионы с двумя знаками: «3,75 млн ₽», «4,00 млн ₽» (А1). */
export function formatRubMillions(value: number): string {
  return `${MILLIONS.format(roundHalfUp(value / MILLION, 2))}\u00a0млн${RUB}`
}
