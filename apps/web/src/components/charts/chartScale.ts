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

/**
 * Стопка столбцов одной категории (3.2): первая серия — у нулевой линии, следующие — над ней.
 * Отрицательные значения в стопке не рисуются (высота 0).
 */
export function stackBoxes(values: readonly number[], domain: ValueDomain, height: number): readonly BarBox[] {
  const zero = height * (1 - ratio(0, domain))
  const scale = height / (domain.max - domain.min)
  return values.reduce<{ readonly boxes: readonly BarBox[]; readonly top: number }>(
    (acc, value) => {
      const size = Math.max(0, value) * scale
      return { boxes: [...acc.boxes, { top: acc.top - size, height: size }], top: acc.top - size }
    },
    { boxes: [], top: zero },
  ).boxes
}

/** Отрезок пройден (лайм), если воспроизведение дошло до его начала: текущий час — тоже лаймом. */
export const isPassed = (index: number, count: number, value: number, max: number): boolean =>
  max > 0 && count > 0 && (index / count) * max < value
