import { Plus } from 'lucide-react'
import { Link, generatePath } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { EmptyState } from '@/components/ui/States'
import { formatNumber, formatRubCompact } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import type { DashboardLocation } from './dashboardModel'

const t = ru.dashboard.locations

function LocationRow({ location, laborRub, projectCount }: DashboardLocation) {
  return (
    <li className="flex items-start justify-between gap-16 border-t border-border py-12">
      <div className="flex min-w-0 flex-col gap-4">
        <h3 className="type-body font-semibold text-text">
          <Link
            to={generatePath(ROUTE_PATHS.location, { locationId: location.id })}
            className="rounded-xs hover:underline hover:underline-offset-4"
          >
            {location.name}
          </Link>
        </h3>
        {laborRub !== null && <p className="type-caption font-medium text-text-secondary">{t.labor(formatRubCompact(laborRub))}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-4 type-caption text-text-secondary">
        <p>{ru.facilityTypesLower[location.facilityType]}</p>
        <p>{t.projects(formatNumber(projectCount))}</p>
      </div>
    </li>
  )
}

interface LocationsPanelProps {
  readonly locations: readonly DashboardLocation[]
  /** У гостя нет своих локаций (PRD 4, D-14) — кнопки «Добавить локацию» нет. */
  readonly canAdd: boolean
}

/** «Локации» — быстрый переход к локации (PRD 8.3; 15935:179). */
export function LocationsPanel({ locations, canAdd }: LocationsPanelProps) {
  return (
    <Card elevation="md" className="w-(--rav-dashboard-aside-width) shrink-0" aria-labelledby="dashboard-locations">
      <SectionHeader
        title={t.title}
        id="dashboard-locations"
        actions={<ButtonLink size="sm" to={ROUTE_PATHS.locations}>{t.all}</ButtonLink>}
      />
      {locations.length === 0 ? (
        <EmptyState title={t.empty} />
      ) : (
        <ul className="flex flex-col gap-12">
          {locations.map((l) => <LocationRow key={l.location.id} {...l} />)}
        </ul>
      )}
      {canAdd && (
        <ButtonLink to={ROUTE_PATHS.locationNew} className="self-start">
          <Plus aria-hidden size={16} />
          {t.add}
        </ButtonLink>
      )}
    </Card>
  )
}
