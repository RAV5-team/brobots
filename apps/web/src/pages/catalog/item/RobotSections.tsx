import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { ButtonLink } from '@/components/ui/Button'
import { FILTER_PILL_CLASSES } from '@/components/ui/buttonStyles'
import { Card, CardTitle } from '@/components/ui/Card'
import { CharacteristicRow } from '@/components/ui/CharacteristicRow'
import { ChipList } from '@/components/ui/ChipList'
import {
  launchCostRub,
  ROBOT_CHARACTERISTIC_GROUPS,
  SITE_REQUIREMENT_KEYS,
  type Characteristic,
  type LaunchItem,
  type LaunchItemId,
  type Norm,
  type OperationClass,
  type Robot,
  type RobotCharacteristicGroup,
  type RobotCharacteristicKey,
} from '@/domain'
import { formatNumber } from '@/shared/format/number'
import { formatRubCompact, formatRubMillions } from '@/shared/format/money'
import { ru } from '@/shared/i18n/ru'
import { catalogItemPath, toCatalogSearch, EMPTY_FILTER } from '../catalogModel'
import type { RobotCharacteristicMap, RobotCharacteristicSummary } from '../characteristics'

const t = ru.catalog.item

/** Ключевые характеристики слева (16777:815): подписи — как на макете, значения — из характеристик. */
const KEY_ROWS: readonly RobotCharacteristicKey[] = ['payload', 'dimensions', 'speed', 'autonomy', 'productivity', 'aisleRequirements']
const keyLabel = (key: RobotCharacteristicKey) => (key in t.keyRows ? t.keyRows[key as keyof typeof t.keyRows] : t.rows[key])
const siteLabel = (key: RobotCharacteristicKey) => (key in t.siteRows ? t.siteRows[key as keyof typeof t.siteRows] : t.rows[key])

function Row({ label, c }: { readonly label: string; readonly c: Characteristic }) {
  return <CharacteristicRow label={label} value={c.value} status={c.status} source={c.source} date={c.date} />
}

/** Блок «Ключевые характеристики» и справа — классы, грузоподъёмность, где применяется (16777:814; D-80). */
export function RobotKeySection({ robot, map, operationClasses }: { readonly robot: Robot; readonly map: RobotCharacteristicMap; readonly operationClasses: readonly OperationClass[] }) {
  const payload = robot.specs.payloadKg
  return (
    <div className="grid grid-cols-2 gap-16">
      <Card as="section" variant="panel" elevation="md" padding={20} gap={4} aria-labelledby="key-title">
        <h2 id="key-title" className="type-heading font-semibold text-text">{t.keyTitle}</h2>
        <dl>
          {KEY_ROWS.map((key) => (
            <div key={key} className="flex items-start justify-between gap-12 py-8 type-body">
              <dt className="text-text-secondary">{keyLabel(key)}</dt>
              <dd className={map[key].value === null ? 'text-right font-medium text-text-secondary' : 'text-right font-medium text-text'}>
                {map[key].value ?? ru.characteristicStatus.missing}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card as="section" variant="panel" elevation="md" padding={20} gap={12} aria-label={t.classesTitle}>
        <h2 className="type-heading font-semibold text-text">{t.classesTitle}</h2>
        <ChipList
          label={t.classesTitle}
          items={robot.operationClasses.map((c) => ({ key: c.code, label: ru.catalog.card.classChip(c.code, operationClasses.find((oc) => oc.code === c.code)?.name ?? '') }))}
        />
        {payload !== undefined && (
          <>
            <h2 className="type-heading font-semibold text-text">{t.payloadTitle}</h2>
            <ChipList label={t.payloadTitle} items={[{ key: 'payload', label: ru.catalog.card.payloadValue(formatNumber(payload)) }]} />
          </>
        )}
        {robot.industries.length > 0 && (
          <>
            <h2 className="type-heading font-semibold text-text">{t.whereTitle}</h2>
            <ChipList label={t.whereTitle} items={robot.industries.map((i) => ({ key: i, label: i }))} />
          </>
        )}
      </Card>
    </div>
  )
}

/** «Требования к объекту» (16777:854): те же записи, что в «Инфраструктуре», плюс температура (D-76). */
export function RobotRequirementsSection({ map }: { readonly map: RobotCharacteristicMap }) {
  return (
    <Card as="section" padding={20} gap={12} aria-labelledby="requirements-title">
      <h2 id="requirements-title" className="type-heading font-semibold text-text">{t.requirementsTitle}</h2>
      <dl>{SITE_REQUIREMENT_KEYS.map((key) => <Row key={key} label={siteLabel(key)} c={map[key]} />)}</dl>
    </Card>
  )
}

function LaunchRow({ item, last }: { readonly item: LaunchItem; readonly last: boolean }) {
  const price = item.price.kind === 'rub' ? formatRubMillions(item.price.amountRub) : ru.catalog.card.percentOfCapex(item.price.percent)
  return (
    <li className={last ? '' : 'border-b border-border'}>
      <Link
        to={catalogItemPath(item.id)}
        aria-label={t.openItem(item.name)}
        className="flex items-center gap-12 rounded-md py-12 transition-colors hover:bg-surface-muted"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-4">
          <span className="type-body font-semibold text-text">{item.name}</span>
          <span className="type-caption text-text-secondary">{item.quantityNorm}</span>
        </span>
        <span className="type-body font-semibold whitespace-nowrap text-text">{price}</span>
        <span className="px-12 py-4 type-caption font-medium whitespace-nowrap text-text">{ru.catalog.card.costType[item.costType]}</span>
        <ArrowRight aria-hidden size={16} className="text-text-secondary" />
      </Link>
    </li>
  )
}

function LaunchGroup({ title, ids, items, lastGroup }: { readonly title: string; readonly ids: readonly LaunchItemId[]; readonly items: readonly LaunchItem[]; readonly lastGroup: boolean }) {
  const found = ids.flatMap((id) => items.filter((i) => i.id === id))
  if (found.length === 0) return null
  return (
    <section aria-label={title} className="flex flex-col gap-4">
      <CardTitle>{title}</CardTitle>
      <ul>{found.map((item, i) => <LaunchRow key={item.id} item={item} last={lastGroup && i === found.length - 1} />)}</ul>
    </section>
  )
}

const normValue = (norms: readonly Norm[], code: string) => norms.find((n) => n.code === code)?.value

/**
 * «Что потребуется для запуска» (16777:899, D-78): сумма обязательных, нормативы модели из справочника А5,
 * обязательные и условные позиции со ссылкой «→» на их страницу (D-79), «Посмотреть все совместимые компоненты».
 */
export function RobotLaunchSection({ robot, items, norms }: { readonly robot: Robot; readonly items: readonly LaunchItem[]; readonly norms: readonly Norm[] }) {
  if (robot.launchRequired.length === 0 && robot.launchConditional.length === 0) return null
  const software = normValue(norms, 'fleet_software_pct')
  const commissioning = normValue(norms, 'commissioning_pct')
  const compatibleSearch = toCatalogSearch({ ...EMPTY_FILTER, tab: 'infrastructure', compatibleWith: robot.id }).toString()
  return (
    <Card as="section" padding={20} gap={0} aria-labelledby="launch-title">
      <h2 id="launch-title" className="type-heading font-semibold text-text">{t.launchTitle}</h2>
      <p className="mt-4 mb-20 type-body text-text-secondary">
        {t.launchLead(formatRubCompact(launchCostRub(robot.launchRequired, items)))}
        {software !== undefined && commissioning !== undefined && t.launchNorms(formatNumber(software), formatNumber(commissioning))}
      </p>
      <div className="flex flex-col gap-20">
        <LaunchGroup title={t.launchRequired} ids={robot.launchRequired} items={items} lastGroup={robot.launchConditional.length === 0} />
        <LaunchGroup title={t.launchConditional} ids={robot.launchConditional} items={items} lastGroup />
      </div>
      <div className="flex justify-end pt-20">
        <ButtonLink to={`${ROUTE_PATHS.catalog}?${compatibleSearch}`}>{t.compatibleAll}</ButtonLink>
      </div>
    </Card>
  )
}

const GROUP_ORDER = Object.keys(ROBOT_CHARACTERISTIC_GROUPS) as RobotCharacteristicGroup[]

/**
 * «Все технические характеристики» (16777:977): шесть групп ТЗ 3.3 строками `CharacteristicRow`; «Качество данных»
 * заканчивается расчётными строками полноты и подтверждённости (D-77). «Каталог ФЦ БАС v4» ведёт к «Качеству данных»,
 * «Сайт производителя» — по ссылке из данных; ссылки нет — кнопки нет (D-79).
 */
export function RobotAllCharacteristics({ map, summary, catalogVersion }: { readonly map: RobotCharacteristicMap; readonly summary: RobotCharacteristicSummary; readonly catalogVersion: string }) {
  const link = map.sourceLink.value
  const href = link === null ? null : /^https?:\/\//.test(link) ? link : `https://${link}`
  return (
    <Card as="section" padding={20} gap={8} aria-labelledby="all-title">
      <div className="flex items-center gap-12">
        <h2 id="all-title" className="flex-1 type-heading font-semibold text-text">{t.allTitle}</h2>
        <a href="#data-quality" className={FILTER_PILL_CLASSES}>{t.catalogSource(catalogVersion)}</a>
        {href && link && (
          <a href={href} target="_blank" rel="noopener noreferrer" aria-label={t.vendorSiteLabel(link)} className={FILTER_PILL_CLASSES}>{t.vendorSite}</a>
        )}
      </div>
      {GROUP_ORDER.map((group) => (
        <section key={group} id={group === 'dataQuality' ? 'data-quality' : undefined} aria-label={t.groups[group]} className="scroll-mt-(--rav-form-nav-offset) pt-12">
          <CardTitle>{t.groups[group]}</CardTitle>
          <dl>
            {ROBOT_CHARACTERISTIC_GROUPS[group].map((key) => <Row key={key} label={t.rows[key]} c={map[key]} />)}
            {group === 'dataQuality' && (
              <>
                <CharacteristicRow label={t.rows.completeness} value={t.completenessValue(summary.filled, summary.total)} status="estimate" source={t.platformCalc} />
                <CharacteristicRow
                  label={t.rows.confirmedness}
                  value={t.confirmednessValue(summary.counts.confirmed, summary.counts.estimate, summary.counts.missing)}
                  status="confirmed"
                  source={t.platformCalc}
                />
              </>
            )}
          </dl>
        </section>
      ))}
    </Card>
  )
}

