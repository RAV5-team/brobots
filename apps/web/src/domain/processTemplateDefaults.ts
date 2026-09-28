import type { HandlingMethodCode } from './handling'

/**
 * Значения по умолчанию формы процесса 09а и копии на локации 16, которых нет ни в процессах источника,
 * ни в справочнике нормативов А5 (PRD 15 · №22). Приходят из сервиса процессов.
 */
export interface ProcessTemplateDefaults {
  /** Коэффициенты замещения труда по способам обработки, доля. */
  readonly replacement: Readonly<Record<Exclude<HandlingMethodCode, 'none'>, number>>
  readonly speedLimitMps: number
  /** Запас по ширине прохода, м — суммарно с обеих сторон. */
  readonly widthMarginM: number
  readonly liftTripPct: number
  readonly liftWaitS: number
  readonly minTempC: number
  readonly turnoverPct: number
  readonly fleetOperators: number
  readonly sitePrepPct: number
  readonly itIntegrationRub: number
  readonly consumablesRub: number
  readonly otherEffectsRub: number
}

/** Тексты демо-заполнения формы 09а (PRD 9.2) — только в демо-режиме. */
export interface ProcessDemoText {
  readonly name: string
  readonly carrier: string
  readonly route: string
}

/** Тексты демо-профиля формы локации 14 (PRD 10.2) — только в демо-режиме. */
export interface LocationDemoProfile {
  readonly name: string
  readonly city: string
  readonly address: string
}

/** Что процесс запрашивает у локации (PRD 9.3, «Что нужно знать для подбора»); подписи — в словаре по коду. */
export type RequirementCode =
  | 'maxMass' | 'palletType' | 'routeWidth' | 'avgDistance' | 'peakFactor' | 'liftHeight' | 'pickupPoints'
  | 'floor' | 'slopes' | 'temperature' | 'wifi' | 'peopleOnRoute'

/** Единица параметра; null — единицы нет (тип, условие среды). */
export type RequirementUnit = 'kg' | 'm' | 'pcs' | null

export interface ProcessRequirement {
  readonly code: RequirementCode
  readonly unit: RequirementUnit
}

export type RequirementGroupKey = 'required' | 'desirable' | 'environment'

/** Требования процесса по группам — без объёма потока: его единица — KPI процесса, её знает экран. */
export type ProcessRequirements = Readonly<Record<RequirementGroupKey, readonly ProcessRequirement[]>>
