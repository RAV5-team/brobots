import { isSiteGroup, siteFields, type FacilityParameter, type Location, type ParameterValue, type SiteGroup } from '@/domain'
import { formatNumber, parseDecimal } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'

const t = ru.location.params.site

export type { SiteGroup }

export type SiteFieldKind = 'number' | 'select' | 'text'

export type SiteValues = Readonly<Record<string, string>>

/** id контрола = код параметра: ссылки шага 1 ведут на `/params#site_wifi_coverage`. */
export const siteFieldId = (code: string): string => code

export function siteFieldKind(field: FacilityParameter): SiteFieldKind {
  if ((field.enumValues?.length ?? 0) > 0) return 'select'
  if (field.valueType === 'number' || field.valueType === 'integer') return 'number'
  if (field.valueType === 'text') return 'text'
  if (typeof field.base === 'number' || field.min !== null || field.max !== null) return 'number'
  return 'text'
}

export function siteSectionOf(code: string, parameters: readonly FacilityParameter[]): SiteGroup | null {
  const section = siteFields(parameters).find((field) => field.code === code)?.formSection
  return isSiteGroup(section) ? section : null
}

export function siteValuesFromLocation(location: Location, parameters: readonly FacilityParameter[]): SiteValues {
  return Object.fromEntries(siteFields(parameters).map((field) => {
    const raw = location.parameters[field.code]?.value
    if (raw === undefined) return [field.code, '']
    return [field.code, typeof raw === 'number' ? formatNumber(raw, 3) : raw]
  }))
}

export function siteParametersOf(values: SiteValues, parameters: readonly FacilityParameter[]): Readonly<Record<string, ParameterValue>> {
  return Object.fromEntries(siteFields(parameters).flatMap((field): [string, ParameterValue][] => {
    const raw = values[field.code]?.trim() ?? ''
    if (raw === '') return []
    if (siteFieldKind(field) === 'number') {
      const value = parseDecimal(raw)
      return value === null ? [] : [[field.code, { value, source: 'user' }]]
    }
    return [[field.code, { value: raw, source: 'user' }]]
  }))
}

export function siteFieldErrors(values: SiteValues, parameters: readonly FacilityParameter[]): Readonly<Record<string, string>> {
  const errors: Record<string, string> = {}
  for (const field of siteFields(parameters)) {
    const raw = values[field.code]?.trim() ?? ''
    if (raw === '' || siteFieldKind(field) !== 'number' || field.min === null || field.max === null) continue
    const value = parseDecimal(raw)
    if (value === null) {
      errors[field.code] = ru.locationNew.errors.number
      continue
    }
    if (value < field.min || value > field.max) {
      errors[field.code] = ru.locationNew.errors.range(formatNumber(field.min, 3), formatNumber(field.max, 3))
    }
  }
  const min = parseDecimal(values.site_temp_min_c ?? '')
  const max = parseDecimal(values.site_temp_max_c ?? '')
  if (min !== null && max !== null && min > max) errors.site_temp_max_c = t.tempOrder
  return errors
}
