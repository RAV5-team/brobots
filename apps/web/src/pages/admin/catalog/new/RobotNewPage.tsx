import { ArrowLeft } from 'lucide-react'
import { useMemo, useState, type SyntheticEvent } from 'react'
import { useNavigate } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { Chip } from '@/components/ui/Chip'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { TextLink } from '@/components/ui/TextLink'
import { nextRobotId } from '@/domain'
import { useServices } from '@/services/useServices'
import { ValidationError } from '@/services/errors'
import { clearDraft, readDraft, useDraftAutosave } from '@/shared/dom/useDraftAutosave'
import { formatNumber, formatTime } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { adminCatalogAddedPath } from '../catalogModel'
import { RobotPhotosSection } from './RobotPhotosSection'
import { RobotReadinessRail } from './RobotReadinessRail'
import { ClassesSection, ConditionsSection, MainSection, SpecsSection } from './RobotSections'
import {
  EMPTY_ROBOT_FORM,
  filledRequired,
  isRobotForm,
  railNote,
  solutionTypeOptions,
  toNewRobot,
  validateRobotForm,
  type RobotForm,
  type RobotFormErrors,
} from './robotForm'
import { usePhotoList } from './usePhotoList'
import { useRobotNew, type RobotNewData } from './useRobotNew'
import { AdminGuard } from '../../AdminGuard'

const t = ru.robotNew
/** Черновик карточки в браузере (D-21); фото в него не пишутся (D-53). */
const DRAFT_KEY = 'rav5.draft.robot-new.v1'

function RobotNewSkeleton() {
  return (
    <div className="flex gap-24" aria-busy="true">
      <Skeleton className="h-48 flex-1" />
      <Skeleton className="h-48 w-(--rav-form-rail-width)" />
    </div>
  )
}

/** После неудачной проверки — к первому полю с ошибкой: форма длиннее экрана (ТЗ 4.5.4). */
function focusFirstError(form: EventTarget) {
  if (!(form instanceof HTMLFormElement)) return
  requestAnimationFrame(() => {
    form.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]')?.focus()
  })
}

/** Форма после загрузки справочников: состояние, автосохранение черновика, проверка и сохранение. */
function RobotNewForm({ data }: { readonly data: RobotNewData }) {
  const services = useServices()
  const navigate = useNavigate()
  const [form, setForm] = useState<RobotForm>(() => readDraft(DRAFT_KEY, isRobotForm) ?? EMPTY_ROBOT_FORM)
  const [errors, setErrors] = useState<RobotFormErrors>({})
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const photos = usePhotoList()
  const savedAt = useDraftAutosave(DRAFT_KEY, form, true)
  const nextId = useMemo(() => nextRobotId(data.robots.map((r) => r.id)), [data.robots])
  const solutionTypes = useMemo(() => solutionTypeOptions(data.robots), [data.robots])

  const update = (patch: Partial<RobotForm>) => { setForm((prev) => ({ ...prev, ...patch })) }
  const sectionProps = { form, errors, update }

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault()
    const found = validateRobotForm(form, data.robots)
    setErrors(found)
    const count = Object.keys(found).length
    if (count > 0) {
      setMessage(t.errors.summary(formatNumber(count)))
      focusFirstError(event.currentTarget)
      return
    }
    setMessage(null)
    setSaving(true)
    try {
      const created = await services.catalog.createRobot(toNewRobot(form, photos.photos.map((p) => p.name)))
      clearDraft(DRAFT_KEY)
      // А3 «Робот добавлен» — состояние каталога А1 (PRD 6.2).
      void navigate(adminCatalogAddedPath(created.id))
    } catch (error) {
      console.error('Не удалось сохранить робота', error)
      setMessage(error instanceof ValidationError ? error.message : t.errors.saveFailed)
      setSaving(false)
    }
  }

  return (
    <form noValidate onSubmit={(e) => { void submit(e) }} className="flex flex-col gap-24">
      <title>{t.documentTitle}</title>
      <div className="flex items-center justify-between gap-16">
        <TextLink to={ROUTE_PATHS.adminCatalog} icon={ArrowLeft}>{t.back}</TextLink>
        {savedAt && <Chip tone="muted" size="md"><span role="status">{t.draftSaved(formatTime(savedAt.toISOString()))}</span></Chip>}
      </div>
      <PageHeader title={t.title} lead={t.lead} gap={8} />
      <div className="flex items-start gap-24">
        <div className="flex min-w-0 flex-1 flex-col gap-20">
          <MainSection {...sectionProps} solutionTypes={solutionTypes} />
          <ClassesSection {...sectionProps} nextId={nextId} operationClasses={data.operationClasses} processes={data.processes} />
          <SpecsSection {...sectionProps} />
          <ConditionsSection {...sectionProps} handlingMethods={data.handlingMethods} />
          <RobotPhotosSection list={photos} />
        </div>
        <RobotReadinessRail
          readiness={{
            required: filledRequired(form, photos.photos.length),
            classes: form.classes.length,
            photos: photos.photos.length,
            note: railNote(form.classes),
          }}
          saving={saving}
          message={message}
        />
      </div>
    </form>
  )
}

/**
 * Экран А2 «Администрирование · новый робот» — карточка робота для каталога и подбора (PRD 6.3; 15966:5992).
 * Только администратор (PRD 5.3, 6); после сохранения — А3 «Каталог обновлён».
 */
export function RobotNewPage() {
  return <AdminGuard><RobotNewContent /></AdminGuard>
}

function RobotNewContent() {
  const { state, retry } = useRobotNew()
  if (state.status === 'loading') return <RobotNewSkeleton />
  if (state.status === 'error') return <ErrorState title={t.errors.loadTitle} message={t.errors.loadMessage} onRetry={retry} />
  return <RobotNewForm data={state} />
}
