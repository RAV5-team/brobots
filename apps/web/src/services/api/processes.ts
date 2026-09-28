import type { ApiSchemas } from '@/api/contract'
import type { HttpClient } from '@/api/http'
import { processFromApi, processInput } from '@/api/mappers/process'
import { NotFoundError } from '../errors'
import type { ProcessService } from '../processes'
import type { Reference } from './reference'

/** Справочник процессов (PRD 9) — `GET/POST /processes`. Экраны работают с кодом PR-NNNN, API — с UUID. */
export function apiProcesses(http: HttpClient, reference: Reference): Partial<ProcessService> {
  return {
    listProcesses: async () => (await reference.processes()).map(processFromApi),
    getProcess: async (code) => {
      const found = (await reference.processes()).find((p) => p.code === code)
      if (!found) throw new NotFoundError(`Процесс ${code} не найден`)
      return processFromApi(found)
    },
    createProcess: async (input) => {
      const created = await http.post<ApiSchemas['ProcessDetail']>('/processes', processInput(input, await reference.workTypeId(input.operationClass)))
      reference.invalidate('processes')
      return processFromApi(created)
    },
  }
}
