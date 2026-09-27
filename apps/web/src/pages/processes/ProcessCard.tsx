import { generatePath } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import type { OperationClass, Process } from '@/domain'
import { formatCount } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { ProcessCardBody } from './ProcessCardBody'
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
      <ProcessCardBody
        headingId={headingId}
        name={process.name}
        unit={rateUnit(process)}
        description={process.description}
        classLabel={t.classOption(process.operationClass, operationClass?.name ?? '')}
        rows={defaultRows(process)}
        chips={robotCount > 0
          ? <Chip size="md">{formatCount(robotCount, ru.plural.robots)}</Chip>
          : <Chip size="md" tone="muted">{t.card.noRobots}</Chip>}
      />

      <div className="flex-1" />

      <ButtonLink to={generatePath(ROUTE_PATHS.process, { processId: process.code })} aria-label={t.card.moreLabel(process.name)} className="w-full">
        {t.card.more}
      </ButtonLink>
    </Card>
  )
}
