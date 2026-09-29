// Начальное заполнение формы 09а (PRD 9.2): значения датасета «Склад» — из параметров типа объекта,
// остальные — значения по умолчанию из сервиса процессов (PRD 15 · №22); тексты примера — только в демо-режиме.
import type { FacilityParameter, ProcessDemoText, ProcessTemplateDefaults } from '@/domain'
import { formatNumber } from '@/shared/format'
import { WAREHOUSE_STAFF } from '../staffParameters'
import { categoryValue, type ProcessForm, type StaffRow } from './processForm'

/** Без демо-режима текстовые поля пустые: форма не предлагает имя, которое при сохранении даст дубль. */
const NO_DEMO_TEXT: ProcessDemoText = { name: '', carrier: '', route: '' }

const RATIO_FORMAT = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Параметры демо-склада, из которых форма берёт значения и подсказки-формулы. */
export interface WarehouseBase {
  readonly inbound: number
  readonly outbound: number
  readonly shifts: number
  readonly shiftHours: number
  readonly peakFactor: number
  readonly oversizeShare: number
  readonly activeArea: number
  readonly floors: number
  readonly mainAisle: number
  readonly rackAisle: number
  readonly palletMass: number
  readonly workTimeLossPct: number
  readonly turnoverPct: number
  readonly payrollCoef: number
}

function numberParam(params: readonly FacilityParameter[], code: string): number {
  const base = params.find((p) => p.code === code)?.base
  if (typeof base !== 'number') throw new Error(`В датасете нет числового параметра ${code}`)
  return base
}

/** Текучести нет в приложении А и в старом seed api — принято 0, как на форме 14 (PRD 10.2). */
function numberParamOr(params: readonly FacilityParameter[], code: string, fallback: number): number {
  const base = params.find((p) => p.code === code)?.base
  return typeof base === 'number' ? base : fallback
}

export function warehouseBase(params: readonly FacilityParameter[]): WarehouseBase {
  const n = (code: string) => numberParam(params, code)
  return {
    inbound: n('wh_inbound_pallets'),
    outbound: n('wh_outbound_pallets'),
    shifts: n('wh_shifts'),
    shiftHours: n('wh_shift_hours'),
    peakFactor: n('wh_peak_factor'),
    oversizeShare: n('wh_oversize_share') / 100,
    activeArea: n('wh_active_area'),
    floors: n('wh_floors'),
    mainAisle: n('wh_main_aisle_width'),
    rackAisle: n('wh_rack_aisle_width'),
    palletMass: n('wh_pallet_mass'),
    workTimeLossPct: n('wh_work_time_loss'),
    turnoverPct: numberParamOr(params, 'wh_annual_turnover', 0),
    payrollCoef: n('wh_payroll_tax_coef'),
  }
}

function staffRows(params: readonly FacilityParameter[]): readonly StaffRow[] {
  return WAREHOUSE_STAFF.map((group, index) => ({
    role: group.role,
    headcount: numberParam(params, group.headcount),
    salaryRub: group.salary === null ? null : numberParam(params, group.salary),
    // Процесс перемещения паллет целиком занимает операторов погрузчиков (15935:1138).
    selected: index === 0,
    timeSharePct: index === 0 ? '100' : '',
  }))
}

const text = (value: number, digits = 1): string => formatNumber(value, digits)

/**
 * Начальная форма: формулы «= 2 × 11 ч», «= 1 − 5 %», «= √ 10 000 м²» считаются из датасета;
 * `demo` — тексты примера «Перемещение паллет · кросс-докинг», null — пустые поля.
 */
export function buildInitialForm(params: readonly FacilityParameter[], defaults: ProcessTemplateDefaults, demo: ProcessDemoText | null): ProcessForm {
  const base = warehouseBase(params)
  const staff = staffRows(params)
  const forkliftSalary = staff[0]?.salaryRub ?? 0
  const texts = demo ?? NO_DEMO_TEXT
  return {
    operationClass: 'OP-01',
    name: texts.name,
    category: categoryValue('warehouse', 'internal_logistics'),
    carrier: texts.carrier,
    cargoDivisible: false,
    route: texts.route,
    handling: ['forks', 'platform'],
    indoor: true,
    unitMassKg: text(base.palletMass),
    dailyVolume: text(base.inbound + base.outbound),
    workHours: text(base.shifts * base.shiftHours),
    peakFactor: text(base.peakFactor),
    automationPct: text((1 - base.oversizeShare) * 100),
    routeLengthM: text(Math.sqrt(base.activeArea), 0),
    speedLimitMps: text(defaults.speedLimitMps),
    widthMarginM: text(defaults.widthMarginM),
    liftTripPct: text(defaults.liftTripPct),
    liftWaitS: text(defaults.liftWaitS),
    minAisleWidthM: text(base.rackAisle),
    minTempC: text(defaults.minTempC),
    staff,
    replacement: Object.fromEntries(Object.entries(defaults.replacement).map(([method, ratio]) => [method, RATIO_FORMAT.format(ratio)])),
    turnoverPct: text(base.turnoverPct),
    workTimeLossPct: text(base.workTimeLossPct),
    fleetOperators: text(defaults.fleetOperators),
    fleetSalaryRub: text(forkliftSalary),
    sitePrepPct: text(defaults.sitePrepPct),
    itIntegrationRub: text(defaults.itIntegrationRub),
    consumablesRub: text(defaults.consumablesRub),
    otherEffectsRub: text(defaults.otherEffectsRub),
  }
}
