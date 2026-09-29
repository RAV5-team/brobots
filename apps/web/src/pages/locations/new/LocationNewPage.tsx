import { ArrowLeft } from 'lucide-react'
import { useState, type SyntheticEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { DemoBanner } from '@/components/shell/DemoBanner'
import { Chip } from '@/components/ui/Chip'
import { SectionNav } from '@/components/ui/SectionNav'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { TextLink } from '@/components/ui/TextLink'
import { useServices } from '@/services/useServices'
import { useRole } from '@/shared/auth/useRole'
import { downloadText } from '@/shared/dom/download'
import { useActiveSection } from '@/shared/dom/useActiveSection'
import { clearDraft, readDraft, useDraftAutosave } from '@/shared/dom/useDraftAutosave'
import { formatNumber, formatTime } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { createdLocationState } from '../createdLocation'
import { errorSection, readiness, toNewLocation, validateLocation } from './locationCheck'
import { applyLocationFile, locationSheetCsv } from './locationSheet'
import { SECTION_IDS, draftFromNavState, extraSections, fieldDomId, isLocationForm, type LocationForm, type ParameterIndex } from './locationForm'
import { AreaSection, BasicsSection, ExtraSections, OtherTypeNotice, ScheduleSection, type LocationSectionProps } from './LocationSections'
import { ProfileReadinessRail, type SaveBlock } from './ProfileReadinessRail'
import { StaffSection } from './StaffSection'
import { useLocationNew, type LocationNewData } from './useLocationNew'

const t = ru.locationNew
export const LOCATION_DRAFT_KEY = 'rav5.draft.location-new.v2'
const ALL_NAV_ITEMS = SECTION_IDS.map((id) => ({ id, label: t.nav[id] }))
const BASICS_ONLY = ALL_NAV_ITEMS.filter((item) => item.id === 'basics')

function LocationNewSkeleton() {
  return (
    <div className="flex gap-24" aria-busy="true">
      <Skeleton className="h-48 flex-1" />
      <Skeleton className="h-48 w-(--rav-form-rail-width)" />
    </div>
  )
}

/** Перейти к полю: прокрутить к его секции и поставить фокус в само поле (или в секцию, если поля нет). */
function focusField(key: string, select: (id: string) => void, params: ParameterIndex) {
  select(errorSection(key, params))
  const el = document.getElementById(fieldDomId(key))
  el?.focus({ preventScroll: true })
}

/** Форма после загрузки параметров: состояние, автосохранение черновика (D-21), живая проверка и сохранение. */
function LocationNewForm({ data, canSave }: { readonly data: LocationNewData; readonly canSave: boolean }) {
  const services = useServices()
  const navigate = useNavigate()
  const navState: unknown = useLocation().state
  // Стартовая форма: сценарий навигации (сверка с макетом) → черновик браузера → демо-профиль склада.
  const [form, setForm] = useState<LocationForm>(
    () => draftFromNavState(navState) ?? (canSave ? readDraft(LOCATION_DRAFT_KEY, isLocationForm) : null) ?? data.initialForm,
  )
  const [showRequired, setShowRequired] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const savedAt = useDraftAutosave(LOCATION_DRAFT_KEY, form, canSave)
  const isWarehouse = form.facilityType === 'warehouse'
  const extras = extraSections(data.params).map((section, index) => ({ id: section.id, label: `${String(index + 5)}. ${section.title}` }))
  const { activeId, select } = useActiveSection(isWarehouse ? [...SECTION_IDS, ...extras.map((section) => section.id)] : ['basics'])

  const errors = validateLocation(form, data.params, { showRequired })
  const ready = readiness(form, errors, data.params)
  const update = (patch: Partial<LocationForm>) => { setForm((prev) => ({ ...prev, ...patch })) }
  const sectionProps: LocationSectionProps = { form, errors, update, params: data.params }
  const saveBlock: SaveBlock = !canSave ? 'guest' : isWarehouse ? null : 'otherType'
  const goToFirstError = () => {
    const [first] = Object.keys(errors)
    if (first) focusField(first, select, data.params)
  }
  const downloadTemplate = () => { downloadText(t.rail.excelFileName, locationSheetCsv(form, data.params)) }
  const importTemplate = (file: File) => {
    void applyLocationFile(form, data.params, file).then((result) => {
      if (!result.ok) {
        setImportStatus(null)
        setMessage(t.rail.excelBadFile)
        return
      }
      setForm(result.form)
      setMessage(null)
      const count = formatNumber(result.applied)
      const sample = result.unknown.slice(0, 3).join(', ')
      setImportStatus(sample === '' ? t.rail.excelImported(count) : t.rail.excelUnknown(count, sample))
    }).catch((error: unknown) => {
      console.error('Не удалось прочитать шаблон локации', error)
      setImportStatus(null)
      setMessage(t.rail.excelReadFailed)
    })
  }

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault()
    if (saveBlock !== null) return
    const found = validateLocation(form, data.params, { showRequired: true })
    setShowRequired(true)
    const keys = Object.keys(found)
    const [first] = keys
    if (first) {
      setMessage(t.errors.summary(formatNumber(keys.length)))
      focusField(first, select, data.params)
      return
    }
    setMessage(null)
    setSaving(true)
    try {
      const created = await services.locations.createLocation(toNewLocation(form, data.params))
      clearDraft(LOCATION_DRAFT_KEY)
      void navigate(ROUTE_PATHS.locations, { state: createdLocationState(created.id) })
    } catch (error) {
      console.error('Не удалось сохранить локацию', error)
      setMessage(t.errors.saveFailed)
      setSaving(false)
    }
  }

  return (
    <form noValidate onSubmit={(e) => { void submit(e) }} className="flex flex-col gap-16">
      <title>{t.documentTitle}</title>
      <div className="flex items-center justify-between gap-16">
        <TextLink to={ROUTE_PATHS.locations} icon={ArrowLeft}>{t.back}</TextLink>
        {canSave
          ? savedAt && <Chip tone="muted" size="md"><span role="status">{t.draftSaved(formatTime(savedAt.toISOString()))}</span></Chip>
          : <DemoBanner />}
      </div>
      <h1 className="type-display-lg text-text">{t.title}</h1>
      <div className="flex items-start gap-24">
        <div className="flex min-w-0 flex-1 flex-col gap-20">
          <div className="sticky top-16 z-10">
            <SectionNav label={t.sectionNavLabel} items={isWarehouse ? [...ALL_NAV_ITEMS, ...extras] : BASICS_ONLY} activeId={activeId} onSelect={select} />
          </div>
          <BasicsSection {...sectionProps} />
          {form.facilityType === 'warehouse' ? (
            <>
              <AreaSection {...sectionProps} />
              <ScheduleSection {...sectionProps} />
              <StaffSection {...sectionProps} />
              <ExtraSections {...sectionProps} />
            </>
          ) : (
            <OtherTypeNotice facilityType={form.facilityType} />
          )}
        </div>
        <ProfileReadinessRail
          readiness={ready}
          saveBlock={saveBlock}
          saving={saving}
          message={message}
          status={importStatus}
          onGoToError={goToFirstError}
          onDownloadTemplate={downloadTemplate}
          onImportTemplate={importTemplate}
        />
      </div>
    </form>
  )
}

/**
 * Экран 14 «Локации · новая локация · форма» — профиль площадки (PRD 10.2; 15950:1952).
 * Гость видит форму на демо-данных, но не сохраняет: своих локаций у него нет (D-14, D-34, D-36).
 */
export function LocationNewPage() {
  const role = useRole()
  const { state, retry } = useLocationNew()

  if (state.status === 'loading') return <LocationNewSkeleton />
  if (state.status === 'error') return <ErrorState title={t.errors.loadTitle} message={t.errors.loadMessage} onRetry={retry} />
  return <LocationNewForm data={state} canSave={role !== 'guest'} />
}
