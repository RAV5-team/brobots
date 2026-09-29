import { ArrowLeft } from 'lucide-react'
import { DemoBanner } from '@/components/shell/DemoBanner'
import { Chip } from '@/components/ui/Chip'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionNav } from '@/components/ui/SectionNav'
import type { SelectOption } from '@/components/ui/Select'
import { TextLink } from '@/components/ui/TextLink'
import type { HandlingMethod, OperationClassCode } from '@/domain'
import { downloadText } from '@/shared/dom/download'
import { formatNumber, formatTime } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { ProcessCheckRail, type CheckRailCopy, type CheckRow } from './ProcessCheckRail'
import { applyProcessFile, processSheetCsv, type ProcessSheetCatalog } from './processSheet'
import { ProcessSection } from './ProcessSection'
import { ProcessStaffSection } from './ProcessStaffSection'
import { CostsSection, RouteSection, VolumeSection } from './VolumeRouteSections'
import { SECTION_IDS, type NumericKey } from './processForm'
import type { ProcessFormState } from './useProcessFormState'

const t = ru.processNew
const NAV_ITEMS = SECTION_IDS.map((id) => ({ id, label: t.nav[id] }))

interface ProcessFormLayoutProps {
  readonly back: { readonly to: string; readonly label: string }
  readonly title: string
  /** Класс копии на локации задан шаблоном и не меняется (PRD 10.4). */
  readonly classLocked?: boolean
  readonly lead: string
  readonly state: ProcessFormState
  readonly canSave: boolean
  /** Сохранение закрыто не из-за гостя (демо-локация): пояснение в панели вместо плашки демо-режима. */
  readonly lockedNote?: string | null
  readonly hints: Readonly<Partial<Record<NumericKey, string>>>
  readonly classOptions: readonly SelectOption<OperationClassCode>[]
  readonly categoryOptions: readonly SelectOption<string>[]
  readonly carrierOptions: readonly SelectOption<string>[]
  readonly handlingMethods: readonly HandlingMethod[]
  readonly payrollCoef: number
  readonly rail: { readonly copy: CheckRailCopy; readonly rows: readonly CheckRow[] }
}

/**
 * Каркас формы процесса: шапка с «←» и плашкой черновика, пять секций с липкой навигацией и правая панель (D-31).
 * Один на шаблон 09а и копию на локации 16 — PRD 10.4: «состав формы полностью совпадает».
 */
export function ProcessFormLayout({ back, title, lead, state, canSave, lockedNote = null, hints, rail, ...options }: ProcessFormLayoutProps) {
  const { form, errors, update, savedAt, activeId, select, submit, saving, message, status, applyImported, rejectImported } = state
  const sectionProps = { form, errors, update, hints }
  const catalog: ProcessSheetCatalog = {
    classLocked: options.classLocked ?? false,
    classes: options.classOptions,
    categories: options.categoryOptions,
    handlingMethods: options.handlingMethods,
  }
  const downloadTemplate = () => { downloadText(t.rail.excelFileName, processSheetCsv(form, catalog)) }
  const importTemplate = (file: File) => {
    void applyProcessFile(form, catalog, file).then((result) => {
      if (!result.ok) {
        rejectImported(t.rail.excelBadFile)
        return
      }
      const count = formatNumber(result.applied)
      const sample = result.unknown.slice(0, 3).join(', ')
      applyImported(result.form, sample === '' ? t.rail.excelImported(count) : t.rail.excelUnknown(count, sample))
    }).catch((error: unknown) => {
      console.error('Не удалось прочитать шаблон процесса', error)
      rejectImported(t.rail.excelReadFailed)
    })
  }
  return (
    <form noValidate onSubmit={(e) => { void submit(e) }} className="flex flex-col gap-16">
      <div className="flex items-center justify-between gap-16">
        <TextLink to={back.to} icon={ArrowLeft}>{back.label}</TextLink>
        {canSave
          ? savedAt && <Chip tone="muted" size="md"><span role="status">{t.draftSaved(formatTime(savedAt.toISOString()))}</span></Chip>
          : lockedNote === null && <DemoBanner />}
      </div>
      <PageHeader title={title} lead={lead} gap={8} />
      <div className="flex items-start gap-24">
        <div className="flex min-w-0 flex-1 flex-col gap-20">
          <div className="sticky top-16 z-10">
            <SectionNav label={t.sectionNavLabel} items={NAV_ITEMS} activeId={activeId} onSelect={select} />
          </div>
          <ProcessSection
            {...sectionProps}
            classOptions={options.classOptions}
            classLocked={options.classLocked ?? false}
            categoryOptions={options.categoryOptions}
            carrierOptions={options.carrierOptions}
            handlingMethods={options.handlingMethods}
          />
          <VolumeSection {...sectionProps} />
          <RouteSection {...sectionProps} />
          <ProcessStaffSection {...sectionProps} handlingMethods={options.handlingMethods} payrollCoef={options.payrollCoef} />
          <CostsSection {...sectionProps} />
        </div>
        <ProcessCheckRail
          copy={rail.copy}
          rows={rail.rows}
          canSave={canSave}
          lockedNote={lockedNote}
          saving={saving}
          message={message}
          status={status}
          onDownloadTemplate={downloadTemplate}
          onImportTemplate={importTemplate}
        />
      </div>
    </form>
  )
}
