import { ArrowRight } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { useParams } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { Button, ButtonLink } from '@/components/ui/Button'
import { MergedButtonLink } from '@/components/ui/MergedButton'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { parseLocationId, type LocationProcessId, type ProcessCode } from '@/domain'
import { requireId } from '@/services/errors'
import { useServices } from '@/services/useServices'
import { ProcessFilters } from '@/pages/processes/ProcessFilters'
import { EMPTY_FILTER, filterProcesses, isFilterActive, type ProcessFilter } from '@/pages/processes/processesModel'
import { useRole } from '@/shared/auth/useRole'
import { ru } from '@/shared/i18n/ru'
import { LocationHeader } from './LocationHeader'
import { LocationProcessCard } from './LocationProcessCard'
import { locationProcessViews, type LocationDetailData, type LocationProcessView } from './locationDetailModel'
import { RemoveProcessDialog, type RemoveTarget } from './RemoveProcessDialog'
import { useLocationDetail } from './useLocationDetail'
import { TemplatePickerModal } from './templatePicker/TemplatePickerModal'
import { templateOptions } from './templatePicker/templatePickerModel'

const t = ru.location
const SKELETON_CARDS = [0, 1, 2]

function LocationSkeleton() {
  return (
    <div className="flex flex-col gap-16" aria-busy="true">
      <Skeleton className="h-48 w-1/3" />
      <div className="grid grid-cols-3 gap-16">
        {SKELETON_CARDS.map((i) => <Skeleton key={i} className="h-48" />)}
      </div>
    </div>
  )
}

interface ProcessesTabProps {
  readonly data: LocationDetailData
  readonly isGuest: boolean
  /** Привязать копию шаблона к локации (окно 15а) и перечитать вкладку. */
  readonly onAddTemplate: (code: ProcessCode) => Promise<void>
  /** Снять копию с локации (окно 17в) и перечитать вкладку. */
  readonly onRemoveProcess: (id: LocationProcessId) => Promise<void>
}

/** «Добавить процесс из шаблона» (окно 15а) и «Создать процесс →» (форма 09а) — PRD 10.4. */
function TabActions({ onOpenPicker }: { readonly onOpenPicker: () => void }) {
  return (
    <>
      <Button onClick={onOpenPicker}>{t.addFromTemplate}</Button>
      <MergedButtonLink to={ROUTE_PATHS.processNew} label={t.createProcess} icon={ArrowRight} />
    </>
  )
}

interface ProcessListProps {
  readonly data: LocationDetailData
  readonly views: readonly LocationProcessView[]
  readonly actions: ReactNode
  /** Открыть окно 17в; null — гостю удалять нечего (D-14). */
  readonly onRemove: ((target: RemoveTarget) => void) | null
}

/** Панель поиска и фильтров и карточки процессов площадки (15, 17). */
function ProcessList({ data, views, actions, onRemove }: ProcessListProps) {
  const [filter, setFilter] = useState<ProcessFilter>(EMPTY_FILTER)
  const visible = filterProcesses(views, filter)
  return (
    <>
      <ProcessFilters
        layout="row"
        filter={filter}
        onChange={setFilter}
        operationClasses={data.operationClasses}
        facilityTypes={data.facilityTypes}
        action={actions}
      />
      {visible.length === 0 && (
        <EmptyState
          title={ru.processes.notFound.title}
          description={ru.processes.notFound.description}
          action={isFilterActive(filter) && <Button onClick={() => { setFilter(EMPTY_FILTER) }}>{ru.processes.notFound.reset}</Button>}
        />
      )}
      {/* Ряды одной высоты: в макете все карточки 796 px, действия прижаты к низу (D-30). */}
      {visible.length > 0 && (
        <ul aria-label={t.listLabel(data.location.name)} className="grid auto-rows-fr grid-cols-3 gap-16">
          {visible.map((view) => (
            <li key={view.id}>
              <LocationProcessCard locationId={data.location.id} view={view} onRemove={onRemove} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

interface NoProcessesProps {
  readonly actions: ReactNode
  readonly onOpenPicker: (() => void) | null
}

/**
 * Пустая вкладка (locprocsempty, 15919:241; D-40): поиск и фильтры скрыты — искать нечего;
 * подпись блока и действия вкладки, ниже — панель с «Добавить процесс» (окно 15а).
 */
function NoProcesses({ actions, onOpenPicker }: NoProcessesProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-16">
        <div className="flex flex-col gap-4">
          <h2 className="type-heading text-text">{t.empty.heading}</h2>
          <p className="type-caption text-text-secondary">{t.empty.lead}</p>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-8">{actions}</div>}
      </div>
      <EmptyState
        size="lg"
        title={t.empty.title}
        description={t.empty.description}
        action={onOpenPicker && <Button onClick={onOpenPicker}>{t.empty.add}</Button>}
      />
    </>
  )
}

/** Вкладка «Процессы локации» (PRD 10.4): карточки площадки или пустое состояние, окно 15а. */
function ProcessesTab({ data, isGuest, onAddTemplate, onRemoveProcess }: ProcessesTabProps) {
  const [isPickerOpen, setPickerOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null)
  const [removedName, setRemovedName] = useState<string | null>(null)
  const removeButton = useRef<HTMLElement | null>(null)
  const openRemove = (target: RemoveTarget) => {
    removeButton.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setRemoveTarget(target)
  }
  // Отмена — назад на «Удалить» карточки; удалено — карточки нет, фокус на заголовок локации.
  const returnFocus = (isRemoved: boolean) => {
    const next = isRemoved ? document.getElementById('location-title') : removeButton.current
    removeButton.current = null
    next?.focus()
  }
  const views = locationProcessViews(data)
  const openPicker = () => { setPickerOpen(true) }
  // Гостю — без добавления и создания: своих локаций и сохранения у него нет (D-14, D-30).
  const actions = !isGuest && <TabActions onOpenPicker={openPicker} />

  return (
    <>
      {views.length === 0
        ? <NoProcesses actions={actions} onOpenPicker={isGuest ? null : openPicker} />
        : <ProcessList data={data} views={views} actions={actions} onRemove={isGuest ? null : openRemove} />}
      {!isGuest && (
        <TemplatePickerModal
          open={isPickerOpen}
          onOpenChange={setPickerOpen}
          locationName={data.location.name}
          options={templateOptions({ ...data, facilityType: data.location.facilityType })}
          onAdd={onAddTemplate}
        />
      )}
      {/* Карточка исчезает молча — скринридеру говорим, что удалено. */}
      {!isGuest && <p role="status" className="sr-only">{removedName && t.removeProcess.removed(removedName)}</p>}
      {!isGuest && (
        <RemoveProcessDialog
          target={removeTarget}
          locationName={data.location.name}
          onClose={() => { setRemoveTarget(null) }}
          onRemove={async (id) => {
            const name = removeTarget?.name ?? null
            await onRemoveProcess(id)
            setRemovedName(name)
          }}
          onAfterClose={returnFocus}
        />
      )}
    </>
  )
}

/**
 * Экраны 15 «Локации · локация создана» (15950:2489) и 17 «Локации · процессы локации» (15950:4324; PRD 10.3, 10.4):
 * шапка локации, вкладки и «Процессы локации». Адрес локации (15, куда ведёт «Открыть локацию» с 12а)
 * и адрес вкладки `/processes` (17) показывают одно и то же (D-37, D-40).
 */
export function LocationPage() {
  const locationId = parseLocationId(useParams().locationId)
  const role = useRole()
  const services = useServices()
  const { state, retry, refresh } = useLocationDetail(locationId)
  const addTemplate = async (code: ProcessCode) => {
    await services.locations.addLocationProcess(requireId(locationId, 'location'), code)
    await refresh()
  }
  const removeProcess = async (id: LocationProcessId) => {
    await services.locations.removeLocationProcess(id)
    // Процесс уже снят: сбой перечитывания — не ошибка удаления, перезагружаем вкладку с её собственным ErrorState.
    await refresh().catch((error: unknown) => {
      console.error('Не удалось перечитать локацию после удаления процесса', error)
      retry()
    })
  }

  if (state.status === 'loading') return <LocationSkeleton />
  if (state.status === 'error') return <ErrorState title={t.error.title} message={t.error.message} onRetry={retry} />
  if (state.status === 'notFound') {
    return (
      <EmptyState
        title={t.notFound.title}
        description={t.notFound.description}
        action={<ButtonLink to={ROUTE_PATHS.locations}>{t.notFound.back}</ButtonLink>}
      />
    )
  }

  const isGuest = role === 'guest'
  return (
    <article className="flex flex-col gap-16" aria-labelledby="location-title">
      <title>{t.documentTitle(state.location.name)}</title>
      <LocationHeader location={state.location} summary={state.summary} facilityTypeName={state.facilityTypeName} isGuest={isGuest} activeTab="processes" />
      <ProcessesTab data={state} isGuest={isGuest} onAddTemplate={addTemplate} onRemoveProcess={removeProcess} />
    </article>
  )
}
