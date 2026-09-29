import { useState } from 'react'
import { Link, generatePath } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Disclosure } from '@/components/ui/Disclosure'
import type { Location } from '@/domain'
import { formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { ParamRows } from './ParamRows'
import { groupCaption, type SiteRowGroup } from './paramsModel'
import { siteGroupKey, type GroupReveal } from './useGroupReveal'

const t = ru.project.params.site

interface SiteBlockProps {
  readonly groups: readonly SiteRowGroup[]
  readonly location: Location
  readonly reveal: GroupReveal
  /** «Всё раскрыто»: сразу все параметры локации, не только применимые. */
  readonly showAllInitially?: boolean
  /** Свой график выбранного процесса (упаковка, 17009:1404): расчёт берёт его, а не режим локации. */
  readonly ownScheduleHours?: number | null
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * Блок 2 «Локация» (16969:367): параметры площадки из снимка профиля (PRD 11.2). Только чтение: «нет данных» ведёт
 * в профиль локации. Группы свёрнуты; по умолчанию — только применимые к процессу (D-93), «Все параметры локации» — все.
 * Группы пока по PRD 10.5 (5 групп), а не 4 группы доски — ждёт D-92.
 */
export function SiteBlock({ groups, location, reveal, showAllInitially = false, ownScheduleHours = null }: SiteBlockProps) {
  const [showAll, setShowAll] = useState(showAllInitially)
  const visible = groups
    .map((g) => ({ ...g, rows: showAll ? g.rows : g.rows.filter((r) => r.applicable) }))
    .filter((g) => g.rows.length > 0)
  const profile = generatePath(ROUTE_PATHS.locationParams, { locationId: location.id })
  return (
    <Card aria-labelledby="params-site-title" padding={28} gap={20}>
      <header className="flex flex-col gap-4">
        <h2 id="params-site-title" className="type-heading text-text">{t.title}</h2>
        <p className="type-caption text-text-secondary">{t.hint}</p>
      </header>
      <div className="flex flex-col gap-4">
        <p className="type-title-md text-text">{location.name}</p>
        <p className="type-caption text-text-secondary">{capitalize(ru.facilityTypesLower[location.facilityType])} · {location.address}</p>
      </div>
      {ownScheduleHours !== null && (
        <Card variant="sunken" padding={16} as="div" className="px-20">
          <p className="type-caption text-text">{t.ownSchedule(formatNumber(ownScheduleHours))}</p>
        </Card>
      )}
      <div className="flex flex-col">
        {visible.map((group) => {
          const key = siteGroupKey(group.key)
          return (
            <Disclosure
              key={group.key}
              variant="group"
              title={group.title}
              caption={groupCaption(group.rows)}
              open={reveal.isOpen(key)}
              onOpenChange={(open) => { reveal.setOpen(key, open) }}
            >
              <Card variant="sunken" padding={16} gap={0} as="div" className="px-20">
                <ParamRows
                  label={group.title}
                  rows={group.rows}
                  missingAction={(row) => <Link to={`${profile}#${row.key}`} className="rounded-xs type-caption text-text-muted underline-offset-4 transition-colors hover:text-text hover:underline">{row.note}</Link>}
                />
              </Card>
            </Disclosure>
          )
        })}
      </div>
      <div className="flex justify-end">
        <Button onClick={() => { setShowAll(!showAll) }}>{showAll ? t.onlyApplicable : t.showAll}</Button>
      </div>
    </Card>
  )
}
