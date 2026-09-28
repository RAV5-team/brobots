import { ArrowLeft } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { projectStepPath } from '@/app/routePaths'
import { ButtonLink } from '@/components/ui/Button'
import { StatusBanner } from '@/components/ui/StatusBanner'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { Stepper } from '@/components/ui/Stepper'
import { TabNav } from '@/components/ui/TabNav'
import { SIMULATION_STAGES, isReadOnly, type Fleet, type SimulationRequest, type SimulationStage } from '@/domain'
import { formatTime } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { useModelNorms } from '@/shared/norms/useModelNorms'
import { ProjectStepLayout } from '../ProjectStepLayout'
import { demandOf } from '../matching/howCalculatedModel'
import { findVariant } from '../matching/matchingModel'
import { ConditionsStage } from './ConditionsStage'
import { RunStage } from './RunStage'
import { ChartsStage } from './charts/ChartsStage'
import { CONDITION_DEFAULTS, conditionBases } from './conditionsModel'
import { ScopeStage } from './ScopeStage'
import {
  calcRows,
  fleetToStore,
  isSimulationStage,
  isStageLinkable,
  matchingFleet,
  stageState,
} from './simulationModel'
import { useSimulationStep, type SimulationStepState } from './useSimulationStep'
import { useVerdictRun } from './useVerdictRun'
import { planOf } from './verdictModel'
import { VerdictStage } from './VerdictStage'
import type { ProjectStepProps } from '../stepProps'

const t = ru.project.simulation

/** Адрес этапа с сохранением остальных параметров (`?as=` в dev-сборке); вкладка вердикта — только у этапа 4. */
function withStage(params: URLSearchParams, stage: SimulationStage): URLSearchParams {
  const next = new URLSearchParams(params)
  next.set('stage', stage)
  next.delete('tab')
  return next
}

/** Вкладки вердикта (PRD 11.4): «Вердикт и действия» и «Графики и 2D-сравнение» — у каждой свой адрес. */
type VerdictTab = 'verdict' | 'charts'
function withTab(params: URLSearchParams, tab: VerdictTab): URLSearchParams {
  const next = withStage(params, 'verdict')
  if (tab === 'charts') next.set('tab', tab)
  return next
}

function saveNoteOf(state: SimulationStepState, isGuest: boolean, readOnly: boolean): { readonly text: string; readonly isError: boolean } | null {
  if (isGuest) return { text: t.save.guest, isError: false }
  if (readOnly) return { text: t.save.readOnly, isError: false }
  if (state.saveError) return { text: state.saveError, isError: true }
  if (state.savedAt) return { text: t.save.saved(formatTime(state.savedAt)), isError: false }
  return null
}

/** Плашка D-89: после прогона изменились состав или условия — вердикт посчитан по прежним (D-102). */
function StaleRunNotice({ runId }: { readonly runId: string }) {
  const n = t.conditions.stale
  return (
    <StatusBanner variant="accent" title={n.title} description={n.description(runId)} />
  )
}

/**
 * Шаг 3 «Симуляция» (PRD 11.4): четыре этапа на одном адресе, этап — в `?stage=` (D-101). Без параметра — этап,
 * где остановились, а пока идёт прогон — «Прогон» (D-103). Этапы — экраны 04–07; вкладка графиков вердикта — 07a (заглушка).
 */
export function SimulationStep({ project: initial, locationName, isGuest }: ProjectStepProps) {
  const readOnly = isReadOnly(initial)
  const state = useSimulationStep(initial, !isGuest && !readOnly)
  const norms = useModelNorms()
  const { project, inputs, load } = state
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const requested = params.get('stage')
  const fallback: SimulationStage = state.run?.status === 'running' ? 'run' : inputs?.stage ?? 'scope'
  const stage: SimulationStage = isSimulationStage(requested) ? requested : fallback
  // Вернулись к идущему прогону без ?stage: закрепляем этап в адресе, иначе по завершении откроется вердикт из черновика.
  const pinRun = !isSimulationStage(requested) && fallback === 'run'
  useEffect(() => {
    if (pinRun) setParams((current) => withStage(current, 'run'), { replace: true })
  }, [pinRun, setParams])

  const verdictRun = useVerdictRun(inputs?.runId ?? null, stage === 'verdict')

  const openStage = (next: SimulationStage) => {
    state.reachStage(next)
    setParams((current) => withStage(current, next))
  }

  const stages = SIMULATION_STAGES.map((s) => {
    const stepState = stageState(s, stage, inputs)
    return {
      key: s,
      label: t.stages[s],
      state: stepState,
      ...(isStageLinkable(s) ? { to: `?${withStage(params, s).toString()}` } : {}),
    }
  })
  const saveNote = saveNoteOf(state, isGuest, readOnly)

  const layout = (title: string, body: ReactNode, lead?: string) => (
    <ProjectStepLayout
      project={project}
      locationName={locationName}
      step="simulation"
      isGuest={isGuest}
      title={title}
      overline={t.overline(SIMULATION_STAGES.indexOf(stage) + 1, SIMULATION_STAGES.length)}
      lead={lead}
      aboveTitle={<Stepper variant="segments" label={t.stagesNav} steps={stages} />}
      actions={<ButtonLink to={projectStepPath(project.id, 'matching')}><ArrowLeft aria-hidden size={16} />{t.back}</ButtonLink>}
    >
      {state.stale && inputs?.runId && <StaleRunNotice runId={inputs.runId} />}
      {body}
      {saveNote && <p role={saveNote.isError ? 'alert' : 'status'} className={saveNote.isError ? 'type-caption text-danger' : 'type-caption text-text-secondary'}>{saveNote.text}</p>}
      <p className="type-caption text-text-muted">{t.disclaimer}</p>
    </ProjectStepLayout>
  )

  const heading = { scope: t.scope, conditions: t.conditions, run: t.run, verdict: t.verdict }[stage]

  // Идущий прогон не ждёт загрузки данных шага: они нужны только для нового запуска.
  const runStage = (onStart: (() => void) | undefined) => layout(heading.title, (
    <RunStage
      progress={state.run}
      lastRunId={inputs?.runId ?? null}
      stale={state.stale}
      readOnly={readOnly}
      verdictTo={`?${withStage(params, 'verdict').toString()}`}
      onStart={onStart}
      onStop={() => {
        state.stopRun()
        openStage('conditions')
      }}
      onConditions={() => { openStage('conditions') }}
    />
  ), heading.lead)
  if (stage === 'run' && state.run !== null && load.status !== 'ready') return runStage(undefined)
  if (load.status === 'loading') return layout(heading.title, <div aria-busy="true"><Skeleton className="h-(--rav-location-card-height)" /></div>, heading.lead)
  if (load.status === 'error') return layout(heading.title, <ErrorState title={t.loadError.title} message={t.loadError.message} onRetry={state.retry} />, heading.lead)

  const { evaluation, snapshot, robot } = load.data
  const selection = project.inputs.matching?.selection ?? null
  const variant = selection ? findVariant(evaluation, selection.solutionId, selection.acquisition) : null
  if (!variant) {
    return layout(heading.title, (
      <EmptyState
        title={t.noSelection.title}
        description={t.noSelection.description}
        action={<ButtonLink to={projectStepPath(project.id, 'matching')}>{t.noSelection.action}</ButtonLink>}
      />
    ), heading.lead)
  }

  const { demand } = demandOf(snapshot, evaluation, project)
  const fromMatching = matchingFleet(variant)
  const fleet = inputs?.fleet ?? fromMatching
  const request: SimulationRequest = { fleet, conditions: inputs?.conditions ?? {} }
  const run = () => {
    state.startRun(request)
    openStage('run')
  }
  if (stage === 'run') return runStage(readOnly ? undefined : run)
  if (stage === 'verdict') {
    const v = t.verdict
    const tab: VerdictTab = params.get('tab') === 'charts' ? 'charts' : 'verdict'
    const tabs = (['verdict', 'charts'] as const).map((key) => ({ to: `?${withTab(params, key).toString()}`, label: v.tabs[key] }))
    // У вкладки графиков свой заголовок и подзаголовок (07a, 16198:75).
    const tabHeading = tab === 'charts' ? t.charts : v
    const verdictLayout = (body: ReactNode) => layout(tabHeading.title, (
      <>
        <TabNav label={v.tabsLabel} items={tabs} activeTo={`?${withTab(params, tab).toString()}`} />
        {body}
      </>
    ), tabHeading.lead)
    const runLoad = verdictRun.load
    if (runLoad.status === 'none') {
      return verdictLayout(
        <EmptyState
          title={v.noRun.title}
          description={v.noRun.description}
          action={<ButtonLink to={`?${withStage(params, 'run').toString()}`}>{v.noRun.action}</ButtonLink>}
        />,
      )
    }
    if (runLoad.status === 'loading') return verdictLayout(<div aria-busy="true"><Skeleton className="h-(--rav-location-card-height)" /></div>)
    if (runLoad.status === 'error') return verdictLayout(<ErrorState title={v.runError.title} message={v.runError.message} onRetry={verdictRun.retry} />)
    const verdictProps = {
      run: runLoad.run,
      variant,
      fromMatching,
      plan: planOf(inputs?.plan ?? null, runLoad.run),
      acceptRisk: inputs?.acceptRisk ?? false,
      canEdit: !readOnly,
      onVerdict: state.setVerdict,
      onAccept: async () => {
        await state.commitVerdict()
        await navigate(projectStepPath(project.id, 'economics'))
      },
      onRerun: (next: Fleet) => {
        state.setFleet(fleetToStore(next, fromMatching))
        state.startRun({ fleet: next, conditions: inputs?.conditions ?? {} })
        openStage('run')
      },
      conditionsTo: `?${withStage(params, 'conditions').toString()}`,
      matchingTo: projectStepPath(project.id, 'matching'),
    }
    if (tab === 'charts') {
      const targets = {
        onTimeTarget: inputs?.conditions.onTimeTarget ?? CONDITION_DEFAULTS.onTimeTarget,
        maxWaitMin: inputs?.conditions.maxWaitMin ?? CONDITION_DEFAULTS.maxWaitMin,
      }
      return verdictLayout(<ChartsStage {...verdictProps} targets={targets} />)
    }
    return verdictLayout(<VerdictStage {...verdictProps} />)
  }
  if (stage === 'conditions') {
    const calcHours = evaluation.calcDefaults?.workHoursPerDay ?? demand?.hours ?? 24
    const base = conditionBases({ snapshot, project, robot, calcHours, tolerance: norms.simulationTolerance }, project.inputs.params.assumptions)
    if (!base) return layout(heading.title, <ErrorState title={t.loadError.title} message={t.loadError.message} onRetry={state.retry} />, heading.lead)
    return layout(heading.title, (
      <ConditionsStage
        bases={base.bases}
        handlingName={base.handlingName}
        overrides={inputs?.conditions ?? {}}
        calcPeak={demand?.perHour ?? null}
        canEdit={!readOnly}
        onChange={state.setConditions}
        onBack={() => { openStage('scope') }}
        onRun={run}
      />
    ), heading.lead)
  }

  return layout(t.scope.title, (
    <ScopeStage
      variant={variant}
      calc={calcRows(variant, demand, evaluation.calcDefaults)}
      tolerance={inputs?.conditions.tolerance ?? norms.simulationTolerance}
      fleet={fleet}
      fromMatching={fromMatching}
      canEdit={!readOnly}
      onFleet={(next) => { state.setFleet(fleetToStore(next, fromMatching)) }}
      onNext={() => { openStage('conditions') }}
    />
  ), t.scope.lead)
}
