// Источник: PRD 11.3 (условия отбора, рейтинг 8 вариантов, исключённые) и 11.5 (разложение CAPEX и OPEX AMR 800).
// Форма — ответ GET /api/v1/projects/{id}/evaluation (api.yaml, схема Evaluation). Правится вручную.
// ROI, TCO и станций у вариантов 2–8 в PRD нет — поля не заданы (экран покажет «—»). Отступления — README.md.
import type { ApiSchemas } from '@/api/contract'
import type { CalcParams } from '@/domain'

type CalcResult = ApiSchemas['CalcResult']
type Candidate = ApiSchemas['EvaluatedCandidate']

const M = 1_000_000
const HORIZON = 5
/** Текущий процесс: ФОТ 25 операторов 46,9 + обслуживание 8 погрузчиков 4,3 млн ₽ в год (PRD 11.5). */
const BASELINE_OPEX = 51.2 * M
const BASELINE_TCO = 256 * M

/** Веса рейтинга подсказки подбора (PRD 11.3; расхождение весов с итогом — D-88, №116), %. */
const WEIGHTS = { payback: 30, roi: 15, tco_savings: 10, budget_fit: 10, maturity: 10, annual_effect: 10, fleet_utilization: 5, data_quality: 10 }
const LABELS: Record<keyof typeof WEIGHTS, string> = {
  payback: 'Окупаемость', roi: 'ROI', tco_savings: 'TCO', budget_fit: 'CAPEX к бюджету', maturity: 'Зрелость решения',
  annual_effect: 'Эффект', fleet_utilization: 'Загрузка парка', data_quality: 'Полнота данных',
}
const criteria = (contributions: Partial<Record<keyof typeof WEIGHTS, number>>): ApiSchemas['ScoreCriterion'][] =>
  (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).map((code) => ({
    code, label: LABELS[code], weight: WEIGHTS[code], contribution: contributions[code] ?? null, missing: contributions[code] === undefined,
  }))

const cost = (code: string, label: string, amountRub: number): ApiSchemas['CostItem'] => ({ code, label, amountRub })

interface Figures {
  readonly id: string
  readonly solutionId: string
  readonly acquisition: 'purchase' | 'raas'
  readonly rank: number
  readonly score: number
  readonly robots: number
  readonly capex: number
  readonly opex: number
  /** Годовой платёж RaaS, млн ₽ (у покупки — 0). */
  readonly raasYear: number
  readonly payback: number | null
  readonly warnings?: readonly string[]
}

/** Результат расчёта варианта: эффект — разница OPEX с текущим процессом (51,2 − OPEX, PRD 11.3). */
const calc = (f: Figures, extra: Partial<CalcResult> = {}): CalcResult => ({
  id: f.id,
  solutionId: f.solutionId,
  acquisitionModel: f.acquisition,
  rank: f.rank,
  score: f.score,
  robotCount: f.robots,
  capexRub: f.capex * M,
  opexYearRub: f.opex * M,
  netEffectYearRub: Math.round((BASELINE_OPEX - f.opex * M) / 1000) * 1000,
  paybackYears: f.payback,
  calculable: true,
  warnings: [...(f.warnings ?? [])],
  details: {
    baselineOpexYearRub: BASELINE_OPEX,
    baselineTcoRub: BASELINE_TCO,
    opexItems: f.raasYear > 0 ? [cost('opex.annual_raas_cost', 'Платёж RaaS', f.raasYear * M)] : [],
    scoreCriteria: criteria({}),
  },
  ...extra,
})

/** AMR 800 · RaaS: CAPEX = станции 3,1 + Wi-Fi 0,5 + внедрение 2,5; OPEX = ФОТ 30,2 + RaaS 9,9 + энергия 0,4 + погрузчики 1,5. */
const AMR800_RAAS = calc(
  { id: 'CR-AMR800-RAAS', solutionId: 'RB-0008', acquisition: 'raas', rank: 1, score: 0.91, robots: 18, capex: 6.1, opex: 42, raasYear: 9.9, payback: 0.7 },
  {
    chargerCount: 6, roi: 6.54, tcoRub: 216.1 * M, laborSavingsYearRub: 16.7 * M,
    details: {
      baselineOpexYearRub: BASELINE_OPEX, baselineTcoRub: BASELINE_TCO, cycleTimeS: 312, fleetUtilization: 0.83,
      capexItems: [cost('capex.charging', 'Зарядная инфраструктура', 3.1 * M), cost('capex.site_preparation', 'Подготовка объекта', 0.5 * M), cost('capex.commissioning', 'Пусконаладка; для RaaS — установочный платёж', 2.5 * M)],
      opexItems: [cost('labor.remaining_annual_payroll', 'Оставшийся ФОТ', 30.2 * M), cost('opex.annual_raas_cost', 'Платёж RaaS', 9.9 * M), cost('opex.annual_energy_cost', 'Электроэнергия', 0.4 * M), cost('opex.annual_repair_cost', 'Ремонт и запчасти', 1.5 * M)],
      scoreCriteria: criteria({ payback: 0.3, roi: 0.15, tco_savings: 0.1, budget_fit: 0.1, maturity: 0.09, annual_effect: 0.05, fleet_utilization: 0.03, data_quality: 0.09 }),
    },
  },
)

/** AMR 800 · покупка: CAPEX = 18 × 2 244 тыс. + ПО 0,9 + станции 3,1 + Wi-Fi 0,5 + внедрение 2,5; OPEX = ФОТ 30,2 + ТО 1,8 + ПО 0,6 + энергия 0,4 + погрузчики 1,5. */
const AMR800_PURCHASE = calc(
  { id: 'CR-AMR800-PURCHASE', solutionId: 'RB-0008', acquisition: 'purchase', rank: 4, score: 0.72, robots: 18, capex: 47.4, opex: 34.5, raasYear: 0, payback: 2.8 },
  {
    chargerCount: 6, roi: 0.76, tcoRub: 219.9 * M, laborSavingsYearRub: 16.7 * M,
    details: {
      baselineOpexYearRub: BASELINE_OPEX, baselineTcoRub: BASELINE_TCO, cycleTimeS: 312, fleetUtilization: 0.83,
      capexItems: [cost('capex.equipment', 'Оборудование', 40.392 * M), cost('capex.software', 'ПО управления флотом', 0.9 * M), cost('capex.charging', 'Зарядная инфраструктура', 3.1 * M), cost('capex.site_preparation', 'Подготовка объекта', 0.5 * M), cost('capex.commissioning', 'Пусконаладка', 2.5 * M)],
      opexItems: [cost('labor.remaining_annual_payroll', 'Оставшийся ФОТ', 30.2 * M), cost('opex.annual_service_cost', 'Сервисный контракт', 1.8 * M), cost('opex.annual_license_cost', 'Лицензии ПО', 0.6 * M), cost('opex.annual_energy_cost', 'Электроэнергия', 0.4 * M), cost('opex.annual_repair_cost', 'Ремонт и запчасти', 1.5 * M)],
      scoreCriteria: criteria({}),
    },
  },
)

const solution = (id: string, name: string, manufacturer: string): ApiSchemas['CandidateSolution'] => ({ id, name, manufacturer })

const passed = (sol: ApiSchemas['CandidateSolution'], state: 'passed' | 'needs_verification', results: CalcResult[]): Candidate => ({
  match: { solution: sol, state, isManual: false, checks: [] },
  results,
})

const fail = (code: NonNullable<ApiSchemas['Check']['code']>, label: string, message: string): ApiSchemas['Check'] => ({ code, label, status: 'fail', message })

const excluded = (sol: ApiSchemas['CandidateSolution'], checks: ApiSchemas['Check'][]): Candidate => ({
  match: { solution: sol, state: 'excluded', isManual: false, checks },
})

/** Расчёт подбора РЦ Химки · перемещение паллет (LP-01): рейтинг PRD 11.3, 130 рейсов/ч в пик, 8 вариантов. */
export const EVALUATION_LP01: ApiSchemas['Evaluation'] = {
  id: 'EV-LP01-0926',
  projectId: 'PJ-DEMO',
  horizonYears: HORIZON,
  modelVersion: '2.1',
  catalogVersion: 4,
  normsVersion: 3,
  stale: false,
  acquisitionModels: ['purchase', 'raas'],
  recommendedResultId: 'CR-AMR800-RAAS',
  conditions: [
    { code: 'work_type', label: 'Класс операции', text: 'OP-01 · Перемещение грузов', source: 'task', applicable: true },
    { code: 'handling', label: 'Способ обработки груза', list: ['вилы', 'платформа'], source: 'task', applicable: true },
    { code: 'payload', label: 'Грузоподъёмность', number: 800, unit: 'кг', source: 'task', note: 'средняя масса паллеты', applicable: true },
    { code: 'aisle_width', label: 'Ширина робота', number: 2.5, unit: 'м', source: 'formula', note: 'проход 3,0 м − запас 0,5 м', applicable: true },
    { code: 'environment', label: 'Среда', text: 'в помещении, +5…+25 °C', source: 'task', applicable: true },
    { code: 'price', label: 'Цена', text: 'есть в каталоге или файле цен', source: 'rule', applicable: true },
  ],
  counts: { total: 8, passed: 2, needsVerification: 2, excluded: 4, manual: 0 },
  candidates: [
    passed(solution('RB-0008', 'AMR 800', 'ООО «Морос»'), 'needs_verification', [AMR800_RAAS, AMR800_PURCHASE]),
    passed(solution('RB-0001', 'Ronavi H1500', 'ООО «Ронави Роботикс»'), 'needs_verification', [
      calc({ id: 'CR-H1500-RAAS', solutionId: 'RB-0001', acquisition: 'raas', rank: 2, score: 0.78, robots: 16, capex: 7.3, opex: 45.7, raasYear: 12.36, payback: 1.3 }),
      calc({ id: 'CR-H1500-PURCHASE', solutionId: 'RB-0001', acquisition: 'purchase', rank: 5, score: 0.63, robots: 16, capex: 61.6, opex: 35.8, raasYear: 0, payback: 4 }),
    ]),
    passed(solution('RB-0005', 'Ronavi M', 'ООО «Ронави Роботикс»'), 'passed', [
      calc({ id: 'CR-M-RAAS', solutionId: 'RB-0005', acquisition: 'raas', rank: 3, score: 0.73, robots: 18, capex: 7.3, opex: 45.9, raasYear: 12.36, payback: 1.4 }),
      calc({ id: 'CR-M-PURCHASE', solutionId: 'RB-0005', acquisition: 'purchase', rank: 6, score: 0.57, robots: 18, capex: 61.9, opex: 35.9, raasYear: 0, payback: 4 }),
    ]),
    passed(solution('RB-0013', 'DMR Carrier P', 'ООО «Диком-Сервис»'), 'passed', [
      calc({ id: 'CR-DMR-PURCHASE', solutionId: 'RB-0013', acquisition: 'purchase', rank: 7, score: 0.33, robots: 19, capex: 113.5, opex: 34.4, raasYear: 0, payback: 6.8, warnings: ['Статус поставки не подтверждён'] }),
      calc({ id: 'CR-DMR-RAAS', solutionId: 'RB-0013', acquisition: 'raas', rank: 8, score: 0.26, robots: 19, capex: 11.5, opex: 53.2, raasYear: 21.24, payback: null, warnings: ['Чистый эффект отрицательный'] }),
    ]),
    excluded(solution('RB-0004', 'Ronavi SD', 'ООО «Ронави Роботикс»'), [
      fail('work_type', 'Класс операции', 'нужно OP-01 Перемещение грузов, есть OP-08 Адресная доставка'),
      fail('payload', 'Грузоподъёмность', 'нужно ≥ 800 кг, есть 10 кг'),
    ]),
    excluded(solution('RB-0188', 'Беспилотный тягач (Когнитив Пилот)', 'АО «Когнитив Пилот»'), [
      fail('handling', 'Способ обработки груза', 'нужно вилы / платформа, есть буксировка'),
      fail('environment', 'Среда', 'нужно в помещении, есть улица'),
    ]),
    excluded(solution('RB-0187', 'EVOCARGO N1', 'ООО «Эвокарго»'), [
      fail('handling', 'Способ обработки груза', 'нужно вилы / платформа, есть кузов'),
      fail('environment', 'Среда', 'нужно в помещении, есть улица'),
    ]),
    excluded(solution('RB-0021', 'MARK 2 SE', 'ООО «Р2Б»'), [
      fail('work_type', 'Класс операции', 'нужно OP-01 Перемещение грузов, есть OP-07 Уборка помещений'),
    ]),
  ],
}

/** Расчёты подбора по процессам локаций. Есть только у РЦ Химки · перемещение паллет — сквозной пример PRD 11. */
export const EVALUATIONS_BY_PROCESS: Readonly<Record<string, ApiSchemas['Evaluation']>> = { 'LP-01': EVALUATION_LP01 }

/**
 * Исходные «Параметры расчёта» подбора LP-01 (PRD 11.3, таблица панели). В API их нет (api-contract.md, №11).
 * Цена единицы 2 244 тыс. ₽ — из расчёта подбора, в каталоге 1 800 тыс. (PRD 15 · №107).
 */
export const CALC_DEFAULTS_LP01: CalcParams = {
  staffCostRubPerMonth: 120_000,
  workHoursPerDay: 22,
  robotTripsPerHour: 8.6,
  robotPriceRub: 2_244_000,
  serviceCostRubPerYear: 1.8 * M,
  utilization: 0.75,
  horizonYears: HORIZON,
}

export const CALC_DEFAULTS_BY_PROCESS: Readonly<Record<string, CalcParams>> = { 'LP-01': CALC_DEFAULTS_LP01 }
