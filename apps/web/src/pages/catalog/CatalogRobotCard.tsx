import type { LaunchItem, OperationClass, Robot } from '@/domain'
import { formatNumber } from '@/shared/format/number'
import { formatRubMillions } from '@/shared/format/money'
import { ru } from '@/shared/i18n/ru'
import { CardSection, CatalogCardFrame } from './CatalogCardFrame'
import { CARD_LAUNCH_LABELS } from './launchLabels'

const t = ru.catalog.card

/** Сколько классов показать на карточке; остальные — «ещё N» (D-65). */
const MAX_CLASSES = 2
/** «Для запуска» — все обязательные позиции; больше трёх — «ещё N» (D-78). */
const MAX_LAUNCH = 3

interface CatalogRobotCardProps {
  readonly robot: Robot
  readonly operationClasses: readonly OperationClass[]
  readonly launchItems: readonly LaunchItem[]
  readonly inCompare: boolean
  readonly compareFull: boolean
  readonly onCompare: () => void
}

/** Карточка робота К-1 (PRD 7.2; 16642:671). Метка типа на плашке — подтип из данных, если фото нет (D-56, D-62). */
export function CatalogRobotCard({ robot, operationClasses, launchItems, inCompare, compareFull, onCompare }: CatalogRobotCardProps) {
  const classItems = robot.operationClasses.length > 0
    ? robot.operationClasses.map((c) => ({
      key: c.code,
      label: t.classChip(c.code, operationClasses.find((oc) => oc.code === c.code)?.name ?? ''),
    }))
    : [{ key: 'none', label: t.noClass }]
  const payload = robot.specs.payloadKg
  const status = t.status[robot.readiness]
  const launch = robot.launchRequired.flatMap((id) => {
    const item = launchItems.find((entry) => entry.id === id)
    if (!item) return []
    return [{ key: id, label: item.launchCategory ? CARD_LAUNCH_LABELS[item.launchCategory] : item.name }]
  })

  return (
    <CatalogCardFrame
      id={robot.id}
      name={robot.name}
      photo={robot.photo}
      typeLabel={robot.subtype}
      subtitle={t.manufacturerLine(robot.manufacturer, robot.subtype)}
      inCompare={inCompare}
      compareFull={compareFull}
      onCompare={onCompare}
    >
      <CardSection title={t.operationClass} items={classItems} max={MAX_CLASSES} />
      <CardSection
        title={t.payload}
        items={[payload === undefined
          ? { key: 'payload', label: t.noData }
          : { key: 'payload', label: t.payloadValue(formatNumber(payload)) }]}
      />
      <div className="flex flex-col gap-4 text-text">
        <p className="type-title-md">{robot.priceRub === null ? t.noPrice : formatRubMillions(robot.priceRub)}</p>
        <p className="type-caption font-medium">{t.readiness(robot.trl === null ? t.noTrl : t.trl(robot.trl), status)}</p>
      </div>
      {launch.length > 0 && <CardSection title={t.launch} items={launch} max={MAX_LAUNCH} />}
    </CatalogCardFrame>
  )
}
