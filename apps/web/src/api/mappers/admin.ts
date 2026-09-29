import {
  NORM_GROUPS,
  type DataSource,
  type DataSourceKind,
  type DataSourceRefresh,
  type NewDataSource,
  type Norm,
  type NormGroup,
} from '@/domain'
import { oneOf, required, type ApiSchemas } from '../contract'

const PERCENT = 100
/** Доли API экран А5 показывает процентами: «доля оборудования» → «% оборудования». */
// i18n-scan-ignore: API unit prefix used only for wire-value mapping.
const SHARE_PREFIX = 'доля'

const isShare = (unit: string | undefined): boolean => (unit ?? '').startsWith(SHARE_PREFIX)
const percentUnit = (unit: string): string => `%${unit.slice(SHARE_PREFIX.length)}`

/** Норматив API → строка экрана А5. Группы робота и рейтинга на экране не показываются. */
export function normFromApi(dto: ApiSchemas['NormValue']): Norm | null {
  const group = dto.group ?? ''
  if (!(NORM_GROUPS as readonly string[]).includes(group)) return null
  const unit = dto.unit ?? ''
  const value = required(dto, 'value', 'NormValue')
  return {
    code: required(dto, 'code', 'NormValue'),
    name: dto.label ?? '',
    group: group as NormGroup,
    kind: oneOf(dto.kind ?? 'norm', ['norm', 'assumption'], 'NormValue.kind'),
    value: isShare(unit) ? value * PERCENT : value,
    unit: isShare(unit) ? percentUnit(unit) : unit,
    source: dto.source ?? '',
  }
}

/** Значение с экрана → значение API: проценты обратно в доли. */
export function normValueToApi(norm: Pick<Norm, 'unit'>, value: number): number {
  return norm.unit.startsWith('%') ? value / PERCENT : value
}

const KINDS: readonly DataSourceKind[] = ['catalog', 'cases', 'specs', 'dataset', 'prices', 'norms']
const REFRESH: readonly DataSourceRefresh[] = ['manual', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly']

/** Источник данных API → строка реестра А6. «vendor» у экрана — открытый источник. */
export function dataSourceFromApi(dto: ApiSchemas['DataSource']): DataSource {
  const entity = 'DataSource'
  const origin = dto.origin === 'organizer' || dto.origin === 'internal' ? dto.origin : 'open'
  const locator = dto.url ? { kind: 'url' as const, url: dto.url } : dto.fileName ? { kind: 'file' as const, fileName: dto.fileName } : null
  return {
    key: required(dto, 'id', entity),
    name: required(dto, 'name', entity),
    kind: oneOf(dto.sourceType ?? 'catalog', KINDS, `${entity}.sourceType`),
    origin,
    locator,
    status: dto.dataStatus === 'estimate' ? 'estimate' : 'confirmed',
    provides: dto.provides ?? '',
    actualizedOn: dto.actualizedOn ? `${dto.actualizedOn}T00:00:00Z` : (dto.updatedAt ?? ''),
    refresh: oneOf(dto.refreshSchedule ?? 'manual', REFRESH, `${entity}.refreshSchedule`),
  }
}

/** Источник окна А7 → тело `POST /data-sources`. */
export function dataSourceInput(input: NewDataSource): ApiSchemas['DataSourceInput'] {
  return {
    name: input.name,
    sourceType: input.kind,
    origin: input.origin,
    dataStatus: input.status,
    provides: input.provides,
    actualizedOn: input.actualizedOn,
    refreshSchedule: input.refresh,
    locatorKind: input.locator.kind,
    ...(input.locator.kind === 'url' ? { url: input.locator.url } : { fileName: input.locator.fileName }),
  }
}
