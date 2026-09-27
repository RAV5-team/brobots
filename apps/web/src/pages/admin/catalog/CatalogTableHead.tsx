import { TableHead, TableHeaderCell, TableRow } from '@/components/ui/Table'
import { ru } from '@/shared/i18n/ru'

const t = ru.adminCatalog

/** Шапка таблицы каталога: общая для А1 (15997:38) и состояния загрузки А1а (16044:43). */
export function CatalogTableHead() {
  return (
    <TableHead>
      <TableRow>
        <TableHeaderCell>{t.columns.solution}</TableHeaderCell>
        <TableHeaderCell className="w-(--rav-catalog-classes-width)">{t.columns.operationClasses}</TableHeaderCell>
        <TableHeaderCell className="w-(--rav-catalog-payload-width)">{t.columns.payload}</TableHeaderCell>
        <TableHeaderCell className="w-(--rav-catalog-price-width)">{t.columns.price}</TableHeaderCell>
        <TableHeaderCell className="w-(--rav-catalog-updated-width)">{t.columns.updated}</TableHeaderCell>
        <TableHeaderCell className="w-(--rav-catalog-completeness-width)">{t.columns.completeness}</TableHeaderCell>
        <TableHeaderCell className="w-(--rav-catalog-action-width)">
          <span className="sr-only">{t.columns.actions}</span>
        </TableHeaderCell>
      </TableRow>
    </TableHead>
  )
}
