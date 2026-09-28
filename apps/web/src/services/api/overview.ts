import type { ApiSchemas } from '@/api/contract'
import type { HttpClient } from '@/api/http'
import type { DashboardService } from '../dashboard'
import type { SessionService } from '../session'
import { PAGE_LIMIT } from './reference'

const SOURCE = 'ФЦ БАС'

/** Версии данных для блока «Версия данных» кабинета (ТЗ 3.1.5) — `GET /versions` и нормативы. */
export function apiSession(http: HttpClient, fallback: SessionService): Partial<SessionService> {
  return {
    getDataVersion: async () => {
      const [versions, norms, base] = await Promise.all([
        http.get<ApiSchemas['VersionList']>('/versions').then((v) => v.items ?? []),
        http.get<ApiSchemas['NormSet']>('/norms'),
        fallback.getDataVersion(),
      ])
      const catalog = versions.find((v) => v.scope === 'catalog')
      return {
        source: SOURCE,
        catalog: catalog?.version == null ? base.catalog : `v${String(catalog.version)}`,
        model: norms.version == null ? base.model : String(norms.version),
        snapshotDate: catalog?.updatedAt?.slice(0, 10) ?? base.snapshotDate,
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
