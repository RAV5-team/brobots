import type { FacilityParameter, ParameterValue } from './facility'
import { SITE_GROUPS, type SiteGroup, type SiteParameterDef } from './projectParams'

export function isSiteGroup(section: string | undefined): section is SiteGroup {
  return (SITE_GROUPS as readonly string[]).includes(section ?? '')
}

/** Поля профиля площадки в порядке справочника. */
export function siteFields(parameters: readonly FacilityParameter[]): readonly FacilityParameter[] {
  return parameters
    .filter((parameter) => isSiteGroup(parameter.formSection))
    .slice()
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.code.localeCompare(b.code))
}

/** Строки шага 1: парное поле (температура «до») не рисуется отдельно. */
export function siteParameterDefs(parameters: readonly FacilityParameter[]): readonly SiteParameterDef[] {
  const fields = siteFields(parameters)
  const paired = new Set(fields.flatMap((parameter) => (parameter.pairCode ? [parameter.pairCode] : [])))
  return fields.filter((parameter) => !paired.has(parameter.code)).map((parameter) => ({
    code: parameter.code,
    ...(parameter.pairCode ? { pairCode: parameter.pairCode } : {}),
    group: parameter.formSection as SiteGroup,
    name: parameter.name,
    unit: parameter.unit,
    routeOnly: parameter.routeOnly ?? false,
    checkedByMatching: parameter.checkedByMatching ?? false,
  }))
}

/** Значения строк шага 1 из профиля локации, включая парное поле. */
export function siteValuesFromParameters(
  parameters: Readonly<Record<string, ParameterValue>>,
  defs: readonly SiteParameterDef[],
): Readonly<Record<string, ParameterValue>> {
  const codes = defs.flatMap((parameter) => (parameter.pairCode ? [parameter.code, parameter.pairCode] : [parameter.code]))
  return Object.fromEntries(codes.flatMap((code) => {
    const value = parameters[code]
    return value ? [[code, value] as const] : []
  }))
}
