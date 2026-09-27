import type { ReactNode } from 'react'

export interface FormulaStat {
  readonly key: string
  /** Подпись капсом: «Пиковая интенсивность». */
  readonly label: string
  readonly value: ReactNode
  /** Формула на подставленных значениях: «= 2 000 ÷ 22 × 1,5». */
  readonly formula: string
}

interface FormulaStatsProps {
  /** Доступное имя группы: «Расчёт по формулам процесса». */
  readonly label: string
  readonly stats: readonly FormulaStat[]
}

/**
 * Вдавленная панель расчётных значений: подпись, значение и формула прямо под ним
 * (components.md: FormulaStats; 15935:1047, 15935:1161). Значения только для чтения — они пересчитываются из полей.
 */
export function FormulaStats({ label, stats }: FormulaStatsProps) {
  return (
    <dl aria-label={label} className="flex gap-12 rounded-lg bg-surface-muted px-20 py-16 shadow-inset-md">
      {stats.map((stat) => (
        <div key={stat.key} className="flex min-w-0 flex-1 flex-col gap-4">
          <dt className="type-overline text-text-muted">{stat.label}</dt>
          <dd className="type-title-md text-text">{stat.value}</dd>
          <dd className="type-caption text-text-secondary">{stat.formula}</dd>
        </div>
      ))}
    </dl>
  )
}
