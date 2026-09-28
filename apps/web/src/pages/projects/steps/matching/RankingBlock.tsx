import { CircleHelp, GitCompareArrows } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Search } from '@/components/ui/Search'
import { Segmented, type SegmentedOption } from '@/components/ui/Segmented'
import { Select, type SelectOption } from '@/components/ui/Select'
import { EmptyState } from '@/components/ui/States'
import { Table, TableBody, TableHead, TableHeaderCell } from '@/components/ui/Table'
import { COMPARE_LIMIT, type ProjectSelection, type RankedVariant, type Robot } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { isSelected, rankingRows, toggleKey, variantKey, type AcquisitionFilter, type RankingSort } from './matchingModel'
import { RankingRow } from './RankingRow'

const k = ru.project.matching.ranking

const FILTERS: readonly SegmentedOption<AcquisitionFilter>[] = (['all', 'purchase', 'raas'] as const).map((value) => ({ value, label: k.filters[value] }))
const SORTS: readonly SelectOption<RankingSort>[] = (['score', 'payback', 'capex', 'effect', 'raas'] as const).map((value) => ({ value, label: k.sorts[value] }))

interface RankingBlockProps {
  readonly variants: readonly RankedVariant[]
  readonly robots: ReadonlyMap<string, Robot>
  readonly selection: ProjectSelection | null
  readonly canSelect: boolean
  readonly onSelect: (selection: ProjectSelection) => void
  readonly onHowRanked: () => void
  /** Ключи вариантов в сравнении (`variantKey`); null — режим сравнения выключен. */
  readonly compareKeys: readonly string[] | null
  /** Сколько мест в сравнении уже занято добавленными вручную. */
  readonly manualCount: number
  readonly onCompareKeys: (keys: readonly string[] | null) => void
  readonly onOpenCompare: () => void
}

/**
 * «Рейтинг вариантов» (16197:829; PRD 11.3): поиск, фильтр «Все · Покупка · RaaS», сортировка, таблица 8 вариантов,
 * «почему» у строки, выбор варианта и режим сравнения 2–4 вариантов.
 */
export function RankingBlock({ variants, robots, selection, canSelect, onSelect, onHowRanked, compareKeys, manualCount, onCompareKeys, onOpenCompare }: RankingBlockProps) {
  const [filter, setFilter] = useState<AcquisitionFilter>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<RankingSort>('score')
  const rows = rankingRows(variants, { filter, query, sort })
  const comparing = compareKeys !== null
  const inCompare = (compareKeys?.length ?? 0) + manualCount
  const columns = 9 + (comparing ? 1 : 0)
  return (
    <Card as="section" padding={24} gap={16} aria-labelledby="matching-ranking-title">
      <div className="flex items-center justify-between gap-16">
        <h2 id="matching-ranking-title" className="type-heading text-text">{k.title}</h2>
        <div className="flex items-center gap-16">
          <Segmented label={k.filter} options={FILTERS} value={filter} onChange={setFilter} fit="content" />
          <Button onClick={onHowRanked}>
            <CircleHelp aria-hidden size={16} />
            {k.howRanked}
          </Button>
        </div>
      </div>
      <p className="type-caption text-text-secondary">{k.lead}</p>
      <div className="flex items-center gap-8">
        <div className="min-w-0 flex-1">
          <Search label={k.search} placeholder={k.search} value={query} onChange={(e) => { setQuery(e.target.value) }} />
        </div>
        <Select variant="filter" aria-label={k.sort} options={SORTS} value={sort} onChange={setSort} />
        {comparing
          ? (
              <>
                <Button onClick={() => { onCompareKeys(null) }}>{k.compareCancel}</Button>
                <Button variant="primary" disabled={inCompare < 2} onClick={onOpenCompare}>{k.compareSelected(inCompare)}</Button>
              </>
            )
          : (
              <Button onClick={() => { onCompareKeys([]) }}>
                <GitCompareArrows aria-hidden size={16} />
                {k.compare}
              </Button>
            )}
      </div>
      {comparing && <p role="status" className="type-caption text-text-secondary">{k.compareHint(COMPARE_LIMIT)}</p>}
      {rows.length === 0
        ? <EmptyState title={k.empty} />
        : (
            <Table caption={k.caption} density="relaxed">
              <TableHead>
                <tr className="border-b border-border">
                  {comparing && <TableHeaderCell><span className="sr-only">{k.compare}</span></TableHeaderCell>}
                  <TableHeaderCell tone="label">{k.columns.rank}</TableHeaderCell>
                  <TableHeaderCell tone="label" className="w-full">{k.columns.solution}</TableHeaderCell>
                  <TableHeaderCell tone="label" align="end">{k.columns.robots}</TableHeaderCell>
                  <TableHeaderCell tone="label" align="end">{k.columns.score}</TableHeaderCell>
                  <TableHeaderCell tone="label" align="end">{k.columns.capex}</TableHeaderCell>
                  <TableHeaderCell tone="label" align="end">{k.columns.raas}</TableHeaderCell>
                  <TableHeaderCell tone="label" align="end">{k.columns.opex}</TableHeaderCell>
                  <TableHeaderCell tone="label" align="end">{k.columns.effect}</TableHeaderCell>
                  <TableHeaderCell tone="label" align="end">{k.columns.payback}</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {rows.map((v) => {
                  const key = variantKey(v)
                  const checked = compareKeys?.includes(key) ?? false
                  return (
                    <RankingRow
                      key={key}
                      variant={v}
                      robot={robots.get(v.solutionId)}
                      selected={isSelected(v, selection)}
                      canSelect={canSelect}
                      onSelect={() => { onSelect({ solutionId: v.solutionId, acquisition: v.acquisition }) }}
                      columns={columns}
                      compare={compareKeys === null
                        ? null
                        : {
                            checked,
                            disabled: !checked && inCompare >= COMPARE_LIMIT,
                            onChange: () => { onCompareKeys(toggleKey(compareKeys, key, COMPARE_LIMIT - manualCount) ?? compareKeys) },
                          }}
                    />
                  )
                })}
              </TableBody>
            </Table>
          )}
      <p className="type-caption text-text-secondary">{k.millions}</p>
    </Card>
  )
}
