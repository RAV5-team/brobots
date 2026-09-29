import { CircleHelp } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Chip, type ChipTone } from '@/components/ui/Chip'
import { Disclosure } from '@/components/ui/Disclosure'
import { Popover } from '@/components/ui/Popover'
import { ScorePill } from '@/components/ui/ScorePill'
import { TabPanel, Tabs, type TabItem } from '@/components/ui/Tabs'
import { stateProps, type DemoState } from './demoState'
import { ShowcaseSection, StateGrid } from './StateGrid'

const STATES: readonly DemoState[] = ['default', 'hover', 'focus', 'disabled']

/** Чип статуса процесса с «?» — кнопка-открывашка поповера (шаг 1, 16969:10). */
function StatusChipButton({ tone, text, ...rest }: { readonly tone: ChipTone; readonly text: string; readonly 'data-demo-state'?: string; readonly disabled?: boolean }) {
  return (
    <button type="button" className="rounded-full transition-shadow not-disabled:hover:shadow-raised-sm disabled:cursor-not-allowed disabled:opacity-(--rav-disabled-opacity)" {...rest}>
      <Chip tone={tone}>{text}<CircleHelp aria-hidden size={12} /></Chip>
    </button>
  )
}

/** Поповер у чипа статуса процесса и у балла (шаг 1 16969:10, шаг 2 16325:101): заголовок, чипы-якоря, пояснение, действие. */
export function PopoverShowcase() {
  return (
    <ShowcaseSection title="Popover">
      <StateGrid
        states={STATES}
        rows={[
          {
            label: 'title + body + action',
            render: (st) => (
              <Popover
                title="Нет данных для оценки: 2 значения"
                trigger={<StatusChipButton tone="inverse" text="Не хватает данных" {...stateProps(st)} />}
                action={<Button>Уточнить параметры площадки</Button>}
              >
                <div className="flex flex-wrap gap-8">
                  <Chip>Допустимая нагрузка на пол</Chip>
                  <Chip>Wi-Fi в зоне работы</Chip>
                </div>
                <p className="type-caption text-text-secondary">Значения заполняются в профиле локации и процесса — здесь они только отображаются</p>
              </Popover>
            ),
          },
          {
            label: 'danger chip',
            render: (st) => (
              <Popover title="Подбор заблокирован" trigger={<StatusChipButton tone="danger" text="Блокирует подбор" {...stateProps(st)} />}>
                <p className="type-caption text-text-secondary">Нет высоты стеллажей: без неё решения для инвентаризации не подобрать</p>
              </Popover>
            ),
          },
          {
            label: 'label · content width',
            render: (st) => (
              <Popover label="Из чего складывается балл" width="content" trigger={<ScorePill score="0,78" label="Из чего складывается балл" {...stateProps(st)} />}>
                <p className="type-caption text-text-secondary">Окупаемость 0,30 · ROI 0,15 · CAPEX к бюджету 0,10</p>
              </Popover>
            ),
          },
        ]}
      />
    </ShowcaseSection>
  )
}

const GROUPS = [
  { title: 'Процесс и объект операции', caption: '7 параметров' },
  { title: 'Объём и нагрузка', caption: '5 параметров' },
  { title: 'Маршрут', caption: '4 параметра · 1 по допущению' },
] as const

/** Группы шага 1 (16969:10), секция и триггер-чип шага 2 (16325:101). */
export function DisclosureShowcase() {
  return (
    <div className="flex flex-col gap-24">
      <ShowcaseSection title="Disclosure · section">
        <StateGrid
          states={STATES}
          rows={[
            {
              label: 'closed',
              render: (st) => (
                <Disclosure title="Сравнение с текущим процессом" caption="AMR 800 · 2 000 паллет/сутки · горизонт 5 лет" {...stateProps(st)}>
                  <p className="type-body text-text-secondary">Таблица сравнения</p>
                </Disclosure>
              ),
            },
            {
              label: 'open',
              render: (st) => (
                <Disclosure title="Условия отбора" caption="6 жёстких фильтров" defaultOpen {...stateProps(st)}>
                  <p className="type-body text-text-secondary">Класс операции OP-01 · способ обработки вилы / платформа</p>
                </Disclosure>
              ),
            },
          ]}
        />
      </ShowcaseSection>
      <ShowcaseSection title="Disclosure · group">
        <div className="flex flex-col">
          {GROUPS.map((g, i) => (
            <Disclosure key={g.title} variant="group" title={g.title} caption={g.caption} defaultOpen={i === 0}>
              <p className="type-body text-text-secondary">Параметры группы</p>
            </Disclosure>
          ))}
          <Disclosure variant="group" title="Исполнители" caption="1 группа · доля по допущению" aside={<Button size="sm">Все параметры</Button>}>
            <p className="type-body text-text-secondary">Параметры группы</p>
          </Disclosure>
        </div>
      </ShowcaseSection>
      <ShowcaseSection title="Disclosure · chip">
        <StateGrid
          states={STATES}
          rows={[
            {
              label: 'neutral',
              render: (st) => <Disclosure variant="chip" title="Показать ещё 3" {...stateProps(st)}><p className="type-body text-text-secondary">Ещё решения</p></Disclosure>,
            },
            {
              label: 'danger',
              render: (st) => <Disclosure variant="chip" tone="danger" title="4 не прошли фильтры" {...stateProps(st)}><p className="type-body text-text-secondary">Ronavi SD · класс операции OP-08</p></Disclosure>,
            },
          ]}
        />
      </ShowcaseSection>
    </div>
  )
}

type SolutionTab = 'overview' | 'tech' | 'infra' | 'economics' | 'quality'
const TAB_ITEMS: readonly TabItem<SolutionTab>[] = [
  { value: 'overview', label: 'Обзор' },
  { value: 'tech', label: 'Технические' },
  { value: 'infra', label: 'Инфраструктура' },
  { value: 'economics', label: 'Экономика' },
  { value: 'quality', label: 'Качество данных', disabled: true },
]

function DemoTabs({ state }: { readonly state: DemoState }) {
  const id = useId()
  const [tab, setTab] = useState<SolutionTab>('overview')
  const label = TAB_ITEMS.find((t) => t.value === tab)?.label
  return (
    <div className="flex flex-col gap-12">
      <Tabs id={id} label="Разделы решения" items={TAB_ITEMS} value={tab} onChange={setTab} data-demo-state={stateProps(state)['data-demo-state']} />
      <TabPanel tabsId={id} value={tab} className="type-body text-text-secondary">{`Панель «${label ?? ''}»`}</TabPanel>
    </div>
  )
}

/** Вкладки окна решения 2.1а (16666:10): стрелки ←/→, Home / End; «Качество данных» — недоступная. */
export function TabsShowcase() {
  return (
    <ShowcaseSection title="Tabs">
      <StateGrid
        states={['default', 'hover', 'focus']}
        rows={[{ label: 'underline', render: (st) => <DemoTabs state={st} /> }]}
      />
    </ShowcaseSection>
  )
}

function DemoScorePill({ tone, state }: { readonly tone: 'default' | 'selected'; readonly state: DemoState }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  return (
    <span className="flex flex-col items-start gap-8">
      <ScorePill
        score={tone === 'selected' ? '0,91' : '0,78'}
        tone={tone}
        label="Из чего складывается балл"
        expanded={open}
        controls={id}
        onClick={() => { setOpen(!open) }}
        {...stateProps(state)}
      />
      <span id={id} hidden={!open} className="type-caption text-text-secondary">Окупаемость 0,30</span>
    </span>
  )
}

/** Пилюля балла рейтинга 2.1 (16325:101): обычная, у выбранной строки, вне рейтинга. */
export function ScorePillShowcase() {
  return (
    <ShowcaseSection title="ScorePill">
      <StateGrid
        states={STATES}
        rows={[
          { label: 'default', render: (st) => <DemoScorePill tone="default" state={st} /> },
          { label: 'selected', render: (st) => <DemoScorePill tone="selected" state={st} /> },
          { label: 'empty', render: () => <ScorePill score={null} label="Из чего складывается балл" /> },
        ]}
      />
    </ShowcaseSection>
  )
}
