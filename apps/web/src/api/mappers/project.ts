import { emptyInputs, PROJECT_STEPS, type AcquisitionModel, type Project, type ProjectInputs, type ProjectResultSnapshot, type ProjectStep } from '@/domain'
import { ContractError, oneOf, optional, required, type ApiSchemas } from '../contract'

/**
 * Чего нет в ответе `GET /projects/{id}`, но нужно экранам: шаг черновика, решения по шагам, снимок результата.
 * Пока API этого не отдаёт, мок хранит рядом (вопросы — apps/web/docs/api-contract.md).
 */
export interface ProjectLocalState {
  readonly step: ProjectStep
  readonly inputs: ProjectInputs
  readonly result: ProjectResultSnapshot | null
}

const ENTITY = 'Project'

function isInputs(value: unknown): value is ProjectInputs {
  return typeof value === 'object' && value !== null && 'params' in value && 'stale' in value
}

/**
 * Состояние проекта из ответа API: шаг, решения по шагам (`inputs` — модель экрана как есть) и снимок результата
 * (`resultSummary`). Запрос КП пишется в проект сервисом (`quoteRequestedAt`) и виден и у сохранённой оценки.
 */
export function localStateFromApi(dto: ApiSchemas['Project']): ProjectLocalState {
  const at = dto.updatedAt ?? dto.createdAt ?? new Date().toISOString()
  const stored = isInputs(dto.inputs) ? dto.inputs : emptyInputs(at)
  const quoteRequestedAt = optional(dto.quoteRequestedAt)
  const scenario = stored.economics?.scenario
    ?? (dto.resultSummary?.acquisitionModel ?? dto.selection?.acquisitionModel ?? 'raas') as AcquisitionModel
  const inputs = quoteRequestedAt ? { ...stored, economics: { ...stored.economics, scenario, quoteRequestedAt } } : stored
  const summary = dto.resultSummary
  return {
    step: oneOf(dto.step ?? 'params', PROJECT_STEPS, `${ENTITY}.step`),
    inputs,
    result: summary
      ? { capexRub: summary.capexRub, opexRubPerYear: summary.opexYearRub, paybackYears: summary.paybackYears ?? 0, annualEffectRub: summary.netEffectYearRub }
      : null,
  }
}

/** Проект API → проект экрана. id проекта, локации и процесса передаются как есть (в API — UUID). */
export function toProject(dto: ApiSchemas['Project'], local: ProjectLocalState): Project {
  const versions = required(dto, 'versions', ENTITY)
  const base = {
    id: required(dto, 'id', ENTITY),
    name: required(dto, 'name', ENTITY),
    locationId: required(dto, 'locationId', ENTITY),
    versions: {
      snapshotAt: required(dto, 'snapshotTakenAt', ENTITY).slice(0, 10),
      catalog: required(versions, 'catalog', `${ENTITY}.versions`),
      // Ядро закрепляется при сохранении; у черновика — версия последнего расчёта, до расчёта — пусто.
      model: optional(versions.model) ?? dto.latestEvaluation?.modelVersion ?? '',
      norms: optional(versions.norms),
    },
    inputs: local.inputs,
    updatedAt: required(dto, 'updatedAt', ENTITY),
  }
  const status = oneOf(required(dto, 'status', ENTITY), ['draft', 'saved'], `${ENTITY}.status`)

  if (status === 'draft') {
    const processId = optional(dto.task?.id)
    return {
      ...base,
      status,
      locationProcessId: processId,
      step: local.step,
      ...(dto.pinnedSolutionId ? { pinnedSolutionId: dto.pinnedSolutionId } : {}),
    }
  }
  if (!local.result) throw new ContractError(`${ENTITY} ${base.id}: у сохранённой оценки нет снимка результата`)
  return {
    ...base,
    status,
    locationProcessId: required(required(dto, 'task', ENTITY), 'id', `${ENTITY}.task`),
    savedAt: required(dto, 'savedAt', ENTITY),
    result: local.result,
  }
}
