import type { ReactNode } from 'react'
import { Chip } from '@/components/ui/Chip'
import { ru } from '@/shared/i18n/ru'
import type { DefaultRow } from './processesModel'

const t = ru.processes

interface ProcessCardBodyProps {
  readonly headingId: string
  readonly name: string
  /** «паллет / ч» — единица производительности под названием. */
  readonly unit: string
  readonly description: string
  /** «OP-01 · Перемещение грузов». */
  readonly classLabel: string
  readonly rows: readonly DefaultRow[]
  /** Плашки над названием справа: роботы по классу, «✓ Выбран». */
  readonly chips: ReactNode
}

/**
 * Содержимое карточки процесса до действий: плашки, название, описание, класс и семь значений (PRD 9.1, 10.4).
 * Общая часть карточек библиотеки 07 (15935:302) и вкладки «Процессы локации» 15 (15950:2587).
 */
export function ProcessCardBody({ headingId, name, unit, description, classLabel, rows, chips }: ProcessCardBodyProps) {
  return (
    <>
      <div className="flex flex-col items-end gap-8">
        <div className="flex items-center gap-8">{chips}</div>
        <div className="flex w-full flex-col gap-4">
          <h2 id={headingId} className="type-title-md text-text">{name}</h2>
          <p className="type-caption text-text-secondary">{unit}</p>
        </div>
      </div>

      <p className="type-body text-text">{description}</p>

      <div className="flex flex-col items-start gap-6">
        <p className="type-overline text-text-muted">{t.card.classTitle}</p>
        <Chip size="md">{classLabel}</Chip>
      </div>

      <section className="flex flex-col gap-12 rounded-lg bg-surface-muted p-16" aria-label={t.card.defaultsTitle}>
        <p aria-hidden className="type-overline text-text-muted">{t.card.defaultsTitle}</p>
        <dl className="flex flex-col gap-12">
          {rows.map((row) => (
            <div key={row.key} className="flex flex-col gap-4">
              <dt className="type-caption text-text-secondary">{row.label}</dt>
              <dd className="type-label font-semibold text-text">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  )
}
