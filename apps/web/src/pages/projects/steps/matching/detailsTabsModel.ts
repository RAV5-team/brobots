import type { VerificationStatus } from '@/components/ui/Badge'
import {
  siteRequirementChecks,
  type Characteristic,
  type RankedVariant,
  type Robot,
  type RobotCharacteristicKey,
  type SiteFacts,
  type SiteRequirementCheck,
  type SiteUnit,
  type SiteValue,
} from '@/domain'
import { summarize, type RobotCharacteristicMap } from '@/pages/catalog/characteristics'
import { formatCount, formatNumber, formatPercent } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import type { AmountRow } from './economicsTabModel'

const rows = ru.catalog.item.rows
const d = ru.project.matching.details

/** Строка характеристики окна 2.1а: значение, источник и дата под ним, плашка статуса справа (`CharacteristicRow stacked`). */
export interface StackedRow {
  readonly key: string
  readonly label: string
  /** null — «нет данных». */
  readonly value: string | null
  readonly source?: string
  readonly date?: string
  readonly verification?: VerificationStatus
}

/** Статус каталога К-4 → плашка: подтверждено, оценка; «нет данных» — серым в значении, как на К-4. */
const STATUS: Readonly<Record<Characteristic['status'], VerificationStatus | undefined>> = { confirmed: 'confirmed', estimate: 'estimate', missing: undefined }

function fromCharacteristic(key: string, label: string, c: Characteristic): StackedRow {
  const verification = STATUS[c.status]
  if (c.value === null) return { key, label, value: null }
  return { key, label, value: c.value, source: c.source, ...(c.date ? { date: c.date } : {}), ...(verification ? { verification } : {}) }
}

const char = (map: RobotCharacteristicMap, key: RobotCharacteristicKey, label: string = rows[key]): StackedRow => fromCharacteristic(key, label, map[key])

// ——— Технические (16830:608) ———

export interface TechnicalView {
  readonly rows: readonly StackedRow[]
}

export function technicalView(v: RankedVariant, robot: Robot, map: RobotCharacteristicMap, simulated: boolean): TechnicalView {
  const t = d.technical
  const massKg = robot.specs.massKg
  const p = v.effectiveProductivity
  const mass: StackedRow = massKg === undefined
    ? { key: 'mass', label: t.mass, value: null }
    : {
        key: 'mass', label: t.mass, value: `${formatNumber(massKg)} ${ru.units.kg}`,
        source: robot.specs.sourceText ?? map.payload.source,
        verification: robot.specs.confidence === 'confirmed' ? 'confirmed' : 'estimate',
      }
  const effective: StackedRow = p
    ? {
        key: 'effective', label: t.effective, value: t.trips(formatNumber(p.tripsPerHour, 1)), verification: 'estimate',
        source: t.effectiveSource(
          p.cycleTimeS === null ? '—' : formatNumber(p.cycleTimeS),
          p.loadTimeS === null ? '—' : formatNumber(p.loadTimeS),
          p.chargingShare === null ? '—' : formatPercent(p.chargingShare, 0),
        ),
      }
    : { key: 'effective', label: t.effective, value: null }
  return {
    rows: [
      char(map, 'payload'),
      mass,
      char(map, 'dimensions'),
      char(map, 'speed'),
      char(map, 'productivity', t.catalogProductivity),
      effective,
      // Производительность в симуляции — после прогона шага 3; до него «ещё не проверено».
      { key: 'simulation', label: t.simulation, value: '—', source: simulated ? t.simulationDone : t.simulationPending, verification: 'pending' },
      char(map, 'autonomy'),
      char(map, 'positioningAccuracy'),
      char(map, 'navigation'),
      char(map, 'operatingConditions'),
    ],
  }
}

// ——— Инфраструктура (16832:608) ———

const UNITS: Readonly<Record<SiteUnit, string>> = { kg: ru.units.kg, m: ru.units.m, tPerM2: d.infrastructure.tPerM2, celsius: d.infrastructure.celsius }

const signedDegrees = (value: number): string => formatNumber(value, 0, { signed: true })

/** «800 кг», «2,2 м», «+5…+25 °C»; у температуры — со знаком. */
export function formatSiteValue(value: SiteValue): string {
  if (value.kind === 'text') return value.text
  if (value.kind === 'number') return `${formatNumber(value.value, value.unit === 'm' ? 2 : 0)} ${UNITS[value.unit]}`
  const f = (n: number) => (value.unit === 'celsius' ? signedDegrees(n) : formatNumber(n))
  const unit = UNITS[value.unit]
  const t = d.infrastructure
  if (value.min !== null && value.max !== null) return `${f(value.min)}…${f(value.max)} ${unit}`
  if (value.min !== null) return t.from(`${f(value.min)} ${unit}`)
  if (value.max !== null) return t.upTo(`${f(value.max)} ${unit}`)
  return ru.characteristicStatus.missing
}

export interface InfrastructureView {
  /** Требование робота против данных локации — одно правило с 2.1б и «Недостающими данными» (D-99). */
  readonly checks: readonly StackedRow[]
  /** Требования робота, для которых в профиле локации нет данных для сравнения. */
  readonly other: readonly StackedRow[]
  readonly equipment: readonly AmountRow[]
}

function checkRow(c: SiteRequirementCheck, map: RobotCharacteristicMap): StackedRow {
  const t = d.infrastructure
  // Нагрузку на пол и связь робот задаёт текстом каталога, числа для сравнения нет.
  const fallback: Partial<Record<SiteRequirementCheck['key'], Characteristic>> = { floorLoad: map.floorRequirements, connectivity: map.connectivity }
  const requirement = c.requirement ? formatSiteValue(c.requirement) : fallback[c.key]?.value ?? null
  const location = c.locationValue ? formatSiteValue(c.locationValue) : ru.characteristicStatus.missing
  return {
    key: c.key,
    label: t.checks[c.key],
    value: requirement,
    source: c.status === 'misfit' ? t.locationMisfit(location) : t.location(location),
    verification: c.status === 'confirmed' ? 'confirmed' : 'needsCheck',
  }
}

export function infrastructureView(v: RankedVariant, robot: Robot, map: RobotCharacteristicMap, site: SiteFacts, widthMarginM: number): InfrastructureView {
  const aux = v.auxEquipment
  const count = (value: number | null | undefined): string => (value == null ? ru.characteristicStatus.missing : formatNumber(value))
  const t = d.infrastructure
  return {
    checks: siteRequirementChecks(robot.specs, site, widthMarginM).map((c) => checkRow(c, map)),
    other: (['charging', 'integration', 'service'] as const).map((key) => char(map, key)),
    equipment: [
      { key: 'stations', label: t.stations, value: count(v.stations ?? aux?.stations) },
      { key: 'adapters', label: t.adapters, value: count(aux?.adapters) },
      { key: 'wifi', label: t.wifiPoints, value: count(aux?.wifiPoints) },
    ],
  }
}

// ——— Качество данных (16832:2061) ———

export interface DataQualityView {
  readonly rows: readonly StackedRow[]
}

/**
 * Источник и дата — характеристики К-4; полнота — та же метрика, что в К-3 и в 2.1б; подтверждённость — сколько
 * значений «Технических» взято оценкой и сколько требований площадки не проверено (счётчик 2.1б, D-99).
 */
export function dataQualityView(map: RobotCharacteristicMap, technical: TechnicalView, infrastructure: InfrastructureView): DataQualityView {
  const t = d.dataQuality
  const { filled, total } = summarize(map)
  const estimates = technical.rows.filter((r) => r.verification === 'estimate').length
  const open = infrastructure.checks.filter((r) => r.verification === 'needsCheck').length
  return {
    rows: [
      { key: 'source', label: t.source, value: map.dataSource.value },
      { key: 'actualizedAt', label: t.actualizedAt, value: map.actualizedAt.value },
      { key: 'completeness', label: t.completeness, value: ru.project.matching.compare.completenessValue(formatPercent(filled / total)) },
      { key: 'confirmedness', label: t.confirmedness, value: t.confirmednessValue(formatCount(estimates, t.values), formatCount(open, t.requirements)) },
    ],
  }
}
