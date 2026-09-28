import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { COMPARE_LIMIT, hasEntry } from '@/domain'
import { useCompare } from '@/shared/compare/useCompare'
import { ru } from '@/shared/i18n/ru'
import { CatalogFilters } from './CatalogFilters'
import { CatalogLaunchItemCard } from './CatalogLaunchItemCard'
import { CatalogRobotCard } from './CatalogRobotCard'
import {
  entryRef,
  filterCatalog,
  isFilterActive,
  parseCatalogSearch,
  resetFilters,
  sortCatalog,
  toCatalogSearch,
  type CatalogEntry,
  type CatalogFilter,
} from './catalogModel'
import { useCatalog, type CatalogData } from './useCatalog'

const t = ru.catalog
const SKELETON_CARDS = [0, 1, 2, 3, 4, 5]

function CatalogSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-16" aria-busy="true">
      {SKELETON_CARDS.map((i) => <Skeleton key={i} className="h-(--rav-location-card-height)" />)}
    </div>
  )
}

interface CatalogGridProps {
  readonly data: CatalogData
  readonly entries: readonly CatalogEntry[]
  readonly filter: CatalogFilter
  readonly onReset: () => void
}

function CatalogGrid({ data, entries, filter, onReset }: CatalogGridProps) {
  const { entries: selected, toggle } = useCompare()

  if (entries.length === 0) {
    return (
      <EmptyState
        title={t.notFound.title}
        description={t.notFound.description}
        action={isFilterActive(filter) && <Button onClick={onReset}>{t.notFound.reset}</Button>}
      />
    )
  }

  // Ряды одной высоты: кнопки карточек на одной линии (К-1).
  const full = selected.length >= COMPARE_LIMIT
  return (
    <ul aria-label={t.listLabel} className="grid auto-rows-fr grid-cols-3 gap-16">
      {entries.map((entry) => {
        const ref = entryRef(entry)
        const inCompare = hasEntry(selected, ref)
        const common = { inCompare, compareFull: full && !inCompare, onCompare: () => { toggle(ref) } }
        return (
          <li key={ref.id}>
            {entry.kind === 'robot'
              ? <CatalogRobotCard robot={entry.robot} operationClasses={data.operationClasses} launchItems={data.launchItems} {...common} />
              : <CatalogLaunchItemCard item={entry.item} robots={data.robots} items={data.launchItems} {...common} />}
          </li>
        )
      })}
    </ul>
  )
}

/** Фильтры и лента: состояние в адресе — выборкой можно поделиться (правило URL-состояния). */
function CatalogContent({ data }: { readonly data: CatalogData }) {
  const [params, setParams] = useSearchParams()
  const { entries: selected, error: compareError } = useCompare()
  const filter = parseCatalogSearch(params, data.operationClasses.map((c) => c.code))
  const update = (next: CatalogFilter) => { setParams(toCatalogSearch(next), { replace: true }) }
  const entries = sortCatalog(filterCatalog(data.robots, data.launchItems, filter, data.processes), filter.sort)

  return (
    <div className="flex flex-col gap-16">
      <CatalogFilters
        filter={filter}
        onChange={update}
        operationClasses={data.operationClasses}
        facilityTypes={data.facilityTypes}
        compareCount={selected.length}
        compatibleName={filter.compatibleWith ? (data.robots.find((r) => r.id === filter.compatibleWith)?.name ?? filter.compatibleWith) : null}
      />
      {compareError && <p role="alert" className="type-body-sm text-danger">{compareError}</p>}
      <CatalogGrid data={data} entries={entries} filter={filter} onReset={() => { update(resetFilters(filter)) }} />
    </div>
  )
}

/** Экран К-1 «Каталог · список» (PRD 7.1, 7.2, 7.5; 16642:619). Доступен всем ролям, включая гостя. */
export function CatalogPage() {
  const { state, retry } = useCatalog()

  return (
    <>
      <header className="flex flex-col gap-4">
        <h1 className="type-display-lg text-text">{t.title}</h1>
        <p className="type-body text-text-secondary">{t.lead}</p>
      </header>

      {state.status === 'loading' && <CatalogSkeleton />}
      {state.status === 'error' && <ErrorState title={t.error.title} message={t.error.message} onRetry={retry} />}
      {state.status === 'ready' && <CatalogContent data={state} />}
    </>
  )
}
