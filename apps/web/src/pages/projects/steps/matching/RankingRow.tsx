import { Check, ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { generatePath } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { Checkbox } from '@/components/ui/Checkbox'
import { TableCell, TableRow } from '@/components/ui/Table'
import { TextButton, TextLink } from '@/components/ui/TextLink'
import type { RankedVariant, Robot } from '@/domain'
import { formatNumber, formatYears } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { contributionsText, formatScore, solutionLine, topContributions } from './matchingModel'

const t = ru.project.matching
const k = t.ranking

const MILLION = 1_000_000
/** Суммы колонок — в млн ₽ с одним знаком, единица в подписи таблицы (PRD 11.3). */
const millions = (value: number | null): string => (value === null ? '—' : formatNumber(value / MILLION, 1, { fixed: true }))

interface RankingRowProps {
  readonly variant: RankedVariant
  readonly robot: Robot | undefined
  readonly selected: boolean
  readonly canSelect: boolean
  readonly onSelect: () => void
  /** Режим сравнения: чекбокс в первой колонке. */
  readonly compare: { readonly checked: boolean; readonly disabled: boolean; readonly onChange: (checked: boolean) => void } | null
  readonly columns: number
}

/** Строка рейтинга (16197:854): место, решение с подписью и «почему», числа, выбор. Раскрытие — все вклады критериев. */
export function RankingRow({ variant: v, robot, selected, canSelect, onSelect, compare, columns }: RankingRowProps) {
  const [open, setOpen] = useState(false)
  const whyId = useId()
  const name = t.variantName(v.solutionName, t.acquisition[v.acquisition])
  const top = contributionsText(topContributions(v.criteria))
  return (
    <>
      <TableRow selected={selected}>
        {compare && (
          <TableCell>
            <Checkbox label={k.compareCheckbox(name)} hideLabel checked={compare.checked} disabled={compare.disabled} onCheckedChange={compare.onChange} />
          </TableCell>
        )}
        <TableCell className="font-medium">{v.rank}</TableCell>
        <TableCell>
          <div className="flex flex-col gap-4">
            <TextLink to={generatePath(ROUTE_PATHS.catalogItem, { itemId: v.solutionId })}>{name}</TextLink>
            <span className="type-caption text-text-secondary">{solutionLine(v.manufacturer, robot)}</span>
            {v.status === 'needs_verification' && <span className="type-caption text-text-secondary">{k.needsCheck}</span>}
            {v.warnings.map((w) => <span key={w} className="type-caption font-medium text-danger">{w}</span>)}
            {selected
              ? <span className="inline-flex items-center gap-4 type-caption font-semibold text-on-accent"><Check aria-hidden size={14} />{k.selected}</span>
              : canSelect && <TextButton className="self-start type-caption" aria-label={k.selectLabel(name)} onClick={onSelect}>{k.select}</TextButton>}
            {v.criteria.some((c) => c.contribution !== null) && (
              <span className="flex flex-wrap items-center gap-x-8 type-caption text-text-muted">
                {top}
                <TextButton aria-expanded={open} aria-controls={whyId} aria-label={k.whyLabel(name)} className="type-caption" onClick={() => { setOpen(!open) }}>
                  {k.why}
                  <ChevronDown aria-hidden size={14} className={open ? 'rotate-180' : undefined} />
                </TextButton>
              </span>
            )}
          </div>
        </TableCell>
        <TableCell align="end" className="whitespace-nowrap">{v.robots}</TableCell>
        <TableCell align="end" className="font-semibold">{v.score === null ? '—' : formatScore(v.score)}</TableCell>
        <TableCell align="end" className="whitespace-nowrap">{millions(v.capexRub)}</TableCell>
        <TableCell align="end" className="whitespace-nowrap">{millions(v.raasMonthlyRub)}</TableCell>
        <TableCell align="end" className="whitespace-nowrap">{millions(v.opexRubPerYear)}</TableCell>
        <TableCell align="end" className="whitespace-nowrap" tone={v.annualEffectRub < 0 ? 'violation' : 'default'}>{millions(v.annualEffectRub)}</TableCell>
        <TableCell align="end" className="whitespace-nowrap">{v.paybackYears === null ? k.notPaying : formatYears(v.paybackYears, { fixed: true })}</TableCell>
      </TableRow>
      {open && (
        <tr id={whyId} className="border-b border-border bg-surface-muted">
          <td colSpan={columns} className="px-12 py-12">
            <ul className="flex flex-wrap gap-x-16 gap-y-4 type-caption text-text-secondary">
              {v.criteria.map((c) => (
                <li key={c.code}>
                  {c.label}
                  {' · '}
                  <span className="font-semibold text-text">{c.contribution === null ? t.howCalc.noContribution : formatScore(c.contribution)}</span>
                  {' / '}
                  {formatScore(c.weight)}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  )
}
