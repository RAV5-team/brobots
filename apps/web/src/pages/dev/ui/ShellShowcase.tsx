import { DemoBanner } from '@/components/shell/DemoBanner'
import { Sidebar } from '@/components/shell/Sidebar'
import { ROLES } from '@/domain'
import { DATA_VERSION, PROFILES } from '@/mocks/fixtures/session'
import { ru } from '@/shared/i18n/ru'

const COUNTS = { projects: 5, processes: 12, locations: 4, catalog: 20 } as const

/** Sidebar трёх ролей рядом и плашка демо-режима. */
export function ShellShowcase() {
  return (
    <div className="flex flex-col gap-24">
      <div className="flex gap-32 [&_aside]:h-[768px] [&_aside]:static">
        {ROLES.map((role) => (
          <figure key={role} className="flex flex-col gap-8">
            <figcaption className="type-overline text-text-muted">{ru.roles[role]}</figcaption>
            <Sidebar
              role={role}
              activeKey={role === 'admin' ? 'admin' : 'processes'}
              counts={COUNTS}
              profile={PROFILES[role]}
              dataVersion={DATA_VERSION}
            />
          </figure>
        ))}
      </div>
      <DemoBanner />
    </div>
  )
}
