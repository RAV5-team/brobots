import { RefreshCw } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { StatusBanner } from '@/components/ui/StatusBanner'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { COMPARE_LIMIT, isReadOnly, siteFactsOf, type Project } from '@/domain'
import { numberParameter } from '@/pages/processes/locationStaffing'
import { formatCount, formatDayTime, formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { ProjectStepLayout } from '../ProjectStepLayout'
import { paramsView } from '../params/paramsModel'
import { demandOf } from './howCalculatedModel'
import { BaselineCompare } from './BaselineCompare'
import { CalcParamsPanel } from './CalcParamsPanel'
import { CompareDialog } from './CompareDialog'
import type { CompareEntry } from './compareModel'
import { ConditionsBlock } from './ConditionsBlock'
import { MatchingRail } from './MatchingRail'
import { effectiveOverrides, findVariant, manualEntries, recommendedVariant, scenariosOf, variantKey } from './matchingModel'
import { COMPARE_PARAM, readCompareParam, readMatchingView } from './matchingView'
import { RankingBlock } from './RankingBlock'
import { RecommendationCard } from './RecommendationCard'
import { useMatchingStep, type MatchingData, type MatchingStepState } from './useMatchingStep'
import { VariantDetailsDialog } from './VariantDetailsDialog'
import { DETAILS_PARAM, detailsVariant } from './variantDetailsModel'
import type { ProjectStepProps } from '../stepProps'

const t = ru.project.matching

/** Плашка D-89: параметры изменились после расчёта — рейтинг по прежним значениям, выбор сохранён. */
function StaleNotice({ state }: { readonly state: MatchingStepState }) {
  return (
    <StatusBanner
      variant="accent"
      title={t.stale.title}
      description={t.stale.description}
      action={(
        <Button variant="primary" className="shrink-0" disabled={state.recalculating} onClick={state.recalculate}>
          <RefreshCw aria-hidden size={16} />
          {state.recalculating ? t.stale.running : t.stale.action}
        </Button>
      )}
    >
      <p className="type-caption text-on-accent">{t.stale.mock}</p>
      {state.recalcError && <p role="alert" className="type-caption text-danger">{t.stale.failed}</p>}
    </StatusBanner>
  )
}

/** Проверки площадки шага 1 (D-91, D-99): параметры без данных, которые сверяются с роботом, — «требует проверки». */
function siteChecksOf(data: MatchingData, project: Project): readonly string[] {
  const view = paramsView(data.snapshot, project.locationProcessId, project.inputs.params.assumptions)
  return view.missing.filter((m) => m.impact === 'needs_check').map((m) => m.label)
}

const MILLION = 1_000_000

/** Бюджет CAPEX локации (`wh_capex_budget` и аналоги, млн ₽) — пояснение строки CAPEX рекомендации. */
function budgetOf({ snapshot }: MatchingData): number | null {
  const code = snapshot.facilityParameters.find((p) => p.code.endsWith('_capex_budget'))?.code ?? null
  const millions = numberParameter(snapshot.location, snapshot.facilityParameters, code)
  return millions === null ? null : millions * MILLION
}

/** Статус черновика справа от «← Проекты» (16399:1352). Гостю и сохранённой оценке его заменяет каркас. */
function SaveStatus({ state }: { readonly state: MatchingStepState }) {
  if (state.saveError) return <p role="alert" className="type-caption text-danger">{state.saveError}</p>
  // До первого сохранения на шаге — время последнего сохранения черновика.
  const savedAt = state.savedAt ?? state.project.updatedAt
  return <span role="status"><Chip tone="muted" size="sm">{t.rail.save.saved(formatDayTime(savedAt))}</Chip></span>
}

/**
 * Шаг 2 «Подбор решений» (доска 16325, экран 2.1 — 16325:101; PRD 11.3): условия отбора во всю ширину, рейтинг с разбором
 * балла, исключёнными и сравнением, сравнение с текущим процессом; справа — рекомендация системы.
 * Гость выбирает без сохранения (D-14), сохранённая оценка — только просмотр (D-17). Правка «Параметров расчёта» — подбор
 * устарел до пересчёта (D-89).
 */
export function MatchingStep({ project: initial, locationName, isGuest }: ProjectStepProps) {
  const readOnly = isReadOnly(initial)
  const state = useMatchingStep(initial, !isGuest && !readOnly)
  const { project, draft, load } = state
  const [paramsOpen, setParamsOpen] = useState(false)
  // Экраны-состояния из /dev/screens: «всё раскрыто» и режим «Сравнить» (состояние навигации, не адрес).
  const location = useLocation()
  // Окно 2.1а — в адресе (`?details=RB-0008:raas`): «Назад» браузера и «×» возвращают к 2.1.
  const [search, setSearch] = useSearchParams()
  const setParam = (name: string, value: string | null) => {
    const next = new URLSearchParams(search)
    if (value === null) next.delete(name)
    else next.set(name, value)
    setSearch(next)
  }
  const setDetails = (key: string | null) => { setParam(DETAILS_PARAM, key) }
  // Окно 2.1б — тоже в адресе (`?compare=…`); «×» закрывает окно, режим «Сравнить» и отметки остаются.
  const openCompareKeys = readCompareParam(search.get(COMPARE_PARAM))
  const [view] = useState(() => readMatchingView(location.state))
  const [compareKeys, setCompareKeys] = useState<readonly string[] | null>(view.compare ?? (openCompareKeys.length > 0 ? openCompareKeys : null))

  const layout = (body: ReactNode, lead?: string, rail?: ReactNode) => (
    <ProjectStepLayout
      layout="board"
      project={project}
      locationName={locationName}
      step="matching"
      isGuest={isGuest}
      title={t.title}
      lead={lead}
      status={<SaveStatus state={state} />}
      rail={rail}
    >
      {body}
    </ProjectStepLayout>
  )

  if (load.status === 'loading') return layout(<div aria-busy="true"><Skeleton className="h-(--rav-location-card-height)" /></div>)
  if (load.status === 'error') return layout(<ErrorState title={t.loadError.title} message={t.loadError.message} onRetry={state.retry} />)
  if (load.status === 'notCalculated') return layout(<EmptyState title={t.notCalculated.title} description={t.notCalculated.description} />)

  const { data } = load
  const { evaluation } = data
  const canEdit = !readOnly
  const recommended = recommendedVariant(evaluation)
  const selected = draft.selection ? findVariant(evaluation, draft.selection.solutionId, draft.selection.acquisition) : null
  const focus = selected ?? recommended
  const siteChecks = siteChecksOf(data, project)
  const manual = manualEntries(evaluation.excluded, draft.manualSolutionIds)
  const overrides = effectiveOverrides(draft.calcParams, evaluation.calcDefaults)
  const { processName, demand } = demandOf(data.snapshot, evaluation, project)
  const rankedCount = evaluation.variants.filter((v) => v.rank !== null).length
  const details = detailsVariant(evaluation, search.get(DETAILS_PARAM))
  const lead = [
    processName,
    demand === null ? null : t.leadPeak(t.howCalc.perHour(formatNumber(demand.perHour), demand.unit)),
    t.leadVariants(formatCount(rankedCount, t.plural.variants)),
  ].filter((part): part is string => Boolean(part)).join(' · ')

  const compareEntries: readonly CompareEntry[] = [
    ...evaluation.variants
      .filter((v) => openCompareKeys.includes(variantKey(v)))
      .map((v) => ({ key: variantKey(v), name: t.variantName(v.solutionName, t.acquisition[v.acquisition]), variant: v, robot: data.robots.get(v.solutionId) ?? null, violations: null })),
    ...manual
      .filter((e) => openCompareKeys.includes(e.solutionId))
      .map((e) => ({ key: e.solutionId, name: e.solutionName, variant: null, robot: data.robots.get(e.solutionId) ?? null, violations: e.reasons })),
  ]

  return layout(
    <>
      {state.stale && <StaleNotice state={state} />}
      <ConditionsBlock evaluation={evaluation} />
      <RankingBlock
        variants={evaluation.variants}
        excluded={evaluation.excluded}
        manual={manual}
        robots={data.robots}
        selectedKey={selected ? variantKey(selected) : null}
        canSelect={canEdit}
        canEdit={canEdit}
        onSelect={state.select}
        onAddManual={(id) => {
          state.addManual(id)
          // В режиме «Сравнить» добавленное сразу отмечено: оно идёт в сравнение (PRD 11.3).
          setCompareKeys((keys) => (keys === null ? null : [...keys, id]))
        }}
        onRemoveManual={(id) => {
          state.removeManual(id)
          setCompareKeys((keys) => keys?.filter((key) => key !== id) ?? null)
        }}
        compareKeys={compareKeys}
        expandAll={view.expandAll ?? false}
        onCompareKeys={setCompareKeys}
        onOpenCompare={() => { setParam(COMPARE_PARAM, compareKeys?.join(',') ?? null) }}
      />
      {compareEntries.length >= 2 && (
        <CompareDialog
          entries={compareEntries}
          catalogVersion={`v${String(project.versions.catalog)}`}
          baseline={evaluation.baseline}
          horizonYears={overrides.horizonYears ?? evaluation.horizonYears}
          site={siteFactsOf(data.snapshot.location, data.snapshot.siteValues)}
          widthMarginM={data.snapshot.widthMarginM}
          onClose={() => { setParam(COMPARE_PARAM, null) }}
        />
      )}
      {focus && evaluation.baseline && (
        <BaselineCompare baseline={evaluation.baseline} scenarios={scenariosOf(evaluation, focus.solutionId)} horizonYears={overrides.horizonYears ?? evaluation.horizonYears} demand={demand} />
      )}
      {details && (
        <VariantDetailsDialog
          evaluation={evaluation}
          variant={details}
          robot={data.robots.get(details.solutionId)}
          catalogVersion={`v${String(project.versions.catalog)}`}
          siteChecks={siteChecks}
          baseline={evaluation.baseline}
          horizonYears={overrides.horizonYears ?? evaluation.horizonYears}
          demand={demand}
          site={siteFactsOf(data.snapshot.location, data.snapshot.siteValues)}
          widthMarginM={data.snapshot.widthMarginM}
          simulated={project.inputs.simulation?.runId != null}
          selected={selected === details}
          canSelect={canEdit}
          onSelect={(v) => {
            state.select({ solutionId: v.solutionId, acquisition: v.acquisition })
            setDetails(null)
          }}
          onAddToCompare={(v) => {
            // Общее состояние сравнения 2.1: включить режим «Сравнить» и отметить вариант (лимит — у таблицы).
            const key = variantKey(v)
            setCompareKeys((keys) => (keys?.includes(key) ? keys : [...(keys ?? []), key].slice(0, COMPARE_LIMIT)))
            setDetails(null)
          }}
          onSwitch={(acquisition) => { setDetails(variantKey({ solutionId: details.solutionId, acquisition })) }}
          onClose={() => { setDetails(null) }}
        />
      )}
      {paramsOpen && evaluation.calcDefaults && (
        <CalcParamsPanel
          defaults={evaluation.calcDefaults}
          overrides={overrides}
          solutionName={focus?.solutionName ?? null}
          onClose={() => { setParamsOpen(false) }}
          onApply={(next) => {
            state.setCalcParams(next)
            setParamsOpen(false)
          }}
        />
      )}
    </>,
    lead,
    <MatchingRail
      project={project}
      recommendation={recommended && (
        <RecommendationCard
          variant={recommended}
          robot={data.robots.get(recommended.solutionId)}
          baseline={evaluation.baseline}
          budgetRub={budgetOf(data)}
          siteChecks={siteChecks}
          onDetails={() => { setDetails(variantKey(recommended)) }}
        />
      )}
      hasSelection={selected !== null}
      stale={state.stale}
      changedParams={canEdit && evaluation.calcDefaults ? Object.keys(overrides).length : null}
      onOpenParams={() => { setParamsOpen(true) }}
    />,
  )
}
