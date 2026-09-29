import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/Table'
import { formatDate } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { ASSUMPTIONS_ANCHOR, assumptionValueText, isNormCode, type AssumptionRow } from './paramsModel'

const t = ru.project.params.assumptions

interface AssumptionsBlockProps {
  readonly rows: readonly AssumptionRow[]
  /** Дата снимка проекта: «проект считается на снимке от 15.09.2026». */
  readonly snapshotAt: string
}

/**
 * Блок 3 «Нормативы и допущения расчёта» (16969:618): только отображение — значения по умолчанию из А5
 * и допущения процесса. «Уточнить» на доске нет (ждёт D-95): уточнения, сохранённые в проекте раньше, продолжают действовать.
 */
export function AssumptionsBlock({ rows, snapshotAt }: AssumptionsBlockProps) {
  const c = t.columns
  return (
    <Card id={ASSUMPTIONS_ANCHOR} aria-labelledby="params-assumptions-title" padding={28} gap={20}>
      <header className="flex flex-col gap-4">
        <h2 id="params-assumptions-title" className="type-heading text-text">{t.title}</h2>
        <p className="type-caption text-text-secondary">{t.hint(formatDate(snapshotAt))}</p>
      </header>
      {rows.length === 0
        ? <p className="type-body text-text-secondary">{t.empty}</p>
        : (
            <Table caption={t.title} layout="fixed" density="regular">
              <TableHead>
                <tr className="border-b border-border">
                  <TableHeaderCell className="pl-12">{ru.project.params.columns.param}</TableHeaderCell>
                  <TableHeaderCell className="w-(--rav-params-status-width)">{c.kind}</TableHeaderCell>
                  <TableHeaderCell align="end" className="w-(--rav-params-source-width)">{c.value}</TableHeaderCell>
                  <TableHeaderCell className="w-(--rav-params-label-width) pl-12">{c.source}</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const item = t.items[row.code]
                  return (
                    <TableRow key={row.code}>
                      <TableCell className="pl-12">
                        <span className="flex flex-col gap-2">
                          <span className="font-semibold">{item.label}</span>
                          <span className="type-caption text-text-secondary">{t.affects(item.affects.charAt(0).toLowerCase() + item.affects.slice(1))}</span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge kind={isNormCode(row.code) ? 'norm' : 'assumption'} className="w-(--rav-norms-pill-width) justify-center" />
                      </TableCell>
                      <TableCell align="end" className="font-semibold">{assumptionValueText(row, row.value)}</TableCell>
                      <TableCell className="pl-12"><span className="type-caption text-text-secondary">{item.basis}</span></TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
    </Card>
  )
}
