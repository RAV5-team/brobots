/**
 * Тона серий графиков (D-87) — только токены. Серии различаются не только цветом: легенда и таблица с числами.
 * strong — главная серия (выполнено, пик, поток); muted — фон и сравнение (потребность); subtle — «свободен»;
 * secondary — «едет за паллетой»; accent — зарядка; danger — ожидание; danger-soft — ремонт.
 * Доска 16325 (3.5, `BOARD_TIME_TONES`): dark — «едет за паллетой», secondary — «ждёт проезд», light — «зарядка» и станции.
 */
export type ChartTone = 'strong' | 'muted' | 'subtle' | 'secondary' | 'accent' | 'danger' | 'danger-soft' | 'dark' | 'light'

export const TONE_FILL: Record<ChartTone, string> = {
  strong: 'fill-inverse',
  muted: 'fill-surface-sunken',
  subtle: 'fill-border',
  secondary: 'fill-border-control',
  accent: 'fill-accent',
  danger: 'fill-danger',
  'danger-soft': 'fill-danger-bg',
  dark: 'fill-text-secondary',
  light: 'fill-border-strong',
}

export const TONE_SWATCH: Record<ChartTone, string> = {
  strong: 'bg-inverse',
  muted: 'bg-surface-sunken',
  subtle: 'bg-border',
  secondary: 'bg-border-control',
  accent: 'bg-accent',
  danger: 'bg-danger',
  'danger-soft': 'bg-danger-bg',
  dark: 'bg-text-secondary',
  light: 'bg-border-strong',
}

/** Обводка знака легенды (круг-обводка, рамка): тот же тон линией. */
export const TONE_BORDER: Record<ChartTone, string> = {
  strong: 'border-inverse',
  muted: 'border-surface-sunken',
  subtle: 'border-border',
  secondary: 'border-border-control',
  accent: 'border-accent',
  danger: 'border-danger',
  'danger-soft': 'border-danger-bg',
  dark: 'border-text-secondary',
  light: 'border-border-strong',
}

/** Обводка фигуры на SVG-схеме (робот «свободен» — пустой круг). */
export const TONE_STROKE: Record<ChartTone, string> = {
  strong: 'stroke-inverse',
  muted: 'stroke-surface-sunken',
  subtle: 'stroke-border',
  secondary: 'stroke-border-control',
  accent: 'stroke-accent',
  danger: 'stroke-danger',
  'danger-soft': 'stroke-danger-bg',
  dark: 'stroke-text-secondary',
  light: 'stroke-border-strong',
}

/** Серия графика: ключ, подпись легенды и таблицы, тон. */
export interface ChartSeries {
  readonly key: string
  readonly label: string
  readonly tone: ChartTone
}

/** Сегменты «Куда уходит время роботов» — ключи как у `TIME_SEGMENTS` экрана симуляции. */
export type TimeSegmentKey = 'carrying' | 'toPickup' | 'blocked' | 'charging' | 'down' | 'idle'

/**
 * Тона сегментов времени по доске 16325 (3.5, 17040:10): везёт — чёрный, едет за паллетой — тёмно-серый,
 * ждёт проезд — серый, зарядка — светло-серый, ремонт — лайм, свободен — фон полосы. Опция: `StackedBar tones`.
 * Набор по умолчанию (`TIME_SEGMENTS` экрана, отчёт 09) не меняется.
 */
export const BOARD_TIME_TONES: Readonly<Record<TimeSegmentKey, ChartTone>> = {
  carrying: 'strong',
  toPickup: 'dark',
  blocked: 'secondary',
  charging: 'light',
  down: 'accent',
  idle: 'muted',
}
