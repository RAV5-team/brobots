import { catalogRefreshStep, type CatalogRefresh, type SourcePoll } from '@/domain'
import { formatCount } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'

const t = ru.catalogRefresh

export interface RefreshView {
  /** «Опрашиваем источники · 2 из 3». */
  readonly title: string
  /** Заполнение полосы, 0…100: шаг опроса из числа источников (D-47). */
  readonly percent: number
  /** «ФЦ БАС · catalog_export_v5.csv — получено 12 позиций · Ронави Роботикс — ждём ответа · …». */
  readonly detail: string
}

function sourceStatus(source: SourcePoll): string {
  if (source.status === 'received') return t.received(formatCount(source.received ?? 0, ru.plural.positions))
  return t.status[source.status]
}

/** Всё, что показывает плашка «status · опрос источников» (16044:376). */
export function refreshView(refresh: CatalogRefresh): RefreshView {
  const total = refresh.sources.length
  const step = catalogRefreshStep(refresh)
  return {
    title: t.polling(step, total),
    percent: total === 0 ? 0 : (step / total) * 100,
    detail: refresh.sources.map((s) => `${s.label} — ${sourceStatus(s)}`).join(' · '),
  }
}
