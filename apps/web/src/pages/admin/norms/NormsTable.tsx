import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/Table'
import { ru } from '@/shared/i18n/ru'
import type { NormRow } from './normsModel'

const t = ru.norms

interface NormsTableProps {
  readonly rows: readonly NormRow[]
  readonly disabled: boolean
  readonly onEdit: (code: string, text: string) => void
}

function NormTableRow({ row, disabled, onEdit }: { readonly row: NormRow; readonly disabled: boolean; readonly onEdit: NormsTableProps['onEdit'] }) {
  const { norm, text, error } = row
  const errorId = `norm-${norm.code}-error`
  return (
    <TableRow>
      <TableCell>
        <p className="type-body font-medium text-text">{norm.name}</p>
        <p className="mt-4 type-caption text-text-secondary">{t.groups[norm.group]}</p>
      </TableCell>
      <TableCell>
        <Badge variant="pill" kind={norm.kind} className="w-(--rav-norms-pill-width)" />
      </TableCell>
      {/* Отступ прокрутки: поле в фокусе не уходит под липкую панель сохранения (D-49, WCAG 2.4.11). */}
      <TableCell className="[&_input]:scroll-mb-(--rav-norms-save-clearance)">
        <Input
          size="compact"
          inputMode="decimal"
          autoComplete="off"
          aria-label={t.valueLabel(norm.name, norm.unit)}
          aria-describedby={error ? errorId : undefined}
          invalid={error !== null}
          disabled={disabled}
          value={text}
          onChange={(event) => { onEdit(norm.code, event.target.value) }}
        />
        {error && <p id={errorId} className="mt-4 type-caption text-danger">{t.valueErrors[error]}</p>}
      </TableCell>
      <TableCell className="text-text-secondary">{norm.unit}</TableCell>
      <TableCell className="type-caption text-text-secondary">{norm.source}</TableCell>
    </TableRow>
  )
}

/** Таблица справочника А5: параметр с группой · тип · значение · единица · источник (15997:391, 15997:402). */
export function NormsTable({ rows, disabled, onEdit }: NormsTableProps) {
  return (
    <Table caption={t.title} layout="fixed">
      <TableHead>
        <TableRow>
          <TableHeaderCell className="w-(--rav-norms-param-width)">{t.columns.parameter}</TableHeaderCell>
          <TableHeaderCell className="w-(--rav-norms-kind-width)">{t.columns.kind}</TableHeaderCell>
          <TableHeaderCell className="w-(--rav-norms-value-width)">{t.columns.value}</TableHeaderCell>
          <TableHeaderCell className="w-(--rav-norms-unit-width)">{t.columns.unit}</TableHeaderCell>
          <TableHeaderCell>{t.columns.source}</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => <NormTableRow key={row.norm.code} row={row} disabled={disabled} onEdit={onEdit} />)}
      </TableBody>
    </Table>
  )
}
