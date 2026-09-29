/** Окно часов «с — по»: часы 0…23; конец меньше начала — окно через полночь (22:00 — 02:00). */
export interface TimeWindow {
  readonly from: number
  readonly to: number
}

export const HOURS_PER_DAY = 24

/** Длительность окна в часах; через полночь — по кругу суток. Начало = конец — сутки целиком (24 ч; лимит пиковых часов проверяет экран). */
export const windowHours = ({ from, to }: TimeWindow): number => (((to - from) % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY || HOURS_PER_DAY

/** Часы, покрытые окнами, по возрастанию без повторов: окно 08–11 — часы 8, 9, 10. */
export function hoursOfWindows(windows: readonly TimeWindow[]): readonly number[] {
  const hours = windows.flatMap((w) => Array.from({ length: windowHours(w) }, (_, i) => (w.from + i) % HOURS_PER_DAY))
  return [...new Set(hours)].sort((a, b) => a - b)
}

/** Окна из набора часов: подряд идущие часы — одно окно, через полночь — тоже одно (23, 0, 1 → 23:00 — 02:00). */
export function windowsOfHours(hours: readonly number[]): readonly TimeWindow[] {
  const set = new Set(hours.filter((h) => Number.isInteger(h) && h >= 0 && h < HOURS_PER_DAY))
  if (set.size === 0) return []
  if (set.size === HOURS_PER_DAY) return [{ from: 0, to: 0 }]
  const starts = [...set].filter((h) => !set.has((h + HOURS_PER_DAY - 1) % HOURS_PER_DAY)).sort((a, b) => a - b)
  return starts.map((from) => {
    const length = Array.from({ length: HOURS_PER_DAY }, (_, i) => i).findIndex((i) => !set.has((from + i) % HOURS_PER_DAY))
    return { from, to: (from + length) % HOURS_PER_DAY }
  })
}

/** Новое окно после последнего: час от его конца; список пуст — 08:00 — 09:00. */
export function addWindow(windows: readonly TimeWindow[]): readonly TimeWindow[] {
  const last = windows.at(-1)
  const from = last ? last.to : 8
  return [...windows, { from, to: (from + 1) % HOURS_PER_DAY }]
}
