import { useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/Table'
import { formatCount } from '@/shared/format'
import { canAccess } from '@/shared/auth/resolveRole'
import { useRole } from '@/shared/auth/useRole'
import { ru } from '@/shared/i18n/ru'
import { AdminHeader } from '../AdminHeader'
import type { OperationClass } from '@/domain'
import { NewOperationClassModal } from './NewOperationClassModal'
import type { OperationClassRow } from './operationClassesModel'
import { useOperationClasses } from './useOperationClasses'

const t = ru.operationClasses
const SKELETON_ROWS = [0, 1, 2, 3, 4]

function ClassRow({ row }: { readonly row: OperationClassRow }) {
  return (
    <TableRow>
      <TableCell>
        <span className="type-body-sm text-text-secondary">{row.code}</span>
      </TableCell>
      <TableCell>
        <p className="type-body font-semibold text-text">{row.name}</p>
        <p className="mt-4 type-body-sm text-text-secondary">{row.description}</p>
      </TableCell>
      <TableCell>
        {/* 0 роботов — новый класс ещё не отмечен в карточках: плашка приглушена (D-34). */}
        <Chip tone={row.robotCount === 0 ? 'muted' : 'neutral'}>{formatCount(row.robotCount, ru.plural.robots)}</Chip>
      </TableCell>
      <TableCell>
        <span className="type-body-sm font-medium text-text">
          {row.processCount === 0 ? t.noProcesses : formatCount(row.processCount, ru.plural.processes)}
        </span>
      </TableCell>
    </TableRow>
  )
}

function ClassesTable({ rows }: { readonly rows: readonly OperationClassRow[] }) {
  if (rows.length === 0) return <EmptyState title={t.empty.title} description={t.empty.description} />
  return (
    <>
      <Table caption={t.title} layout="fixed" density="relaxed">
        <TableHead>
          <TableRow>
            <TableHeaderCell className="w-(--rav-op-class-code-width)">{t.columns.code}</TableHeaderCell>
            <TableHeaderCell>{t.columns.name}</TableHeaderCell>
            <TableHeaderCell className="w-(--rav-op-class-robots-width)">{t.columns.robots}</TableHeaderCell>
            <TableHeaderCell className="w-(--rav-op-class-processes-width)">{t.columns.processes}</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => <ClassRow key={row.code} row={row} />)}
        </TableBody>
      </Table>
      <p className="type-caption text-text-muted">{t.footnote(formatCount(rows.length, ru.plural.classes))}</p>
    </>
  )
}

function ClassesPanel() {
  const { state, retry, reload } = useOperationClasses()
  const [isCreating, setIsCreating] = useState(false)
  const [createdNote, setCreatedNote] = useState('')
  const addButtonRef = useRef<HTMLButtonElement>(null)

  // Окно монтируется без Dialog.Trigger — фокус на «Добавить класс» возвращаем сами.
  const closeDialog = () => {
    setIsCreating(false)
    requestAnimationFrame(() => { addButtonRef.current?.focus() })
  }

  const handleCreated = (created: OperationClass) => {
    closeDialog()
    setCreatedNote(t.created(created.code, created.name))
    reload()
  }

  return (
    <Card gap={16} aria-labelledby="operation-classes-title">
      <div className="flex items-center justify-between gap-16">
        <h2 id="operation-classes-title" className="type-heading text-text">{t.title}</h2>
        {/* PRD 6.7: «Добавить класс» открывает окно А10 на этом же маршруте (D-22). */}
        <Button ref={addButtonRef} variant="primary" disabled={state.status !== 'ready'} onClick={() => { setIsCreating(true) }}>{t.add}</Button>
      </div>
      {/* Живая область есть всегда, чтобы сообщение о новом классе прочитала экранная читалка; пустая — скрыта. */}
      <p role="status" className="type-body-sm text-text-secondary empty:hidden">{createdNote}</p>
      {state.status === 'loading' && (
        <div className="flex flex-col gap-8" aria-busy="true">
          {SKELETON_ROWS.map((i) => <Skeleton key={i} className="h-44" />)}
        </div>
      )}
      {state.status === 'error' && <ErrorState title={t.error.title} message={t.error.message} onRetry={retry} />}
      {state.status === 'ready' && <ClassesTable rows={state.rows} />}
      {isCreating && state.status === 'ready' && (
        <NewOperationClassModal existing={state.rows} onClose={closeDialog} onCreated={handleCreated} />
      )}
    </Card>
  )
}

/** Экран А8 «Администрирование · классы операций» — справочник ключей подбора (PRD 6.7; 15966:8018). */
export function OperationClassesPage() {
  const role = useRole()
  const { pathname } = useLocation()

  // Справочник ведёт только администратор (PRD 5.3, 6.7).
  if (!canAccess(role, pathname)) {
    return <ErrorState title={ru.errors.accessDenied(ru.roles[role])} message={ru.admin.accessHint} />
  }

  // Шаг 24 между шапкой, вкладками и панелью (15966:8019), а не общий 16 каркаса.
  return (
    <div className="flex flex-col gap-24">
      <AdminHeader active="operationClasses" />
      <ClassesPanel />
    </div>
  )
}
