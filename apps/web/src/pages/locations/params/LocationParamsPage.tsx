import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react'
import { useLocation, useParams } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { Button, ButtonLink } from '@/components/ui/Button'
import { SectionNav } from '@/components/ui/SectionNav'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import type { Role } from '@/domain'
import { useServices } from '@/services/useServices'
import { useRole } from '@/shared/auth/useRole'
import { useActiveSection } from '@/shared/dom/useActiveSection'
import { formatNumber, formatTime } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { LocationHeader } from '../detail/LocationHeader'
import { errorSection, readiness, validateLocation } from '../new/locationCheck'
import { SECTION_IDS, fieldDomId, type LocationForm } from '../new/locationForm'
import { AreaSection, BasicsSection, OtherTypeNotice, ScheduleSection, type LocationSectionProps } from '../new/LocationSections'
import { ProfileReadinessRail } from '../new/ProfileReadinessRail'
import { StaffSection } from '../new/StaffSection'
import { formFromLocation, isEditLocationState, toLocationUpdate } from './locationParamsModel'
import { SiteSection } from './SiteSection'
import { SITE_GROUPS } from '@/domain'
import { siteFieldErrors, siteFieldId, siteSectionOf, siteValuesFromLocation, type SiteValues } from './siteProfileFields'
import { useLocationParams, type LocationParamsData } from './useLocationParams'

const t = ru.location
const tf = ru.locationNew
const PARAMS_SECTION_IDS = [...SECTION_IDS, ...SITE_GROUPS] as const
const ALL_NAV_ITEMS = [
  ...SECTION_IDS.map((id) => ({ id, label: tf.nav[id] })),
  ...SITE_GROUPS.map((id) => ({ id, label: t.params.site.groups[id] })),
]
const BASICS_ONLY = ALL_NAV_ITEMS.filter((item) => item.id === 'basics')

function LocationParamsSkeleton() {
  return (
    <div className="flex flex-col gap-16" aria-busy="true">
      <Skeleton className="h-48 w-1/3" />
      <div className="flex gap-24">
        <Skeleton className="h-48 flex-1" />
        <Skeleton className="h-48 w-(--rav-form-rail-width)" />
      </div>
    </div>
  )
}

/** Перейти к полю: прокрутить к его секции и поставить фокус в само поле. */
function focusField(key: string, select: (id: string) => void, parameters: LocationParamsData['params']) {
  const site = siteSectionOf(key, [...parameters.values()])
  select(errorSection(key, parameters))
  document.getElementById(site ? siteFieldId(key) : fieldDomId(key))?.focus({ preventScroll: true })
}

function hashCode(hash: string): string {
  return hash.startsWith('#') ? hash.slice(1) : hash
}

interface ParamsFormProps {
  readonly data: LocationParamsData
  readonly editing: boolean
  /** Сохранено: закрыть режим правки и перечитать локацию. */
  readonly onSaved: () => Promise<void>
  readonly status: string | null
}

/**
 * Профиль площадки — те же четыре секции, что у формы 14 (PRD 10.3). В режиме просмотра контролы и панель
 * приглушены и недоступны (`fieldset disabled`, 16005:291); «Изменить» в шапке включает правку.
 */
function ParamsForm({ data, editing, onSaved, status }: ParamsFormProps) {
  const services = useServices()
  const { hash } = useLocation()
  const { location, params } = data
  const [form, setForm] = useState<LocationForm>(() => formFromLocation(location, params))
  const catalog = useMemo(() => [...params.values()], [params])
  const [site, setSite] = useState<SiteValues>(() => siteValuesFromLocation(location, catalog))
  const [showRequired, setShowRequired] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const isWarehouse = location.facilityType === 'warehouse'
  const { activeId, select } = useActiveSection(isWarehouse ? PARAMS_SECTION_IDS : ['basics'])
  const wasEditing = useRef(editing)

  // «Изменить» — в название; ссылка с шага 1 (`#site_*`) — в это поле.
  useEffect(() => {
    if (!editing) {
      wasEditing.current = false
      return
    }
    const target = hashCode(hash)
    const group = siteSectionOf(target, catalog)
    const id = group ? siteFieldId(target) : !wasEditing.current ? fieldDomId('name') : null
    if (group) select(group)
    if (id) {
      // Селекты площадки монтируются вместе с fieldset — фокус после кадра, иначе его перехватывают.
      requestAnimationFrame(() => {
        const el = document.getElementById(id)
        el?.scrollIntoView({ block: 'center' })
        el?.focus({ preventScroll: true })
      })
    }
    wasEditing.current = true
  }, [catalog, editing, hash, select])

  const formErrors = validateLocation(form, params, { showRequired })
  const siteErrors = siteFieldErrors(site, catalog)
  const errors = { ...formErrors, ...siteErrors }
  const ready = readiness(form, formErrors, params)
  const update = (patch: Partial<LocationForm>) => { setForm((prev) => ({ ...prev, ...patch })) }
  const sectionProps: LocationSectionProps = { form, errors, update, params }
  const goToFirstError = () => {
    const [first] = Object.keys(errors)
    if (first) focusField(first, select, params)
  }

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault()
    if (!editing) return
    const found = { ...validateLocation(form, params, { showRequired: true }), ...siteFieldErrors(site, catalog) }
    setShowRequired(true)
    const keys = Object.keys(found)
    const [first] = keys
    if (first) {
      setMessage(tf.errors.summary(formatNumber(keys.length)))
      focusField(first, select, params)
      return
    }
    setMessage(null)
    setSaving(true)
    try {
      await services.locations.updateLocation(location.id, toLocationUpdate(form, params, location, site))
      await onSaved()
    } catch (error) {
      console.error('Не удалось сохранить параметры локации', error)
      setMessage(t.params.saveFailed)
      setSaving(false)
    }
  }

  return (
    <form noValidate onSubmit={(e) => { void submit(e) }} className="flex items-start gap-24" aria-label={t.tabs.params}>
      <div className="flex min-w-0 flex-1 flex-col gap-20">
        <div className="sticky top-16 z-10">
          <SectionNav label={t.params.sectionNavLabel} items={isWarehouse ? ALL_NAV_ITEMS : BASICS_ONLY} activeId={activeId} onSelect={select} />
        </div>
        <fieldset disabled={!editing} className="flex min-w-0 flex-col gap-20">
          <BasicsSection {...sectionProps} typeLockedHint={t.params.typeLocked} />
          {form.facilityType === 'warehouse' ? (
            <>
              <AreaSection {...sectionProps} description={t.params.areaDescription} />
              <ScheduleSection {...sectionProps} />
              <StaffSection {...sectionProps} />
              <SiteSection
                parameters={catalog}
                values={site}
                errors={siteErrors}
                onChange={(code, value) => { setSite((prev) => ({ ...prev, [code]: value })) }}
              />
            </>
          ) : (
            <OtherTypeNotice facilityType={form.facilityType} copy={t.params.otherType} />
          )}
        </fieldset>
      </div>
      <fieldset disabled={!editing} className="sticky top-24 shrink-0 self-start">
        <ProfileReadinessRail
          readiness={ready}
          saveBlock={null}
          saving={saving}
          message={message}
          status={editing ? null : status}
          onGoToError={goToFirstError}
          dimmed={!editing}
        />
      </fieldset>
    </form>
  )
}

/**
 * Экран 17а «Локации · параметры объекта» (16005:291; PRD 10.3, 10.5): шапка локации, вкладки и профиль площадки
 * в режиме просмотра с «Изменить» (D-41). Гость только смотрит: своих локаций и сохранения у него нет (D-14).
 */
function wantsEdit(role: Role, hash: string, navState: unknown): boolean {
  const code = hashCode(hash)
  return role !== 'guest' && (code.startsWith('site_') || code.startsWith('wh_') || isEditLocationState(navState))
}

export function LocationParamsPage() {
  const { locationId = '' } = useParams()
  const { hash, state: navState } = useLocation()
  const role = useRole()
  const { state, retry, refresh } = useLocationParams(locationId)
  const [editing, setEditing] = useState(() => wantsEdit(role, hash, navState))
  // Сеанс правки: «Отменить изменения» и сохранение пересоздают форму со значениями локации.
  const [session, setSession] = useState(0)
  const [status, setStatus] = useState<string | null>(null)
  const seenLocationId = useRef(locationId)

  // С шага 1: `#site_*` или state.edit включают правку. После «Сохранить» тот же hash не открывает её снова.
  useEffect(() => {
    const switched = seenLocationId.current !== locationId
    seenLocationId.current = locationId
    if (wantsEdit(role, hash, navState)) setEditing(true)
    else if (switched) setEditing(false)
  }, [hash, navState, role, locationId])

  if (state.status === 'loading') return <LocationParamsSkeleton />
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
  const closeEditing = () => {
    setEditing(false)
    setSession((n) => n + 1)
  }
  const onSaved = async () => {
    await refresh()
    setStatus(t.params.saved(formatTime(new Date().toISOString())))
    closeEditing()
  }
  const action = isGuest ? null : editing
    ? <Button onClick={closeEditing}>{t.params.cancel}</Button>
    : <Button aria-label={t.params.editLabel} onClick={() => { setStatus(null); setEditing(true) }}>{t.params.edit}</Button>

  return (
    <article className="flex flex-col gap-16" aria-labelledby="location-title">
      <title>{t.documentTitle(state.location.name)}</title>
      <LocationHeader
        location={state.location}
        summary={state.summary}
        facilityTypeName={state.facilityTypeName}
        isGuest={isGuest}
        activeTab="params"
        action={action}
      />
      <ParamsForm key={session} data={state} editing={editing} onSaved={onSaved} status={status} />
    </article>
  )
}
