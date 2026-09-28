// Тексты демо-профиля с макета 14 (15950:1994–2009) и PRD 10.2; числа — из датасета склада (D-13).
import { updateStaffRow, type LocationForm, type ProfileText } from './locationForm'

export const LOCATION_DEMO_PROFILE: ProfileText = {
  name: 'РЦ Химки',
  city: 'Москва',
  address: 'Москва, Ленинградское ш., 12',
}

/**
 * Состояние формы ровно как на макете 15950:1952: активная зона 22 000 м² больше общей — ошибка (PRD 10.2; PRD 15 · №38).
 * Открывается сценарием «14» в /dev/screens для сверки с макетом; обычная форма стартует со значений датасета.
 */
export function mockupForm(base: LocationForm): LocationForm {
  return { ...base, activeArea: '22 000', staff: updateStaffRow(base.staff, 'wh_packing_operators', { salary: '' }) }
}
