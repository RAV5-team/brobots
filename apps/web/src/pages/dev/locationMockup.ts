import { updateStaffRow, type LocationForm } from '@/pages/locations/new/locationForm'

/**
 * Состояние формы 14 ровно как на макете 15950:1952: активная зона 22 000 м² больше общей — ошибка (PRD 10.2; PRD 15 · №38).
 * Открывается сценарием «14» в /dev/screens для сверки с макетом; обычная форма стартует со значений датасета.
 */
export function mockupForm(base: LocationForm): LocationForm {
  return { ...base, activeArea: '22 000', staff: updateStaffRow(base.staff, 'wh_packing_operators', { salary: '' }) }
}
