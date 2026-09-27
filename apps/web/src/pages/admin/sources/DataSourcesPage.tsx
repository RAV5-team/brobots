import { clsx } from 'clsx'
import { ArrowRight } from 'lucide-react'
import { useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { MergedButton } from '@/components/ui/MergedButton'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/Table'
import { Toggle } from '@/components/ui/Toggle'
import { canAutoRefresh, type DataSource } from '@/domain'
import { canAccess } from '@/shared/auth/resolveRole'
import { useRole } from '@/shared/auth/useRole'
import { formatDayOf } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { AdminHeader } from '../AdminHeader'
import { refreshLabel, sourceTypeLabel } from './dataSourcesModel'
import { NewDataSourceModal } from './NewDataSourceModal'
import { useDataSources, type DataSourcesModel } from './useDataSources'

const t = ru.dataSources
const SKELETON_ROWS = [0, 1, 2, 3, 4, 5]

interface SourceRowProps {
  readonly source: DataSource
  readonly isPending: boolean
  readonly onRefreshModeChange: DataSourcesModel['setRefresh']
  readonly onRefresh: DataSourcesModel['refresh']
}

function SourceRow({ source, isPending, onRefreshModeChange, onRefresh }: SourceRowProps) {
  const isAuto = source.refresh !== 'manual'
  return (
    <TableRow>
      <TableCell>
        <p className="type-body font-semibold text-text">{source.name}</p>
        <p className="mt-4 type-caption text-text-secondary">{sourceTypeLabel(source)}</p>
      </TableCell>
      <TableCell>
        <Chip tone={source.status === 'confirmed' ? 'accent' : 'neutral'}>{t.status[source.status]}</Chip>
      </TableCell>
      <TableCell className="text-text-secondary">{source.provides}</TableCell>
      <TableCell>
        <span className="type-caption font-medium text-text-secondary">{formatDayOf(source.actualizedOn)}</span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-8">
          {/* Автообновление — только у источника по ссылке (PRD 6.10); у файла переключатель показывает режим, но заблокирован. */}
          <Toggle
            label={t.toggleLabel(source.name)}
            hideLabel
            checked={isAuto}
            disabled={isPending || !canAutoRefresh(source)}
            onCheckedChange={(on) => { onRefreshModeChange(source, on ? 'monthly' : 'manual') }}
          />
          <span className={clsx('type-caption', isAuto ? 'text-text' : 'text-text-muted')}>{refreshLabel(source)}</span>
        </div>
      </TableCell>
      <TableCell align="end">
        <Button aria-label={t.refreshActionLabel(source.name)} aria-busy={isPending} disabled={isPending} onClick={() => { onRefresh(source) }}>
          {isPending ? t.refreshing : t.refreshAction}
        </Button>
      </TableCell>
    </TableRow>
  )
}

function SourcesTable({ model, sources }: { readonly model: DataSourcesModel; readonly sources: readonly DataSource[] }) {
  if (sources.length === 0) return <EmptyState title={t.empty.title} description={t.empty.description} />
  return (
    <Table caption={t.title} layout="fixed" density="roomy">
      <TableHead>
        <TableRow>
          <TableHeaderCell>{t.columns.source}</TableHeaderCell>
          <TableHeaderCell className="w-(--rav-sources-status-width)">{t.columns.status}</TableHeaderCell>
          <TableHeaderCell className="w-(--rav-sources-provides-width)">{t.columns.provides}</TableHeaderCell>
          <TableHeaderCell className="w-(--rav-sources-actualized-width)">{t.columns.actualized}</TableHeaderCell>
          <TableHeaderCell className="w-(--rav-sources-refresh-width)">{t.columns.refresh}</TableHeaderCell>
          <TableHeaderCell className="w-(--rav-sources-action-width)"><span className="sr-only">{t.columns.actions}</span></TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {sources.map((source) => (
          <SourceRow
            key={source.key}
            source={source}
            isPending={model.pending.has(source.key)}
            onRefreshModeChange={model.setRefresh}
            onRefresh={model.refresh}
          />
        ))}
      </TableBody>
    </Table>
  )
}

function SourcesPanel({ model }: { readonly model: DataSourcesModel }) {
  const { state } = model
  return (
    <Card gap={0} aria-label={t.title}>
      {/* Живая область есть всегда, чтобы итог «Обновить» прочитала экранная читалка; пустая — скрыта. */}
      <p role="status" className="pb-12 type-body-sm text-text-secondary empty:hidden">{model.notice}</p>
      {state.status === 'loading' && (
        <div className="flex flex-col gap-8 py-16" aria-busy="true">
          {SKELETON_ROWS.map((i) => <Skeleton key={i} className="h-48" />)}
        </div>
      )}
      {state.status === 'error' && <ErrorState title={t.error.title} message={t.error.message} onRetry={model.retry} />}
      {state.status === 'ready' && <SourcesTable model={model} sources={state.sources} />}
    </Card>
  )
}

function SourcesContent() {
  const model = useDataSources()
  const [isCreating, setIsCreating] = useState(false)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const { state } = model

  // Окно монтируется без Dialog.Trigger — фокус на «Добавить источник» возвращаем сами.
  const closeDialog = () => {
    setIsCreating(false)
    requestAnimationFrame(() => { addButtonRef.current?.focus() })
  }

  const handleCreated = (created: DataSource) => {
    closeDialog()
    model.added(created)
  }

  // «Добавить источник» открывает окно А7 на этом же маршруте (PRD 6.9, D-22); пока реестр не загружен — недоступна.
  const addButton = (
    <MergedButton ref={addButtonRef} label={t.add} icon={ArrowRight} disabled={state.status !== 'ready'} onClick={() => { setIsCreating(true) }} />
  )
  return (
    <div className="flex flex-col gap-24">
      <AdminHeader active="sources" action={addButton} />
      <SourcesPanel model={model} />
      {isCreating && state.status === 'ready' && (
        <NewDataSourceModal existing={state.sources} onClose={closeDialog} onCreated={handleCreated} />
      )}
    </div>
  )
}

/** Экран А6 «Администрирование · источники данных»: откуда данные, подтверждены ли и как обновляются (PRD 6.9; 15966:7246). */
export function DataSourcesPage() {
  const role = useRole()
  const { pathname } = useLocation()

  // Реестр источников ведёт только администратор (PRD 5.3, 6.9).
  if (!canAccess(role, pathname)) {
    return <ErrorState title={ru.errors.accessDenied(ru.roles[role])} message={ru.admin.accessHint} />
  }
  return <SourcesContent />
}
