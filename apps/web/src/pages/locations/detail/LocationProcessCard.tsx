import { generatePath } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import type { LocationId } from '@/domain'
import { ProcessCardBody } from '@/pages/processes/ProcessCardBody'
import { formatCount } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { readinessLabel, type LocationProcessView } from './locationDetailModel'
import type { RemoveTarget } from './RemoveProcessDialog'

const t = ru.location.card

interface LocationProcessCardProps {
  readonly locationId: LocationId
  readonly view: LocationProcessView
  /** Открыть окно 17в. Нет — кнопки «Удалить» нет: гость смотрит демо без сохранения (D-14). */
  readonly onRemove: ((target: RemoveTarget) => void) | null
}

/** Карточка процесса на вкладке «Процессы локации» (PRD 10.4; 15950:2587). */
export function LocationProcessCard({ locationId, view, onRemove }: LocationProcessCardProps) {
  const headingId = `location-process-${view.id}`
  const isReady = view.missing.length === 0
  return (
    <Card as="article" elevation="md" aria-labelledby={headingId} className="h-full">
      <ProcessCardBody
        headingId={headingId}
        name={view.name}
        unit={view.unit}
        description={view.description}
        classLabel={view.classLabel}
        rows={view.rows}
        chips={
          <>
            {view.robotCount > 0
              ? <Chip size="md">{formatCount(view.robotCount, ru.plural.robots)}</Chip>
              : <Chip size="md" tone="muted">{ru.processes.card.noRobots}</Chip>}
            {view.isSelected && (
              <span title={t.selectedHint}>
                <Chip size="md" tone="inverse" checked>{t.selected}</Chip>
              </span>
            )}
          </>
        }
      />

      <div>
        <Chip tone={isReady ? 'success' : 'muted'} checked={isReady}>{readinessLabel(view.missing)}</Chip>
      </div>

      <div className="flex-1" />

      <div className="flex gap-12">
        <ButtonLink
          to={generatePath(ROUTE_PATHS.locationProcess, { locationId, locationProcessId: view.id })}
          aria-label={t.moreLabel(view.name)}
          className="flex-1"
        >
          {t.more}
        </ButtonLink>
        {onRemove && (
          <Button aria-label={t.removeLabel(view.name)} onClick={() => { onRemove({ id: view.id, name: view.name }) }} className="flex-1">
            {t.remove}
          </Button>
        )}
      </div>
    </Card>
  )
}
