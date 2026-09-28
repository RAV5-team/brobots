// Источник: PRD 10.5, «Параметры площадки для подбора: полный состав» (25 строк, значения РЦ Химки); коды `site_*` — PRD 10.6,
// остальные — коды датасета склада (значения — в locations.ts). Правится вручную. Разрешённые расхождения — README.md.
import type { LocationId, ParameterValue, SiteParameterDef } from '@/domain'

/** Состав и порядок строк блока «Локация» шага 1 (D-92). */
export const SITE_PARAMETERS: readonly SiteParameterDef[] = [
  { code: 'wh_main_aisle_width', group: 'aisles', name: 'Ширина главных проездов', unit: 'м', routeOnly: false, checkedByMatching: true },
  { code: 'site_aisle_min_m', group: 'aisles', name: 'Мин. свободная ширина прохода на маршруте', unit: 'м', routeOnly: true, checkedByMatching: true },
  { code: 'wh_ceiling_height', group: 'aisles', name: 'Высота потолков', unit: 'м', routeOnly: false, checkedByMatching: true },
  { code: 'site_clear_height_m', group: 'aisles', name: 'Мин. высота проезда', unit: 'м', routeOnly: true, checkedByMatching: true },

  { code: 'wh_floor_type', group: 'floor', name: 'Тип покрытия', unit: '', routeOnly: false, checkedByMatching: true },
  { code: 'wh_floor_flatness', group: 'floor', name: 'Ровность пола', unit: 'мм на 2 м', routeOnly: false, checkedByMatching: true },
  { code: 'site_floor_condition', group: 'floor', name: 'Состояние пола', unit: '', routeOnly: false, checkedByMatching: false },
  { code: 'site_floor_load_tm2', group: 'floor', name: 'Допустимая нагрузка на пол', unit: 'т/м²', routeOnly: false, checkedByMatching: true },
  { code: 'site_threshold_mm', group: 'floor', name: 'Макс. высота порога', unit: 'мм', routeOnly: true, checkedByMatching: true },
  { code: 'site_slope_pct', group: 'floor', name: 'Макс. уклон', unit: '%', routeOnly: true, checkedByMatching: true },

  { code: 'site_doors', group: 'layout', name: 'Двери и ворота на маршрутах', unit: '', routeOnly: true, checkedByMatching: false },
  { code: 'site_lifts', group: 'layout', name: 'Лифты и перепады уровней', unit: '', routeOnly: true, checkedByMatching: false },
  { code: 'site_bottlenecks', group: 'layout', name: 'Узкие места и запретные зоны', unit: '', routeOnly: true, checkedByMatching: false },
  { code: 'site_equipment_area_m2', group: 'layout', name: 'Площадь для размещения оборудования', unit: 'м²', routeOnly: false, checkedByMatching: false },

  { code: 'site_env', group: 'operating', name: 'Среда работы', unit: '', routeOnly: false, checkedByMatching: true },
  { code: 'site_temp_min_c', pairCode: 'site_temp_max_c', group: 'operating', name: 'Температура', unit: '°C', routeOnly: false, checkedByMatching: true },
  { code: 'site_people_on_route', group: 'operating', name: 'Люди на маршруте', unit: '', routeOnly: true, checkedByMatching: false },
  { code: 'site_vehicles_on_route', group: 'operating', name: 'Другая техника на маршруте', unit: '', routeOnly: true, checkedByMatching: false },
  { code: 'site_noise_limit_db', group: 'operating', name: 'Допустимый уровень шума', unit: 'дБ', routeOnly: false, checkedByMatching: false },

  { code: 'site_wifi_coverage', group: 'connectivity', name: 'Wi-Fi в зоне работы', unit: '', routeOnly: false, checkedByMatching: true },
  { code: 'site_wifi_band', group: 'connectivity', name: 'Диапазон Wi-Fi', unit: '', routeOnly: false, checkedByMatching: false },
  { code: 'site_wifi_roaming', group: 'connectivity', name: 'Бесшовный роуминг · private LTE', unit: '', routeOnly: false, checkedByMatching: false },
  { code: 'site_wifi_area_m2', group: 'connectivity', name: 'Площадь покрытия Wi-Fi', unit: 'м²', routeOnly: false, checkedByMatching: false },
  { code: 'site_charge_power_ready', group: 'connectivity', name: 'Электропитание в местах зарядки', unit: '', routeOnly: false, checkedByMatching: false },
  { code: 'site_charge_power_kw', group: 'connectivity', name: 'Доступная мощность для зарядки', unit: 'кВт', routeOnly: false, checkedByMatching: false },
]

/**
 * Значения `site_*` — на вкладке 17а (PRD 10.5). У РЦ Химки нет данных о нагрузке на пол и Wi-Fi
 * (PRD 11.2), о дверях, лифтах и узких местах (PRD 10.5), о диапазоне, роуминге и площади Wi-Fi (предложение 10.5).
 * Мин. ширина прохода — 2,8 м, как рабочие проходы на 17а, а не 3,0 м прототипа (PRD 15 · №121).
 */
export const SITE_VALUES: Readonly<Record<LocationId, Readonly<Record<string, ParameterValue>>>> = {
  'LOC-01': {
    site_aisle_min_m: { value: 2.8, source: 'organizer' },
    site_clear_height_m: { value: 6, source: 'user' },
    site_floor_condition: { value: 'Без выбоин', source: 'user' },
    site_threshold_mm: { value: 0, source: 'user' },
    site_slope_pct: { value: 0, source: 'user' },
    site_equipment_area_m2: { value: 120, source: 'user' },
    site_env: { value: 'В помещении', source: 'user' },
    site_temp_min_c: { value: 5, source: 'user' },
    site_temp_max_c: { value: 25, source: 'user' },
    site_people_on_route: { value: 'Периодически', source: 'user' },
    site_vehicles_on_route: { value: 'Постоянно · погрузчики', source: 'user' },
    site_noise_limit_db: { value: 'Не применяется', source: 'user' },
    site_charge_power_ready: { value: 'Подведено', source: 'user' },
    site_charge_power_kw: { value: 60, source: 'user' },
  },
}
