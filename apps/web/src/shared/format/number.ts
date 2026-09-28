const LOCALE = 'ru-RU'

/**
 * Единое правило округления (D-19): половина — от нуля, только при показе.
 * Расчёты идут на неокруглённых значениях. Сдвиг через экспоненту убирает двоичную погрешность (1.005 → 1.01).
 */
export function roundHalfUp(value: number, digits = 0): number {
  const shifted = Math.round(Number(`${String(Math.abs(value))}e${String(digits)}`))
  return Math.sign(value) * Number(`${String(shifted)}e-${String(digits)}`)
}

interface NumberOptions {
  readonly fixed?: boolean
  /** Изменение со знаком: «+2», «−2», «0» — минус типографский (дельта состава, «было → стало»). */
  readonly signed?: boolean
}

/** Intl для ru-RU ставит дефис; у изменений со знаком — типографский минус. */
const withSign = (text: string, signed: boolean): string => (signed ? text.replace('-', '\u2212') : text)

/**
 * Число по-русски: разряды через пробел, дробная часть через запятую, без хвостовых нулей.
 * `fixed` — хвостовые нули остаются: колонка таблицы с одним знаком («84,0», A1).
 */
export function formatNumber(value: number, maxFractionDigits = 0, { fixed = false, signed = false }: NumberOptions = {}): string {
  return withSign(
    new Intl.NumberFormat(LOCALE, {
      maximumFractionDigits: maxFractionDigits,
      minimumFractionDigits: fixed ? maxFractionDigits : 0,
      ...(signed ? { signDisplay: 'exceptZero' } : {}),
    }).format(roundHalfUp(value, maxFractionDigits)),
    signed,
  )
}

/** Доля 0…1 как проценты: 0.95 → «95 %»; `signed` — изменение: −0.18 → «−18 %». */
export function formatPercent(share: number, maxFractionDigits = 0, { signed = false }: Pick<NumberOptions, 'signed'> = {}): string {
  return withSign(
    new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: maxFractionDigits, ...(signed ? { signDisplay: 'exceptZero' } : {}) }).format(
      roundHalfUp(share * 100, maxFractionDigits) / 100,
    ),
    signed,
  )
}

const KB = 1024
const MB = KB * KB

/** Размер файла: «2,4 МБ» (А7, 15966:7671); меньше мегабайта — целые килобайты, не меньше 1. */
export function formatFileSize(bytes: number): string {
  if (bytes >= MB) return `${formatNumber(bytes / MB, 1)}\u00a0МБ`
  return `${formatNumber(Math.max(1, bytes / KB))}\u00a0КБ`
}
