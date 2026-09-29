import { Check } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Modal } from '@/components/ui/Modal'
import { Segmented, type SegmentedOption } from '@/components/ui/Segmented'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { TabPanel, Tabs, type TabItem } from '@/components/ui/Tabs'
import type { AcquisitionModel, MatchBaseline, MatchingEvaluation, RankedVariant, Robot, SiteFacts } from '@/domain'
import { robotCharacteristics, type RobotCharacteristicMap } from '@/pages/catalog/characteristics'
import { ru } from '@/shared/i18n/ru'
import { findVariant, formatScore, rubMillions } from './matchingModel'
import { DataQualityTab, InfrastructureTab, TechnicalTab } from './DetailsTabs'
import { dataQualityView, infrastructureView, technicalView } from './detailsTabsModel'
import { EconomicsTab } from './EconomicsTab'
import { economicsView } from './economicsTabModel'
import { OverviewTab } from './OverviewTab'
import { useCharacteristicContext } from './useCharacteristicContext'
import type { PeakDemand } from '../params/paramsModel'
import { detailsSummary, overviewView } from './variantDetailsModel'

const t = ru.project.matching
const d = t.details

type DetailsTab = keyof typeof d.tabs
const TABS: readonly TabItem<DetailsTab>[] = (['overview', 'technical', 'infrastructure', 'economics', 'dataQuality'] as const)
  .map((value) => ({ value, label: d.tabs[value] }))
const TABS_ID = 'variant-details-tabs'

interface CatalogTabProps {
  readonly tab: Exclude<DetailsTab, 'economics'>
  readonly variant: RankedVariant
  readonly robot: Robot
  readonly map: RobotCharacteristicMap
  readonly siteChecks: readonly string[]
  readonly site: SiteFacts
  readonly widthMarginM: number
  readonly simulated: boolean
}

/** Вкладки на характеристиках К-4: «Обзор», «Технические», «Инфраструктура», «Качество данных». */
function CatalogTab({ tab, variant, robot, map, siteChecks, site, widthMarginM, simulated }: CatalogTabProps) {
  if (tab === 'overview') return <OverviewTab view={overviewView(variant, robot, map, siteChecks)} score={variant.score} />
  const technical = technicalView(variant, robot, map, simulated)
  if (tab === 'technical') return <TechnicalTab view={technical} />
  const infrastructure = infrastructureView(variant, robot, map, site, widthMarginM)
  if (tab === 'infrastructure') return <InfrastructureTab view={infrastructure} />
  return <DataQualityTab view={dataQualityView(map, technical, infrastructure)} />
}

interface VariantDetailsDialogProps {
  readonly evaluation: MatchingEvaluation
  readonly variant: RankedVariant
  readonly robot: Robot | undefined
  readonly catalogVersion: string
  /** Параметры площадки без данных (D-99) — «Недостающие данные». */
  readonly siteChecks: readonly string[]
  readonly baseline: MatchBaseline | null
  /** Горизонт расчёта с учётом «Параметров расчёта» — как в сравнении с текущим процессом 2.1. */
  readonly horizonYears: number
  readonly demand: PeakDemand | null
  /** Площадка проекта и норматив запаса — вкладки «Инфраструктура» и «Качество данных» (правило площадки, D-99). */
  readonly site: SiteFacts
  readonly widthMarginM: number
  /** У проекта есть прогон симуляции — строка «Производительность в симуляции». */
  readonly simulated: boolean
  readonly selected: boolean
  /** Выбор доступен (не сохранённая оценка, D-17). */
  readonly canSelect: boolean
  readonly onSelect: (variant: RankedVariant) => void
  readonly onAddToCompare: (variant: RankedVariant) => void
  /** Переключатель «Покупка · RaaS» — просмотр другого варианта того же решения, выбор не меняет. */
  readonly onSwitch: (acquisition: AcquisitionModel) => void
  readonly onClose: () => void
}

/**
 * Окно 2.1а «Подробнее о решении» (16666:10, 17103:735; PRD 11.3): шапка с местом и баллом, переключатель способа
 * приобретения, пять вкладок (пока готов «Обзор»), подвал «Добавить к сравнению» и «Выбрать этот вариант» / «✓ Выбран».
 */
export function VariantDetailsDialog(props: VariantDetailsDialogProps) {
  const { evaluation, variant: v, robot, catalogVersion, siteChecks, baseline, horizonYears, demand, site, widthMarginM, simulated, selected, canSelect, onSelect, onAddToCompare, onSwitch, onClose } = props
  const [tab, setTab] = useState<DetailsTab>('overview')
  const load = useCharacteristicContext(catalogVersion)
  const options: readonly SegmentedOption<AcquisitionModel>[] = (['purchase', 'raas'] as const).map((value) => ({ value, label: t.acquisition[value] }))
  const available = (a: AcquisitionModel) => findVariant(evaluation, v.solutionId, a)?.rank != null
  const [first, second] = detailsSummary(v, robot, (value) => rubMillions(value))

  return (
    <Modal
      open
      onOpenChange={(open) => { if (!open) onClose() }}
      size="detail"
      title={v.solutionName}
      titleAside={v.rank !== null && v.score !== null && <Chip tone="inverse" size="xs">{d.rank(v.rank, formatScore(v.score))}</Chip>}
      headerExtra={(
        <div className="flex flex-col gap-20">
          <div className="flex items-center gap-20">
            <p className="flex-1 type-body text-text-secondary">{first}<br />{second}</p>
            <Segmented
              label={d.acquisition}
              options={options.map((opt) => ({ ...opt, disabled: !available(opt.value) }))}
              value={v.acquisition}
              onChange={onSwitch}
              fit="content"
              size={44}
            />
          </div>
          <Tabs id={TABS_ID} label={d.tabsLabel} items={TABS} value={tab} onChange={setTab} />
        </div>
      )}
      footer={(
        <>
          <Button onClick={() => { onAddToCompare(v) }}>{d.addToCompare}</Button>
          {selected
            ? <p role="status" className="flex items-center gap-8 px-16 type-body font-semibold text-on-accent"><Check aria-hidden size={16} />{d.selected}</p>
            : canSelect && <Button variant="primary" onClick={() => { onSelect(v) }}>{d.select}</Button>}
        </>
      )}
    >
      <TabPanel tabsId={TABS_ID} value={tab}>
        {tab === 'economics'
          ? <EconomicsTab view={economicsView({ variant: v, acquisitions: (['purchase', 'raas'] as const).filter(available), baseline, horizonYears, demand })} />
          : load.status === 'loading' || !robot
            ? <div aria-busy="true"><Skeleton className="h-(--rav-location-card-height)" /></div>
            : load.status === 'error'
              ? <ErrorState title={d.loadError} message={t.loadError.message} />
              : <CatalogTab tab={tab} variant={v} robot={robot} map={robotCharacteristics(robot, load.ctx)} siteChecks={siteChecks} site={site} widthMarginM={widthMarginM} simulated={simulated} />}
      </TabPanel>
    </Modal>
  )
}
