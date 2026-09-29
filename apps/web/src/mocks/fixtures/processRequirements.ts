// Какие данные процесс запрашивает у локации (PRD 9.3, блок «Что нужно знать для подбора»).
// В источниках списка нет: у «Перемещения паллет» он взят с макета 15935:1413, у остальных собирается из значений процесса (D-33).
import type { Process, ProcessCode, ProcessRequirement, ProcessRequirements } from '@/domain'

/** Условия среды нужны жёстким проверкам любого процесса; задаёт их локация (PRD 10.5, PRD 15 · №46). */
export const ENVIRONMENT_REQUIREMENTS: readonly ProcessRequirement[] = [
  { code: 'floor', unit: null },
  { code: 'slopes', unit: null },
  { code: 'temperature', unit: null },
  { code: 'wifi', unit: null },
  { code: 'peopleOnRoute', unit: null },
]

/** Списки с макета: пока нарисован только экран «Перемещения паллет». */
export const REQUIREMENTS_FROM_MOCKUP: Readonly<Partial<Record<ProcessCode, Omit<ProcessRequirements, 'environment'>>>> = {
  'PR-0001': {
    required: [
      { code: 'maxMass', unit: 'kg' },
      { code: 'palletType', unit: null },
      { code: 'routeWidth', unit: 'm' },
    ],
    desirable: [
      { code: 'avgDistance', unit: 'm' },
      { code: 'peakFactor', unit: null },
      { code: 'liftHeight', unit: 'm' },
      { code: 'pickupPoints', unit: 'pcs' },
    ],
  },
}

/** Требования процесса без макета: масса — если есть груз, дистанция — если задана длина маршрута (D-33). */
export function requirementsOf(process: Process): ProcessRequirements {
  const defaults = process.defaults
  const drawn = REQUIREMENTS_FROM_MOCKUP[process.code] ?? {
    required: [
      ...(defaults.unitMassKg === undefined ? [] : [{ code: 'maxMass', unit: 'kg' } as const]),
      { code: 'routeWidth', unit: 'm' },
    ],
    desirable: [
      ...(defaults.routeLengthM === undefined ? [] : [{ code: 'avgDistance', unit: 'm' } as const]),
      { code: 'peakFactor', unit: null },
    ],
  }
  return { ...drawn, environment: ENVIRONMENT_REQUIREMENTS }
}
