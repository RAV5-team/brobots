import type { ApiSchemas } from '@/api/contract'
import type { HttpClient } from '@/api/http'
import {
  facilityParameterFromApi,
  facilityTypeFromOption,
  locationFromApi,
  locationInput,
  parameterInputs,
  parametersFromApi,
  staffInputs,
  summaryFromApi,
} from '@/api/mappers/location'
import { locationProcessFromTask, taskPatch } from '@/api/mappers/process'
import type { FacilityType, Location } from '@/domain'
import type { LocationService } from '../locations'
import { PAGE_LIMIT, type Reference } from './reference'

/** Локации, параметры и процессы на площадке (PRD 10) — `/locations`, `/tasks`, `/facility-types`. */
export function apiLocations(http: HttpClient, reference: Reference): Partial<LocationService> {
  const page = () => http.get<ApiSchemas['LocationPage']>('/locations', { limit: PAGE_LIMIT }).then((p) => p.items ?? [])
  const parameters = (id: string) => http.get<ApiSchemas['LocationParameters']>(`/locations/${id}/parameters`).then(parametersFromApi)
  const withParameters = async (dto: ApiSchemas['Location']): Promise<Location> =>
    locationFromApi(dto, await parameters(idOf(dto)))
  const processOf = async (task: ApiSchemas['Task']) => (await reference.processes()).find((p) => p.id === task.processId)
  const toLocationProcess = async (task: ApiSchemas['Task']) => locationProcessFromTask(task, await processOf(task))

  return {
    listLocations: async () => (await page()).map((dto) => locationFromApi(dto)),
    getLocation: async (id) => withParameters(await http.get<ApiSchemas['Location']>(`/locations/${id}`)),
    createLocation: async (input) => withParameters(await http.post<ApiSchemas['Location']>('/locations', locationInput(input))),
    updateLocation: async (id, input) => {
      await http.patch<ApiSchemas['Location']>(`/locations/${id}`, {
        name: input.name, city: input.city, address: input.address, horizonYears: input.horizonYears,
        capexBudget: { amount: input.capexBudgetRub, currency: 'RUB' },
      })
      await http.put(`/locations/${id}/parameters`, { items: parameterInputs(input.parameters) })
      await http.put(`/locations/${id}/staff-groups`, { items: staffInputs(input.staffGroups) })
      return withParameters(await http.get<ApiSchemas['Location']>(`/locations/${id}`))
    },
    listLocationSummaries: async () => (await page()).map(summaryFromApi),
    listLocationProcesses: async (locationId) => {
      const tasks = (await http.get<ApiSchemas['TaskList']>(`/locations/${locationId}/tasks`)).items ?? []
      return Promise.all(tasks.filter((t) => !t.archivedAt).map(toLocationProcess))
    },
    addLocationProcess: async (locationId, processCode) => {
      const task = await http.post<ApiSchemas['Task']>(`/locations/${locationId}/tasks`, { processId: await reference.processId(processCode) })
      return toLocationProcess(task)
    },
    updateLocationProcess: async (id, update) => {
      const current = await http.get<ApiSchemas['Task']>(`/tasks/${id}`)
      const task = await http.patch<ApiSchemas['Task']>(`/tasks/${id}`, taskPatch(update, current.processName ?? current.name ?? ''))
      return toLocationProcess(task)
    },
    removeLocationProcess: async (id) => {
      await http.delete(`/tasks/${id}`)
    },
    listFacilityTypes: async () =>
      ((await reference.dictionaries()).facilityTypes ?? []).map(facilityTypeFromOption).filter((t): t is FacilityType => t !== null),
    listFacilityParameters: async (facilityType) =>
      ((await http.get<ApiSchemas['DefinitionList']>(`/facility-types/${facilityType}/parameters`)).items ?? []).map(facilityParameterFromApi),
  }
}

function idOf(dto: ApiSchemas['Location']): string {
  if (!dto.id) throw new Error('Location: в ответе API нет id')
  return dto.id
}
