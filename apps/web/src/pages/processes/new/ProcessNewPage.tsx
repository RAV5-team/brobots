import { ArrowLeft } from 'lucide-react'
import { useState, type SyntheticEvent } from 'react'
import { generatePath, useNavigate } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { DemoBanner } from '@/components/shell/DemoBanner'
import { Chip } from '@/components/ui/Chip'
import { SectionNav } from '@/components/ui/SectionNav'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { TextLink } from '@/components/ui/TextLink'
import { useServices } from '@/services/useServices'
import { useRole } from '@/shared/auth/useRole'
import { useActiveSection } from '@/shared/dom/useActiveSection'
import { clearDraft, readDraft, useDraftAutosave } from '@/shared/dom/useDraftAutosave'
import { formatNumber, formatTime } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { ProcessSection } from './ProcessSection'
import { StaffSection } from './StaffSection'
import { TemplateCheckRail } from './TemplateCheckRail'
import { CostsSection, RouteSection, VolumeSection } from './VolumeRouteSections'
import { toNewProcess, validateForm, type FormErrors } from './processCalc'
import { NUMERIC_SPECS, SECTION_IDS, type NumericKey, type ProcessForm, type SectionId } from './processForm'
import { carrierOptions, categoryOptions, classOptions, numericHints, templateCheck } from './processNewModel'
import { useProcessNew, type ProcessNewData } from './useProcessNew'

const t = ru.processNew
const DRAFT_KEY = 'rav5.draft.process-new.v1'
const NAV_ITEMS = SECTION_IDS.map((id) => ({ id, label: t.nav[id] }))

/** Черновик из браузера годится, если у него форма той же версии: класс, список групп, способы. */
function isProcessForm(value: unknown): value is ProcessForm {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<ProcessForm>
  return typeof v.operationClass === 'string' && Array.isArray(v.staff) && Array.isArray(v.handling) && typeof v.dailyVolume === 'string'
}

/** Секция первой ошибки — туда ведём после неудачной проверки. */
function firstErrorSection(errors: FormErrors): SectionId {
  const keys = Object.keys(errors)
  if (keys.some((k) => ['name', 'carrier', 'category', 'handling', 'unitMassKg'].includes(k))) return 'process'
  const numeric = keys.find((k): k is NumericKey => k in NUMERIC_SPECS)
  if (numeric && NUMERIC_SPECS[numeric].section !== 'staff') return NUMERIC_SPECS[numeric].section
  return 'staff'
}

function ProcessNewSkeleton() {
  return (
    <div className="flex gap-24" aria-busy="true">
      <Skeleton className="h-48 flex-1" />
      <Skeleton className="h-48 w-(--rav-form-rail-width)" />
    </div>
  )
}

/** Форма после загрузки справочников: состояние, автосохранение черновика, проверка и сохранение. */
function ProcessNewForm({ data, canSave }: { readonly data: ProcessNewData; readonly canSave: boolean }) {
  const services = useServices()
  const navigate = useNavigate()
  const [form, setForm] = useState<ProcessForm>(() => (canSave ? readDraft(DRAFT_KEY, isProcessForm) : null) ?? data.initialForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const savedAt = useDraftAutosave(DRAFT_KEY, form, canSave)
  const { activeId, select } = useActiveSection(SECTION_IDS)

  const update = (patch: Partial<ProcessForm>) => { setForm((prev) => ({ ...prev, ...patch })) }
  const sectionProps = { form, errors, update, hints: numericHints(data.base, form) }
  const cls = data.operationClasses.find((c) => c.code === form.operationClass)

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault()
    const found = validateForm(form)
    setErrors(found)
    const count = Object.keys(found).length
    if (count > 0) {
      setMessage(t.errors.summary(formatNumber(count)))
      select(firstErrorSection(found))
      return
    }
    setMessage(null)
    setSaving(true)
    try {
      const created = await services.processes.createProcess(toNewProcess(form, cls?.unit ?? '', cls?.description ?? ''))
      clearDraft(DRAFT_KEY)
      void navigate(generatePath(ROUTE_PATHS.process, { processId: created.code }))
    } catch (error) {
      console.error('Не удалось сохранить процесс', error)
      setMessage(t.errors.saveFailed)
      setSaving(false)
    }
  }

  return (
    <form noValidate onSubmit={(e) => { void submit(e) }} className="flex flex-col gap-16">
      <div className="flex items-center justify-between gap-16">
        <TextLink to={ROUTE_PATHS.processes} icon={ArrowLeft}>{t.back}</TextLink>
        {canSave
          ? savedAt && <Chip tone="muted" size="md"><span role="status">{t.draftSaved(formatTime(savedAt.toISOString()))}</span></Chip>
          : <DemoBanner />}
      </div>
      <header className="flex flex-col gap-8">
        <h1 className="type-display-lg text-text">{t.title}</h1>
        <p className="type-body text-text-secondary">{t.lead}</p>
      </header>
      <div className="flex items-start gap-24">
        <div className="flex min-w-0 flex-1 flex-col gap-20">
          <div className="sticky top-16 z-10">
            <SectionNav label={t.sectionNavLabel} items={NAV_ITEMS} activeId={activeId} onSelect={select} />
          </div>
          <ProcessSection
            {...sectionProps}
            classOptions={classOptions(data.operationClasses)}
            categoryOptions={categoryOptions(data.facilityTypes)}
            carrierOptions={carrierOptions(data.processes, data.operationClasses, form)}
            handlingMethods={data.handlingMethods}
          />
          <VolumeSection {...sectionProps} />
          <RouteSection {...sectionProps} />
          <StaffSection {...sectionProps} handlingMethods={data.handlingMethods} payrollCoef={data.base.payrollCoef} />
          <CostsSection {...sectionProps} />
        </div>
        <TemplateCheckRail
          check={templateCheck(form, data.robotsByClass, data.locations)}
          canSave={canSave}
          saving={saving}
          message={message}
        />
      </div>
    </form>
  )
}

/**
 * Экран 09а «Процессы · новый процесс вручную» — шаблон процесса в справочнике (PRD 9.2; 15935:903).
 * Гость видит форму на демо-данных, но не сохраняет: своих процессов у него нет (PRD 9.1, D-14, D-31).
 */
export function ProcessNewPage() {
  const role = useRole()
  const { state, retry } = useProcessNew()

  if (state.status === 'loading') return <ProcessNewSkeleton />
  if (state.status === 'error') return <ErrorState title={t.errors.loadTitle} message={t.errors.loadMessage} onRetry={retry} />
  return <ProcessNewForm data={state} canSave={role !== 'guest'} />
}
