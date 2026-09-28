import { ButtonLink } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { ru } from '@/shared/i18n/ru'
import { useNewProjectLink } from '@/components/newProject/useNewProjectLink'
import { newProjectContext, type LocationUsage } from './processDetailModel'

const t = ru.processCard.locations

/** «Процесс на локациях»: потребность, пик, исполнители и стоимость труда на каждой площадке (PRD 9.3; 15935:1516). */
export function LocationsSection({ usages }: { readonly usages: readonly LocationUsage[] }) {
  const newProjectLink = useNewProjectLink()
  return (
    <Card aria-labelledby="locations-title">
      <CardTitle as="h2" id="locations-title">{t.title}</CardTitle>
      {usages.length === 0 ? (
        <p className="type-body text-text-secondary">{t.empty}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-12">
          {usages.map((usage) => (
            <li key={usage.locationProcessId} className="flex flex-col rounded-lg bg-surface-sunken p-16">
              <div className="flex items-start justify-between gap-8 pb-8">
                <h3 className="type-heading text-text">{usage.heading}</h3>
                <ButtonLink to={newProjectLink(newProjectContext(usage))} aria-haspopup="dialog" aria-label={t.createProjectLabel(usage.locationName)} className="shrink-0">
                  {t.createProject}
                </ButtonLink>
              </div>
              <dl>
                {usage.rows.map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-16 py-8">
                    <dt className="type-body whitespace-nowrap text-text-secondary">{row.label}</dt>
                    <dd className="type-body text-right font-semibold text-text">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
