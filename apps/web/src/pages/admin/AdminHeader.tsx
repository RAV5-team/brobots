import type { ReactNode } from 'react'
import { ROUTE_PATHS } from '@/app/routePaths'
import { TabNav, type TabNavItem } from '@/components/ui/TabNav'
import { ru } from '@/shared/i18n/ru'

const t = ru.admin

export type AdminTab = keyof typeof t.tabs

// Порядок вкладок — PRD 6.2 и 6.7: «Классы операций» четвёртая, между «Источники» и «Журнал».
// «Журнала» в чистовой серии нет, вкладка — по PRD (D-34).
const TABS: readonly TabNavItem<AdminTab>[] = [
  { key: 'catalog', label: t.tabs.catalog, to: ROUTE_PATHS.adminCatalog },
  { key: 'norms', label: t.tabs.norms, to: ROUTE_PATHS.adminNorms },
  { key: 'sources', label: t.tabs.sources, to: ROUTE_PATHS.adminSources },
  { key: 'operationClasses', label: t.tabs.operationClasses, to: ROUTE_PATHS.adminOperationClasses },
  { key: 'journal', label: t.tabs.journal, to: ROUTE_PATHS.adminJournal },
]

/** Шапка раздела «Администрирование»: заголовок, подзаголовок и вкладки (А1, А5, А6, А8; 15966:8020). */
interface AdminHeaderProps {
  readonly active: AdminTab
  /** Главное действие вкладки справа от вкладок: «Добавить источник» (А6, 15966:7265). */
  readonly action?: ReactNode
}

export function AdminHeader({ active, action }: AdminHeaderProps) {
  return (
    <>
      <header className="flex flex-col gap-4">
        <h1 className="type-display-lg text-text">{t.title}</h1>
        <p className="type-body text-text-secondary">{t.lead}</p>
      </header>
      {action ? (
        <div className="flex items-center justify-between gap-16">
          <TabNav label={t.tabsLabel} items={TABS} activeKey={active} />
          {action}
        </div>
      ) : (
        <TabNav label={t.tabsLabel} items={TABS} activeKey={active} />
      )}
    </>
  )
}
