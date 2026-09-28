import type { Location, ParameterValue } from '@/domain'
import { formatNumber, parseDecimal } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'

const t = ru.location.params.site

export type SiteGroup = 'aisles' | 'floor' | 'layout' | 'operating' | 'connectivity'

export type SiteFieldKind = 'number' | 'select' | 'text'

export interface SiteFieldDef {
  readonly code: string
  readonly group: SiteGroup
  readonly kind: SiteFieldKind
  readonly unit?: string
  readonly min?: number
  readonly max?: number
  readonly options?: readonly string[]
}

/**
 * Группы подбора 17а (PRD 10.3, 10.5): отдельные секции, не одна «Условия площадки».
 * Сначала строки датасета склада (`wh_*` не дублировать в 10.6), затем `site_*`. Пусто — «нет данных».
 */
export const SITE_PROFILE_FIELDS: readonly SiteFieldDef[] = [
  { code: 'wh_main_aisle_width', group: 'aisles', kind: 'number', unit: 'м', min: 2.5, max: 6 },
  { code: 'wh_rack_aisle_width', group: 'aisles', kind: 'number', unit: 'м', min: 1.5, max: 4.5 },
  { code: 'site_aisle_min_m', group: 'aisles', kind: 'number', unit: 'м', min: 1, max: 6 },
  { code: 'wh_ceiling_height', group: 'aisles', kind: 'number', unit: 'м', min: 5, max: 16 },
  { code: 'site_clear_height_m', group: 'aisles', kind: 'number', unit: 'м', min: 1.5, max: 40 },

  { code: 'wh_floor_type', group: 'floor', kind: 'select', options: ['Промышленный бетон', 'эпоксид', 'плитка', 'асфальт'] },
  { code: 'wh_floor_flatness', group: 'floor', kind: 'number', unit: 'мм/2м', min: 1, max: 8 },
  { code: 'site_floor_condition', group: 'floor', kind: 'select', options: ['без выбоин', 'есть выбоины', 'нужен ремонт'] },
  { code: 'site_floor_load_tm2', group: 'floor', kind: 'number', unit: 'т/м²', min: 0.5, max: 20 },
  { code: 'site_threshold_mm', group: 'floor', kind: 'number', unit: 'мм', min: 0, max: 200 },
  { code: 'site_slope_pct', group: 'floor', kind: 'number', unit: '%', min: 0, max: 20 },

  { code: 'site_doors', group: 'layout', kind: 'text' },
  { code: 'site_lifts', group: 'layout', kind: 'text' },
  { code: 'site_bottlenecks', group: 'layout', kind: 'text' },
  { code: 'site_equipment_area_m2', group: 'layout', kind: 'number', unit: 'м²', min: 0, max: 100000 },

  { code: 'site_env', group: 'operating', kind: 'select', options: ['в помещении', 'на улице', 'смешанная'] },
  { code: 'site_temp_min_c', group: 'operating', kind: 'number', unit: '°C', min: -60, max: 60 },
  { code: 'site_temp_max_c', group: 'operating', kind: 'number', unit: '°C', min: -60, max: 60 },
  { code: 'site_people_on_route', group: 'operating', kind: 'select', options: ['редко', 'периодически', 'часто', 'постоянно'] },
  { code: 'site_vehicles_on_route', group: 'operating', kind: 'text' },
  { code: 'site_noise_limit_db', group: 'operating', kind: 'number', unit: 'дБ', min: 20, max: 120 },

  { code: 'site_wifi_coverage', group: 'connectivity', kind: 'select', options: ['по всей зоне', 'частично', 'нет', 'не проверено'] },
  { code: 'site_wifi_band', group: 'connectivity', kind: 'select', options: ['2,4 ГГц', '5 ГГц', 'оба'] },
  { code: 'site_wifi_roaming', group: 'connectivity', kind: 'select', options: ['да', 'нет'] },
  { code: 'site_wifi_area_m2', group: 'connectivity', kind: 'number', unit: 'м²', min: 0, max: 100000 },
  { code: 'site_charge_power_ready', group: 'connectivity', kind: 'select', options: ['подведено', 'нужно подвести'] },
  { code: 'site_charge_power_kw', group: 'connectivity', kind: 'number', unit: 'кВт', min: 0, max: 3000 },
]

export const SITE_PROFILE_CODES: ReadonlySet<string> = new Set(SITE_PROFILE_FIELDS.map((f) => f.code))

export const SITE_PROFILE_GROUPS: readonly SiteGroup[] = [...new Set(SITE_PROFILE_FIELDS.map((f) => f.group))]

export const isSiteProfileCode = (code: string): boolean => SITE_PROFILE_CODES.has(code)

export const siteSectionOf = (code: string): SiteGroup | null =>
  SITE_PROFILE_FIELDS.find((field) => field.code === code)?.group ?? null

/** id контрола = код параметра: ссылки шага 1 ведут на `/params#site_wifi_coverage`. */
export const siteFieldId = (code: string): string => code

export type SiteValues = Readonly<Record<string, string>>

export function siteValuesFromLocation(location: Location): SiteValues {
  return Object.fromEntries(SITE_PROFILE_FIELDS.map((field) => {
    const raw = location.parameters[field.code]?.value
    if (raw === undefined) return [field.code, '']
    return [field.code, typeof raw === 'number' ? formatNumber(raw, 3) : String(raw)]
  }))
}

export function siteParametersOf(values: SiteValues): Readonly<Record<string, ParameterValue>> {
  return Object.fromEntries(SITE_PROFILE_FIELDS.flatMap((field): [string, ParameterValue][] => {
    const raw = values[field.code]?.trim() ?? ''
    if (raw === '') return []
    if (field.kind === 'number') {
      const value = parseDecimal(raw)
      return value === null ? [] : [[field.code, { value, source: 'user' }]]
    }
    return [[field.code, { value: raw, source: 'user' }]]
  }))
}

export function siteFieldErrors(values: SiteValues): Readonly<Record<string, string>> {
  const errors: Record<string, string> = {}
  for (const field of SITE_PROFILE_FIELDS) {
    const raw = values[field.code]?.trim() ?? ''
    if (raw === '' || field.kind !== 'number') continue
    const value = parseDecimal(raw)
    if (value === null) {
      errors[field.code] = ru.locationNew.errors.number
      continue
    }
    if (field.min !== undefined && field.max !== undefined && (value < field.min || value > field.max)) {
      errors[field.code] = ru.locationNew.errors.range(formatNumber(field.min, 3), formatNumber(field.max, 3))
    }
  }
  const min = parseDecimal(values.site_temp_min_c ?? '')
  const max = parseDecimal(values.site_temp_max_c ?? '')
  if (min !== null && max !== null && min > max) errors.site_temp_max_c = t.tempOrder
  return errors
}

export const siteFieldLabel = (code: string): string => t.fields[code] ?? code
