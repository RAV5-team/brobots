import { generatePath, useNavigate } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { useServices } from '@/services/useServices'
import { useRole } from '@/shared/auth/useRole'
import { ru } from '@/shared/i18n/ru'
import { ProcessFormLayout } from './ProcessFormLayout'
import { toNewProcess } from './processCalc'
import { carrierOptions, categoryOptions, classOptions, numericHints, templateCheck, templateCheckRows } from './processNewModel'
import { useProcessFormState } from './useProcessFormState'
import { useProcessNew, type ProcessNewData } from './useProcessNew'

const t = ru.processNew
const DRAFT_KEY = 'rav5.draft.process-new.v1'

function ProcessNewSkeleton() {
  return (
    <div className="flex gap-24" aria-busy="true">
      <Skeleton className="h-48 flex-1" />
      <Skeleton className="h-48 w-(--rav-form-rail-width)" />
    </div>
  )
}

/** Форма после загрузки справочников: состояние, автосохранение черновика, проверка и сохранение в справочник. */
function ProcessNewForm({ data, canSave }: { readonly data: ProcessNewData; readonly canSave: boolean }) {
  const services = useServices()
  const navigate = useNavigate()
  const state = useProcessFormState({
    draftKey: DRAFT_KEY,
    initialForm: data.initialForm,
    canSave,
    onSave: async (form) => {
      const cls = data.operationClasses.find((c) => c.code === form.operationClass)
      const created = await services.processes.createProcess(toNewProcess(form, cls?.unit ?? '', cls?.description ?? ''))
      void navigate(generatePath(ROUTE_PATHS.process, { processId: created.code }))
    },
  })
  const { form } = state

  return (
    <ProcessFormLayout
      back={{ to: ROUTE_PATHS.processes, label: t.back }}
      title={t.title}
      lead={t.lead}
      state={state}
      canSave={canSave}
      hints={numericHints(data.base, form)}
      classOptions={classOptions(data.operationClasses)}
      categoryOptions={categoryOptions(data.facilityTypes)}
      carrierOptions={carrierOptions(data.processes, data.operationClasses, form)}
      handlingMethods={data.handlingMethods}
      payrollCoef={data.base.payrollCoef}
      rail={{
        copy: { title: t.rail.title, note: t.rail.note, save: t.rail.save },
        rows: templateCheckRows(templateCheck(form, data.robotsByClass, data.locations)),
      }}
    />
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
