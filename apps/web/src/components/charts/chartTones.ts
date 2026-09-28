/**
 * Тона серий графиков (D-87) — только токены. Серии различаются не только цветом: легенда и таблица с числами.
 * strong — главная серия (выполнено, пик, поток); muted — фон и сравнение (потребность); subtle — «свободен»;
 * secondary — «едет за паллетой»; accent — зарядка; danger — ожидание; danger-soft — ремонт.
 */
export type ChartTone = 'strong' | 'muted' | 'subtle' | 'secondary' | 'accent' | 'danger' | 'danger-soft'

export const TONE_FILL: Record<ChartTone, string> = {
  strong: 'fill-inverse',
  muted: 'fill-surface-sunken',
  subtle: 'fill-border',
  secondary: 'fill-border-control',
  accent: 'fill-accent',
  danger: 'fill-danger',
  'danger-soft': 'fill-danger-bg',
}

export const TONE_SWATCH: Record<ChartTone, string> = {
  strong: 'bg-inverse',
  muted: 'bg-surface-sunken',
  subtle: 'bg-border',
  secondary: 'bg-border-control',
  accent: 'bg-accent',
  danger: 'bg-danger',
  'danger-soft': 'bg-danger-bg',
}

/** Серия графика: ключ, подпись легенды и таблицы, тон. */
export interface ChartSeries {
  readonly key: string
  readonly label: string
  readonly tone: ChartTone
}
