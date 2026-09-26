import { generatePath } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import type { OperationClass, Process } from '@/domain'
import { formatCount } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { defaultRows, rateUnit } from './processesModel'

const t = ru.processes

interface ProcessCardProps {
  readonly process: Process
  readonly operationClass: OperationClass | undefined
  readonly robotCount: number
}

/** Карточка процесса в библиотеке (PRD 9.1; 15935:302). */
export function ProcessCard({ process, operationClass, robotCount }: ProcessCardProps) {
  const headingId = `process-${process.code}`
  return (
    <Card as="article" elevation="md" aria-labelledby={headingId} className="h-full">
      <div className="flex flex-col items-end gap-8">
        {robotCount > 0
          ? <Chip size="md">{formatCount(robotCount, ru.plural.robots)}</Chip>
          : <Chip size="md" tone="muted">{t.card.noRobots}</Chip>}
        <div className="flex w-full flex-col gap-4">
          <h2 id={headingId} className="type-title-md text-text">{process.name}</h2>
          <p className="type-caption text-text-secondary">{rateUnit(process)}</p>
        </div>
      </div>

      <p className="type-body text-text">{process.description}</p>

      <div className="flex flex-col items-start gap-6">
        <p className="type-overline text-text-muted">{t.card.classTitle}</p>
        <Chip size="md">{t.classOption(process.operationClass, operationClass?.name ?? '')}</Chip>
      </div>

      <section className="flex flex-col gap-12 rounded-lg bg-surface-muted p-16" aria-label={t.card.defaultsTitle}>
        <p aria-hidden className="type-overline text-text-muted">{t.card.defaultsTitle}</p>
        <dl className="flex flex-col gap-12">
          {defaultRows(process).map((row) => (
            <div key={row.key} className="flex flex-col gap-4">
              <dt className="type-caption text-text-secondary">{row.label}</dt>
              <dd className="type-label font-semibold text-text">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="flex-1" />

      <ButtonLink to={generatePath(ROUTE_PATHS.process, { processId: process.code })} aria-label={t.card.moreLabel(process.name)} className="w-full">
        {t.card.more}
      </ButtonLink>
    </Card>
  )
}
