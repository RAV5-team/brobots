import {
  COMPLETENESS_GROUPS,
  completeness,
  countByStatus,
  KEY_SPEC_KEYS,
  ROBOT_CHARACTERISTIC_GROUPS,
  type Characteristic,
  type CharacteristicStatus,
  type FacilityType,
  type OperationClass,
  type Process,
  type Robot,
  type RobotCharacteristicKey,
  type RobotSpecs,
} from '@/domain'
import { formatDayOf } from '@/shared/format/date'
import { formatRubMillions } from '@/shared/format/money'
import { formatNumber } from '@/shared/format/number'
import { ru } from '@/shared/i18n/ru'
import { robotFacilities } from './catalogModel'

const d = ru.catalog.item.derived

export type RobotCharacteristicMap = Readonly<Record<RobotCharacteristicKey, Characteristic>>

export interface CharacteristicContext {
  readonly operationClasses: readonly OperationClass[]
  readonly processes: readonly Process[]
  readonly facilityTypes: readonly FacilityType[]
  /** Версия каталога из данных сессии (`DataVersion.catalog`) — в подписях источника: «каталог v4». */
  readonly catalogVersion: string
}

const missing = (source: string = d.notInData): Characteristic => ({ value: null, status: 'missing', source })

/** ТТХ робота: подтверждено, если ТТХ подтверждены целиком (`specs.confidence`), иначе оценка (D-76). */
const specStatus = (specs: RobotSpecs): CharacteristicStatus => (specs.confidence === 'confirmed' ? 'confirmed' : 'estimate')

function spec(robot: Robot, catalogVersion: string, value: string | null): Characteristic {
  return value === null ? missing() : { value, status: specStatus(robot.specs), source: robot.specs.sourceText ?? d.catalog(catalogVersion) }
}

const signed = (value: number) => (value > 0 ? `+${formatNumber(value)}` : formatNumber(value))

/** «+5…+40 °C», «от +5 °C», «до +40 °C» — общий вид температуры для К-3 и К-4. */
function temperatureText(specs: RobotSpecs): string | null {
  const t = ru.catalog.comparePage
  const { minTempC: min, maxTempC: max } = specs
  if (min !== undefined && max !== undefined) return t.temperatureRange(signed(min), signed(max))
  if (min !== undefined) return t.temperatureFrom(signed(min))
  if (max !== undefined) return t.temperatureTo(signed(max))
  return null
}

function classes(robot: Robot, ctx: CharacteristicContext): Characteristic {
  if (robot.operationClasses.length === 0) return missing(d.noClass)
  const value = robot.operationClasses
    .map((c) => ru.catalog.card.classChip(c.code, ctx.operationClasses.find((oc) => oc.code === c.code)?.name ?? ''))
    .join(' · ')
  // Привязка по подсказке сценария или демо-привязка администратора — оценка (D-61).
  const source = robot.operationClasses.find((c) => c.source)?.source
  return source ? { value, status: 'estimate', source } : { value, status: 'confirmed', source: d.catalog(ctx.catalogVersion) }
}

/** Строки, выведенные из полей робота (D-76); чего нет в полях — «нет данных». */
function derived(robot: Robot, ctx: CharacteristicContext): RobotCharacteristicMap {
  const s = robot.specs
  const version = ctx.catalogVersion
  const catalog = (value: string): Characteristic => ({ value, status: 'confirmed', source: d.catalog(version) })
  const fromSpecs = (value: string | null): Characteristic => spec(robot, version, value)
  const dims = s.lengthMm !== undefined && s.widthMm !== undefined && s.heightMm !== undefined
    ? d.mm(formatNumber(s.lengthMm), formatNumber(s.widthMm), formatNumber(s.heightMm))
    : null
  const productivity = robot.operationClasses.flatMap((c) => (c.productivityText ? [`${c.code}: ${c.productivityText}`] : []))
  const facilities = [...robotFacilities(robot, ctx.processes)]
    .map((code) => ctx.facilityTypes.find((f) => f.code === code)?.name ?? code)
  const origin = robot.country ?? robot.region
  const operationClasses = classes(robot, ctx)

  return {
    manufacturer: catalog(robot.manufacturer),
    id: catalog(robot.id),
    solutionType: catalog(robot.subtype),
    operationClasses,
    origin: origin ? { value: origin, status: 'estimate', source: d.region } : missing(),
    availability: robot.readiness === 'unknown'
      ? missing()
      : { value: ru.catalog.comparePage.status[robot.readiness], status: 'confirmed', source: robot.trl === null ? d.catalog(version) : d.catalogWithTrl(version, robot.trl) },
    payload: fromSpecs(s.payloadKg === undefined ? null : d.kg(formatNumber(s.payloadKg))),
    dimensions: fromSpecs(dims),
    speed: fromSpecs(s.maxSpeedMps === undefined ? null : d.speed(formatNumber(s.maxSpeedMps, 2))),
    productivity: fromSpecs(productivity.length === 0 ? null : productivity.join(' · ')),
    autonomy: fromSpecs(s.autonomyH === undefined ? null : d.hours(formatNumber(s.autonomyH))),
    positioningAccuracy: missing(),
    navigation: missing(),
    operatingConditions: fromSpecs(temperatureText(s)),
    temperature: fromSpecs(temperatureText(s)),
    aisleRequirements: missing(),
    floorRequirements: missing(),
    charging: missing(),
    connectivity: missing(),
    integration: missing(),
    service: missing(),
    equipmentPrice: robot.priceRub === null
      ? missing()
      : { value: d.priceWithVat(formatRubMillions(robot.priceRub)), status: 'confirmed', source: d.catalogFile(version) },
    software: missing(),
    implementation: missing(),
    maintenance: missing(),
    acquisitionModel: missing(),
    serviceLife: missing(),
    supportedProcesses: operationClasses,
    facilityTypes: facilities.length === 0 ? missing() : { value: facilities.join(' · '), status: 'estimate', source: d.facilities },
    limitations: missing(),
    cases: robot.cases ? catalog(robot.cases) : missing(),
    dataSource: { value: d.dataSource(version), status: 'confirmed', source: d.registry },
    sourceLink: missing(),
    actualizedAt: catalog(formatDayOf(robot.updatedAt)),
  }
}

/** Все характеристики робота: хранимые значения (`Robot.characteristics`) поверх выведенных из полей (D-76). */
export function robotCharacteristics(robot: Robot, ctx: CharacteristicContext): RobotCharacteristicMap {
  const base = derived(robot, ctx)
  const stored = robot.characteristics?.values ?? {}
  return { ...base, ...stored }
}

export interface RobotCharacteristicSummary {
  /** «7 из 8 ключевых ТТХ подтверждено». */
  readonly keyConfirmed: number
  readonly keyTotal: number
  /** «Полнота 27 из 30 полей» и «17 подтверждено · 10 оценка · 3 нет данных» — по пяти группам (D-77). */
  readonly filled: number
  readonly total: number
  readonly counts: Readonly<Record<CharacteristicStatus, number>>
}

export function summarize(map: RobotCharacteristicMap): RobotCharacteristicSummary {
  const rows = COMPLETENESS_GROUPS.flatMap((g) => ROBOT_CHARACTERISTIC_GROUPS[g]).map((key) => map[key])
  const { filled, total } = completeness(rows)
  return {
    keyConfirmed: KEY_SPEC_KEYS.filter((key) => map[key].status === 'confirmed').length,
    keyTotal: KEY_SPEC_KEYS.length,
    filled,
    total,
    counts: countByStatus(rows),
  }
}
