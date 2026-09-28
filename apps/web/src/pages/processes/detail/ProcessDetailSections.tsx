import { ArrowRight } from 'lucide-react'
import { Card, CardTitle } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { StatTile } from '@/components/ui/StatTile'
import type { OperationClass, Process, ProcessRequirements, RequirementGroupKey } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { rateUnit } from '../processesModel'
import { capitalize, requirementRows, routeSegments, type RequirementRow } from './processDetailModel'

const t = ru.processCard
const GROUPS: readonly RequirementGroupKey[] = ['required', 'desirable', 'environment']

interface AutomationSectionProps {
  readonly process: Process
  readonly operationClass: OperationClass | undefined
  readonly facilities: readonly string[]
}

/** «Что автоматизируем»: объект, класс, KPI, отрасли и типовые точки маршрута (PRD 9.3; 15935:1390). */
export function AutomationSection({ process, operationClass, facilities }: AutomationSectionProps) {
  const segments = routeSegments(process.defaults.routePoints)
  return (
    <Card aria-labelledby="automation-title">
      <CardTitle as="h2" id="automation-title">{t.automation.title}</CardTitle>
      <dl className="flex items-stretch gap-8">
        <StatTile as="term" size="md" className="shrink-0" label={t.automation.carrier} value={capitalize(process.defaults.carrier ?? t.requirements.noUnit)} />
        <StatTile as="term" size="md" className="shrink-0" label={t.automation.operationClass} value={ru.processes.classOption(process.operationClass, operationClass?.name ?? '')} />
        <StatTile as="term" size="md" className="shrink-0" label={t.automation.kpi} value={rateUnit(process)} />
        <StatTile as="term" size="md" className="min-w-0 flex-1" label={t.automation.facilities} value={facilities.join(', ')} />
      </dl>
      {segments.length > 0 && (
        <>
          <h3 className="type-body font-semibold text-text">{t.automation.routePoints}</h3>
          <ul className="flex flex-wrap gap-8">
            {segments.map((s) => (
              <li key={`${s.from}-${s.to}`}>
                <Chip size="md">
                  {s.from}
                  <ArrowRight aria-hidden size={12} />
                  <span className="sr-only">→</span>
                  {s.to}
                </Chip>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}

function RequirementList({ title, items }: { readonly title: string; readonly items: readonly RequirementRow[] }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <h3 className="type-body font-semibold text-text">{title}</h3>
      <dl>
        {items.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-8 py-8">
            <dt className="type-body whitespace-nowrap text-text-secondary">{item.label}</dt>
            <dd className="type-body font-semibold whitespace-nowrap text-text">{item.unit ?? t.requirements.noUnit}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** «Что нужно знать для подбора»: какие данные процесс запрашивает у локации (PRD 9.3; 15935:1413). */
export function RequirementsSection({ process, requirements }: { readonly process: Process; readonly requirements: ProcessRequirements }) {
  const rows = requirementRows(requirements, rateUnit(process))
  return (
    <Card aria-labelledby="requirements-title">
      <CardTitle as="h2" id="requirements-title">{t.requirements.title}</CardTitle>
      <p className="type-body text-text-secondary">{t.requirements.lead}</p>
      <div className="flex items-start gap-16">
        {GROUPS.map((key) => <RequirementList key={key} title={t.requirements.groups[key]} items={rows[key]} />)}
      </div>
    </Card>
  )
}
