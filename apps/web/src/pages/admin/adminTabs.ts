import { ROUTE_PATHS } from '@/app/routePaths'
import type { TabNavItem } from '@/components/ui/TabNav'
import { ru } from '@/shared/i18n/ru'

const t = ru.admin

export type AdminTab = keyof typeof t.tabs

// Порядок вкладок — PRD 6.2 и 6.7: «Классы операций» четвёртая, между «Источники» и «Журнал».
// «Журнала» в чистовой серии нет, вкладка — по PRD (D-44).
export const ADMIN_TAB_PATHS: Readonly<Record<AdminTab, string>> = {
  catalog: ROUTE_PATHS.adminCatalog,
  norms: ROUTE_PATHS.adminNorms,
  sources: ROUTE_PATHS.adminSources,
  operationClasses: ROUTE_PATHS.adminOperationClasses,
  journal: ROUTE_PATHS.adminJournal,
}

export const ADMIN_TABS: readonly TabNavItem[] = (Object.keys(ADMIN_TAB_PATHS) as AdminTab[])
  .map((key) => ({ label: t.tabs[key], to: ADMIN_TAB_PATHS[key] }))
