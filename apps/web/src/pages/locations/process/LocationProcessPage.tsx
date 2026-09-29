import { useMemo } from 'react'
import { generatePath, useNavigate, useParams } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { parseLocationId, parseLocationProcessId } from '@/domain'
import { ProcessFormLayout } from '@/pages/processes/new/ProcessFormLayout'
import { countFormulas, countRequired, type ProcessForm } from '@/pages/processes/new/processForm'
import { carrierOptions, categoryOptions, classOptions } from '@/pages/processes/new/processNewModel'
import { useProcessFormState } from '@/pages/processes/new/useProcessFormState'
import { PAYROLL_COEF_PARAMETER } from '@/pages/processes/staffParameters'
import { numberParameter } from '@/pages/processes/locationStaffing'
import { useServices } from '@/services/useServices'
import { useRole } from '@/shared/auth/useRole'
import { formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { useModelNorms } from '@/shared/norms/useModelNorms'
import { copyValues, countChanged, formOf, siteBase, siteHints, siteValues, toLocationUpdate } from './locationProcessForm'
import { useLocationProcess, type LocationProcessData } from './useLocationProcess'

const t = ru.locationProcess
const rail = ru.processNew.rail

function LocationProcessSkeleton() {
  return (
    <div className="flex gap-24" aria-busy="true">
      <Skeleton className="h-48 flex-1" />
      <Skeleton className="h-48 w-(--rav-form-rail-width)" />
    </div>
  )
}

/** Форма копии: значения шаблона с профилем, поверх — переопределения площадки; сохраняются только отличия. */
function LocationProcessForm({ data, canSave, lockedNote }: { readonly data: LocationProcessData; readonly canSave: boolean; readonly lockedNote: string | null }) {
  const services = useServices()
  // Начисления на ФОТ, если в профиле их нет, — норматив А5 `payroll_tax_ratio`.
  const { payrollTaxRatio } = useModelNorms()
  const navigate = useNavigate()
  const { location, locationProcess: lp, process, parameters, templateDefaults } = data
  const { siteForm, initialForm, hints } = useMemo(() => {
    const ctx = { defaults: templateDefaults, process, location, parameters, operationClass: data.operationClasses.find((c) => c.code === process.operationClass) }
    const site = siteValues(ctx)
    const baseline = formOf(site, ctx)
    return { siteForm: baseline, initialForm: formOf(copyValues(site, lp), ctx), hints: siteHints(siteBase(location, parameters), baseline) }
  }, [templateDefaults, process, location, parameters, lp, data.operationClasses])
  const locationPath = generatePath(ROUTE_PATHS.location, { locationId: location.id })

  const state = useProcessFormState({
    // Черновик у каждой копии свой (D-21).
    draftKey: `rav5.draft.location-process.v1.${lp.id}`,
    initialForm,
    canSave,
    // Класс копии задан шаблоном: черновик с другим классом не подходит (PRD 10.4).
    acceptDraft: (draft: ProcessForm) => draft.operationClass === process.operationClass,
    onSave: async (form) => {
      await services.locations.updateLocationProcess(lp.id, toLocationUpdate(form, siteForm, process))
      void navigate(locationPath)
    },
  })
  const { form } = state

  return (
    <>
      <title>{t.documentTitle(form.name, location.name)}</title>
      <ProcessFormLayout
        back={{ to: locationPath, label: location.name }}
        title={form.name.trim() || process.name}
        lead={t.lead(location.name)}
        state={state}
        canSave={canSave}
        lockedNote={lockedNote}
        hints={hints}
        classOptions={classOptions(data.operationClasses)}
        classLocked
        categoryOptions={categoryOptions(data.facilityTypes)}
        carrierOptions={carrierOptions(data.processes, data.operationClasses, form)}
        handlingMethods={data.handlingMethods}
        payrollCoef={numberParameter(location, parameters, PAYROLL_COEF_PARAMETER[location.facilityType]) ?? payrollTaxRatio}
        rail={{
          copy: { title: t.rail.title, note: t.rail.note(location.name), save: t.rail.save },
          rows: [
            { label: rail.formulas, value: formatNumber(countFormulas()) },
            { label: rail.required, value: formatNumber(countRequired()) },
            { label: rail.robots, value: formatNumber(data.robotsByClass[process.operationClass] ?? 0) },
            { label: t.rail.changed, value: formatNumber(countChanged(form, siteForm)) },
          ],
        }}
      />
    </>
  )
}

/**
 * Экран 16 «Локации · процесс на локации» (PRD 10.4; 15950:3096) — форма 09а над копией шаблона.
 * Сохранение меняет только эту копию: шаблон в справочнике и другие локации не меняются (D-11).
 * Гость видит форму без сохранения и черновика (D-14); демо-локация только для просмотра у всех ролей (ролевая модель, §4).
 */
export function LocationProcessPage() {
  const params = useParams()
  const locationId = parseLocationId(params.locationId)
  const role = useRole()
  const { state, retry } = useLocationProcess(locationId, parseLocationProcessId(params.locationProcessId))

  if (state.status === 'loading') return <LocationProcessSkeleton />
  if (state.status === 'error') return <ErrorState title={t.error.title} message={t.error.message} onRetry={retry} />
  if (state.status === 'notFound') {
    return (
      <EmptyState
        title={t.notFound.title}
        description={t.notFound.description}
        action={<ButtonLink to={generatePath(ROUTE_PATHS.location, { locationId: params.locationId ?? '' })}>{t.notFound.back}</ButtonLink>}
      />
    )
  }
  const isGuest = role === 'guest'
  const isDemo = state.location.isDemo === true
  return <LocationProcessForm data={state} canSave={!isGuest && !isDemo} lockedNote={!isGuest && isDemo ? t.rail.demoReadOnly : null} />
}
