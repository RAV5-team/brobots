import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/Table'
import type { AssumptionOverride } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { AssumptionPanel } from './AssumptionPanel'
import { assumptionValueText, type AssumptionCode, type AssumptionRow } from './paramsModel'

const t = ru.project.params.assumptions

interface AssumptionsBlockProps {
  readonly rows: readonly AssumptionRow[]
  readonly readOnly: boolean
  readonly onRefine: (code: AssumptionCode, next: AssumptionOverride | null) => void
}

/** Метка строки: факт — «указано», оценка и исходное значение — «допущение» (PRD 11.2, панель «Уточнить допущение»). */
const badgeOf = (row: AssumptionRow) => (row.override?.kind === 'fact' ? 'specified' : 'assumption')

/** Блок 3 «Допущения расчёта»: значения по нормативу с основанием и кнопкой «Уточнить» (16197:542). */
export function AssumptionsBlock({ rows, readOnly, onRefine }: AssumptionsBlockProps) {
  const [openCode, setOpenCode] = useState<AssumptionCode | null>(null)
  const open = rows.find((r) => r.code === openCode) ?? null
  const c = ru.project.params.columns
  return (
    <Card aria-labelledby="params-assumptions-title" gap={16}>
      <header className="flex flex-col gap-4">
        <h2 id="params-assumptions-title" className="type-heading text-text">{t.title}</h2>
        <p className="type-caption text-text-secondary">{t.hint}</p>
      </header>
      {rows.length === 0
        ? <p className="type-body text-text-secondary">{t.empty}</p>
        : (
            <Table caption={t.title} layout="fixed" density="regular">
              <TableHead>
                <tr className="border-b border-border">
                  <TableHeaderCell className="w-(--rav-params-label-width)">{c.param}</TableHeaderCell>
                  <TableHeaderCell className="w-(--rav-params-source-width)">{c.source}</TableHeaderCell>
                  <TableHeaderCell>{c.basis}</TableHeaderCell>
                  {!readOnly && <TableHeaderCell align="end" className="w-(--rav-params-action-width)">{c.action}</TableHeaderCell>}
                </tr>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const item = t.items[row.code]
                  return (
                    <TableRow key={row.code}>
                      <TableCell>
                        <span className="flex flex-col gap-2">
                          <span className="font-semibold">{item.label} — {assumptionValueText(row, row.value)}</span>
                          <span className="type-caption text-text-secondary">
                            {row.override
                              ? t.refinedNote(t.refined[row.override.kind], assumptionValueText(row, row.base), item.source)
                              : item.source}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell><Badge kind={badgeOf(row)} /></TableCell>
                      <TableCell className="type-caption text-text-secondary">{item.basis}. {item.affects}</TableCell>
                      {!readOnly && (
                        <TableCell align="end">
                          <Button size="sm" aria-label={t.refineLabel(item.label)} onClick={() => { setOpenCode(row.code) }}>{t.refineShort}</Button>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
      {open && (
        <AssumptionPanel
          key={open.code}
          row={open}
          onClose={() => { setOpenCode(null) }}
          onApply={(next) => {
            onRefine(open.code, next)
            setOpenCode(null)
          }}
        />
      )}
    </Card>
  )
}
