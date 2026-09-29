import type { ParameterValue } from './facility'
import type { Location } from './location'
import type { RobotSpecs } from './robot'

/**
 * Правило «робот × площадка» — одно для блока «Соответствие» сравнения К-3 (PRD 7.6, D-75), вкладки «Инфраструктура»
 * окна 2.1а и счётчика «не проверено на площадке» (D-99). Сравнение К-3 передаёт только профиль склада
 * (`siteFactsOfLocation`), проект — ещё и параметры площадки для подбора (`siteFactsOf`, шаг 1).
 */
export type SiteFitStatus = 'fit' | 'misfit' | 'unknown'

const MM_IN_M = 1000
const PALLET_MASS = 'wh_pallet_mass'
const RACK_AISLE = 'wh_rack_aisle_width'
/** Параметры площадки для подбора (PRD 10.5, 10.6): мин. проход на маршруте, температура, пол, Wi-Fi. */
const SITE_AISLE = 'site_aisle_min_m'
const SITE_TEMP_MIN = 'site_temp_min_c'
const SITE_TEMP_MAX = 'site_temp_max_c'
const SITE_FLOOR_LOAD = 'site_floor_load_tm2'
const SITE_WIFI = 'site_wifi_coverage'

/** Что известно о площадке; null — нет данных. */
export interface SiteFacts {
  /** Масса грузовой единицы, кг (`wh_pallet_mass`). */
  readonly unitMassKg: number | null
  /** Ширина прохода, м: мин. на маршруте, иначе между стеллажами. */
  readonly aisleWidthM: number | null
  readonly temperatureC: { readonly min: number; readonly max: number } | null
  /** Допустимая нагрузка на пол, т/м². */
  readonly floorLoadTm2: number | null
  /** Wi-Fi в зоне работы: текст профиля площадки. */
  readonly wifiCoverage: string | null
}

const numberOf = (value: ParameterValue | undefined): number | null => (typeof value?.value === 'number' ? value.value : null)
const textOf = (value: ParameterValue | undefined): string | null => (value === undefined ? null : String(value.value))

/** Профиль склада без параметров площадки: температуры, пола и Wi-Fi в нём нет — «?» (как было в К-3, D-75). */
export function siteFactsOfLocation(location: Location): SiteFacts {
  return {
    unitMassKg: numberOf(location.parameters[PALLET_MASS]),
    aisleWidthM: numberOf(location.parameters[RACK_AISLE]),
    temperatureC: null,
    floorLoadTm2: null,
    wifiCoverage: null,
  }
}

/** Профиль склада и параметры площадки для подбора (`ProjectParamsSnapshot.siteValues`, шаг 1). */
export function siteFactsOf(location: Location, siteValues: Readonly<Record<string, ParameterValue>>): SiteFacts {
  const base = siteFactsOfLocation(location)
  const min = numberOf(siteValues[SITE_TEMP_MIN])
  const max = numberOf(siteValues[SITE_TEMP_MAX])
  return {
    unitMassKg: base.unitMassKg,
    aisleWidthM: numberOf(siteValues[SITE_AISLE]) ?? base.aisleWidthM,
    temperatureC: min === null || max === null ? null : { min, max },
    floorLoadTm2: numberOf(siteValues[SITE_FLOOR_LOAD]),
    wifiCoverage: textOf(siteValues[SITE_WIFI]),
  }
}

/** Груз: масса единицы ≤ грузоподъёмности. */
export function cargoFit(unitMassKg: number | null, payloadKg: number | undefined): SiteFitStatus {
  if (unitMassKg === null || payloadKg === undefined) return 'unknown'
  return unitMassKg <= payloadKg ? 'fit' : 'misfit'
}

/** Проходы: ширина робота + запас (норматив А5 `width_margin_m`) ≤ проход (правило карточки А2, PRD 6.3, D-75). */
export function aisleFit(aisleWidthM: number | null, robotWidthM: number | null, widthMarginM: number): SiteFitStatus {
  if (aisleWidthM === null || robotWidthM === null) return 'unknown'
  return robotWidthM <= aisleWidthM - widthMarginM ? 'fit' : 'misfit'
}

/** Температура: диапазон площадки внутри указанных границ робота; у робота нет ни одной границы — «?». */
export function temperatureFit(site: SiteFacts['temperatureC'], specs: Pick<RobotSpecs, 'minTempC' | 'maxTempC'>): SiteFitStatus {
  if (site === null || (specs.minTempC === undefined && specs.maxTempC === undefined)) return 'unknown'
  const belowMin = specs.minTempC !== undefined && site.min < specs.minTempC
  const aboveMax = specs.maxTempC !== undefined && site.max > specs.maxTempC
  return belowMin || aboveMax ? 'misfit' : 'fit'
}

/**
 * Пол и Wi-Fi напрямую с роботом не сравниваются (нагрузка в т/м² против массы в кг, связь — по паспорту перекрытий
 * и обследованию). Поэтому по D-99 «требует проверки» — пока у площадки нет значения; значение есть — принято.
 */
const presenceFit = (value: unknown): SiteFitStatus => (value === null ? 'unknown' : 'fit')

export const robotWidthM = (specs: Pick<RobotSpecs, 'widthMm'>): number | null =>
  specs.widthMm === undefined ? null : specs.widthMm / MM_IN_M

/** Результат проверки требования робота в проекте (2.1а, «Инфраструктура»). */
export type SiteRequirementStatus = 'confirmed' | 'needs_check' | 'misfit'

export type SiteRequirementKey = 'cargo' | 'aisles' | 'temperature' | 'floorLoad' | 'connectivity'

/** Единица значения — код; подпись берёт экран (`ru.units`). */
export type SiteUnit = 'kg' | 'm' | 'tPerM2' | 'celsius'

/** Значение требования или площадки: число, диапазон или текст. */
export type SiteValue =
  | { readonly kind: 'number'; readonly value: number; readonly unit: SiteUnit }
  | { readonly kind: 'range'; readonly min: number | null; readonly max: number | null; readonly unit: SiteUnit }
  | { readonly kind: 'text'; readonly text: string }

/** Строка «требование робота → данные локации → результат». null — у робота или площадки нет данных. */
export interface SiteRequirementCheck {
  readonly key: SiteRequirementKey
  readonly requirement: SiteValue | null
  readonly locationValue: SiteValue | null
  readonly status: SiteRequirementStatus
}

const STATUS_OF: Readonly<Record<SiteFitStatus, SiteRequirementStatus>> = { fit: 'confirmed', misfit: 'misfit', unknown: 'needs_check' }

const num = (value: number | null | undefined, unit: SiteUnit): SiteValue | null =>
  value === null || value === undefined ? null : { kind: 'number', value, unit }

/**
 * Требования робота против площадки — по тем же правилам, что «Соответствие» К-3 (`cargoFit`, `aisleFit`).
 * «Требует проверки» у РЦ Химки — нагрузка на пол и Wi-Fi: те же параметры без данных, что считает шаг 1 (D-99).
 */
export function siteRequirementChecks(specs: RobotSpecs, site: SiteFacts, widthMarginM: number): readonly SiteRequirementCheck[] {
  const width = robotWidthM(specs)
  const check = (key: SiteRequirementKey, requirement: SiteValue | null, locationValue: SiteValue | null, fit: SiteFitStatus): SiteRequirementCheck =>
    ({ key, requirement, locationValue, status: STATUS_OF[fit] })
  const tempRequirement: SiteValue | null = specs.minTempC === undefined && specs.maxTempC === undefined
    ? null
    : { kind: 'range', min: specs.minTempC ?? null, max: specs.maxTempC ?? null, unit: 'celsius' }
  return [
    check('cargo', num(specs.payloadKg, 'kg'), num(site.unitMassKg, 'kg'), cargoFit(site.unitMassKg, specs.payloadKg)),
    check('aisles', width === null ? null : num(width + widthMarginM, 'm'), num(site.aisleWidthM, 'm'), aisleFit(site.aisleWidthM, width, widthMarginM)),
    check('temperature', tempRequirement, site.temperatureC && { kind: 'range', ...site.temperatureC, unit: 'celsius' }, temperatureFit(site.temperatureC, specs)),
    check('floorLoad', null, num(site.floorLoadTm2, 'tPerM2'), presenceFit(site.floorLoadTm2)),
    check('connectivity', null, site.wifiCoverage === null ? null : { kind: 'text', text: site.wifiCoverage }, presenceFit(site.wifiCoverage)),
  ]
}

/** «Требует проверки N из M» (2.1б, «Качество данных» 2.1а) — число строк без подтверждения площадкой. */
export const needsCheckCount = (checks: readonly SiteRequirementCheck[]): number =>
  checks.filter((c) => c.status === 'needs_check').length
