import type { SelectOption } from '@/components/ui/Select'
import type { FacilityType, Location, OperationClass, OperationClassCode, Process, WorkCategoryCode } from '@/domain'
import { formatCount, formatNumber, formatPercent } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { categoryValue, countFormulas, countRequired, parseCategory, type NumericKey, type ProcessForm } from './processForm'
import type { WarehouseBase } from './processNew.mock'
import type { TemplateCheck } from './TemplateCheckRail'

const t = ru.processNew

export function classOptions(classes: readonly OperationClass[]): readonly SelectOption<string>[] {
  return classes.map((c) => ({ value: c.code, label: t.classOption(c.code, c.name) }))
}

/** Категория = тип объекта · рабочая категория: «Склад · внутренняя логистика». */
export function categoryOptions(facilityTypes: readonly FacilityType[]): readonly SelectOption<string>[] {
  const works = Object.keys(ru.workCategories) as WorkCategoryCode[]
  return facilityTypes.flatMap((f) =>
    works.map((w) => ({ value: categoryValue(f.code, w), label: t.categoryOption(f.name, ru.workCategories[w]) })),
  )
}

const capitalize = (text: string): string => text.charAt(0).toLocaleUpperCase('ru-RU') + text.slice(1)

/** Единицы груза: носители процессов того же класса и типовые носители класса; текущее значение — всегда в списке. */
export function carrierOptions(
  processes: readonly Process[],
  classes: readonly OperationClass[],
  form: ProcessForm,
): readonly SelectOption<string>[] {
  const fromProcesses = processes.filter((p) => p.operationClass === form.operationClass).flatMap((p) => p.defaults.carrier ?? [])
  const fromClass = classes.find((c) => c.code === form.operationClass)?.typicalCarriers ?? []
  const seen = new Set<string>()
  return [form.carrier, ...fromProcesses, ...fromClass]
    .filter((c) => c.trim() !== '')
    .map(capitalize)
    .filter((c) => {
      const key = c.toLocaleLowerCase('ru-RU')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((c) => ({ value: c, label: c }))
}

/** Подсказки-формулы на значениях демо-склада: «= 2 смены × 11 ч (из локации)». */
export function numericHints(base: WarehouseBase, form: ProcessForm): Readonly<Partial<Record<NumericKey, string>>> {
  const h = t.formulaHints
  const firstGroup = form.staff.find((row) => row.selected)?.role ?? form.staff[0]?.role ?? ''
  return {
    dailyVolume: h.dailyVolume(formatNumber(base.inbound), formatNumber(base.outbound)),
    workHours: h.workHours(formatCount(base.shifts, t.shifts), formatNumber(base.shiftHours)),
    automationPct: h.automationPct(formatPercent(base.oversizeShare)),
    routeLengthM: h.routeLengthM(formatNumber(base.activeArea)),
    liftTripPct: h.liftTripPct(formatCount(base.floors, t.floors)),
    liftWaitS: h.liftWaitS,
    minAisleWidthM: h.minAisleWidthM(formatNumber(base.mainAisle, 1), formatNumber(base.rackAisle, 1)),
    fleetSalaryRub: h.fleetSalaryRub(firstGroup),
  }
}

/** Строки «Проверки шаблона»: счётчики формы и совпадения по классу и типу объекта (PRD 9.2). */
export function templateCheck(
  form: ProcessForm,
  robotsByClass: Readonly<Record<OperationClassCode, number>>,
  locations: readonly Location[],
): TemplateCheck {
  const facilityType = parseCategory(form.category)?.facilityType
  return {
    formulas: countFormulas(),
    required: countRequired(),
    robots: robotsByClass[form.operationClass] ?? 0,
    locations: locations.filter((l) => l.facilityType === facilityType).length,
  }
}
