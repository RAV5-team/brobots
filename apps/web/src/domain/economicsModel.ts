import type { AcquisitionModel } from './projectInputs'
import type { CostItem } from './projectMatching'
import type { CurrentProcessEconomics, ScenarioEconomics } from './projectEconomics'

/** Начисления на ФОТ: страховые взносы 30,2 % [ДС-Легенда]. */
const PAYROLL_FACTOR = 1.302
const MONTHS = 12

/** Остаются в процессе после внедрения: ФОТ оставшихся исполнителей и обслуживание оставшихся погрузчиков. */
const REMAINING_CODES: ReadonlySet<string> = new Set(['labor.remaining_annual_payroll', 'opex.annual_repair_cost'])
const PAYROLL_CODE = 'labor.remaining_annual_payroll'
/** Масштабируются по числу роботов и станций — как «Экономика, предварительно» вердикта (D-104). */
const PER_ROBOT: ReadonlySet<string> = new Set(['capex.equipment', 'opex.annual_raas_cost', 'opex.annual_energy_cost', 'opex.annual_service_cost'])
const PER_STATION: ReadonlySet<string> = new Set(['capex.charging'])
/** Параметр цены: у RaaS — тариф, у покупки — цена робота (PRD 11.5, ТЗ 3.5.6). */
const PRICE_CODE = { raas: 'opex.annual_raas_cost', purchase: 'capex.equipment' } as const

const sumOf = (items: readonly CostItem[], codes: ReadonlySet<string>): number =>
  items.filter((item) => codes.has(item.code)).reduce((sum, item) => sum + item.amountRub, 0)

/** Цепочка «Из чего складываются затраты и эффект» (PRD 11.5), ₽ в год. */
export interface EffectChain {
  readonly currentRub: number
  /** Подтверждаемая экономия на персонале. */
  readonly laborSavingsRub: number
  /** Иной эффект: часть техники выводится из работы. */
  readonly otherEffectRub: number
  /** Новые расходы: платёж RaaS или ТО и ПО, электроэнергия. */
  readonly newCostsRub: number
  readonly afterRub: number
  readonly effectRub: number
}

/**
 * Текущие − экономия на персонале − сокращение обслуживания + новые расходы = расходы после внедрения.
 * Новые расходы — OPEX без того, что остаётся от процесса; иной эффект — остаток разницы.
 */
export function effectChain(scenario: ScenarioEconomics, current: CurrentProcessEconomics): EffectChain {
  const remaining = sumOf(scenario.opexItems, REMAINING_CODES)
  const laborSavingsRub = scenario.laborSavingsRubPerYear ?? 0
  return {
    currentRub: current.opexRubPerYear,
    laborSavingsRub,
    otherEffectRub: current.opexRubPerYear - laborSavingsRub - remaining,
    newCostsRub: scenario.opexRubPerYear - remaining,
    afterRub: scenario.opexRubPerYear,
    effectRub: current.opexRubPerYear - scenario.opexRubPerYear,
  }
}

/** Статьи новых расходов: OPEX без того, что остаётся от текущего процесса. */
export function newCostItems(scenario: ScenarioEconomics): readonly CostItem[] {
  return scenario.opexItems.filter((item) => !REMAINING_CODES.has(item.code))
}

/** Сколько ставок даёт экономия ФОТ: 16,7 млн ÷ (120 000 × 12 × 1,302) ≈ 8,9 (PRD 11.5). */
export function staffEquivalent(laborSavingsRub: number, salaryRubPerMonth: number): number {
  return laborSavingsRub / (salaryRubPerMonth * MONTHS * PAYROLL_FACTOR)
}

/** Год выхода в плюс по накопленному потоку: окупаемость 0,7 года — «в течение года 1»; null — не окупается. */
export function breakEvenYear(paybackYears: number | null): number | null {
  return paybackYears === null ? null : Math.max(1, Math.ceil(paybackYears))
}

export type SensitivityParameter = 'price' | 'labor' | 'volume'
const SENSITIVITY_PARAMETERS: readonly SensitivityParameter[] = ['price', 'labor', 'volume']
/** ±20 % — допущение команды для одиночных проверок (PRD 11.5). */
const SENSITIVITY_SHIFT = 0.2

/** Итог сценария при отклонённом параметре. */
export interface ShiftedResult {
  readonly capexRub: number
  readonly opexRubPerYear: number
  readonly effectRub: number
  /** null — не окупается. */
  readonly paybackYears: number | null
  readonly tcoRub: number
  /** Парк после пересчёта объёма; у остальных параметров — как в расчёте. */
  readonly robots: number
}

interface Shift {
  readonly capexDelta: number
  readonly opexDelta: number
  readonly currentDelta: number
  readonly robots: number
}

/** Цена: тариф RaaS меняет OPEX, цена робота — CAPEX. */
function priceShift(s: ScenarioEconomics, k: number): Shift {
  const code = new Set([PRICE_CODE[s.acquisition]])
  const items = s.acquisition === 'raas' ? s.opexItems : s.capexItems
  const delta = sumOf(items, code) * (k - 1)
  return s.acquisition === 'raas'
    ? { capexDelta: 0, opexDelta: delta, currentDelta: 0, robots: s.robots }
    : { capexDelta: delta, opexDelta: 0, currentDelta: 0, robots: s.robots }
}

/** Стоимость труда: меняется весь ФОТ — и текущий, и оставшийся после внедрения. */
function laborShift(s: ScenarioEconomics, k: number): Shift {
  const payroll = sumOf(s.opexItems, new Set([PAYROLL_CODE]))
  const labor = s.laborSavingsRubPerYear ?? 0
  return { capexDelta: 0, opexDelta: payroll * (k - 1), currentDelta: (payroll + labor) * (k - 1), robots: s.robots }
}

/**
 * Объём операций: текущий процесс и то, что от него остаётся, — пропорционально; парк — с округлением вверх,
 * станции — в той же пропорции к роботам; статьи на робота и станцию — по новому составу. Расчётная оценка до нового прогона.
 */
function volumeShift(s: ScenarioEconomics, current: CurrentProcessEconomics, k: number): Shift {
  const robots = Math.ceil(s.robots * k)
  const stations = s.stations ? Math.ceil(robots * (s.stations / s.robots)) : null
  const robotRatio = robots / s.robots
  const stationRatio = s.stations && stations ? stations / s.stations : 1
  const scaled = (items: readonly CostItem[]) =>
    sumOf(items, PER_ROBOT) * (robotRatio - 1) + sumOf(items, PER_STATION) * (stationRatio - 1)
  return {
    capexDelta: scaled(s.capexItems),
    opexDelta: scaled(s.opexItems) + sumOf(s.opexItems, REMAINING_CODES) * (k - 1),
    currentDelta: current.opexRubPerYear * (k - 1),
    robots,
  }
}

/** Итог сценария при отклонении одного параметра на долю `shift` (−0,2 или +0,2). */
export function shiftedResult(
  scenario: ScenarioEconomics,
  current: CurrentProcessEconomics,
  horizonYears: number,
  parameter: SensitivityParameter,
  shift: number,
): ShiftedResult {
  const k = 1 + shift
  const delta = parameter === 'price' ? priceShift(scenario, k) : parameter === 'labor' ? laborShift(scenario, k) : volumeShift(scenario, current, k)
  const capexRub = scenario.capexRub + delta.capexDelta
  const opexRubPerYear = scenario.opexRubPerYear + delta.opexDelta
  const effectRub = current.opexRubPerYear + delta.currentDelta - opexRubPerYear
  return {
    capexRub,
    opexRubPerYear,
    effectRub,
    paybackYears: effectRub > 0 ? capexRub / effectRub : null,
    tcoRub: capexRub + opexRubPerYear * horizonYears,
    robots: delta.robots,
  }
}

/** Строка «Устойчивость результата» сценария: −20 % и +20 % параметра. */
export interface SensitivityResult {
  readonly parameter: SensitivityParameter
  readonly minus: ShiftedResult
  readonly plus: ShiftedResult
  /** Эффект остаётся положительным при обоих отклонениях. */
  readonly staysPositive: boolean
  /** Сценарий, который при отклонении становится дешевле по TCO вместо базового лидера; null — предпочтение сохраняется. */
  readonly flipsTo: AcquisitionModel | null
}

/**
 * Чувствительность сценария к трём параметрам (ТЗ 3.5.6). Предпочтение — сценарий с меньшим TCO; при отклонении
 * другие сценарии пересчитываются с тем же отклонением, кроме цены — она у каждого своя, другой берётся без изменения.
 */
export function sensitivity(
  scenario: ScenarioEconomics,
  others: readonly ScenarioEconomics[],
  current: CurrentProcessEconomics,
  horizonYears: number,
): readonly SensitivityResult[] {
  const all = [scenario, ...others]
  const cheapest = (tco: (s: ScenarioEconomics) => number): AcquisitionModel | null =>
    lowestOf(all.map((s) => ({ key: s.acquisition, value: tco(s) })))
  const baseLeader = cheapest((s) => s.capexRub + s.opexRubPerYear * horizonYears)
  return SENSITIVITY_PARAMETERS.map((parameter) => {
    const at = (s: ScenarioEconomics, shift: number) => shiftedResult(s, current, horizonYears, parameter, shift)
    const leaderAt = (shift: number) =>
      cheapest((s) => at(s, s === scenario || parameter !== 'price' ? shift : 0).tcoRub)
    const minus = at(scenario, -SENSITIVITY_SHIFT)
    const plus = at(scenario, SENSITIVITY_SHIFT)
    const flipsTo = [leaderAt(-SENSITIVITY_SHIFT), leaderAt(SENSITIVITY_SHIFT)].find((l) => l !== null && l !== baseLeader) ?? null
    return { parameter, minus, plus, staysPositive: minus.effectRub > 0 && plus.effectRub > 0, flipsTo }
  })
}

/** Сценарий с наименьшим значением показателя; равенство или нет данных — null. */
export function lowestOf<T extends string>(values: ReadonlyArray<{ readonly key: T; readonly value: number | null }>): T | null {
  const known = values.filter((v): v is { readonly key: T; readonly value: number } => v.value !== null)
  const min = Math.min(...known.map((v) => v.value))
  const winners = known.filter((v) => v.value === min)
  return winners.length === 1 ? (winners[0]?.key ?? null) : null
}
