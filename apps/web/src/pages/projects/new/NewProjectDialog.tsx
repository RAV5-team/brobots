import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { generatePath, useNavigate, useSearchParams } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { Button, ButtonLink } from '@/components/ui/Button'
import { MergedButton } from '@/components/ui/MergedButton'
import { Modal } from '@/components/ui/Modal'
import { RadioTable, type RadioTableColumn } from '@/components/ui/RadioTable'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import type { LocationId } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { useServices } from '@/services/useServices'
import {
  draftName,
  isNewProjectOpen,
  parseNewProjectContext,
  withoutNewProject,
  type LocationChoice,
  type NewProjectContext,
} from './newProjectModel'
import { useLocationChoices } from './useLocationChoices'

const t = ru.newProject
const SKELETON_ROWS = 4

const COLUMNS: readonly RadioTableColumn[] = [
  { key: 'location', label: t.columns.location },
  { key: 'area', label: t.columns.area, widthClass: 'w-(--rav-new-project-area-width)' },
  { key: 'staff', label: t.columns.staff, widthClass: 'w-(--rav-new-project-staff-width)' },
  { key: 'labor', label: t.columns.labor, widthClass: 'w-(--rav-new-project-labor-width)' },
]

function LocationCell({ choice }: { readonly choice: LocationChoice }) {
  return (
    <span className="flex flex-col gap-4">
      <span className="type-body font-semibold text-text">{choice.name}</span>
      <span className="type-caption text-text-secondary">{choice.caption}</span>
    </span>
  )
}

interface NewProjectModalProps {
  readonly context: NewProjectContext
  readonly onClose: () => void
}

/**
 * Куда вернуть фокус: окно открывает ссылка через адрес, а не Radix Trigger, поэтому Radix сам его не вернёт.
 * Ссылка остаётся в фокусе после щелчка; если нет (Safari, открытие по адресу) — кнопка «Новый проект» в меню.
 */
function openerElement(): HTMLElement | null {
  const active = document.activeElement
  if (active instanceof HTMLElement && active !== document.body) return active
  return document.querySelector<HTMLElement>('aside a[aria-haspopup="dialog"]')
}

/** Открытое окно: выбор живёт, пока окно открыто, и сбрасывается при следующем открытии. */
function NewProjectModal({ context, onClose }: NewProjectModalProps) {
  const services = useServices()
  const navigate = useNavigate()
  const { state, retry } = useLocationChoices(true)
  const [picked, setPicked] = useState<LocationId | null>(null)
  const [submit, setSubmit] = useState<'idle' | 'pending' | 'error'>('idle')
  const [opener] = useState(openerElement)

  const choices = state.status === 'ready' ? state.choices : []
  // Предвыбор из карточки процесса — пока пользователь не выбрал сам; чужой id не выбирает ничего.
  const selected = picked ?? choices.find((c) => c.id === context.locationId)?.id ?? null

  const create = async (locationId: LocationId) => {
    const choice = choices.find((c) => c.id === locationId)
    if (!choice || submit === 'pending') return
    setSubmit('pending')
    try {
      const draft = await services.projects.createDraft({
        name: draftName(choice.name),
        locationId,
        ...(context.locationId === locationId && context.locationProcessId ? { locationProcessId: context.locationProcessId } : {}),
        ...(context.solutionId ? { solutionId: context.solutionId } : {}),
      })
      // Шаг 1 «Параметры» (экран 1.1); подпись «→ A3» на доске — ошибка (D-84).
      void navigate(generatePath(ROUTE_PATHS.projectParams, { projectId: draft.id }))
    } catch (error: unknown) {
      console.error('Не удалось создать черновик проекта', error)
      setSubmit('error')
    }
  }

  const isEmpty = state.status === 'ready' && choices.length === 0
  const footer = (
    <>
      {submit === 'error' && <p role="alert" className="mr-auto type-caption text-danger">{t.createError}</p>}
      <Button onClick={onClose}>{t.cancel}</Button>
      {!isEmpty && state.status !== 'error' && (
        <MergedButton
          label={submit === 'pending' ? t.creating : t.continue}
          icon={ArrowRight}
          disabled={selected === null || submit === 'pending'}
          onClick={() => { if (selected) void create(selected) }}
        />
      )}
    </>
  )

  return (
    <Modal
      title={t.title}
      size="wide"
      open
      onOpenChange={(open) => { if (!open) onClose() }}
      onCloseAutoFocus={(event) => { event.preventDefault(); opener?.focus() }}
      footer={footer}
    >
      {state.status === 'loading' && (
        <div aria-busy className="flex flex-col gap-8">
          {Array.from({ length: SKELETON_ROWS }, (_, i) => <Skeleton key={i} className="h-44 rounded-md" />)}
        </div>
      )}
      {state.status === 'error' && <ErrorState title={t.loadError.title} message={t.loadError.message} onRetry={retry} />}
      {isEmpty && (
        <EmptyState
          title={t.empty.title}
          description={t.empty.description}
          // Форма 14; вкладка «+ Создать локацию» из прототипа на макете отсутствует (D-84).
          action={<ButtonLink to={ROUTE_PATHS.locationNew} variant="primary">{t.empty.action}</ButtonLink>}
        />
      )}
      {state.status === 'ready' && choices.length > 0 && (
        <RadioTable
          label={t.tableLabel}
          columns={COLUMNS}
          value={selected}
          onChange={(value) => { setPicked(value); setSubmit('idle') }}
          onConfirm={(value) => { void create(value) }}
          rows={choices.map((choice) => ({
            value: choice.id,
            label: t.rowLabel(choice),
            cells: [<LocationCell key="location" choice={choice} />, choice.area, choice.staff, choice.labor],
          }))}
        />
      )}
    </Modal>
  )
}

/**
 * Окно A2 «Новый проект» (PRD 11.1; 16429:2) поверх текущей страницы: открывается параметром `?new=1` (D-84).
 * Только пользователь и администратор — у гостя вместо него «Открыть демо-проект» (D-26).
 */
export function NewProjectDialog() {
  const [params, setParams] = useSearchParams()
  if (!isNewProjectOpen(params)) return null
  const close = () => { setParams(withoutNewProject(params), { replace: true }) }
  return <NewProjectModal context={parseNewProjectContext(params)} onClose={close} />
}
