// Пример заполнения формы 09а: «Перемещение паллет · кросс-докинг» на значениях демо-склада (PRD 9.2).
// Значения из датасета «Склад» берутся из параметров типа объекта; остальные — значения по умолчанию макета 15935:903.
// Коэффициенты без норматива (PRD 15 · №22) — здесь, пока их нет в справочнике нормативов А5.
import type { FacilityParameter, HandlingMethodCode } from '@/domain'
import { formatNumber, formatPercent } from '@/shared/format'
import { WAREHOUSE_STAFF } from '../staffParameters'
import { categoryValue, type ProcessForm, type StaffRow } from './processForm'

/** Коэффициенты замещения труда по способам: вилы и платформа — из PR-0001, остальные — подсказка секции 4 макета. */
export const REPLACEMENT: Readonly<Record<Exclude<HandlingMethodCode, 'none'>, number>> = {
  forks: 0.8,
  platform: 0.6,
  tow: 0.8,
  body: 0.5,
  manipulator: 0.5,
  brushes: 0.7,
}

export const MACRO_DEFAULTS = {
  speedLimitMps: 1.5,
  widthMarginM: 0.6,
  liftTripPct: 0,
  liftWaitS: 0,
  minTempC: 5,
  turnoverPct: 0,
  fleetOperators: 1,
  sitePrepPct: 5,
  itIntegrationRub: 2_000_000,
  consumablesRub: 0,
  otherEffectsRub: 0,
} as const

const DEMO_NAME = 'Перемещение паллет · кросс-докинг'
const DEMO_CARRIER = 'Паллета на полу'
const DEMO_ROUTE = 'Приёмка → зона хранения → отгрузка'
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
    turnoverPct: n('wh_annual_turnover'),
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

/** Демо-заполнение формы: формулы «= 2 × 11 ч», «= 1 − 5 %», «= √ 10 000 м²» считаются из датасета. */
export function buildDemoForm(params: readonly FacilityParameter[]): ProcessForm {
  const base = warehouseBase(params)
  const staff = staffRows(params)
  const forkliftSalary = staff[0]?.salaryRub ?? 0
  return {
    operationClass: 'OP-01',
    name: DEMO_NAME,
    category: categoryValue('warehouse', 'internal_logistics'),
    carrier: DEMO_CARRIER,
    cargoDivisible: false,
    route: DEMO_ROUTE,
    handling: ['forks', 'platform'],
    indoor: true,
    unitMassKg: text(base.palletMass),
    dailyVolume: text(base.inbound + base.outbound),
    workHours: text(base.shifts * base.shiftHours),
    peakFactor: text(base.peakFactor),
    automationPct: text((1 - base.oversizeShare) * 100),
    routeLengthM: text(Math.sqrt(base.activeArea), 0),
    speedLimitMps: text(MACRO_DEFAULTS.speedLimitMps),
    widthMarginM: text(MACRO_DEFAULTS.widthMarginM),
    liftTripPct: text(MACRO_DEFAULTS.liftTripPct),
    liftWaitS: text(MACRO_DEFAULTS.liftWaitS),
    minAisleWidthM: text(base.rackAisle),
    minTempC: text(MACRO_DEFAULTS.minTempC),
    staff,
    replacement: Object.fromEntries(Object.entries(REPLACEMENT).map(([method, ratio]) => [method, RATIO_FORMAT.format(ratio)])),
    turnoverPct: text(base.turnoverPct),
    workTimeLossPct: text(base.workTimeLossPct),
    fleetOperators: text(MACRO_DEFAULTS.fleetOperators),
    fleetSalaryRub: text(forkliftSalary),
    sitePrepPct: text(MACRO_DEFAULTS.sitePrepPct),
    itIntegrationRub: text(MACRO_DEFAULTS.itIntegrationRub),
    consumablesRub: text(MACRO_DEFAULTS.consumablesRub),
    otherEffectsRub: text(MACRO_DEFAULTS.otherEffectsRub),
  }
}

export const formatRatio = (ratio: number): string => RATIO_FORMAT.format(ratio)
export const formatShare = (share: number): string => formatPercent(share)
