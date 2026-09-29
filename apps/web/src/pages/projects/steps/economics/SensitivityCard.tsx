import { RangeBar } from '@/components/charts/RangeBar'
import { Card } from '@/components/ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/Table'
import type { AcquisitionModel } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { useModelNorms } from '@/shared/norms/useModelNorms'
import type { SensitivityView } from './economicsTables'
import { acquisitionName, sensitivityStep } from './economicsView'

const t = ru.project.economics.sensitivity

/**
 * «Устойчивость: окупаемость при ±20 %» (16197:2216; PRD 11.5; шаг — норматив А5): `RangeBar` по трём параметрам сценария, сверху —
 * самый влиятельный, и таблица PRD с окупаемостью, TCO и выводом. Параметры — ТЗ 3.5.6; числа — `economicsModel`.
 */
export function SensitivityCard({ acquisition, rows }: { readonly acquisition: AcquisitionModel; readonly rows: readonly SensitivityView[] }) {
  const c = t.columns
  const step = sensitivityStep(useModelNorms().sensitivityShift)
  return (
    <Card as="section" padding={24} gap={16} aria-labelledby="economics-sensitivity-title">
      <div className="flex items-baseline justify-between gap-16">
        <h2 id="economics-sensitivity-title" className="type-heading text-text">{t.title(step)}</h2>
        <p className="type-caption text-text-secondary">{t.caption}</p>
      </div>
      <RangeBar label={t.title(step)} valueLabel={t.valueLabel} rows={rows.map((row) => row.range)} />
      <Table caption={t.tableCaption(acquisitionName(acquisition))} density="regular">
        <TableHead>
          <TableRow>
            <TableHeaderCell>{c.parameter}</TableHeaderCell>
            <TableHeaderCell>{c.base}</TableHeaderCell>
            <TableHeaderCell>{c.payback(step)}</TableHeaderCell>
            <TableHeaderCell>{c.tco(step)}</TableHeaderCell>
            <TableHeaderCell>{c.conclusion}</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="font-medium">{row.label}</TableCell>
              <TableCell>{row.base}</TableCell>
              <TableCell>{row.payback}</TableCell>
              <TableCell>{row.tco}</TableCell>
              <TableCell className="text-text-secondary">{row.conclusion}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="type-caption text-text-secondary">{t.note(step)}</p>
    </Card>
  )
}
