import type { ReactNode } from 'react'
import { TabNav } from '@/components/ui/TabNav'
import { ru } from '@/shared/i18n/ru'
import { ADMIN_TAB_PATHS, ADMIN_TABS, type AdminTab } from './adminTabs'

const t = ru.admin

/** Шапка раздела «Администрирование»: заголовок, подзаголовок и вкладки (А1, А5, А6, А8; 15966:8020). */
interface AdminHeaderProps {
  readonly active: AdminTab
  /** Главное действие вкладки справа от вкладок: «Добавить источник» (А6, 15966:7265). */
  readonly action?: ReactNode
}

export function AdminHeader({ active, action }: AdminHeaderProps) {
  // Вкладка задаётся явно, а не по адресу: «Каталог» активна и на /admin/catalog/import (А1а).
  return (
    <>
      <header className="flex flex-col gap-4">
        <h1 className="type-display-lg text-text">{t.title}</h1>
        <p className="type-body text-text-secondary">{t.lead}</p>
      </header>
      {action ? (
        <div className="flex items-center justify-between gap-16">
          <TabNav label={t.tabsLabel} items={ADMIN_TABS} activeTo={ADMIN_TAB_PATHS[active]} />
          {action}
        </div>
      ) : (
        <TabNav label={t.tabsLabel} items={ADMIN_TABS} activeTo={ADMIN_TAB_PATHS[active]} />
      )}
    </>
  )
}
