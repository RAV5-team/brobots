const LOCALE = 'ru-RU'

/**
 * Единое правило округления (D-19): половина — от нуля, только при показе.
 * Расчёты идут на неокруглённых значениях. Сдвиг через экспоненту убирает двоичную погрешность (1.005 → 1.01).
 */
export function roundHalfUp(value: number, digits = 0): number {
  const shifted = Math.round(Number(`${String(Math.abs(value))}e${String(digits)}`))
  return Math.sign(value) * Number(`${String(shifted)}e-${String(digits)}`)
}

/** Число по-русски: разряды через пробел, дробная часть через запятую, без хвостовых нулей. */
export function formatNumber(value: number, maxFractionDigits = 0): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: maxFractionDigits }).format(
    roundHalfUp(value, maxFractionDigits),
  )
}

/** Доля 0…1 как проценты: 0.95 → «95 %». */
export function formatPercent(share: number, maxFractionDigits = 0): string {
  return new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: maxFractionDigits }).format(
    roundHalfUp(share * 100, maxFractionDigits) / 100,
  )
}
