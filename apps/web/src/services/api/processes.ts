import type { ApiSchemas } from '@/api/contract'
import type { HttpClient } from '@/api/http'
import { processFromApi, processInput } from '@/api/mappers/process'
import { DEFAULT_MODEL_NORMS } from '@/domain'
import { PROCESS_TEMPLATE_DEFAULTS } from '@/mocks/fixtures/processTemplateDefaults'
import { requirementsOf } from '@/mocks/fixtures/processRequirements'
import { NotFoundError } from '../errors'
import type { ProcessService } from '../processes'
import type { Reference } from './reference'

/** Запас по ширине прохода из текущего справочника А5; нет норматива — значение PRD, 0,6 м. */
async function widthMarginM(http: HttpClient): Promise<number> {
  const set = await http.get<ApiSchemas['NormSet']>('/norms')
  const margin = (set.values ?? []).find((item) => item.code === 'width_margin_m')?.value
  return typeof margin === 'number' ? margin : DEFAULT_MODEL_NORMS.widthMarginM
}

/** Справочник процессов (PRD 9) — `GET/POST /processes`. Экраны работают с кодом PR-NNNN, API — с UUID. */
export function apiProcesses(http: HttpClient, reference: Reference): Partial<ProcessService> {
  const processByCode = async (code: string) => {
    const found = (await reference.processes()).find((item) => item.code === code)
    if (!found) throw new NotFoundError(`Процесс ${code} не найден`)
    return processFromApi(found)
  }
  return {
    listProcesses: async () => (await reference.processes()).map(processFromApi),
    getProcess: processByCode,
    createProcess: async (input) => {
      const created = await http.post<ApiSchemas['ProcessDetail']>('/processes', processInput(input, await reference.workTypeId(input.operationClass)))
      reference.invalidate('processes')
      return processFromApi(created)
    },
    // Коэффициенты и прочие поля формы 09а в API нет (PRD 15 · №22) — значения макета.
    // Запас по ширине — норматив `width_margin_m` из GET /norms, если он там есть.
    getTemplateDefaults: async () => ({ ...PROCESS_TEMPLATE_DEFAULTS, widthMarginM: await widthMarginM(http) }),
    // Списка требований в API нет (PRD 9.3, D-33): у «Перемещения паллет» — макет, у остальных — из полей процесса.
    getRequirements: async (code) => requirementsOf(await processByCode(code)),
    // Пример «Перемещение паллет · кросс-докинг» — текст макета, не ресурс API. Форма стартует без него.
    getDemoText: async () => ({ name: '', carrier: '', route: '' }),
  }
}
