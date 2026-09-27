import { clsx } from 'clsx'
import { Plus } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { MergedButton, MergedButtonLink } from '@/components/ui/MergedButton'
import { ProgressPanel } from '@/components/ui/ProgressPanel'
import { Search } from '@/components/ui/Search'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/Table'
import { canAccess } from '@/shared/auth/resolveRole'
import { useRole } from '@/shared/auth/useRole'
import { ru } from '@/shared/i18n/ru'
import { AdminHeader } from '../AdminHeader'
import { CatalogTableHead } from './CatalogTableHead'
import { refreshView } from './catalogRefreshModel'
import { useCatalogRefresh, type CatalogRefreshState } from './useCatalogRefresh'

const t = ru.catalogRefresh
const tc = ru.adminCatalog

// Полосы-заглушки строк (16047:2…50): доля ширины ячейки по колонкам «решение … полнота», три строки повторяются.
// Последняя колонка — кнопка «→»: полоса фиксированной ширины по центру.
const SKELETON_ROWS = [
  { cells: ['75%', '60%', '57%', '64%', '72%', '46%'], action: 'w-36' },
  { cells: ['72%', '55%', '51%', '56%', '64%', '38%'], action: 'w-28' },
  { cells: ['69%', '49%', '46%', '49%', '56%', '30%'], action: 'w-28' },
] as const
const SKELETON_ROW_COUNT = 7

function SkeletonTable() {
  return (
    <Table caption={tc.title} layout="fixed" density="regular">
      <CatalogTableHead />
      <TableBody>
        {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => {
          const row = SKELETON_ROWS[i % SKELETON_ROWS.length] ?? SKELETON_ROWS[0]
          return (
            <TableRow key={i}>
              {row.cells.map((width, c) => (
                <TableCell key={c}>
                  <Skeleton className="h-14 rounded-sm" style={{ width }} />
                </TableCell>
              ))}
              <TableCell>
                <Skeleton className={clsx('mx-auto h-14 rounded-sm', row.action)} />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function RefreshStatus({ state }: { readonly state: Exclude<CatalogRefreshState, { status: 'error' }> }) {
  if (state.status === 'starting') {
    return <ProgressPanel title={t.starting} label={t.progressLabel} value={0}>{t.startingDetail}</ProgressPanel>
  }
  const view = refreshView(state.refresh)
  return <ProgressPanel title={view.title} label={t.progressLabel} value={view.percent}>{view.detail}</ProgressPanel>
}

function Toolbar({ isRunning, onRetry }: { readonly isRunning: boolean; readonly onRetry: () => void }) {
  // Пока опрос идёт, поиск, повторный запуск и добавление заблокированы (PRD 6.2; 16044:29 — все три приглушены).
  return (
    <div className="flex items-center gap-24">
      <div className="flex-1">
        <Search label={tc.search} disabled={isRunning} />
      </div>
      {isRunning
        ? <Button disabled aria-busy="true" className="px-20">{t.refreshing}</Button>
        : <Button onClick={onRetry} className="px-20">{tc.refresh}</Button>}
      {isRunning
        ? <MergedButton disabled label={tc.add} icon={Plus} />
        : <MergedButtonLink to={ROUTE_PATHS.adminCatalogNew} label={tc.add} icon={Plus} />}
    </div>
  )
}

function RefreshPanel() {
  const navigate = useNavigate()
  // Все источники ответили — таблица обновится на А1 (PRD 6.2). А4 «предпросмотр изменений» пока не реализован (D-47).
  const { state, retry } = useCatalogRefresh(() => { void navigate(ROUTE_PATHS.adminCatalog, { replace: true }) })

  return (
    <Card aria-labelledby="catalog-refresh-title" aria-busy={state.status !== 'error'}>
      <h2 id="catalog-refresh-title" className="sr-only">{t.title}</h2>
      <Toolbar isRunning={state.status !== 'error'} onRetry={retry} />
      {state.status === 'error'
        ? <ErrorState title={t.error.title} message={t.error.message} onRetry={retry} />
        : (
          <>
            {/* Плашка статуса и шапка таблицы стоят вплотную (16044:376 → 16044:43). */}
            <div className="flex flex-col">
              <RefreshStatus state={state} />
              <SkeletonTable />
            </div>
            {/* Отступ 16 над подписью (16044:335): 12 — зазор панели, 4 — здесь. */}
            <p className="pt-4 type-caption text-text-secondary">{t.loadingNote}</p>
          </>
        )}
    </Card>
  )
}

/** Экран А1а «Администрирование · каталог · загрузка»: опрос источников по запросу (PRD 6.2; 16044:11). */
export function AdminCatalogImportPage() {
  const role = useRole()
  const { pathname } = useLocation()

  if (!canAccess(role, pathname)) {
    return <ErrorState title={ru.errors.accessDenied(ru.roles[role])} message={ru.admin.accessHint} />
  }

  return (
    <div className="flex flex-col gap-24">
      <AdminHeader active="catalog" />
      <RefreshPanel />
    </div>
  )
}
