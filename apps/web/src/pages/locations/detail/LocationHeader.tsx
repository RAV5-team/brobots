import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { generatePath } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { DemoBanner } from '@/components/shell/DemoBanner'
import { Chip } from '@/components/ui/Chip'
import { TabNav } from '@/components/ui/TabNav'
import { TextLink } from '@/components/ui/TextLink'
import type { Location, LocationSummary } from '@/domain'
import { formatDayOf } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { profileLine } from './locationDetailModel'

const t = ru.location

interface LocationHeaderProps {
  readonly location: Location
  readonly summary: LocationSummary | undefined
  readonly facilityTypeName: string
  readonly isGuest: boolean
  /** Вкладка, открытая на экране: у «Процессов локации» два адреса — локации (15) и `/processes` (17). */
  readonly activeTab: LocationTab
  /** Действие вкладки справа от вкладок: «Изменить» на 17а (16069:477). */
  readonly action?: ReactNode
}

export type LocationTab = 'params' | 'processes' | 'documents'

const TAB_PATHS = {
  params: ROUTE_PATHS.locationParams,
  processes: ROUTE_PATHS.locationProcesses,
  documents: ROUTE_PATHS.locationDocuments,
} as const satisfies Record<LocationTab, string>

/** Шапка локации и вкладки разделов (PRD 10.3; 15950:2491–15950:2501, 16005:293). */
export function LocationHeader({ location, summary, facilityTypeName, isGuest, activeTab, action }: LocationHeaderProps) {
  const params = { locationId: location.id }
  const tabPath = (tab: LocationTab) => generatePath(TAB_PATHS[tab], params)
  return (
    <>
      <div className="flex items-center gap-16">
        <TextLink to={ROUTE_PATHS.locations} icon={ArrowLeft}>{t.back}</TextLink>
        {isGuest && <DemoBanner />}
      </div>
      <header className="flex flex-col gap-8">
        <div className="flex items-center gap-12">
          <h1 id="location-title" tabIndex={-1} className="type-display-lg text-text focus-visible:outline-none">{location.name}</h1>
          <Chip>{facilityTypeName}</Chip>
        </div>
        <div className="flex flex-col gap-4">
          <p className="type-body text-text-secondary">{profileLine(location, summary)}</p>
          <p className="type-caption text-text-secondary">{t.updated(formatDayOf(location.updatedAt))}</p>
        </div>
      </header>
      <div className="flex items-center justify-between gap-16">
        <TabNav
          label={t.tabsLabel}
          activeTo={tabPath(activeTab)}
          items={[
            { to: tabPath('params'), label: t.tabs.params },
            // Экран 17: у вкладки свой адрес; адрес локации (15, после создания) показывает её же.
            { to: tabPath('processes'), label: t.tabs.processes },
            { to: tabPath('documents'), label: t.tabs.documents },
          ]}
        />
        {action}
      </div>
    </>
  )
}
