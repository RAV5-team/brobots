import { ArrowLeft, RefreshCw } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { projectStepPath } from '@/app/routePaths'
import { Button, ButtonLink } from '@/components/ui/Button'
import { StatusBanner } from '@/components/ui/StatusBanner'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { COMPARE_LIMIT, isReadOnly, type Project } from '@/domain'
import { numberParameter } from '@/pages/processes/locationStaffing'
import { formatTime } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { ProjectStepLayout } from '../ProjectStepLayout'
import { paramsView } from '../params/paramsModel'
import { HowCalculatedPanel } from './HowCalculatedPanel'
import { demandOf } from './howCalculatedModel'
import { BaselineCompare } from './BaselineCompare'
import { CalcParamsPanel } from './CalcParamsPanel'
import { CompareSection } from './CompareSection'
import type { CompareEntry } from './compareModel'
import { ConditionsBlock } from './ConditionsBlock'
import { ExcludedBlock } from './ExcludedBlock'
import { ManualBlock } from './ManualBlock'
import { MatchingRail } from './MatchingRail'
import { effectiveOverrides, findVariant, manualEntries, recommendedVariant, scenariosOf, variantKey } from './matchingModel'
import { RankingBlock } from './RankingBlock'
import { RecommendationCard } from './RecommendationCard'
import { useMatchingStep, type MatchingData, type MatchingStepState } from './useMatchingStep'
import type { ProjectStepProps } from '../stepProps'

const t = ru.project.matching

type Panel = 'hint' | 'params' | null

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

/** Проверки площадки шага 1 (D-91): параметры без данных, которые сверяются с роботом, — «требует проверки». */
function siteChecksOf(data: MatchingData, project: Project): readonly string[] {
  const view = paramsView(data.snapshot, project.locationProcessId, project.inputs.params.assumptions)
  return view.missing.filter((m) => m.impact === 'needs_check').map((m) => m.label)
}

const MILLION = 1_000_000

/** Бюджет CAPEX локации (`wh_capex_budget` и аналоги, млн ₽) — подпись плитки CAPEX. */
function budgetOf({ snapshot }: MatchingData): number | null {
  const code = snapshot.facilityParameters.find((p) => p.code.endsWith('_capex_budget'))?.code ?? null
  const millions = numberParameter(snapshot.location, snapshot.facilityParameters, code)
  return millions === null ? null : millions * MILLION
}

/**
 * Шаг 2 «Подбор решения» (экран 03, 16197:713; PRD 11.3). Гость проходит путь без сохранения (D-14),
 * сохранённая оценка — только просмотр (D-17). Правка «Параметров расчёта» — подбор устарел до пересчёта (D-89).
 */
export function MatchingStep({ project: initial, locationName, isGuest }: ProjectStepProps) {
  const readOnly = isReadOnly(initial)
  const state = useMatchingStep(initial, !isGuest && !readOnly)
  const { project, draft, load } = state
  const [panel, setPanel] = useState<Panel>(null)
  const [compareKeys, setCompareKeys] = useState<readonly string[] | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)

  const layout = (body: ReactNode, rail?: ReactNode) => (
    <ProjectStepLayout
      project={project}
      locationName={locationName}
      step="matching"
      isGuest={isGuest}
      title={t.title}
      lead={t.lead}
      actions={<ButtonLink to={projectStepPath(project.id, 'params')}><ArrowLeft aria-hidden size={16} />{t.back}</ButtonLink>}
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
  const operationClass = evaluation.conditions.find((c) => c.code === 'work_type')?.text ?? null

  const compareEntries: readonly CompareEntry[] = [
    ...evaluation.variants
      .filter((v) => compareKeys?.includes(variantKey(v)))
      .map((v) => ({ key: variantKey(v), name: t.variantName(v.solutionName, t.acquisition[v.acquisition]), variant: v, robot: data.robots.get(v.solutionId) ?? null, violations: null })),
    ...manual.map((e) => ({ key: e.solutionId, name: e.solutionName, variant: null, robot: data.robots.get(e.solutionId) ?? null, violations: e.reasons })),
  ]
  const closeCompare = () => { setCompareOpen(false); setCompareKeys(null) }

  const saveNote = isGuest
    ? { text: t.rail.save.guest, isError: false }
    : readOnly
      ? { text: t.rail.save.readOnly, isError: false }
      : state.saveError
        ? { text: state.saveError, isError: true }
        : state.savedAt
          ? { text: t.rail.save.saved(formatTime(state.savedAt)), isError: false }
          : null

  return layout(
    <>
      {state.stale && <StaleNotice state={state} />}
      <ConditionsBlock evaluation={evaluation} paramsPath={projectStepPath(project.id, 'params')} />
      {recommended && (
        <RecommendationCard
          variant={recommended}
          robot={data.robots.get(recommended.solutionId)}
          operationClass={operationClass}
          baseline={evaluation.baseline}
          budgetRub={budgetOf(data)}
          siteChecks={siteChecks}
          selected={selected === recommended}
          canSelect={canEdit}
          onSelect={() => { state.select({ solutionId: recommended.solutionId, acquisition: recommended.acquisition }) }}
          onHowRanked={() => { setPanel('hint') }}
        />
      )}
      <RankingBlock
        variants={evaluation.variants}
        robots={data.robots}
        selection={draft.selection}
        canSelect={canEdit}
        onSelect={state.select}
        onHowRanked={() => { setPanel('hint') }}
        compareKeys={compareKeys}
        manualCount={manual.length}
        onCompareKeys={(keys) => {
          setCompareKeys(keys)
          if (keys === null) setCompareOpen(false)
        }}
        onOpenCompare={() => { setCompareOpen(true) }}
      />
      {compareOpen && compareEntries.length >= 2 && (
        <CompareSection entries={compareEntries} handlingMethods={data.snapshot.handlingMethods} siteUnchecked={siteChecks.length} onClose={closeCompare} />
      )}
      <ManualBlock entries={manual} canEdit={canEdit} onRemove={state.removeManual} />
      <ExcludedBlock
        excluded={evaluation.excluded}
        robots={data.robots}
        manualIds={draft.manualSolutionIds}
        canEdit={canEdit}
        compareFull={(compareKeys?.length ?? 0) + manual.length >= COMPARE_LIMIT}
        onAdd={(id) => {
          state.addManual(id)
          // Добавленное вручную сразу идёт в сравнение (PRD 11.3): включаем режим выбора.
          setCompareKeys((keys) => keys ?? [])
        }}
      />
      {focus && evaluation.baseline && (
        <BaselineCompare baseline={evaluation.baseline} scenarios={scenariosOf(evaluation, focus.solutionId)} horizonYears={overrides.horizonYears ?? evaluation.horizonYears} />
      )}
      {panel === 'hint' && focus && (
        <HowCalculatedPanel
          variant={focus}
          {...demandOf(data.snapshot, data.evaluation, project)}
          params={evaluation.calcDefaults}
          baseline={evaluation.baseline}
          paramsChanged={Object.keys(overrides).length > 0}
          onClose={() => { setPanel(null) }}
        />
      )}
      {panel === 'params' && evaluation.calcDefaults && (
        <CalcParamsPanel
          defaults={evaluation.calcDefaults}
          overrides={overrides}
          solutionName={focus?.solutionName ?? null}
          onClose={() => { setPanel(null) }}
          onApply={(next) => {
            state.setCalcParams(next)
            setPanel(null)
          }}
        />
      )}
    </>,
    <MatchingRail
      project={project}
      selected={selected}
      stale={state.stale}
      siteChecks={siteChecks}
      changedParams={canEdit && evaluation.calcDefaults ? Object.keys(overrides).length : null}
      onOpenParams={() => { setPanel('params') }}
      saveNote={saveNote}
    />,
  )
}
