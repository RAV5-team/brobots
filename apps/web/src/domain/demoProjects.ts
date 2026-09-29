import type { FacilityTypeCode } from './facility'

/**
 * Демо-проекты, которые гость может открыть (ролевая модель, §5). Готова проработка склада; аэропорт и медучреждение
 * в списке видны, но неактивны — «Демо в подготовке». Открыть ещё один тип объекта — добавить его сюда.
 */
export const OPEN_DEMO_FACILITIES: readonly FacilityTypeCode[] = ['warehouse']

export const isDemoOpen = (facilityType: FacilityTypeCode): boolean => OPEN_DEMO_FACILITIES.includes(facilityType)
