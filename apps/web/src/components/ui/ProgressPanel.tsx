import type { ReactNode } from 'react'
import { Progress } from './Progress'

interface ProgressPanelProps {
  /** «Опрашиваем источники · 2 из 3». */
  readonly title: string
  /** Имя полосы для чтения с экрана: «Опрос источников». */
  readonly label: string
  /** 0…100. */
  readonly value: number
  /** Статус по частям операции: «ФЦ БАС — получено 12 позиций · …». */
  readonly children: ReactNode
}

/**
 * Статус долгой операции: утопленная плашка с заголовком, полосой и строкой статуса
 * (components.md: ProgressPanel; А1а «status · опрос источников», 16044:376). Изменения зачитываются вежливо (ТЗ 4.3.3).
 */
export function ProgressPanel({ title, label, value, children }: ProgressPanelProps) {
  return (
    <section aria-live="polite" className="flex flex-col gap-10 rounded-lg bg-surface-sunken px-20 py-16">
      <h3 className="type-heading font-medium text-text">{title}</h3>
      <Progress label={label} value={value} track="strong" />
      <p className="type-body text-text-secondary">{children}</p>
    </section>
  )
}
