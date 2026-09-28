import { useState } from 'react'
import { useLocation } from 'react-router'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import type { LocationId } from '@/domain'
import { useRole } from '@/shared/auth/useRole'
import { ru } from '@/shared/i18n/ru'
import { CreatedLocationBanner } from './CreatedLocationBanner'
import { readCreatedLocationId } from './createdLocation'
import { LocationCard } from './LocationCard'
import { LocationFilters } from './LocationFilters'
import {
  DEFAULT_SORT, EMPTY_FILTER, filterLocations, isFilterActive, sortLocations,
  type LocationFilter, type LocationListItem, type LocationSort,
} from './locationsModel'
import { useLocations } from './useLocations'

const t = ru.locations
const SKELETON_CARDS = [0, 1, 2, 3]

function LocationsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-16" aria-busy="true">
      {SKELETON_CARDS.map((i) => <Skeleton key={i} className="h-(--rav-location-card-height)" />)}
    </div>
  )
}

interface LocationGridProps {
  readonly items: readonly LocationListItem[]
  readonly filter: LocationFilter
  readonly sort: LocationSort
  readonly onReset: () => void
  readonly createdId: LocationId | null
}

function LocationGrid({ items, filter, sort, onReset, createdId }: LocationGridProps) {
  if (items.length === 0) return <EmptyState title={t.empty.title} description={t.empty.description} />

  const visible = sortLocations(filterLocations(items, filter), sort)
  if (visible.length === 0) {
    return (
      <EmptyState
        title={t.notFound.title}
        description={t.notFound.description}
        action={isFilterActive(filter) && <Button onClick={onReset}>{t.notFound.reset}</Button>}
      />
    )
  }

  return (
    // Ряды одной высоты: в макете все карточки 408 px, «Подробнее» прижата к низу.
    <ul aria-label={t.listLabel} className="grid auto-rows-fr grid-cols-2 gap-16">
      {visible.map((item) => (
        <li key={item.location.id}>
          <LocationCard {...item} isJustCreated={item.location.id === createdId} />
        </li>
      ))}
    </ul>
  )
}

/**
 * Экран 12 «Локации · список» — профили площадок организации (PRD 10.1; 15950:1627).
 * Состояние 12а (15950:2245): после формы 14 — плашка «Локация создана» и карточка с «создана только что» (D-35).
 */
export function LocationsPage() {
  const role = useRole()
  const navigationState: unknown = useLocation().state
  // Гость своих локаций не заводит (D-14): состояние 12а ему не показываем.
  const createdId = role === 'guest' ? null : readCreatedLocationId(navigationState)
  const { state, retry } = useLocations()
  const [filter, setFilter] = useState<LocationFilter>(EMPTY_FILTER)
  const [sort, setSort] = useState<LocationSort>(DEFAULT_SORT)
  const created = state.status === 'ready' ? state.items.find((i) => i.location.id === createdId) : undefined

  return (
    <>
      <PageHeader
        title={t.title}
        lead={(
          <>
            {t.lead[0]}
            <br />
            {t.lead[1]}
          </>
        )}
      />

      {state.status === 'loading' && <LocationsSkeleton />}
      {state.status === 'error' && <ErrorState title={t.error.title} message={t.error.message} onRetry={retry} />}
      {state.status === 'ready' && (
        <>
          {created && <CreatedLocationBanner item={created} />}
          <LocationFilters
            filter={filter}
            onFilterChange={setFilter}
            sort={sort}
            onSortChange={setSort}
            facilityTypes={state.facilityTypes}
            // Гостю — демо-локации без сохранения (PRD 5.3, D-14): своих локаций он не заводит (как D-30).
            canAdd={role !== 'guest'}
          />
          <LocationGrid
            items={state.items}
            filter={filter}
            sort={sort}
            onReset={() => { setFilter(EMPTY_FILTER) }}
            createdId={created ? createdId : null}
          />
        </>
      )}
    </>
  )
}
