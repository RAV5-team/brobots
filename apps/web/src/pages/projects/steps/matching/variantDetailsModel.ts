import type { AcquisitionModel, MatchingEvaluation, RankedVariant, Robot, ScoreContribution } from '@/domain'
import type { RobotCharacteristicMap } from '@/pages/catalog/characteristics'
import { formatCount } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { brandOf, breakdownOf, findVariant, formatScore, inline } from './matchingModel'

const rows = ru.catalog.item.rows
const o = ru.project.matching.details.overview

/** Строка «подпись — значение» вкладки «Обзор»; null — «нет данных». */
export interface OverviewRow {
  readonly key: string
  readonly label: string
  readonly value: string | null
}

export interface OverviewView {
  readonly identification: readonly OverviewRow[]
  readonly applicability: readonly OverviewRow[]
  /** «Почему подходит»: прошедшие проверки варианта. */
  readonly fits: readonly string[]
  /** «Недостающие данные»: параметры площадки без данных (D-99, тот же источник, что в правой колонке). */
  readonly missing: readonly string[]
  readonly criteria: readonly OverviewRow[]
}

/** Окно 2.1а открыто для варианта: `?details=RB-0008:raas`. */
export const DETAILS_PARAM = 'details'

export function parseDetailsKey(value: string | null): { readonly solutionId: string; readonly acquisition: AcquisitionModel } | null {
  if (value === null) return null
  const [solutionId, acquisition] = value.split(':')
  if (!solutionId || (acquisition !== 'purchase' && acquisition !== 'raas')) return null
  return { solutionId, acquisition }
}

/** Вариант окна: только из рейтинга (у решения вне рейтинга расчёта нет). */
export function detailsVariant(evaluation: MatchingEvaluation, value: string | null): RankedVariant | null {
  const key = parseDetailsKey(value)
  if (!key) return null
  const variant = findVariant(evaluation, key.solutionId, key.acquisition)
  return variant && variant.rank !== null ? variant : null
}

/** «Почему подходит» — прошедшие проверки варианта (рекомендация 2.1 и «Обзор» 2.1а). */
export const fitsOf = (v: RankedVariant): readonly string[] => v.fits?.map((c) => c.label) ?? []

const criterionRow = (c: ScoreContribution): OverviewRow => ({
  key: c.code,
  label: inline(c.label),
  value: c.contribution === null ? null : formatScore(c.contribution),
})

/**
 * Вкладка «Обзор» (16666:10; PRD 11.3 «Карточка решения»): идентификация и применимость — характеристики К-4
 * (`robotCharacteristics`) без плашек и источников; наименование — предложение расчёта, назначение — короткое поле робота.
 */
export function overviewView(v: RankedVariant, robot: Robot, map: RobotCharacteristicMap, siteChecks: readonly string[]): OverviewView {
  const manufacturer = map.manufacturer.value
  return {
    identification: [
      { key: 'name', label: o.name, value: v.priceOffer?.offerName ?? robot.name },
      { key: 'manufacturer', label: rows.manufacturer, value: manufacturer === null ? null : brandOf(manufacturer) },
      { key: 'solutionType', label: rows.solutionType, value: map.solutionType.value },
      { key: 'purpose', label: o.purpose, value: robot.purpose ?? null },
      { key: 'origin', label: rows.origin, value: map.origin.value },
      { key: 'availability', label: rows.availability, value: map.availability.value },
    ],
    applicability: (['supportedProcesses', 'facilityTypes', 'limitations', 'cases'] as const).map((key) => ({ key, label: rows[key], value: map[key].value })),
    fits: fitsOf(v),
    missing: siteChecks.map((label) => label.charAt(0).toLocaleUpperCase('ru') + label.slice(1)),
    criteria: breakdownOf(v).map(criterionRow),
  }
}

/** Строка под заголовком окна: «Морос · AMR · 18 роботов» и «CAPEX 6,1 млн ₽ · эффект 9,2 млн ₽/год». */
export function detailsSummary(v: RankedVariant, robot: Robot | undefined, money: (value: number) => string): readonly [string, string] {
  const d = ru.project.matching.details
  const first = [brandOf(v.manufacturer), robot?.subtype, formatCount(v.robots, ru.plural.robots)].filter(Boolean).join(' · ')
  return [first, d.money(money(v.capexRub), money(v.annualEffectRub))]
}
