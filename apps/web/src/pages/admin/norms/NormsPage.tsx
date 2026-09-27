import { useState } from 'react'
import { useLocation } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorState, Skeleton } from '@/components/ui/States'
import type { Norm } from '@/domain'
import { canAccess } from '@/shared/auth/resolveRole'
import { useRole } from '@/shared/auth/useRole'
import { formatCount } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { AdminHeader } from '../AdminHeader'
import { buildNormRows, collectNormChanges, type NormDraft } from './normsModel'
import { NormsTable } from './NormsTable'
import { useNorms, type SaveState } from './useNorms'

const t = ru.norms
const SKELETON_ROWS = [0, 1, 2, 3, 4, 5]

interface SaveBarProps {
  readonly changedCount: number
  readonly invalidCount: number
  readonly isSaving: boolean
  readonly onSave: () => void
  readonly onReset: () => void
}

/** Панель сохранения: видна, пока есть несохранённые правки, и липнет к низу окна (D-49). */
function SaveBar({ changedCount, invalidCount, isSaving, onSave, onReset }: SaveBarProps) {
  const message = invalidCount > 0
    ? t.invalid(formatCount(invalidCount, ru.plural.fields))
    : t.changed(formatCount(changedCount, ru.plural.values))
  return (
    <Card as="div" variant="tile" padding={16} className="sticky bottom-16 flex-row items-center gap-16">
      <p className="flex-1 type-body-sm text-text-secondary">{message}</p>
      <Button variant="secondary" disabled={isSaving} onClick={onReset}>{t.reset}</Button>
      <Button variant="primary" disabled={isSaving || invalidCount > 0 || changedCount === 0} onClick={onSave}>
        {isSaving ? t.saving : t.save}
      </Button>
    </Card>
  )
}

function saveNote(saveState: SaveState): string {
  if (saveState.status === 'saved') return t.saved(formatCount(saveState.count, ru.plural.values))
  if (saveState.status === 'error') return t.saveError
  return ''
}

function NormsEditor({ norms, saveState, onSave }: {
  readonly norms: readonly Norm[]
  readonly saveState: SaveState
  readonly onSave: ReturnType<typeof useNorms>['save']
}) {
  const [draft, setDraft] = useState<NormDraft>({})
  const rows = buildNormRows(norms, draft)
  const { changes, invalidCount } = collectNormChanges(norms, draft)
  const isSaving = saveState.status === 'saving'
  const hasEdits = changes.length > 0 || invalidCount > 0

  const edit = (code: string, text: string) => { setDraft((prev) => ({ ...prev, [code]: text })) }
  const save = async () => {
    if (await onSave(changes)) setDraft({})
  }

  return (
    <>
      <NormsTable rows={rows} disabled={isSaving} onEdit={edit} />
      {/* Живая область есть всегда, чтобы итог сохранения прочитала экранная читалка; пустая — скрыта. */}
      <p role="status" className="type-body-sm text-text-secondary empty:hidden">{hasEdits ? '' : saveNote(saveState)}</p>
      {hasEdits && (
        <SaveBar
          changedCount={changes.length}
          invalidCount={invalidCount}
          isSaving={isSaving}
          onSave={() => { void save() }}
          onReset={() => { setDraft({}) }}
        />
      )}
      {hasEdits && saveState.status === 'error' && <p role="alert" className="type-body-sm text-danger">{t.saveError}</p>}
    </>
  )
}

function NormsPanel() {
  const { state, saveState, retry, save } = useNorms()
  return (
    <Card gap={16} aria-labelledby="norms-title">
      <header>
        <h2 id="norms-title" className="type-heading text-text">{t.title}</h2>
        <p className="type-body text-text-secondary">{t.lead}</p>
      </header>
      {state.status === 'loading' && (
        <div className="flex flex-col gap-8" aria-busy="true">
          {SKELETON_ROWS.map((i) => <Skeleton key={i} className="h-44" />)}
        </div>
      )}
      {state.status === 'error' && <ErrorState title={t.error.title} message={t.error.message} onRetry={retry} />}
      {state.status === 'ready' && <NormsEditor norms={state.norms} saveState={saveState} onSave={save} />}
    </Card>
  )
}

/** Экран А5 «Администрирование · нормативы и допущения» — значения по умолчанию для расчёта (PRD 6.8; 15997:371). */
export function NormsPage() {
  const role = useRole()
  const { pathname } = useLocation()

  // Нормативы правит только администратор (PRD 5.3, 6).
  if (!canAccess(role, pathname)) {
    return <ErrorState title={ru.errors.accessDenied(ru.roles[role])} message={ru.admin.accessHint} />
  }

  // Шаг 24 между шапкой, вкладками и панелью (15997:373 → 15997:377 → 15997:387).
  return (
    <div className="flex flex-col gap-24">
      <AdminHeader active="norms" />
      <NormsPanel />
    </div>
  )
}
