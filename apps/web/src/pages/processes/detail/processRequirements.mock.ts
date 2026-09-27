// Какие данные процесс запрашивает у локации (PRD 9.3, блок «Что нужно знать для подбора»).
// В источниках списка нет: у «Перемещения паллет» он взят с макета 15935:1413, у остальных собирается из значений процесса (D-33).
// Единица потока — единица KPI процесса, как на экране 07.
import type { Process, ProcessCode } from '@/domain'

export type RequirementGroupKey = 'required' | 'desirable' | 'environment'

/** Параметр, который процесс запрашивает у локации; unit = null — единицы нет (тип, условие среды). */
export interface Requirement {
  readonly label: string
  readonly unit: string | null
}

export type ProcessRequirements = Readonly<Record<RequirementGroupKey, readonly Requirement[]>>

/** Условия среды нужны жёстким проверкам любого процесса; задаёт их локация (PRD 10.5, PRD 15 · №46). */
const ENVIRONMENT: readonly Requirement[] = [
  { label: 'Покрытие и плоскость пола', unit: null },
  { label: 'Уклоны и пороги', unit: null },
  { label: 'Температурный режим', unit: null },
  { label: 'Wi‑Fi на маршруте', unit: null },
  { label: 'Люди на маршруте', unit: null },
]

/** Списки с макета: пока нарисован только экран «Перемещения паллет». */
const FROM_MOCKUP: Readonly<Partial<Record<ProcessCode, Omit<ProcessRequirements, 'environment'>>>> = {
  'PR-0001': {
    required: [
      { label: 'Максимальная масса', unit: 'кг' },
      { label: 'Тип паллеты', unit: null },
      { label: 'Ширина маршрута', unit: 'м' },
    ],
    desirable: [
      { label: 'Средняя дистанция', unit: 'м' },
      { label: 'Коэффициент пиковой нагрузки', unit: null },
      { label: 'Высота подъёма', unit: 'м' },
      { label: 'Точек pickup/dropoff', unit: 'шт' },
    ],
  },
}

/** Остальные процессы: масса — если есть груз, дистанция — если задана длина маршрута. */
function derived(process: Process): Omit<ProcessRequirements, 'environment'> {
  const d = process.defaults
  return {
    required: [
      ...(d.unitMassKg === undefined ? [] : [{ label: 'Максимальная масса', unit: 'кг' }]),
      { label: 'Ширина маршрута', unit: 'м' },
    ],
    desirable: [
      ...(d.routeLengthM === undefined ? [] : [{ label: 'Средняя дистанция', unit: 'м' }]),
      { label: 'Коэффициент пиковой нагрузки', unit: null },
    ],
  }
}

/** Объём потока — первый обязательный параметр любого процесса, в единице его KPI («паллет / ч»). */
export function processRequirements(process: Process, rateUnit: string): ProcessRequirements {
  const { required, desirable } = FROM_MOCKUP[process.code] ?? derived(process)
  return { required: [{ label: 'Объём потока', unit: rateUnit }, ...required], desirable, environment: ENVIRONMENT }
}
