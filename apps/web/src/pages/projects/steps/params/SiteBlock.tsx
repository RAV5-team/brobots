import { useState } from 'react'
import { generatePath } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { Card } from '@/components/ui/Card'
import { TextLink } from '@/components/ui/TextLink'
import { Toggle } from '@/components/ui/Toggle'
import type { LocationId } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import type { SiteRowGroup } from './paramsModel'
import { ValueTable } from '../../shared/ValueTable'

const t = ru.project.params.site

interface SiteBlockProps {
  readonly groups: readonly SiteRowGroup[]
  readonly locationId: LocationId
}

/**
 * Блок 2 «Условия площадки»: параметры площадки из снимка профиля (PRD 11.2, 10.5). Только чтение: «нет данных»
 * ведёт в профиль локации. По умолчанию показаны только применимые к процессу (D-93).
 */
export function SiteBlock({ groups, locationId }: SiteBlockProps) {
  const [onlyApplicable, setOnlyApplicable] = useState(true)
  const total = groups.reduce((sum, g) => sum + g.rows.length, 0)
  const visible = groups
    .map((g) => ({ ...g, rows: onlyApplicable ? g.rows.filter((r) => r.applicable) : g.rows }))
    .filter((g) => g.rows.length > 0)
  const shown = visible.reduce((sum, g) => sum + g.rows.length, 0)
  const profile = generatePath(ROUTE_PATHS.locationParams, { locationId })
  return (
    <Card aria-labelledby="params-site-title" gap={16}>
      <header className="flex items-start justify-between gap-16">
        <div className="flex flex-col gap-4">
          <h2 id="params-site-title" className="type-heading text-text">{t.title}</h2>
          <p className="type-caption text-text-secondary">{t.hint}</p>
        </div>
        <div className="flex shrink-0 items-center gap-12">
          <span className="type-caption text-text-muted">{t.count(shown, total)}</span>
          <Toggle label={t.onlyApplicable} checked={onlyApplicable} onCheckedChange={setOnlyApplicable} />
        </div>
      </header>
      {visible.map((group) => (
        <ValueTable
          key={group.key}
          title={group.title}
          rows={group.rows}
          missingAction={(row) => <TextLink to={`${profile}#${row.key}`}>{row.note}</TextLink>}
        />
      ))}
    </Card>
  )
}
