// Новая локация для состояния 12а «локация добавлена» (PRD 10.1): профиль РЦ Химки под другим именем,
// как если бы его сохранила форма 14. На макете 12а новая локация — сама «РЦ Химки»; в списке её дубль запутал бы.
// Разрешённые расхождения — apps/web/src/mocks/fixtures/README.md.
import type { NewLocation } from '@/domain'
import { LOCATIONS } from './locations'

function sampleNewLocation(): NewLocation {
  const [template] = LOCATIONS
  if (!template) throw new Error('В фикстурах нет локаций')
  const { facilityType, address, capexBudgetRub, horizonYears, parameters, staffGroups } = template
  return { name: 'РЦ Подольск', city: 'Подольск', facilityType, address, capexBudgetRub, horizonYears, parameters, staffGroups }
}

export const NEW_LOCATION_SAMPLE: NewLocation = sampleNewLocation()
