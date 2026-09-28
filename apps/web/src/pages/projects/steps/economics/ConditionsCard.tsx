import { Card } from '@/components/ui/Card'
import { Chip, type ChipTone } from '@/components/ui/Chip'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/Table'
import type { ConditionRow, ConditionStatus } from '@/domain'
import { formatCount } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'

const t = ru.project.economics.conditions

/** Плашка статуса: подтверждено — лаймовая, как у характеристик (D-76); нет данных — тёмная, как «высокий» риск макета. */
const TONES: Record<ConditionStatus, ChipTone> = { confirmed: 'accent', needs_check: 'neutral', assumption: 'muted', no_data: 'inverse' }

/**
 * «Условия решения и что проверить» (PRD 11.5) вместо «Рисков» макета (16197:2241): реестр неизвестных условий
 * и допущений — `Table` с плашкой статуса (D-86). Пол, Wi-Fi и WMS держат вывод условным.
 */
export function ConditionsCard({ rows, solution }: { readonly rows: readonly ConditionRow[]; readonly solution: string }) {
  const c = t.columns
  return (
    <Card as="section" padding={24} gap={12} aria-labelledby="economics-conditions-title">
      <div className="flex items-center justify-between gap-16">
        <h2 id="economics-conditions-title" className="type-heading text-text">{t.title}</h2>
        <Chip size="sm" tone="neutral">{formatCount(rows.length, ru.plural.items)}</Chip>
      </div>
      <p className="type-caption text-text-secondary">{t.lead(solution)}</p>
      {rows.length === 0
        ? <p className="type-body-sm text-text-secondary">{t.empty}</p>
        : (
          <Table caption={t.lead(solution)} density="relaxed">
            <TableHead>
              <TableRow>
                <TableHeaderCell>{c.parameter}</TableHeaderCell>
                <TableHeaderCell>{c.status}</TableHeaderCell>
                <TableHeaderCell>{c.impact}</TableHeaderCell>
                <TableHeaderCell>{c.confirm}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.parameter}>
                  <TableCell>
                    <span className="flex flex-col gap-2">
                      <span className="font-medium">{row.parameter}</span>
                      {row.value !== '—' && <span className="type-caption text-text-secondary">{`${c.value}: ${row.value}`}</span>}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-col items-start gap-4">
                      <Chip size="xs" tone={TONES[row.status]}>{t.statuses[row.status]}</Chip>
                      <span className="type-caption text-text-secondary">{row.source}</span>
                    </span>
                  </TableCell>
                  <TableCell className="type-body-sm">{row.impact}</TableCell>
                  <TableCell className="type-body-sm text-text-secondary">{row.howToConfirm}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
    </Card>
  )
}
