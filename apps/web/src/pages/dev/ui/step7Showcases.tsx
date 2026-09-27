import { useState } from 'react'
import { Chip } from '@/components/ui/Chip'
import { CharacteristicRow } from '@/components/ui/CharacteristicRow'
import { ChipList } from '@/components/ui/ChipList'
import { CompareTable } from '@/components/ui/CompareTable'
import { MultiSelectFilter, type MultiSelectGroup } from '@/components/ui/MultiSelectFilter'
import { OPERATION_CLASSES } from '@/mocks/fixtures/operationClasses'
import { INDUSTRIES } from '@/pages/catalog/catalogModel'
import { ru } from '@/shared/i18n/ru'
import { stateProps, type DemoState } from './demoState'
import { ShowcaseSection, StateGrid } from './StateGrid'

const f = ru.catalog.filters
const STATES: readonly DemoState[] = ['default', 'hover', 'focus', 'disabled']
const INDUSTRY_OPTIONS = INDUSTRIES.map((i) => ({ value: i, label: i }))
const CLASS_OPTIONS = OPERATION_CLASSES.map((c) => ({ value: c.code, label: f.classOption(c.code, c.name) }))
const COST_GROUPS: readonly MultiSelectGroup<string>[] = [
  { label: f.costTypeGroup, options: [{ value: 'capex', label: f.costTypes.capex }, { value: 'opex', label: f.costTypes.opex }] },
  {
    label: f.priceGroup,
    options: [
      { value: 'upTo1m', label: f.priceRanges.upTo1m },
      { value: 'from1to3m', label: f.priceRanges.from1to3m },
      { value: 'over3m', label: f.priceRanges.over3m },
    ],
  },
]

type Variant = 'plain' | 'search' | 'groups'

function DemoMultiSelect({ variant, state, initial = [] }: { readonly variant: Variant; readonly state: DemoState; readonly initial?: readonly string[] }) {
  const [value, setValue] = useState<readonly string[]>(initial)
  const common = { value, onChange: setValue, ...stateProps(state) }
  if (variant === 'search') return <MultiSelectFilter label={f.industry} searchLabel={f.industrySearch} options={INDUSTRY_OPTIONS} {...common} />
  if (variant === 'groups') return <MultiSelectFilter label={f.cost} groups={COST_GROUPS} {...common} />
  return <MultiSelectFilter label={f.operationClass} options={CLASS_OPTIONS} {...common} />
}

/**
 * Выпадающий список с мультивыбором (PRD 7.4). Макета нет: раскрытые списки первой итерации удалены из Figma —
 * сверить с панелью 15835:11139, когда скрытая секция будет готова.
 */
export function MultiSelectShowcase() {
  return (
    <ShowcaseSection title="MultiSelectFilter">
      <StateGrid
        states={STATES}
        rows={[
          { label: 'plain', render: (st) => <DemoMultiSelect variant="plain" state={st} /> },
          { label: 'one', render: (st) => <DemoMultiSelect variant="plain" state={st} initial={['OP-01']} /> },
          { label: 'many', render: (st) => <DemoMultiSelect variant="plain" state={st} initial={['OP-01', 'OP-08']} /> },
          { label: 'search', render: (st) => <DemoMultiSelect variant="search" state={st} /> },
          { label: 'groups', render: (st) => <DemoMultiSelect variant="groups" state={st} initial={['capex']} /> },
        ]}
      />
    </ShowcaseSection>
  )
}

const CHIPS = [
  { key: 'rb', label: 'AMR 800', to: '/catalog/RB-0008' },
  { key: 'si', label: 'Fleet Manager', to: '/catalog/SI-SW-01' },
  { key: 'text', label: 'SmartCube' },
  { key: 'unconfirmed', label: 'REST, MQTT', unconfirmed: true },
]

/** Ряд плашек карточки каталога и «ещё N» (D-64, D-65). */
export function ChipListShowcase() {
  return (
    <ShowcaseSection title="ChipList · MoreChip">
      <StateGrid
        states={['default']}
        rows={[
          { label: 'all', render: () => <ChipList items={CHIPS} /> },
          { label: 'max 2', render: () => <ChipList items={CHIPS} max={2} /> },
        ]}
      />
    </ShowcaseSection>
  )
}

const cmp = ru.catalog.comparePage

/** Таблица сравнения К-3 с тонами ячеек и ✓ ✕ ? (D-59, D-75). */
export function CompareTableShowcase() {
  return (
    <ShowcaseSection title="CompareTable · FitCell">
      <CompareTable
        caption={cmp.caption}
        columns={[
          { key: 'a', label: 'AMR 100', header: <Chip>AMR 100</Chip> },
          { key: 'b', label: 'AMR 800', header: <Chip>AMR 800</Chip> },
        ]}
        groups={[
          {
            key: 'main',
            title: cmp.groups.main,
            rows: [
              { key: 'price', label: cmp.rows.price, cells: [{ key: 'a', content: '1,50 млн ₽' }, { key: 'b', content: '1,80 млн ₽' }] },
              { key: 'aisle', label: cmp.rows.minAisle, cells: [{ key: 'a', tone: 'unconfirmed', content: cmp.noData }, { key: 'b', tone: 'unconfirmed', content: cmp.noData }] },
              { key: 'infra', label: cmp.rows.launchInfrastructure, cells: [{ key: 'a', tone: 'panel', content: cmp.launchInfrastructure.charging }, { key: 'b', tone: 'panel', content: cmp.launchInfrastructure.fleet }] },
            ],
          },
          {
            key: 'fit',
            title: cmp.groups.fit('РЦ Химки'),
            rows: [
              { key: 'cargo', label: cmp.rows.cargo, cells: [{ key: 'a', tone: 'misfit', content: cmp.fit.cargoTooHeavy('800', '100') }, { key: 'b', tone: 'fit', content: cmp.fit.cargoOk('800', '800') }] },
              { key: 'floor', label: cmp.rows.floorLoad, cells: [{ key: 'a', tone: 'unknown', content: cmp.fit.floorLoadUnknown }, { key: 'b', tone: 'unknown', content: cmp.fit.floorLoadUnknown }] },
            ],
          },
        ]}
      />
    </ShowcaseSection>
  )
}

const it = ru.catalog.item

/** Строка характеристики К-4 с тремя статусами (D-76). */
export function CharacteristicRowShowcase() {
  return (
    <ShowcaseSection title="CharacteristicRow · StatusChip">
      <dl>
        <CharacteristicRow label={it.rows.dimensions} value="940 × 640 × 230 мм" status="confirmed" source="морос.рф" date="2026-09-19" />
        <CharacteristicRow label={it.rows.floorRequirements} value="ровное твёрдое покрытие" status="estimate" source="типовое требование класса AMR" />
        <CharacteristicRow label={it.rows.productivity} value={null} status="missing" source="требует уточнения у поставщика" />
      </dl>
    </ShowcaseSection>
  )
}
