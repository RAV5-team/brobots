// Данные окна 2.1а «Подробнее о решении» (доска 16325, 2.1а1–2.1а5) для расчёта подбора LP-01.
// Полей нет в API (`Evaluation`) — фронтовая фикстура, вопросы — docs/api-contract.md, №16–18. Правится вручную.
// Подгружается моком лениво (`services/mock/variantDetails.ts`): в стартовый бандл не входит.
// Разбор балла — у всех 8 вариантов (с макета 2.1, 16325:92), остальное — только у AMR 800 (оба способа).
// У остальных вариантов этих полей нет — экран покажет «нет данных». Отступления от макета — README.md.
import type { AcquisitionModel, RankedVariant, ScoreContribution, SolutionCheck } from '@/domain'
import { CALC_DEFAULTS_LP01, SCORE_LABELS, SCORE_WEIGHTS } from './projectMatching'

type ScoreCode = keyof typeof SCORE_WEIGHTS

/** Поля варианта, которых нет в ответе API. */
export type VariantDetails = Pick<
  RankedVariant,
  'scoreBreakdown' | 'reasons' | 'priceOffer' | 'ownership' | 'netEffectItems' | 'raasTerms' | 'auxEquipment' | 'effectiveProductivity'
>

/** Ключ варианта: решение × способ приобретения. */
export const variantKey = (solutionId: string, acquisition: AcquisitionModel): string => `${solutionId}:${acquisition}`

const M = 1_000_000
const PERCENT = 100

/**
 * Вклады в порядке строк макета: окупаемость, ROI, CAPEX к бюджету, TCO, зрелость, годовой эффект, загрузка, полнота.
 * Сумма равна баллу фикстуры (проверяет projectMatchingDetails.test.ts).
 */
const breakdown = (
  payback: number, roi: number, budgetFit: number, tco: number, maturity: number, effect: number, fleet: number, data: number,
): readonly ScoreContribution[] => {
  const values: Readonly<Record<ScoreCode, number>> = {
    payback, roi, budget_fit: budgetFit, tco_savings: tco, maturity, annual_effect: effect, fleet_utilization: fleet, data_quality: data,
  }
  return (Object.keys(SCORE_WEIGHTS) as ScoreCode[]).map((code) => ({
    code, label: SCORE_LABELS[code], weight: SCORE_WEIGHTS[code] / PERCENT, contribution: values[code],
  }))
}

const check = (code: string, label: string, status: SolutionCheck['status'], message: string | null = null): SolutionCheck =>
  ({ code, label, status, message })

/** «Почему подходит» — условия отбора, «Недостающие данные» — параметры площадки без данных (D-99: у РЦ Химки их 2). */
const AMR800_REASONS: NonNullable<RankedVariant['reasons']> = {
  fits: [
    check('work_type', 'Класс операции OP-01 и способ «платформа» совпадают с процессом', 'pass'),
    check('payload', 'Грузоподъёмность 800 кг покрывает среднюю массу паллеты', 'pass'),
    check('environment', 'Работает в помещении при +5…+25 °C', 'pass'),
  ],
  missing: [
    check('site_floor_load_tm2', 'Нагрузка на пол', 'unknown', 'нет данных в профиле площадки'),
    check('site_wifi_coverage', 'Покрытие Wi-Fi', 'unknown', 'нет данных в профиле площадки'),
  ],
}

/** Цена расчёта подбора (2 244 тыс. ₽), а не каталога (1,80 млн ₽) — PRD 15 · №107. */
const AMR800_PRICE: NonNullable<RankedVariant['priceOffer']> = {
  unitPriceRub: CALC_DEFAULTS_LP01.robotPriceRub,
  currency: 'RUB',
  vatIncluded: true,
  included: ['Робот', 'базовое ПО', 'стандартная комплектация'],
  excluded: ['Доставка', 'пусконаладка', 'глубокая интеграция с ИТ-системами'],
  offerName: 'AMR 800 · базовая комплектация',
  source: 'Файл цен организатора',
  date: '2026-09-01',
}

const IMPLEMENTATION = { value: 2.5 * M, assumption: true, note: 'оценка, допущение модели' } as const
const SERVICE_LIFE = { value: 7, assumption: true, note: 'в каталоге не указан; горизонт расчёта — отдельный параметр' } as const

/** Вспомогательное оборудование: станции — из расчёта (1 на 3), адаптер — на каждого робота, 4 точки Wi-Fi (PRD 11.5). */
const AMR800_EQUIPMENT: NonNullable<RankedVariant['auxEquipment']> = { stations: 6, adapters: 18, wifiPoints: 4 }

/** 3 600 ÷ 312 с × 0,75 ≈ 8,6 рейса/ч — производительность «Параметров расчёта» (D-101). Погрузка — ТТХ робота. */
const AMR800_PRODUCTIVITY: NonNullable<RankedVariant['effectiveProductivity']> = {
  tripsPerHour: CALC_DEFAULTS_LP01.robotTripsPerHour,
  cycleTimeS: 312,
  loadTimeS: 45,
  utilization: CALC_DEFAULTS_LP01.utilization,
  chargingShare: 0.12,
}

/** Экономия ФОТ 46,9 − 30,2 и вывод 5 из 8 погрузчиков 4,3 − 1,5 (PRD 11.5) — одинаковы у обоих способов. */
const LABOR = { code: 'labor.payroll_savings', kind: 'labor', label: 'Экономия фонда оплаты труда', amountRub: 16.7 * M } as const
const FORKLIFTS = { code: 'other.forklifts', kind: 'other', label: 'Иные эффекты: вывод 5 из 8 погрузчиков', amountRub: 2.8 * M } as const
/** Новые расходы на роботов — статьи OPEX варианта, кроме оставшегося ФОТ и обслуживания погрузчиков. */
const newCosts = (amountRub: number) => ({ code: 'new_costs.robots', kind: 'new_costs', label: 'Новые расходы на роботов', amountRub: -amountRub }) as const

const AMR800_RAAS: VariantDetails = {
  scoreBreakdown: breakdown(0.3, 0.15, 0.1, 0.1, 0.09, 0.05, 0.03, 0.09),
  reasons: AMR800_REASONS,
  priceOffer: AMR800_PRICE,
  // ПО, обслуживание и замена АКБ входят в тариф RaaS — отдельно не считаются.
  ownership: { softwareOneOffRub: null, softwareRubPerYear: null, implementationRub: IMPLEMENTATION, serviceRubPerYear: null, serviceLifeYears: SERVICE_LIFE },
  netEffectItems: [LABOR, FORKLIFTS, newCosts((9.9 + 0.4) * M)],
  raasTerms: {
    tariffStructure: 'fixed',
    billingBase: 'за робота в месяц',
    // 9,9 млн ₽ в год ÷ 12 ÷ 18 роботов; на макете — округлённые 46 000 ₽.
    rateRub: 45_833,
    usageNote: 'не влияет на платёж',
    monthlyFleetRub: 825_000,
    includedServices: ['ТО и ремонт', 'ПО и обновления', 'замена АКБ'],
    extraCosts: ['Внедрение', 'станции и адаптеры', 'связь'],
    contractMonths: 36,
    renewal: null,
    buyout: null,
    indexationPerYear: 0.05,
    assumptions: ['после 36 мес. — продление по тому же тарифу', 'индексация 5 % в год'],
    source: 'Расчётный сценарий команды — не предложение производителя',
  },
  auxEquipment: AMR800_EQUIPMENT,
  effectiveProductivity: AMR800_PRODUCTIVITY,
}

const AMR800_PURCHASE: VariantDetails = {
  scoreBreakdown: breakdown(0.19, 0.08, 0.06, 0.09, 0.1, 0.15, 0.03, 0.02),
  reasons: AMR800_REASONS,
  priceOffer: AMR800_PRICE,
  ownership: {
    softwareOneOffRub: 0.9 * M,
    softwareRubPerYear: 0.6 * M,
    implementationRub: IMPLEMENTATION,
    serviceRubPerYear: CALC_DEFAULTS_LP01.serviceCostRubPerYear,
    serviceLifeYears: SERVICE_LIFE,
  },
  netEffectItems: [LABOR, FORKLIFTS, newCosts((1.8 + 0.6 + 0.4) * M)],
  auxEquipment: AMR800_EQUIPMENT,
  effectiveProductivity: AMR800_PRODUCTIVITY,
}

/** Поля окна 2.1а по вариантам расчёта LP-01. */
export const VARIANT_DETAILS_LP01: Readonly<Record<string, VariantDetails>> = {
  [variantKey('RB-0008', 'raas')]: AMR800_RAAS,
  [variantKey('RB-0008', 'purchase')]: AMR800_PURCHASE,
  [variantKey('RB-0001', 'raas')]: { scoreBreakdown: breakdown(0.27, 0.12, 0.1, 0.09, 0.09, 0.05, 0.04, 0.02) },
  [variantKey('RB-0005', 'raas')]: { scoreBreakdown: breakdown(0.27, 0.11, 0.1, 0.08, 0.08, 0.05, 0.03, 0.01) },
  [variantKey('RB-0001', 'purchase')]: { scoreBreakdown: breakdown(0.14, 0.06, 0.06, 0.08, 0.09, 0.14, 0.04, 0.02) },
  [variantKey('RB-0005', 'purchase')]: { scoreBreakdown: breakdown(0.13, 0.05, 0.05, 0.08, 0.08, 0.14, 0.03, 0.01) },
  [variantKey('RB-0013', 'purchase')]: { scoreBreakdown: breakdown(0.03, 0, 0, 0, 0.07, 0.15, 0.05, 0.03) },
  [variantKey('RB-0013', 'raas')]: { scoreBreakdown: breakdown(0, 0, 0.1, 0.01, 0.07, 0, 0.05, 0.03) },
}

/** Поля окна 2.1а по процессам локаций — как `EVALUATIONS_BY_PROCESS`. */
export const VARIANT_DETAILS_BY_PROCESS: Readonly<Record<string, Readonly<Record<string, VariantDetails>>>> = { 'LP-01': VARIANT_DETAILS_LP01 }
