import type { BadgeKind } from '@/components/ui/Badge'
import type {
  FacilityTypeCode,
  HandlingMethodCode,
  OperationClassCode,
  ProcessTemplate,
  WorkCategoryCode,
} from '@/domain'

/** Секции формы в порядке навигации (PRD 9.2). */
export const SECTION_IDS = ['process', 'volume', 'route', 'staff', 'costs'] as const
export type SectionId = (typeof SECTION_IDS)[number]

/** Группа исполнителей из профиля: численность и оклад только для чтения, выбор и доля — поля формы. */
export interface StaffRow {
  readonly role: string
  readonly headcount: number
  /** null — оклад в профиле не указан. */
  readonly salaryRub: number | null
  readonly selected: boolean
  readonly timeSharePct: string
}

/** Числовые поля хранятся строкой, как введены: «1,5», «2 000». Разбор — `parseDecimal`. */
export interface NumericValues {
  readonly unitMassKg: string
  readonly dailyVolume: string
  readonly workHours: string
  readonly peakFactor: string
  readonly automationPct: string
  readonly routeLengthM: string
  readonly speedLimitMps: string
  readonly widthMarginM: string
  readonly liftTripPct: string
  readonly liftWaitS: string
  readonly minAisleWidthM: string
  readonly minTempC: string
  readonly turnoverPct: string
  readonly workTimeLossPct: string
  readonly fleetOperators: string
  readonly fleetSalaryRub: string
  readonly sitePrepPct: string
  readonly itIntegrationRub: string
  readonly consumablesRub: string
  readonly otherEffectsRub: string
}

export type NumericKey = keyof NumericValues

export interface ProcessForm extends NumericValues {
  readonly operationClass: OperationClassCode
  readonly name: string
  /** `${FacilityTypeCode}:${WorkCategoryCode}` — одно значение для Select. */
  readonly category: string
  readonly carrier: string
  readonly cargoDivisible: boolean
  readonly route: string
  readonly handling: readonly HandlingMethodCode[]
  readonly indoor: boolean
  readonly staff: readonly StaffRow[]
  /** Коэффициент замещения по способу обработки груза, строкой: «0,80». */
  readonly replacement: Readonly<Partial<Record<HandlingMethodCode, string>>>
}

interface NumericSpec {
  readonly section: SectionId
  readonly required?: boolean
  readonly badge?: BadgeKind
  readonly min: number
  readonly max: number
}

/**
 * Числовые поля: секция, звёздочка, плашка происхождения и допустимый диапазон (PRD 9.2).
 * Диапазоны — физические границы, а не диапазоны датасета: шаблон годится для любой локации своего типа.
 */
export const NUMERIC_SPECS: Readonly<Record<NumericKey, NumericSpec>> = {
  unitMassKg: { section: 'process', required: true, badge: 'assumption', min: 0.1, max: 50_000 },
  dailyVolume: { section: 'volume', required: true, badge: 'assumption', min: 1, max: 10_000_000 },
  workHours: { section: 'volume', required: true, badge: 'formula', min: 1, max: 24 },
  peakFactor: { section: 'volume', required: true, min: 1, max: 10 },
  automationPct: { section: 'volume', badge: 'formula', min: 0, max: 100 },
  routeLengthM: { section: 'route', required: true, min: 1, max: 10_000 },
  speedLimitMps: { section: 'route', min: 0.1, max: 10 },
  widthMarginM: { section: 'route', min: 0, max: 5 },
  liftTripPct: { section: 'route', min: 0, max: 100 },
  liftWaitS: { section: 'route', min: 0, max: 3_600 },
  minAisleWidthM: { section: 'route', badge: 'assumption', min: 0.5, max: 20 },
  minTempC: { section: 'route', badge: 'assumption', min: -60, max: 60 },
  turnoverPct: { section: 'staff', min: 0, max: 100 },
  workTimeLossPct: { section: 'staff', min: 0, max: 100 },
  fleetOperators: { section: 'costs', min: 0, max: 100 },
  fleetSalaryRub: { section: 'costs', badge: 'formula', min: 0, max: 10_000_000 },
  sitePrepPct: { section: 'costs', min: 0, max: 100 },
  itIntegrationRub: { section: 'costs', badge: 'assumption', min: 0, max: 10_000_000_000 },
  consumablesRub: { section: 'costs', min: 0, max: 100_000_000 },
  otherEffectsRub: { section: 'costs', min: 0, max: 10_000_000_000 },
}

/** Обязательные поля вне числовых: класс, название, единица груза, делимость, способы обработки (секция 1). */
const REQUIRED_CHOICE_FIELDS = ['operationClass', 'name', 'carrier', 'cargoDivisible', 'handling'] as const
/** Колонки таблицы исполнителей со звёздочкой: «Оклад gross *», «Доля времени на процесс *». */
const REQUIRED_STAFF_COLUMNS = 2

/** Счётчик «Обязательных полей» панели: звёздочки формы, включая две колонки таблицы (PRD 15 · №35, D-31). */
export function countRequired(): number {
  const numeric = Object.values(NUMERIC_SPECS).filter((s) => s.required === true).length
  return numeric + REQUIRED_CHOICE_FIELDS.length + REQUIRED_STAFF_COLUMNS
}

/** Счётчик «Формул»: поля с плашкой «формула». */
export function countFormulas(): number {
  return Object.values(NUMERIC_SPECS).filter((s) => s.badge === 'formula').length
}

export { parseDecimal } from '@/shared/format'

export const categoryValue = (facilityType: FacilityTypeCode, workCategory: WorkCategoryCode): string =>
  `${facilityType}:${workCategory}`

export function parseCategory(value: string): ProcessTemplate['category'] | null {
  const [facilityType, workCategory] = value.split(':')
  if (!facilityType || !workCategory) return null
  return { facilityType: facilityType as FacilityTypeCode, workCategory: workCategory as WorkCategoryCode }
}

/** Выбранные способы с коэффициентом замещения; «Без груза» коэффициента не имеет. */
export const replaceableMethods = (form: ProcessForm): readonly HandlingMethodCode[] =>
  form.handling.filter((m) => m !== 'none')

export function toggleHandling(form: ProcessForm, method: HandlingMethodCode): ProcessForm {
  const has = form.handling.includes(method)
  return { ...form, handling: has ? form.handling.filter((m) => m !== method) : [...form.handling, method] }
}

export function updateStaffRow(form: ProcessForm, role: string, patch: Partial<StaffRow>): ProcessForm {
  return { ...form, staff: form.staff.map((row) => (row.role === role ? { ...row, ...patch } : row)) }
}
