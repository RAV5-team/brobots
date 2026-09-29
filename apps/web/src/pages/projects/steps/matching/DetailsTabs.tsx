import { ru } from '@/shared/i18n/ru'
import { AmountRows, DetailsGroup, StackedRows } from './detailsParts'
import type { DataQualityView, InfrastructureView, TechnicalView } from './detailsTabsModel'

const d = ru.project.matching.details

/** Вкладка «Технические» окна 2.1а (16830:608): характеристики К-4 с источником и статусом, производительность в трёх значениях. */
export function TechnicalTab({ view }: { readonly view: TechnicalView }) {
  return (
    <DetailsGroup id="technical-specs" title={d.technical.title} note={d.technical.note}>
      <StackedRows rows={view.rows} />
    </DetailsGroup>
  )
}

/**
 * Вкладка «Инфраструктура» (16832:474): требования робота против данных локации — общее правило площадки (D-99),
 * прочие требования каталога и вспомогательное оборудование из расчёта.
 */
export function InfrastructureTab({ view }: { readonly view: InfrastructureView }) {
  const t = d.infrastructure
  return (
    <div className="flex flex-col gap-20">
      <DetailsGroup id="infrastructure-checks" title={t.title} note={t.note}><StackedRows rows={view.checks} /></DetailsGroup>
      <DetailsGroup id="infrastructure-other" title={t.otherTitle} note={t.otherNote}><StackedRows rows={view.other} /></DetailsGroup>
      <DetailsGroup id="infrastructure-equipment" title={t.equipmentTitle}><AmountRows rows={view.equipment} /></DetailsGroup>
    </div>
  )
}

/** Вкладка «Качество данных» (16832:2061): источник, дата, полнота и подтверждённость. */
export function DataQualityTab({ view }: { readonly view: DataQualityView }) {
  return (
    <DetailsGroup id="data-quality" title={d.dataQuality.title} note={d.dataQuality.note}>
      <StackedRows rows={view.rows} />
    </DetailsGroup>
  )
}
