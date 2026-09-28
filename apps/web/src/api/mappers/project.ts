import type { LocationId, LocationProcessId, Project, ProjectId, ProjectInputs, ProjectResultSnapshot, ProjectStep } from '@/domain'
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

/** Проект API → проект экрана. id проекта, локации и процесса передаются как есть (в API — UUID). */
export function toProject(dto: ApiSchemas['Project'], local: ProjectLocalState): Project {
  const versions = required(dto, 'versions', ENTITY)
  const base = {
    id: required(dto, 'id', ENTITY) as ProjectId,
    name: required(dto, 'name', ENTITY),
    locationId: required(dto, 'locationId', ENTITY) as LocationId,
    versions: {
      snapshotAt: required(dto, 'snapshotTakenAt', ENTITY).slice(0, 10),
      catalog: required(versions, 'catalog', `${ENTITY}.versions`),
      model: required(versions, 'model', `${ENTITY}.versions`),
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
      locationProcessId: processId as LocationProcessId | null,
      step: local.step,
      ...(dto.pinnedSolutionId ? { pinnedSolutionId: dto.pinnedSolutionId } : {}),
    }
  }
  if (!local.result) throw new ContractError(`${ENTITY} ${base.id}: у сохранённой оценки нет снимка результата`)
  return {
    ...base,
    status,
    locationProcessId: required(required(dto, 'task', ENTITY), 'id', `${ENTITY}.task`) as LocationProcessId,
    savedAt: required(dto, 'savedAt', ENTITY),
    result: local.result,
  }
}
