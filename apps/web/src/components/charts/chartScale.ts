/** Область значений шкалы; ноль всегда внутри — столбцы растут от нулевой линии. */
export interface ValueDomain {
  readonly min: number
  readonly max: number
}

export function valueDomain(values: readonly number[]): ValueDomain {
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  return min === max ? { min: 0, max: 1 } : { min, max }
}

const ratio = (value: number, { min, max }: ValueDomain): number => (value - min) / (max - min)

/** Положение столбца по вертикали, px от верха графика. */
export interface BarBox {
  readonly top: number
  readonly height: number
}

/**
 * Столбец значения: положительный — вверх от нулевой линии, отрицательный — вниз.
 * `minHeight` — заглушка у нуля и очень малых значений, чтобы час без рейсов было видно (07a).
 */
export function barBox(value: number, domain: ValueDomain, height: number, minHeight = 0): BarBox {
  const zero = height * (1 - ratio(0, domain))
  const size = Math.max(minHeight, Math.abs(ratio(value, domain) - ratio(0, domain)) * height)
  return value < 0 ? { top: zero, height: size } : { top: zero - size, height: size }
}

/** Доли сегментов полосы 100 %; пустая полоса — нули. */
export function shares(values: readonly number[]): readonly number[] {
  const total = values.reduce((sum, v) => sum + Math.max(0, v), 0)
  return values.map((v) => (total === 0 ? 0 : Math.max(0, v) / total))
}

/** Диапазон на общей шкале 0…max: начало и ширина в долях; границы упорядочиваются и обрезаются по шкале. */
export function rangeBox(from: number, to: number, max: number): { readonly start: number; readonly width: number } {
  const clamp = (v: number) => Math.min(max, Math.max(0, v))
  const low = clamp(Math.min(from, to))
  const high = clamp(Math.max(from, to))
  return { start: low / max, width: (high - low) / max }
}
