import type { ApiSchemas } from '@/api/contract'
import type { HttpClient } from '@/api/http'

/** Самый большой список API за один запрос (services/api, paginate). */
export const PAGE_LIMIT = 500

/**
 * Справочники API, нужные нескольким сервисам: классы операций (код ↔ UUID), словари, процессы.
 * Меняются редко — один запрос на сессию, сброс после записи.
 */
export interface Reference {
  workTypes(): Promise<readonly ApiSchemas['WorkType'][]>
  dictionaries(): Promise<Readonly<Record<string, readonly ApiSchemas['Option'][]>>>
  processes(): Promise<readonly ApiSchemas['Process'][]>
  /** UUID класса операции по коду OP-NN. */
  workTypeId(code: string): Promise<string>
  /** UUID процесса по коду PR-NNNN. */
  processId(code: string): Promise<string>
  invalidate(key: 'workTypes' | 'processes'): void
}

export function createReference(http: HttpClient): Reference {
  let workTypes: Promise<readonly ApiSchemas['WorkType'][]> | null = null
  let dictionaries: Promise<Readonly<Record<string, readonly ApiSchemas['Option'][]>>> | null = null
  let processes: Promise<readonly ApiSchemas['Process'][]> | null = null

  // Неудачный запрос не кэшируется: следующий вызов повторит его.
  const remember = <T>(load: () => Promise<T>, forget: () => void): Promise<T> =>
    load().catch((error: unknown) => {
      forget()
      throw error
    })

  const reference: Reference = {
    workTypes: () => {
      workTypes ??= remember(
        () => http.get<ApiSchemas['WorkTypeList']>('/work-types').then((list) => list.items ?? []),
        () => { workTypes = null },
      )
      return workTypes
    },
    dictionaries: () => {
      dictionaries ??= remember(
        () => http.get<ApiSchemas['Dictionaries']>('/dictionaries').then((d) => d ?? {}),
        () => { dictionaries = null },
      )
      return dictionaries
    },
    processes: () => {
      processes ??= remember(
        () => http.get<ApiSchemas['ProcessList']>('/processes').then((list) => list.items ?? []),
        () => { processes = null },
      )
      return processes
    },
    workTypeId: async (code) => {
      const found = (await reference.workTypes()).find((w) => w.code === code)
      if (!found?.id) throw new Error(`Класс операции ${code} не найден в справочнике`)
      return found.id
    },
    processId: async (code) => {
      const found = (await reference.processes()).find((p) => p.code === code)
      if (!found?.id) throw new Error(`Процесс ${code} не найден в справочнике`)
      return found.id
    },
    invalidate: (key) => {
      if (key === 'workTypes') workTypes = null
      else processes = null
    },
  }
  return reference
}
