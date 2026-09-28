import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { CompareTable, type CompareColumn, type CompareGroup } from '@/components/ui/CompareTable'
import type { AcquisitionModel, ScenarioEconomics } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import type { ColumnKey, ScenarioRow } from './economicsTables'
import { acquisitionName } from './economicsView'

const t = ru.project.economics.scenarios

/** Группы строк: конфигурация, экономика, условия. */
const GROUPS: readonly { readonly key: keyof typeof t.groups; readonly rows: readonly string[] }[] = [
  { key: 'config', rows: ['fleet', 'check'] },
  { key: 'money', rows: ['capex', 'raas', 'opex', 'reduction', 'labor', 'effect', 'payback', 'roi', 'tco', 'cumulative', 'operation'] },
  { key: 'conditions', rows: ['conditions'] },
]

interface ScenarioCompareProps {
  readonly scenarios: readonly ScenarioEconomics[]
  readonly rows: readonly ScenarioRow[]
  readonly lead: string
  readonly selected: AcquisitionModel
  readonly canChoose: boolean
  readonly onChoose: (scenario: AcquisitionModel) => void
}

function Head({ title, children }: { readonly title: string; readonly children?: ReactNode }) {
  return (
    <span className="flex min-h-44 flex-col items-start gap-8 px-12">
      <span className="type-body font-semibold text-text">{title}</span>
      {children}
    </span>
  )
}

/**
 * «Сравнение сценариев» (16197:2098; PRD 11.5): текущий процесс, покупка и RaaS по единым показателям, а не
 * «базовый / пессимистичный / без роботов» макета. Выбор меняется только кнопкой «Выбрать этот сценарий».
 * Таблица — `CompareTable` (D-86); выбранная колонка — плашка «Выбран» вместо тёмной шапки макета.
 */
export function ScenarioCompare({ scenarios, rows, lead, selected, canChoose, onChoose }: ScenarioCompareProps) {
  const columns: CompareColumn[] = [
    { key: 'current', label: t.current, header: <Head title={t.current}><span className="type-caption text-text-secondary">{t.base}</span></Head> },
    ...scenarios.map((s): CompareColumn => {
      const name = acquisitionName(s.acquisition)
      const isSelected = s.acquisition === selected
      return {
        key: s.acquisition,
        label: isSelected ? `${name} · ${t.selected}` : name,
        header: (
          <Head title={name}>
            {isSelected
              ? <Chip size="sm" tone="inverse">{t.selected}</Chip>
              : canChoose && <Button size="sm" onClick={() => { onChoose(s.acquisition) }}>{ru.project.economics.recommendation.choose}</Button>}
          </Head>
        ),
      }
    }),
  ]
  const keys: readonly ColumnKey[] = ['current', ...scenarios.map((s) => s.acquisition)]
  const cell = (row: ScenarioRow, key: ColumnKey) => {
    const value = row.values[key]
    if (row.mark?.column !== key) return { key, tone: key === 'current' ? 'panel' as const : 'default' as const, content: value }
    return {
      key,
      tone: 'default' as const,
      content: <span className="flex flex-col items-start gap-6">{value}<Chip size="xs" tone="accent">{row.mark.text}</Chip></span>,
    }
  }
  const groups: CompareGroup[] = GROUPS.map((g) => ({
    key: g.key,
    title: t.groups[g.key],
    rows: rows.filter((r) => g.rows.includes(r.key)).map((r) => ({ key: r.key, label: r.label, cells: keys.map((k) => cell(r, k)) })),
  }))
  return (
    <Card as="section" padding={24} gap={12} aria-labelledby="economics-scenarios-title">
      <h2 id="economics-scenarios-title" className="type-heading text-text">{t.title}</h2>
      <p className="type-caption text-text-secondary">{lead}</p>
      <CompareTable caption={t.caption} columns={columns} groups={groups} />
    </Card>
  )
}
