import type { ApiSchemas } from '@/api/contract'
import type { HttpClient } from '@/api/http'
import { dataSourceFromApi, dataSourceInput, normFromApi, normValueToApi } from '@/api/mappers/admin'
import { canAutoRefresh, type Norm } from '@/domain'
import type { AdminService } from '../admin'
import { NotFoundError, ValidationError } from '../errors'

const FILE_REFRESH = 'Автообновление доступно только для источника по ссылке — файл обновляется загрузкой нового'
const today = (): string => new Date().toISOString().slice(0, 10)

/**
 * Администрирование на services/api: источники данных (А6, А7) и нормативы (А5, `POST /norm-sets` — новая версия).
 * Проверки ссылки и опроса каталога в API нет (D-52, A1а) — они остаются у запасной реализации.
 */
export function apiAdmin(http: HttpClient): Partial<AdminService> {
  const listNorms = async (): Promise<readonly Norm[]> =>
    ((await http.get<ApiSchemas['NormSet']>('/norms')).values ?? []).map(normFromApi).filter((n): n is Norm => n !== null)

  return {
    listDataSources: async () => ((await http.get<ApiSchemas['DataSourceList']>('/data-sources')).items ?? []).map(dataSourceFromApi),
    createDataSource: async (input) => {
      if (input.refresh !== 'manual' && !canAutoRefresh(input)) throw new ValidationError({ kind: 'refreshNeedsUrl' }, FILE_REFRESH)
      return dataSourceFromApi(await http.post<ApiSchemas['DataSource']>('/data-sources', dataSourceInput(input)))
    },
    updateDataSource: async (key, patch) =>
      dataSourceFromApi(await http.patch<ApiSchemas['DataSource']>(`/data-sources/${key}`, { refreshSchedule: patch.refresh })),
    refreshDataSource: async (key) =>
      dataSourceFromApi(await http.patch<ApiSchemas['DataSource']>(`/data-sources/${key}`, { actualizedOn: today() })),
    listNorms,
    saveNorms: async (changes) => {
      const norms = await listNorms()
      const values = changes.map((change) => {
        const norm = norms.find((n) => n.code === change.code)
        if (!norm) throw new NotFoundError(`Норматив ${change.code} не найден`)
        return { code: change.code, value: normValueToApi(norm, change.value) }
      })
      await http.post('/norm-sets', { values } satisfies ApiSchemas['NormSetInput'])
      return listNorms()
    },
  }
}
