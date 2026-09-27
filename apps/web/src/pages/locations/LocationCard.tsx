import { generatePath } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { ButtonLink } from '@/components/ui/Button'
import { Card, CardStat } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import type { LocationSummary } from '@/domain'
import { formatCount, formatDayOf, formatNumber, formatPercent, formatRubCompact } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import type { LocationListItem } from './locationsModel'

const t = ru.locations.card
const PERCENT = 100

const orNone = (value: number | null, format: (v: string) => string): string =>
  value === null ? t.none : format(formatNumber(value))

function metrics(s: LocationSummary) {
  const shifts = s.shiftsPerDay !== null && s.shiftHours !== null
    ? t.shiftsValue(formatNumber(s.shiftsPerDay), formatNumber(s.shiftHours))
    : t.none
  return [
    { key: 'area', label: t.area, value: orNone(s.totalAreaM2, t.areaValue) },
    { key: 'staff', label: t.staff, value: orNone(s.staffTotal, t.staffValue) },
    { key: 'shifts', label: t.shifts, value: shifts },
    { key: 'processes', label: t.processes, value: formatNumber(s.processesCount) },
  ] as const
}

/** «231 млн ₽ / год» и кто в эту сумму входит. У локации без процессов считать нечего (PRD 15 · №43). */
function LaborWell({ summary }: { readonly summary: LocationSummary }) {
  const labor = summary.processesCount > 0 ? summary.laborCostRubYear : null
  return (
    <Card variant="well" padding={16} gap={4}>
      {labor !== null ? (
        <>
          <p className="type-title-lg text-text">{t.labor(formatRubCompact(labor))}</p>
          <p className="type-caption text-text-secondary">
            {summary.workersInProcesses === null
              ? t.laborCaptionNoWorkers
              : t.laborCaption(formatCount(summary.workersInProcesses, ru.plural.people))}
          </p>
        </>
      ) : (
        <p className="type-body text-text-secondary">{t.noLabor}</p>
      )}
    </Card>
  )
}

interface LocationCardProps extends LocationListItem {
  /** Только что сохранена формой 14: вместо даты — «создана только что» (экран 12а). */
  readonly isJustCreated?: boolean
}

/** Карточка локации в списке (PRD 10.1; 15950:1666). */
export function LocationCard({ location, summary, facilityTypeName, isJustCreated = false }: LocationCardProps) {
  const headingId = `location-${location.id}`
  return (
    <Card as="article" elevation="md" gap={16} aria-labelledby={headingId} className="h-full min-h-(--rav-location-card-height)">
      <div className="flex items-start justify-between gap-12">
        <div className="flex min-w-0 flex-col gap-4">
          <h2 id={headingId} className="type-title-lg text-text">{location.name}</h2>
          <p className="type-body text-text-secondary">{t.subtitle(facilityTypeName, location.city)}</p>
        </div>
        {summary.assumptionsCount > 0 && (
          <Chip size="md">{formatCount(summary.assumptionsCount, ru.plural.assumptions)}</Chip>
        )}
      </div>

      <dl className="flex gap-12">
        {metrics(summary).map((m) => (
          <div key={m.key} className="flex min-w-0 flex-1 flex-col gap-4">
            <dt className="type-caption text-text-secondary">{m.label}</dt>
            <dd className="type-heading whitespace-nowrap text-text">{m.value}</dd>
          </div>
        ))}
      </dl>

      <LaborWell summary={summary} />

      <dl>
        <CardStat label={t.completeness} value={formatPercent(summary.parametersCompletenessPct / PERCENT)} />
        <CardStat
          label={t.projects}
          value={summary.projectsCount === 0
            ? formatNumber(0)
            : t.projectsValue(formatNumber(summary.projectsCount), formatNumber(summary.projectsCompleted))}
        />
      </dl>

      <div className="mt-auto flex items-center justify-between gap-12">
        <p className="type-caption text-text-secondary">
          {isJustCreated ? t.createdJustNow : t.updated(formatDayOf(location.updatedAt))}
        </p>
        <ButtonLink
          to={generatePath(ROUTE_PATHS.location, { locationId: location.id })}
          aria-label={t.moreLabel(location.name)}
        >
          {t.more}
        </ButtonLink>
      </div>
    </Card>
  )
}
