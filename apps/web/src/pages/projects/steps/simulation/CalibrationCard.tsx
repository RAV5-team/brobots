import { Card } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { Chip } from '@/components/ui/Chip'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/Table'
import type { SimulationAdjustment } from '@/domain'
import { formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'

const t = ru.project.simulation.verdict.calibration

/** Безразмерный коэффициент подписывается без единицы: «Коэффициент загрузки робота». */
const UNITLESS = new Set([t.unitless, ''])
const DIGITS = 2

const labelOf = (a: SimulationAdjustment): string => (UNITLESS.has(a.unit) ? a.label : t.withUnit(a.label, a.unit))
const valueOf = (value: number | null): string => (value === null ? '—' : formatNumber(value, DIGITS))

interface CalibrationCardProps {
  readonly adjustments: readonly SimulationAdjustment[]
  /** Принятые коды; по умолчанию — отмеченные движком (`defaultSelected`). */
  readonly selected: readonly string[]
  readonly canEdit: boolean
  readonly onChange: (codes: readonly string[]) => void
}

/**
 * «Уточнить методику по данным симуляции» (3.4, 16414:3532; PRD 11.4): норматив подбора против измеренного на модели,
 * флажок — передать ли измеренное в экономику. Выбор не меняет состав и не делает прогон устаревшим (D-89).
 */
export function CalibrationCard({ adjustments, selected, canEdit, onChange }: CalibrationCardProps) {
  const toggle = (code: string, checked: boolean) => {
    onChange(checked ? [...selected, code] : selected.filter((c) => c !== code))
  }
  return (
    <Card as="section" padding={28} gap={20} aria-labelledby="verdict-calibration-title">
      <div className="flex items-start gap-16">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <h2 id="verdict-calibration-title" className="type-heading text-text">{t.title}</h2>
          <p className="type-caption text-text-secondary">{t.description}</p>
        </div>
        <Chip tone="neutral">{t.optional}</Chip>
      </div>
      <Table caption={t.caption} density="regular">
        <TableHead>
          <tr className="border-b border-border">
            <TableHeaderCell className="pl-[calc(var(--rav-space-12)+var(--rav-size-18)+var(--rav-space-12))]">{t.columns.indicator}</TableHeaderCell>
            <TableHeaderCell align="end">{t.columns.base}</TableHeaderCell>
            <TableHeaderCell align="end">{t.columns.simulated}</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {adjustments.map((a) => (
            <TableRow key={a.code}>
              <TableCell className="pl-12">
                <Checkbox label={labelOf(a)} checked={selected.includes(a.code)} disabled={!canEdit} onCheckedChange={(checked) => { toggle(a.code, checked) }} />
              </TableCell>
              <TableCell align="end" className="whitespace-nowrap tabular-nums"><span className="text-text-secondary">{valueOf(a.base)}</span></TableCell>
              <TableCell align="end" className="pr-12 font-semibold whitespace-nowrap tabular-nums">{valueOf(a.simulated)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
