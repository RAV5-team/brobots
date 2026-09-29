import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { RadioTable, type RadioTableColumn, type RadioTableRow } from '@/components/ui/RadioTable'
import { ScorePill } from '@/components/ui/ScorePill'
import { Segmented, type SegmentedOption } from '@/components/ui/Segmented'
import { Select, type SelectOption } from '@/components/ui/Select'
import { EmptyState } from '@/components/ui/States'
import { COMPARE_LIMIT, type ExcludedSolution, type ProjectSelection, type RankedVariant, type Robot } from '@/domain'
import { formatYears } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { ExcludedList } from './ExcludedList'
import { brandOf, breakdownOf, formatScore, rankingRows, shortReasonsText, rubMillions as money, solutionLine, variantKey, type AcquisitionFilter, type RankingSort } from './matchingModel'
import { ScoreBreakdown } from './ScoreBreakdown'

const t = ru.project.matching
const k = t.ranking

const FILTERS: readonly SegmentedOption<AcquisitionFilter>[] = (['all', 'purchase', 'raas'] as const).map((value) => ({ value, label: k.filters[value] }))
const SORTS: readonly SelectOption<RankingSort>[] = (['score', 'payback', 'effect', 'capex'] as const).map((value) => ({ value, label: k.sorts[value] }))

const COLUMNS: readonly RadioTableColumn[] = [
  { key: 'solution', label: k.columns.solution },
  { key: 'capex', label: k.columns.capex, widthClass: 'w-(--rav-ranking-capex-width)' },
  { key: 'effect', label: k.columns.effect, widthClass: 'w-(--rav-ranking-effect-width)' },
  { key: 'payback', label: k.columns.payback, widthClass: 'w-(--rav-ranking-payback-width)' },
]
const SCORE_COLUMN: RadioTableColumn = { key: 'score', label: k.columns.score, widthClass: 'w-(--rav-ranking-score-width)' }


interface RankingBlockProps {
  readonly variants: readonly RankedVariant[]
  readonly excluded: readonly ExcludedSolution[]
  /** Исключённые, добавленные вручную: строки в конце рейтинга, вне рейтинга (16834:69). */
  readonly manual: readonly ExcludedSolution[]
  readonly robots: ReadonlyMap<string, Robot>
  /** Ключ выбранного варианта (`variantKey`); null — не выбран. */
  readonly selectedKey: string | null
  /** Выбор меняется: пользователь и гость (D-14). Сохранённая оценка — только просмотр (D-17): `RadioTable readOnly`. */
  readonly canSelect: boolean
  /** Ручное добавление исключённых — не у сохранённой оценки. */
  readonly canEdit: boolean
  readonly onSelect: (selection: ProjectSelection) => void
  readonly onAddManual: (solutionId: string) => void
  readonly onRemoveManual: (solutionId: string) => void
  /** Ключи в сравнении: `variantKey` или id решения вне рейтинга; null — режим сравнения выключен. */
  readonly compareKeys: readonly string[] | null
  readonly onCompareKeys: (keys: readonly string[] | null) => void
  readonly onOpenCompare: () => void
  /** Разбор балла раскрыт у всех строк — состояние «всё раскрыто» (17093:10). */
  readonly expandAll?: boolean
}

function solutionCell(name: string, lines: readonly string[], alerts: readonly string[]) {
  return (
    <span className="flex flex-col gap-2">
      <span className="type-body font-semibold text-text">{name}</span>
      {lines.map((line) => <span key={line} className="type-caption text-text-secondary">{line}</span>)}
      {alerts.map((alert) => <span key={alert} className="type-caption text-danger">{alert}</span>)}
    </span>
  )
}

/** Строка варианта: решение в три строки и предупреждения, CAPEX, эффект (отрицательный — красным), окупаемость. */
function variantCells(v: RankedVariant, robot: Robot | undefined) {
  const name = t.variantName(v.solutionName, t.acquisition[v.acquisition])
  const place = v.rank === null ? solutionLine(v.manufacturer, robot) : k.place(v.rank, brandOf(v.manufacturer), v.robots)
  return {
    name,
    cells: [
      solutionCell(name, [place, k.money(money(v.raasMonthlyRub, 2), money(v.opexRubPerYear))], v.warnings),
      money(v.capexRub),
      <span key="effect" className={v.annualEffectRub < 0 ? 'text-danger' : undefined}>{money(v.annualEffectRub)}</span>,
      <span key="payback" className="font-semibold">{v.paybackYears === null ? k.notPaying : formatYears(v.paybackYears, { fixed: true })}</span>,
    ],
  }
}

/**
 * «Рейтинг вариантов» (16742:3; PRD 11.3): фильтр «Все · Покупка · RaaS», сортировка, «Сравнить»; таблица-радиогруппа —
 * выбор варианта радио, пилюля балла раскрывает разбор под строкой (2.2 удалён, D-54). В конце — добавленные вручную
 * (вне рейтинга, 16834:69), под таблицей — исключённые решения. Режим «Сравнить» — флажки вместо радио (16834:5).
 */
export function RankingBlock(props: RankingBlockProps) {
  const { variants, excluded, manual, robots, selectedKey, canSelect, canEdit, onSelect, onAddManual, onRemoveManual, compareKeys, onCompareKeys, onOpenCompare, expandAll = false } = props
  const [filter, setFilter] = useState<AcquisitionFilter>('all')
  const [sort, setSort] = useState<RankingSort>('score')
  // Разбор балла: явно раскрытые и свёрнутые строки. По умолчанию раскрыт у выбранной (16325:101), в режиме «Сравнить»
  // свёрнут (16834:5), в «всё раскрыто» — у всех (17093:10).
  const [open, setOpen] = useState<Readonly<Record<string, boolean>>>({})
  const ranked = rankingRows(variants, { filter, sort })
  const comparing = compareKeys !== null
  const full = (compareKeys?.length ?? 0) >= COMPARE_LIMIT

  // Недоступная строка (вне рейтинга; сверх лимита сравнения) полупрозрачна вместе с колонкой балла: пилюля у неё тоже
  // недоступна — иначе активная кнопка без контраста (axe). В просмотре строки не выключены (`readOnly`), разбор открыт у всех.
  const scoreColumn = (key: string, name: string, score: number | null, selected: boolean, disabled: boolean) => {
    const expanded = !disabled && (open[key] ?? (expandAll || (selected && !comparing)))
    const detailId = `matching-score-${key.replace(':', '-')}`
    return {
      expanded,
      trailing: (
        <ScorePill
          score={score === null ? null : formatScore(score)}
          label={k.scoreLabel(name)}
          // Тёмная пилюля — у выбранной строки и у раскрытого разбора (16834:5, 17093:10).
          tone={selected || expanded ? 'selected' : 'default'}
          expanded={expanded}
          controls={detailId}
          disabled={disabled}
          onClick={() => { setOpen({ ...open, [key]: !expanded }) }}
        />
      ),
      detailId,
    }
  }

  const rows: RadioTableRow<string>[] = [
    ...ranked.map((v) => {
      const key = variantKey(v)
      const { name, cells } = variantCells(v, robots.get(v.solutionId))
      const selected = key === selectedKey
      const disabled = comparing && full && !compareKeys.includes(key)
      const score = scoreColumn(key, name, v.score, selected, disabled)
      return {
        value: key,
        label: name,
        cells,
        trailing: score.trailing,
        expanded: score.expanded,
        detail: <ScoreBreakdown id={score.detailId} score={v.score} criteria={breakdownOf(v)} />,
        disabled,
      }
    }),
    // Вне рейтинга (16834:69): расчёта нет — выбрать нельзя, в симуляцию не передать; в сравнение — можно (PRD 11.3).
    // Прочерки чёрные, как на макете: несоответствие показывает красная строка «Критическое несоответствие».
    ...manual.map((e) => ({
      value: e.solutionId,
      label: e.solutionName,
      cells: [
        solutionCell(
          e.solutionName,
          [`${solutionLine(e.manufacturer, robots.get(e.solutionId))} · ${k.outOfRanking}`, k.money('—', '—')],
          [k.critical(shortReasonsText(e))],
        ),
        '—',
        '—',
        '—',
      ],
      trailing: <ScorePill score={null} label={k.scoreLabel(e.solutionName)} />,
      disabled: comparing ? full && !(compareKeys.includes(e.solutionId)) : true,
    })),
  ]

  return (
    <Card as="section" padding={28} gap={20} aria-labelledby="matching-ranking-title">
      <div className="flex flex-col gap-4">
        <h2 id="matching-ranking-title" className="type-heading text-text">{k.title}</h2>
        <p className="type-caption text-text-secondary">{k.lead}</p>
      </div>
      <div className="flex items-center gap-12">
        <Segmented label={k.filter} options={FILTERS} value={filter} onChange={setFilter} fit="content" size={44} />
        <Select variant="filter" aria-label={k.sort} options={SORTS} value={sort} onChange={setSort} />
        <span className="flex-1" />
        {comparing
          ? (
              <>
                <Button onClick={() => { onCompareKeys(null) }}>{k.compareCancel}</Button>
                <Button variant="primary" disabled={compareKeys.length < 2} onClick={onOpenCompare}>{k.compareSelected(compareKeys.length)}</Button>
              </>
            )
          : <Button onClick={() => { onCompareKeys([]) }}>{k.compare}</Button>}
      </div>
      {rows.length === 0
        ? <EmptyState title={k.empty} />
        : comparing
          ? (
              <RadioTable
                selection="multiple"
                label={k.compareCaption}
                columns={COLUMNS}
                trailingColumn={SCORE_COLUMN}
                rows={rows}
                values={compareKeys}
                onValuesChange={onCompareKeys}
              />
            )
          : (
              <RadioTable
                label={k.caption}
                columns={COLUMNS}
                trailingColumn={SCORE_COLUMN}
                rows={rows}
                value={selectedKey}
                readOnly={!canSelect}
                onChange={(key) => {
                  const v = ranked.find((r) => variantKey(r) === key)
                  if (v) onSelect({ solutionId: v.solutionId, acquisition: v.acquisition })
                }}
              />
            )}
      <ExcludedList excluded={excluded} robots={robots} manualIds={manual.map((e) => e.solutionId)} canEdit={canEdit} onAdd={onAddManual} onRemove={onRemoveManual} />
    </Card>
  )
}
