import { ArrowLeft } from 'lucide-react'
import { useParams } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { TextLink } from '@/components/ui/TextLink'
import type { LaunchItem, Robot } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { launchItemPrice } from '../catalogModel'
import { robotCharacteristics, summarize } from '../characteristics'
import { checkOnSiteContext, typeLabelOf } from '../compare/comparePaths'
import { LaunchItemCharacteristics, LaunchItemCompatibility } from './LaunchItemSections'
import { RobotAllCharacteristics, RobotKeySection, RobotLaunchSection, RobotRequirementsSection } from './RobotSections'
import { SolutionHero } from './SolutionHero'
import { useCatalogItem, type CatalogItemData } from './useCatalogItem'

const t = ru.catalog.item

function RobotSolution({ robot, data }: { readonly robot: Robot; readonly data: CatalogItemData }) {
  const map = robotCharacteristics(robot, data)
  const summary = summarize(map)
  const classes = robot.operationClasses
    .map((c) => ru.catalog.card.classChip(c.code, data.operationClasses.find((oc) => oc.code === c.code)?.name ?? ''))
  const entry = { kind: 'robot', robot } as const
  return (
    <>
      <SolutionHero
        kicker={[robot.type, robot.subtype, ...classes].join(' · ')}
        name={robot.name}
        subtitle={[robot.manufacturer, robot.region].filter(Boolean).join(' · ')}
        photo={robot.photo}
        typeLabel={typeLabelOf(entry)}
        description={robot.description || undefined}
        compareRef={{ kind: 'robot', id: robot.id }}
        checkOnSite={checkOnSiteContext(entry)}
        facts={[
          { key: 'price', value: robot.priceRub === null ? ru.catalog.card.noPrice : map.equipmentPrice.value?.split(' · ')[0] ?? '', note: t.priceNote },
          { key: 'trl', value: robot.trl === null ? t.noTrl : t.trl(robot.trl), note: t.readiness[robot.readiness] },
          { key: 'specs', value: t.keySpecs(summary.keyConfirmed, summary.keyTotal), note: t.keySpecsNote },
        ]}
      />
      <RobotKeySection robot={robot} map={map} operationClasses={data.operationClasses} />
      <RobotRequirementsSection map={map} />
      <RobotLaunchSection robot={robot} items={data.launchItems} norms={data.norms} />
      <RobotAllCharacteristics map={map} summary={summary} />
    </>
  )
}

function LaunchItemSolution({ item, data }: { readonly item: LaunchItem; readonly data: CatalogItemData }) {
  const confirmed = item.specs.filter((s) => s.status === 'confirmed').length
  const entry = { kind: 'launch-item', item } as const
  return (
    <>
      <SolutionHero
        kicker={[t.itemTypes[item.type], ...item.specs.slice(0, 2).map((s) => s.value)].join(' · ')}
        name={item.name}
        subtitle={item.supplier}
        typeLabel={typeLabelOf(entry)}
        compareRef={{ kind: 'launch-item', id: item.id }}
        facts={[
          { key: 'price', value: launchItemPrice(item), note: t.costTypeNote(ru.catalog.card.costType[item.costType]) },
          { key: 'specs', value: t.keySpecs(confirmed, item.specs.length), note: t.itemSpecsNote },
        ]}
      />
      <LaunchItemCharacteristics item={item} />
      <LaunchItemCompatibility item={item} robots={data.robots} items={data.launchItems} />
    </>
  )
}

function ItemContent({ itemId, data }: { readonly itemId: string; readonly data: CatalogItemData }) {
  const robot = data.robots.find((r) => r.id === itemId)
  if (robot) return <RobotSolution robot={robot} data={data} />
  const item = data.launchItems.find((i) => i.id === itemId)
  if (item) return <LaunchItemSolution item={item} data={data} />
  return (
    <EmptyState
      size="lg"
      title={t.notFound.title}
      description={t.notFound.description}
      action={<TextLink to={ROUTE_PATHS.catalog} icon={ArrowLeft}>{t.toCatalog}</TextLink>}
    />
  )
}

/**
 * Экран К-4 «Каталог · карточка решения» (PRD 7.7; 16777:783) — цель «Подробнее» на К-1 и К-2 и «→» у позиций запуска.
 * Робот — все блоки макета; позиция для запуска — тот же шаблон с доступными блоками (D-79). Гостю — без сохранения сравнения.
 */
export function CatalogItemPage() {
  const { itemId = '' } = useParams()
  const { state, retry } = useCatalogItem()

  if (state.status === 'loading') return <Skeleton className="h-(--rav-empty-panel-min-height)" />
  if (state.status === 'error') return <ErrorState title={ru.catalog.error.title} message={ru.catalog.error.message} onRetry={retry} />
  return (
    <div className="flex flex-col gap-24">
      <ItemContent itemId={itemId} data={state} />
    </div>
  )
}
