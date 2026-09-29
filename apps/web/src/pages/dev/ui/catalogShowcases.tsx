import { useId, useState } from 'react'
import { Chip } from '@/components/ui/Chip'
import { CharacteristicRow } from '@/components/ui/CharacteristicRow'
import { ChipList } from '@/components/ui/ChipList'
import { CompareTable } from '@/components/ui/CompareTable'
import { MultiSelectFilter, type MultiSelectGroup } from '@/components/ui/MultiSelectFilter'
import { RadioTable } from '@/components/ui/RadioTable'
import { ScorePill } from '@/components/ui/ScorePill'
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
      {/* Подписи второй строкой у показателя и колонки: «Сравнение с текущим процессом» 2.1 (16325:101). */}
      <CompareTable
        caption="Сравнение с текущим процессом"
        labelWidth="compact"
        columns={[
          { key: 'base', label: 'Текущий процесс', header: <span className="type-overline text-text-muted">Текущий процесс</span>, caption: 'без роботизации · база' },
          { key: 'buy', label: 'Покупка', header: <span className="type-overline text-text-muted">Покупка</span>, caption: '18 роботов' },
          { key: 'raas', label: 'RaaS', header: <span className="type-overline text-text-muted">RaaS · услуга</span>, caption: 'расчётный тариф' },
        ]}
        groups={[
          {
            key: 'money',
            title: 'Экономика',
            rows: [
              { key: 'capex', label: 'Стартовые вложения', caption: 'CAPEX', cells: [{ key: 'base', tone: 'unconfirmed', content: '—' }, { key: 'buy', content: '47,4 млн ₽' }, { key: 'raas', content: '6,1 млн ₽' }] },
              { key: 'raas', label: 'Платёж RaaS в месяц', caption: 'за весь парк', cells: [{ key: 'base', tone: 'unconfirmed', content: '—' }, { key: 'buy', tone: 'unconfirmed', content: '—' }, { key: 'raas', content: '0,83 млн ₽' }] },
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
      <h3 className="type-overline text-text-muted">stacked · статусы проверки (2.1а, 16830:10)</h3>
      <dl>
        <CharacteristicRow variant="stacked" label="Грузоподъёмность" value="800 кг" verification="confirmed" source="Технический паспорт" date="2026-03-01" />
        <CharacteristicRow variant="stacked" label="Скорость" value="1,5 м/с без груза · 1,2 м/с с грузом" verification="analog" source="Паспорт; с грузом — по аналогу" />
        <CharacteristicRow variant="stacked" label="Эффективная производительность для процесса" value="8,6 рейса/ч" verification="estimate" source="Расчёт: цикл 312 с, погрузка 40 с" />
        <CharacteristicRow variant="stacked" label="Производительность в симуляции" value={null} verification="pending" source="Симуляция ещё не выполнена" />
        <CharacteristicRow variant="stacked" label="Покрытие Wi-Fi" value="нужно по всему маршруту" verification="needsCheck" />
      </dl>
      <h3 className="type-overline text-text-muted">plain (2.1а «Обзор», 16666:10)</h3>
      <dl>
        <CharacteristicRow variant="plain" label="Наименование" value="AMR 800 · базовая комплектация" />
        <CharacteristicRow variant="plain" label="Производитель" value="Морос" />
      </dl>
    </ShowcaseSection>
  )
}

const RADIO_TABLE_COLUMNS = [
  { key: 'location', label: ru.newProject.columns.location },
  { key: 'area', label: ru.newProject.columns.area, widthClass: 'w-(--rav-new-project-area-width)' },
  { key: 'labor', label: ru.newProject.columns.labor, widthClass: 'w-(--rav-new-project-labor-width)' },
] as const

/** Таблица-радиогруппа окна A2 (16429:8): ничего не выбрано и выбранная строка; стрелки меняют выбор. */
export function RadioTableShowcase() {
  const [value, setValue] = useState<string | null>(null)
  const row = (id: string, name: string, caption: string, area: string, labor: string) => ({
    value: id,
    label: `${name}, ${caption}; площадь ${area}, ручной труд ${labor}`,
    cells: [
      <span key="n" className="flex flex-col gap-4"><span className="type-body font-semibold text-text">{name}</span><span className="type-caption text-text-secondary">{caption}</span></span>,
      area,
      labor,
    ],
  })
  return (
    <ShowcaseSection title="RadioTable">
      <div className="w-(--rav-modal-wide-width) rounded-2xl bg-bg p-32">
        <RadioTable
          label={ru.newProject.tableLabel}
          columns={RADIO_TABLE_COLUMNS}
          value={value}
          onChange={setValue}
          rows={[
            row('LOC-01', 'РЦ Химки', 'склад · данные от 14.09.2026', '20 000 м²', '231 млн ₽/год'),
            row('LOC-02', 'Даркстор Юг', 'склад · данные от 09.09.2026', '10 500 м²', '84 млн ₽/год'),
          ]}
        />
      </div>
      <h3 className="type-overline text-text-muted">trailing · detail · danger (рейтинг 2.1, 16325:101)</h3>
      <RankingDemo />
      <h3 className="type-overline text-text-muted">readOnly (только просмотр): выбор не меняется, разбор балла открывается</h3>
      <RankingDemo readOnly />
      <h3 className="type-overline text-text-muted">selection=multiple (сравнить 2–4 варианта)</h3>
      <CompareSelectDemo />
    </ShowcaseSection>
  )
}

const RANKING_COLUMNS = [
  { key: 'name', label: 'Решение' },
  { key: 'capex', label: 'CAPEX', widthClass: 'w-(--rav-new-project-labor-width)' },
] as const
const SCORE_COLUMN = { key: 'score', label: 'Балл', widthClass: 'w-(--rav-new-project-labor-width)' }
const RANKING = [
  { id: 'amr', name: 'AMR 800 · RaaS', caption: 'Место 1 · Морос · 18 роб.', capex: '6,1 млн ₽', score: '0,91' },
  { id: 'ronavi', name: 'Ronavi H1500 · RaaS', caption: 'Место 2 · Ронави Роботикс · 16 роб.', capex: '7,3 млн ₽', score: '0,78' },
  { id: 'dmr', name: 'DMR Carrier P · RaaS', caption: 'Чистый эффект отрицательный', capex: '11,5 млн ₽', score: null },
] as const

const nameCell = (name: string, caption: string) => (
  <span className="flex flex-col gap-4"><span className="type-body font-semibold text-text">{name}</span><span className="type-caption text-text-secondary">{caption}</span></span>
)

function RankingDemo({ readOnly = false }: { readonly readOnly?: boolean }) {
  const [value, setValue] = useState<string | null>('amr')
  const [why, setWhy] = useState<string | null>(null)
  const idPrefix = useId()
  return (
    <div className="w-(--rav-modal-wide-width)">
      <RadioTable
        label="Рейтинг вариантов"
        columns={RANKING_COLUMNS}
        trailingColumn={SCORE_COLUMN}
        readOnly={readOnly}
        value={value}
        onChange={setValue}
        rows={RANKING.map((r) => ({
          value: r.id,
          label: `${r.name}, CAPEX ${r.capex}`,
          cells: [nameCell(r.name, r.caption), r.capex],
          tone: r.score === null ? 'danger' : 'default',
          trailing: (
            <ScorePill
              score={r.score}
              tone={r.id === value ? 'selected' : 'default'}
              label={`Из чего складывается балл ${r.name}`}
              expanded={why === r.id}
              controls={`${idPrefix}-why-${r.id}`}
              onClick={() => { setWhy(why === r.id ? null : r.id) }}
            />
          ),
          expanded: why === r.id || r.id === value,
          detail: <p id={`${idPrefix}-why-${r.id}`} className="type-caption text-text-secondary">{`Из чего складывается балл ${r.score ?? '—'} · окупаемость 0,30 · ROI 0,15`}</p>,
        }))}
      />
    </div>
  )
}

function CompareSelectDemo() {
  const [values, setValues] = useState<readonly string[]>(['amr'])
  return (
    <div className="w-(--rav-modal-wide-width)">
      <RadioTable
        selection="multiple"
        label="Сравнить варианты"
        columns={RANKING_COLUMNS}
        values={values}
        onValuesChange={setValues}
        rows={RANKING.map((r) => ({
          value: r.id,
          label: r.name,
          cells: [nameCell(r.name, r.caption), r.capex],
          disabled: r.score === null,
        }))}
      />
    </div>
  )
}
