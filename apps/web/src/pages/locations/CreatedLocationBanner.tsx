import { generatePath } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { ButtonLink } from '@/components/ui/Button'
import { StatusBanner } from '@/components/ui/StatusBanner'
import { formatCount, formatNumber, formatPercent } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import type { LocationListItem } from './locationsModel'

const t = ru.locations.created
const PERCENT = 100

/** Профиль одной строкой: тип · город · площадь · персонал — неизвестные значения пропускаются. */
function profileParts({ location, summary, facilityTypeName }: LocationListItem): readonly string[] {
  return [
    facilityTypeName,
    location.city,
    summary.totalAreaM2 === null ? null : ru.locations.card.areaValue(formatNumber(summary.totalAreaM2)),
    summary.staffTotal === null ? null : formatCount(summary.staffTotal, ru.plural.employees),
  ].filter((part): part is string => part !== null)
}

/** Плашка «Локация создана» над списком (PRD 10.1, экран 12а; 15950:2251). Текст — из словаря (PRD 15 · №42). */
export function CreatedLocationBanner({ item }: { readonly item: LocationListItem }) {
  const { location, summary } = item
  return (
    <StatusBanner
      title={t.title(location.name)}
      description={t.profile(profileParts(item), formatPercent(summary.parametersCompletenessPct / PERCENT))}
      action={
        <ButtonLink
          to={generatePath(ROUTE_PATHS.location, { locationId: location.id })}
          aria-label={t.openLabel(location.name)}
        >
          {t.open}
        </ButtonLink>
      }
    />
  )
}
