import { ArrowRight, Plus } from 'lucide-react'
import { generatePath, useSearchParams } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { parseRobotId } from '@/domain'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { IconButtonLink } from '@/components/ui/IconButton'
import { MergedButtonLink } from '@/components/ui/MergedButton'
import { Search } from '@/components/ui/Search'
import { EmptyState, ErrorState, SkeletonList } from '@/components/ui/States'
import { StatusBanner } from '@/components/ui/StatusBanner'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/Table'
import { ru } from '@/shared/i18n/ru'
import { AdminHeader } from '../AdminHeader'
import { CatalogTableHead } from './CatalogTableHead'
import { ADDED_PARAM, filterCatalogRows, shownLabel, type CatalogRow } from './catalogModel'
import { useAdminCatalog, type AdminCatalogState } from './useAdminCatalog'
import { AdminGuard } from '../AdminGuard'

const t = ru.adminCatalog
const SKELETON_ROWS = 6
const QUERY_PARAM = 'q'

function SolutionCell({ row }: { readonly row: CatalogRow }) {
  return (
    <TableCell>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <span className="type-body font-semibold text-text">{row.name}</span>
        {row.needsConfirmation && <Chip tone="inverse">{t.needsConfirmation}</Chip>}
      </div>
      <p className="mt-4 type-caption text-text-secondary">{row.meta}</p>
    </TableCell>
  )
}

function CatalogTableRow({ row }: { readonly row: CatalogRow }) {
  return (
    <TableRow>
      <SolutionCell row={row} />
      <TableCell>
        <div className="flex flex-wrap gap-x-6 gap-y-4">
          {row.operationClasses.length === 0
            ? <Chip tone="muted">{t.noOperationClass}</Chip>
            : row.operationClasses.map((code) => <Chip key={code}>{code}</Chip>)}
        </div>
      </TableCell>
      <TableCell>
        {row.payload === null ? <span className="type-body-sm text-text-muted">{t.noPayload}</span> : <Chip size="xs">{row.payload}</Chip>}
      </TableCell>
      <TableCell className={row.price === null ? 'type-body-sm text-text-muted' : 'font-semibold whitespace-nowrap'}>
        {row.price ?? t.noPrice}
      </TableCell>
      <TableCell className="text-text-secondary">{row.updated}</TableCell>
      <TableCell>
        <Chip>{row.completeness}</Chip>
      </TableCell>
      {/* Кнопка по центру колонки 98 (15997:300). */}
      <TableCell>
        <div className="flex justify-center">
          <IconButtonLink
            size={36}
            icon={ArrowRight}
            label={t.open(row.name)}
            to={generatePath(ROUTE_PATHS.catalogItem, { itemId: row.id })}
          />
        </div>
      </TableCell>
    </TableRow>
  )
}

function CatalogTable({ rows }: { readonly rows: readonly CatalogRow[] }) {
  return (
    <Table caption={t.title} layout="fixed" density="regular">
      <CatalogTableHead />
      <TableBody>
        {rows.map((row) => <CatalogTableRow key={row.id} row={row} />)}
      </TableBody>
    </Table>
  )
}

function CatalogResults({ rows, query }: { readonly rows: readonly CatalogRow[]; readonly query: string }) {
  if (rows.length === 0) return <EmptyState title={t.empty.title} description={t.empty.description} />
  const shown = filterCatalogRows(rows, query)
  return (
    <>
      {shown.length === 0
        ? <EmptyState title={t.notFound.title} description={t.notFound.description} />
        : <CatalogTable rows={shown} />}
      {/* Отступ 16 над подписью (15997:330): 12 — зазор панели, 4 — здесь. */}
      <p role="status" className="pt-4 type-caption text-text-muted">{shownLabel(shown.length, rows.length)}</p>
    </>
  )
}

/** А3: «Каталог обновлён» и переход к решению в пользовательском каталоге (PRD 6.2, раздел 7). */
function AddedBanner({ row }: { readonly row: CatalogRow }) {
  const to = { pathname: ROUTE_PATHS.catalog, search: `?${new URLSearchParams({ [QUERY_PARAM]: row.name }).toString()}` }
  return (
    <StatusBanner
      variant="inverse"
      title={t.added.title}
      action={<ButtonLink variant="accent" to={to} className="h-40 px-20">{t.added.open}</ButtonLink>}
    />
  )
}

function CatalogPanel({ query, onQueryChange, state, retry }: {
  readonly query: string
  readonly onQueryChange: (value: string) => void
  readonly state: AdminCatalogState
  readonly retry: () => void
}) {
  return (
    <Card aria-labelledby="admin-catalog-title">
      <h2 id="admin-catalog-title" className="sr-only">{t.title}</h2>
      <div className="flex items-center gap-24">
        <div className="flex-1">
          <Search label={t.search} value={query} onChange={(e) => { onQueryChange(e.target.value) }} />
        </div>
        {/* PRD 6.2: опрос источников — состояние А1а; добавление — пустая карточка А2. */}
        <ButtonLink to={ROUTE_PATHS.adminCatalogImport} className="px-20">{t.refresh}</ButtonLink>
        <MergedButtonLink to={ROUTE_PATHS.adminCatalogNew} label={t.add} icon={Plus} />
      </div>
      {state.status === 'loading' && (
        <SkeletonList rows={SKELETON_ROWS} rowClassName="h-(--rav-admin-catalog-skeleton-height)" />
      )}
      {state.status === 'error' && <ErrorState title={t.error.title} message={t.error.message} onRetry={retry} />}
      {state.status === 'ready' && <CatalogResults rows={state.rows} query={query} />}
    </Card>
  )
}

/** Экран А1 «Администрирование · каталог решений» (PRD 6.2; 15997:2) и его состояние А3 «Робот добавлен» (?added=, 15966:6268). */
export function AdminCatalogPage() {
  // Каталог ведёт только администратор (PRD 5.3, 6).
  return <AdminGuard><AdminCatalogContent /></AdminGuard>
}

function AdminCatalogContent() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get(QUERY_PARAM) ?? ''
  const addedId = parseRobotId(searchParams.get(ADDED_PARAM))
  const { state, retry } = useAdminCatalog(addedId)
  const addedRow = state.status === 'ready' ? state.rows.find((row) => row.id === addedId) : undefined

  // Запрос живёт в адресе: ссылкой на отфильтрованный каталог можно поделиться; ?as= и ?added= сохраняются.
  const changeQuery = (value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value === '') next.delete(QUERY_PARAM)
      else next.set(QUERY_PARAM, value)
      return next
    }, { replace: true })
  }

  // Шаг 24 между шапкой, вкладками и панелью (15997:3), как на А8; плашка А3 стоит над панелью с зазором 8 (15979:8604).
  return (
    <div className="flex flex-col gap-24">
      <AdminHeader active="catalog" />
      <div className="flex flex-col gap-8">
        {addedRow && <AddedBanner row={addedRow} />}
        <CatalogPanel query={query} onQueryChange={changeQuery} state={state} retry={retry} />
      </div>
    </div>
  )
}
