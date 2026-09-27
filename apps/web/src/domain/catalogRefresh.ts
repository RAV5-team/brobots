/** Статус источника в опросе «Обновить каталог по запросу»: получено, ждём ответа, в очереди, не ответил (PRD 6.2, А1а). */
export type SourcePollStatus = 'received' | 'waiting' | 'queued' | 'failed'

export interface SourcePoll {
  readonly key: string
  /** «ФЦ БАС · catalog_export_v5.csv». */
  readonly label: string
  readonly status: SourcePollStatus
  /** Сколько позиций пришло; null — источник ещё не ответил. */
  readonly received: number | null
}

/** Снимок опроса источников каталога (экран А1а). */
export interface CatalogRefresh {
  readonly sources: readonly SourcePoll[]
}

/**
 * Номер опрашиваемого источника: «2 из 3» — опрос второго начат (D-37).
 * На макете при «2 из 3» ответил один источник, а полоса заполнена на ⅔ — это шаг, а не число ответивших.
 */
export function catalogRefreshStep(refresh: CatalogRefresh): number {
  return refresh.sources.filter((s) => s.status !== 'queued').length
}

/** Опрос окончен, когда каждый источник ответил или не ответил. */
export function isCatalogRefreshDone(refresh: CatalogRefresh): boolean {
  return refresh.sources.every((s) => s.status === 'received' || s.status === 'failed')
}
