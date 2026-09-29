import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { generatePath, useLocation, useNavigate, useSearchParams } from 'react-router'
import { ROUTE_PATHS, projectStepPath } from '@/app/routePaths'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Segmented } from '@/components/ui/Segmented'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { isReadOnly, newCostItems, type AcquisitionModel, type Project } from '@/domain'
import { downloadText, toCsv } from '@/shared/dom/download'
import { formatCount, formatDate } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { useModelNorms } from '@/shared/norms/useModelNorms'
import { NEW_PROJECT_PARAMS } from '@/components/newProject/newProjectModel'
import { missingOf } from '../params/paramsModel'
import { ProjectStepLayout } from '../ProjectStepLayout'
import { CashFlowCard } from './CashFlowCard'
import { ConditionsCard } from './ConditionsCard'
import { CostsCard } from './CostsCard'
import { EconomicsFooter, type FooterMode } from './EconomicsFooter'
import { hourlyCsv, tablesCsv } from './economicsCsv'
import { pathSteps } from './economicsPath'
import { chainRows, columnName, scenarioRows, sensitivityView } from './economicsTables'
import {
  acquisitionName,
  conclusionView,
  conditionsFor,
  fleetText,
  parseAcquisition,
  processFacts,
  shownScenario,
  simulationOutcome,
} from './economicsView'
import { PathCard } from './PathCard'
import { RecommendationCard } from './RecommendationCard'
import { ScenarioCompare } from './ScenarioCompare'
import { SensitivityCard } from './SensitivityCard'
import { useEconomicsStep, type EconomicsData, type EconomicsStepState } from './useEconomicsStep'
import type { ProjectStepProps } from '../stepProps'

const t = ru.project.economics
const YEARS = ru.project.matching.plural.years
const VIEW_PARAM = 'scenario'
/** Порядок сценариев — как в PRD 11.5 и на переключателе макета: покупка, затем RaaS. */
const ORDER: readonly AcquisitionModel[] = ['purchase', 'raas']

/** «Данные расчёта» (PRD 11.5): версии данных итога под шапкой, свёрнуто. */
function CalcData({ project, runId, criteria, scope }: { readonly project: Project; readonly runId: string | null; readonly criteria: number; readonly scope: string }) {
  const d = t.data
  const rows = [
    [d.snapshot, formatDate(project.versions.snapshotAt)],
    [d.catalog, d.catalogValue(project.versions.catalog, project.versions.model)],
    [d.run, runId ?? d.noRun],
    [d.criteria, d.criteriaValue(formatCount(criteria, ru.plural.criteria))],
  ] as const
  return (
    <Card as="section" padding={20} gap={8} aria-label={d.title}>
      <p className="type-body-sm text-text-secondary">{scope}</p>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-8 rounded-xs type-body-sm font-semibold text-text">
          {d.title}
          <ChevronDown aria-hidden size={16} className="transition-transform group-open:rotate-180" />
        </summary>
        <dl aria-label={d.caption} className="mt-12 grid grid-cols-2 gap-x-24 gap-y-8">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-16 border-b border-border py-4">
              <dt className="type-body-sm text-text-secondary">{label}</dt>
              <dd className="type-body-sm font-medium text-text">{value}</dd>
            </div>
          ))}
        </dl>
      </details>
    </Card>
  )
}

function footerMode(project: Project, isGuest: boolean): FooterMode {
  if (isGuest) return 'guest'
  return isReadOnly(project) ? 'saved' : 'draft'
}

/** «Новый расчёт на основе»: окно A2 на этой же странице с локацией, процессом и решением (D-84). */
function basedOnHref(project: Project, pathname: string): string {
  const params = new URLSearchParams({ [NEW_PROJECT_PARAMS.open]: '1', [NEW_PROJECT_PARAMS.location]: project.locationId })
  if (project.locationProcessId) params.set(NEW_PROJECT_PARAMS.locationProcess, project.locationProcessId)
  const solution = project.inputs.matching?.selection?.solutionId
  if (solution) params.set(NEW_PROJECT_PARAMS.solution, solution)
  return `${pathname}?${params.toString()}`
}

interface ReadyProps {
  readonly data: EconomicsData
  readonly state: EconomicsStepState
  readonly locationName: string
  readonly isGuest: boolean
  readonly view: AcquisitionModel
}

function EconomicsBody({ data, state, locationName, isGuest, view }: ReadyProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const norms = useModelNorms()
  const { economics, matching, snapshot, run } = data
  const { project, selected } = state
  const readOnly = isReadOnly(project)
  const canChoose = !readOnly
  const scenario = shownScenario(economics, project, view)
  const selectedScenario = shownScenario(economics, project, selected)
  if (!scenario || !selectedScenario) return <ErrorState title={t.loadError.title} message={t.loadError.message} onRetry={state.retry} />

  const scenarios = ORDER.flatMap((a) => { const s = shownScenario(economics, project, a); return s ? [s] : [] })
  const others = scenarios.filter((s) => s.acquisition !== view)
  const facts = processFacts(snapshot, project, (entry) => missingOf(entry, snapshot).length)
  const conditions = conditionsFor(economics.conditions, view)
  const outcome = simulationOutcome(project, run)
  const conclusion = conclusionView(scenario, conditions, outcome, run)
  const selectedConclusion = conclusionView(selectedScenario, conditionsFor(economics.conditions, selected), outcome, run)
  const rows = scenarioRows({ norms, economics, scenarios, facts, run, conditions: economics.conditions })
  const horizon = formatCount(economics.horizonYears, YEARS)
  const mode = footerMode(project, isGuest)

  // Черновик пользователя: при скачивании сохраняем текущую версию оценки (PRD 11.6).
  const withSave = (action: () => void) => {
    if (mode !== 'draft') {
      action()
      return
    }
    void state.save().then((saved) => { if (saved) action() })
  }
  const columns = [
    { key: 'current' as const, label: t.scenarios.current },
    ...scenarios.map((s) => ({ key: s.acquisition, label: columnName(s.acquisition, s) })),
  ]
  const downloadTables = () => {
    downloadText(t.csv.tablesFile(project.id), toCsv(tablesCsv(columns, rows, selectedScenario, conditionsFor(economics.conditions, selected))))
  }
  const downloadSimulation = () => {
    if (run) downloadText(t.csv.simulationFile(run.id), toCsv(hourlyCsv(run.hourlyAfter)))
  }
  const quote = isGuest ? null : {
    summary: {
      manufacturer: economics.manufacturer,
      solution: economics.solutionName,
      scenario: acquisitionName(selected),
      fleet: fleetText(selectedScenario.robots, selectedScenario.stations),
      location: `${locationName} · ${facts?.name ?? ''}`,
    },
    requestedAt: project.inputs.economics?.quoteRequestedAt ?? null,
    pending: state.pending === 'quote',
    onRequest: state.requestQuote,
  }

  return (
    <>
      <CalcData project={project} runId={run?.id ?? null} criteria={matching.variants.find((v) => v.criteria.length > 0)?.criteria.length ?? 0} scope={t.scope(facts?.name ?? '', locationName)} />
      <RecommendationCard economics={economics} scenario={scenario} selected={selected} conclusion={conclusion} canChoose={canChoose} onChoose={state.choose} />
      <PathCard projectId={project.id} steps={pathSteps(locationName, facts, matching, scenario, project, run)} />
      <ScenarioCompare
        scenarios={scenarios}
        rows={rows}
        lead={t.scenarios.lead(facts?.volume ?? '—', String(facts?.hoursPerDay ?? '—'), horizon)}
        selected={selected}
        canChoose={canChoose}
        onChoose={state.choose}
      />
      <CostsCard scenario={scenario} solutionName={economics.solutionName} chain={chainRows(scenario, economics, facts, newCostItems(scenario), norms)} laborSavingsRub={scenario.laborSavingsRubPerYear ?? 0} />
      <CashFlowCard scenario={scenario} horizonYears={economics.horizonYears} />
      <SensitivityCard acquisition={view} rows={sensitivityView(scenario, others, economics, facts, norms)} />
      <ConditionsCard rows={conditions} solution={`${economics.solutionName} · ${acquisitionName(view)}`} />
      <EconomicsFooter
        mode={mode}
        summary={t.footer.summary(`${economics.solutionName} · ${acquisitionName(selected)}`, selectedConclusion.title)}
        savedAt={project.status === 'saved' ? project.savedAt : null}
        saving={state.pending === 'save'}
        error={state.error}
        hasRun={run !== null}
        basedOnTo={basedOnHref(project, pathname)}
        onSave={() => { void state.save() }}
        onTables={() => { withSave(downloadTables) }}
        onSimulation={() => { withSave(downloadSimulation) }}
        onReport={() => { withSave(() => { void navigate(generatePath(ROUTE_PATHS.projectReport, { projectId: project.id })) }) }}
        quote={quote}
      />
    </>
  )
}

/**
 * Шаг 4 «Итог и экономика» (PRD 11.5, 11.6; экран 08, 16197:2005; 08a — сценарий «покупка»; 08b — КП запрошено).
 * Переключатель в шапке показывает сценарий (`?scenario=`), выбирает его — только «Выбрать этот сценарий» (D-106).
 * Сохранённая оценка — тот же экран только для просмотра (D-17), выбранный сценарий — из снимка (D-81).
 */
export function EconomicsStep({ project: initial, locationName, isGuest }: ProjectStepProps) {
  const readOnly = isReadOnly(initial)
  const state = useEconomicsStep(initial, !readOnly)
  const { project, load, selected } = state
  const [params, setParams] = useSearchParams()
  const view = parseAcquisition(params.get(VIEW_PARAM)) ?? selected
  const setView = (next: AcquisitionModel) => {
    setParams((current) => {
      const updated = new URLSearchParams(current)
      updated.set(VIEW_PARAM, next)
      return updated
    }, { replace: true })
  }
  const economicsReady = load.status === 'ready' ? load.data : null
  const facts = economicsReady ? processFacts(economicsReady.snapshot, project, () => 0) : null
  const lead = economicsReady
    ? t.lead(facts?.name ?? '', locationName, formatDate((project.status === 'saved' ? project.savedAt : project.updatedAt).slice(0, 10)), formatCount(economicsReady.economics.horizonYears, YEARS))
    : undefined
  const available = ORDER.filter((a) => economicsReady?.economics.scenarios.some((s) => s.acquisition === a))
  const layout = (body: ReactNode) => (
    <ProjectStepLayout
      project={project}
      locationName={locationName}
      step="economics"
      isGuest={isGuest}
      title={t.title}
      overline={t.overline(locationName, facts?.name ?? '')}
      lead={lead}
      actions={available.length > 1 && (
        <Segmented
          label={t.viewLabel}
          size={44}
          fit="content"
          value={view}
          onChange={setView}
          options={available.map((a) => ({ value: a, label: acquisitionName(a) }))}
        />
      )}
    >
      {body}
    </ProjectStepLayout>
  )

  if (load.status === 'loading') return layout(<div aria-busy="true"><Skeleton className="h-(--rav-location-card-height)" /></div>)
  if (load.status === 'error') return layout(<ErrorState title={t.loadError.title} message={t.loadError.message} onRetry={state.retry} />)
  if (load.status === 'noSelection') {
    return layout(
      <EmptyState
        title={t.noSelection.title}
        description={t.noSelection.description}
        action={<ButtonLink to={projectStepPath(project.id, 'matching')}>{t.noSelection.action}</ButtonLink>}
      />,
    )
  }
  return layout(<EconomicsBody data={load.data} state={state} locationName={locationName} isGuest={isGuest} view={view} />)
}
