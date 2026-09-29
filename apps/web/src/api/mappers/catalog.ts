import type {
  CompatibilityRef,
  DataConfidence,
  HandlingMethod,
  HandlingMethodCode,
  LaunchCategory,
  LaunchItem,
  LaunchItemType,
  OperationClass,
  OperationClassCode,
  Robot,
  RobotOperationClass,
  RobotReadiness,
  RobotSpecs,
  WorkCategoryCode,
} from '@/domain'
import { oneOf, optional, required, type ApiSchemas } from '../contract'

type Summary = ApiSchemas['SolutionSummary']
type Solution = ApiSchemas['Solution']

const READINESS: Readonly<Record<string, RobotReadiness>> = { operation: 'operation', piloting: 'pilot', rnd: 'rnd' }
const CONFIDENCE: Readonly<Record<string, DataConfidence>> = { yes: 'confirmed', partial: 'partial', no: 'unconfirmed' }
const HANDLING: readonly HandlingMethodCode[] = ['forks', 'platform', 'tow', 'body', 'manipulator', 'brushes', 'none']
const LAUNCH_TYPES: readonly LaunchItemType[] = ['infrastructure', 'software', 'service', 'support']
const WORK_CATEGORIES: readonly WorkCategoryCode[] = ['internal_logistics', 'fulfillment', 'facility_maintenance', 'accounting_control', 'security']
const LIST_SEPARATOR = /\s*[,;]\s*/u
const SOURCE = 'Каталог RAV5 (services/api)'

const readiness = (status: string | null | undefined): RobotReadiness => READINESS[status ?? ''] ?? 'unknown'
const splitList = (text: string | null | undefined): readonly string[] => (text ?? '').split(LIST_SEPARATOR).filter(Boolean)

function handlingOf(code: string | null | undefined): HandlingMethodCode | undefined {
  return code && (HANDLING as readonly string[]).includes(code) ? (code as HandlingMethodCode) : undefined
}

function specsOf(spec: ApiSchemas['RobotSpec'] | undefined, specsConfirmed?: string | null): RobotSpecs {
  const confidence = CONFIDENCE[spec?.specsConfirmed ?? specsConfirmed ?? ''] ?? 'unconfirmed'
  if (!spec) return { confidence }
  const handlingMethod = handlingOf(spec.handlingMethodCode)
  // exactOptionalPropertyTypes: поля без значения не передаются вовсе.
  const values: Record<string, number | boolean | string | null | undefined> = {
    payloadKg: spec.payloadKg,
    lengthMm: spec.lengthMm,
    widthMm: spec.widthMm,
    heightMm: spec.heightMm,
    maxSpeedMps: spec.maxSpeedMps,
    autonomyH: spec.autonomyH,
    chargeTimeMin: spec.chargeTimeMin,
    avgPowerKw: spec.avgPowerKw,
    loadTimeS: spec.loadTimeS,
    unloadTimeS: spec.unloadTimeS,
    minTempC: spec.minTempC,
    maxTempC: spec.maxTempC,
    handlingMethod,
    indoor: spec.indoorAllowed,
    outdoor: spec.outdoorAllowed,
    sourceText: spec.specsSourceText,
  }
  const defined = Object.fromEntries(Object.entries(values).filter(([, v]) => v != null)) as Omit<RobotSpecs, 'confidence'>
  return { ...defined, confidence }
}

function classesOf(capabilities: readonly ApiSchemas['Capability'][]): readonly RobotOperationClass[] {
  return capabilities
    .filter((c) => c.isActive !== false && c.workType?.code)
    .map((c) => ({
      code: required(required(c, 'workType', 'Capability'), 'code', 'WorkTypeRef') as OperationClassCode,
      ...(c.throughputPerHour == null ? {} : { productivityPerHour: c.throughputPerHour }),
      ...(c.workType?.unitLabel ? { unit: c.workType.unitLabel } : {}),
      ...(c.throughputRangeText ? { productivityText: c.throughputRangeText } : {}),
    }))
}

function photoOf(url: string | null | undefined): Pick<Robot, 'photo'> {
  return url ? { photo: { path: url, source: SOURCE } } : {}
}

/** Строка каталога API → робот экрана. ТТХ в списке нет — полная карточка приходит из `GET /solutions/{id}`. */
export function robotFromSummary(dto: Summary): Robot {
  const entity = 'SolutionSummary'
  return {
    id: required(dto, 'id', entity),
    name: required(dto, 'name', entity),
    manufacturer: dto.manufacturer ?? '',
    type: dto.typeGroup ?? '',
    subtype: dto.solutionType ?? '',
    readiness: readiness(dto.status),
    trl: optional(dto.trl),
    priceRub: optional(dto.price?.amountRub),
    alternativePricesRub: [],
    industries: dto.industries ?? [],
    scenarios: [],
    description: '',
    operationClasses: (dto.workTypes ?? []).filter((w) => w.code).map((w) => ({ code: w.code as OperationClassCode, ...(w.unitLabel ? { unit: w.unitLabel } : {}) })),
    specs: { ...(dto.payloadKg == null ? {} : { payloadKg: dto.payloadKg }), confidence: CONFIDENCE[dto.specsConfirmed ?? ''] ?? 'unconfirmed' },
    needsConfirmation: dto.needsConfirmation ?? false,
    updatedAt: required(dto, 'updatedAt', entity),
    testedByFcbas: dto.badges?.testedByFcbas ?? false,
    inRegistry719: dto.badges?.inRegistry719 ?? false,
    ...photoOf(dto.photoUrl),
    launchRequired: [],
    launchConditional: [],
  }
}

/** Полная карточка решения API → робот экрана (К-4, А2). */
export function robotFromSolution(dto: Solution): Robot {
  const entity = 'Solution'
  const offers = (dto.offers ?? []).map((o) => o.price?.amountRub).filter((p): p is number => typeof p === 'number')
  const price = optional(dto.price?.amountRub) ?? offers[0] ?? null
  return {
    id: required(dto, 'id', entity),
    name: required(dto, 'name', entity),
    manufacturer: dto.manufacturer ?? '',
    ...(dto.country ? { country: dto.country } : {}),
    ...(dto.region ? { region: dto.region } : {}),
    type: dto.typeGroup ?? '',
    subtype: dto.solutionType ?? '',
    readiness: readiness(dto.status),
    trl: optional(dto.trl),
    priceRub: price,
    alternativePricesRub: offers.filter((p) => p !== price),
    industries: dto.industries ?? [],
    scenarios: dto.organizerScenarios ?? [],
    description: dto.description ?? '',
    operationClasses: classesOf(dto.capabilities ?? []),
    specs: specsOf(dto.spec),
    needsConfirmation: false,
    updatedAt: required(dto, 'updatedAt', entity),
    testedByFcbas: dto.badges?.testedByFcbas ?? false,
    inRegistry719: dto.badges?.inRegistry719 ?? false,
    ...photoOf(dto.photoUrl),
    launchRequired: [],
    launchConditional: [],
    ...(dto.casesText ? { cases: dto.casesText } : {}),
  }
}

/** Обязательная часть конфигурации по названию и типу позиции (D-63): в API категории нет. */
function launchCategoryOf(type: LaunchItemType, name: string, solutionType: string): LaunchCategory | undefined {
  const text = `${name} ${solutionType}`.toLocaleLowerCase('ru')
  if (type === 'infrastructure' && text.includes('зарядн')) return 'charging'
  if (type === 'software' && /fleet|управлени[ея] парк/u.test(text)) return 'fleet'
  if (type === 'software' && text.includes('wms')) return 'wms'
  if (type === 'service' && /внедрени|пусконалад|commissioning/u.test(text)) return 'commissioning'
  return undefined
}

const comparable = (text: string) => text.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е')

/** «Робот-штабелёр RoboCV, AK-2000-2» → ссылки на роботы каталога по названию или коду, остальное — текстом. */
export function compatibilityOf(text: string | null | undefined, robots: readonly { readonly id: string; readonly name: string; readonly code?: string }[]): readonly CompatibilityRef[] {
  return splitList(text).map((part) => {
    const key = comparable(part)
    const robot = robots.find((r) => comparable(r.name) === key || (r.code !== undefined && comparable(r.code) === key))
    return robot ? { kind: 'robot', id: robot.id } : { kind: 'text', text: part }
  })
}

/** Позиция для запуска API → позиция экрана (PRD 7.5). */
export function launchItemFromSummary(dto: Summary, robots: Parameters<typeof compatibilityOf>[1]): LaunchItem {
  const entity = 'SolutionSummary'
  const type = oneOf(required(dto, 'kind', entity), LAUNCH_TYPES, `${entity}.kind`)
  const name = required(dto, 'name', entity)
  const solutionType = dto.solutionType ?? ''
  const category = launchCategoryOf(type, name, solutionType)
  const specValues = [solutionType, ...(dto.typeGroup ? [dto.typeGroup] : [])].filter(Boolean)
  return {
    id: required(dto, 'id', entity),
    type,
    name,
    supplier: dto.manufacturer ?? '',
    specs: specValues.map((value) => ({ value, status: 'confirmed', source: SOURCE })),
    price: dto.price?.percent != null
      ? { kind: 'percent-of-capex', percent: dto.price.percent }
      : { kind: 'rub', amountRub: dto.price?.amountRub ?? 0 },
    costType: dto.costType === 'opex' ? 'opex-yearly' : 'capex',
    quantityNorm: dto.quantityRule ?? '',
    compatibleWith: compatibilityOf(dto.compatibleWith, robots),
    ...(category ? { launchCategory: category } : {}),
    source: SOURCE,
  }
}

/** Класс операции API (work-type) → класс экрана (PRD 6.7). */
export function operationClassFromWorkType(dto: ApiSchemas['WorkType']): OperationClass {
  const entity = 'WorkType'
  const category = dto.workCategoryCode
  return {
    code: required(dto, 'code', entity) as OperationClassCode,
    name: required(dto, 'name', entity),
    description: dto.description ?? '',
    unit: dto.unitLabel ?? '',
    ...(category && (WORK_CATEGORIES as readonly string[]).includes(category) ? { workCategory: category as WorkCategoryCode } : {}),
    typicalCarriers: splitList(dto.typicalCarriers),
    exampleProcesses: splitList(dto.exampleProcesses),
  }
}

/** Способ обработки из справочника `GET /dictionaries` (handlingMethods). */
export function handlingMethodFromOption(dto: ApiSchemas['Option']): HandlingMethod | null {
  const code = handlingOf(dto.code)
  return code ? { code, name: dto.name ?? code, hint: dto.hint ?? '' } : null
}
