import type { ApiSchemas } from '@/api/contract'
import type { HttpClient } from '@/api/http'
import type { DashboardService } from '../dashboard'
import type { SessionService } from '../session'
import { PAGE_LIMIT } from './reference'

const SOURCE = 'ФЦ БАС'

const MISSING = 'нет в API'

/** Версии данных для блока «Версия данных» кабинета (ТЗ 3.1.5) — `GET /versions` и нормативы. */
export function apiSession(http: HttpClient): Partial<SessionService> {
  return {
    getDataVersion: async () => {
      const [versions, norms] = await Promise.all([
        http.get<ApiSchemas['VersionList']>('/versions').then((v) => v.items ?? []),
        http.get<ApiSchemas['NormSet']>('/norms'),
      ])
      const catalog = versions.find((v) => v.scope === 'catalog')
      return {
        source: SOURCE,
        catalog: catalog?.version == null ? MISSING : `v${String(catalog.version)}`,
        model: norms.version == null ? MISSING : String(norms.version),
        snapshotDate: catalog?.updatedAt?.slice(0, 10) ?? MISSING,
      }
    },
  }
}

/** Данные дашборда (PRD 8): стоимость ручной работы по локациям — из сводок `GET /locations`. */
export function apiDashboard(http: HttpClient): Partial<DashboardService> {
  return {
    getInputs: async () => {
      const locations = (await http.get<ApiSchemas['LocationPage']>('/locations', { limit: PAGE_LIMIT })).items ?? []
      return {
        laborCosts: locations.filter((l) => l.id).map((l) => ({ locationId: l.id ?? '', annualRub: l.summary?.laborCostRubYear ?? 0 })),
        // Реестра «Уточнения и проверки» в API нет (PRD 8.3): блок пуст, пока его не соберёт сервис.
        checks: { total: 0, preview: [] },
      }
    },
  }
}
