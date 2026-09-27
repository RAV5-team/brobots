import { ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import type { OperationClass, Process } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { rateUnit } from '../processesModel'
import { capitalize, routeSegments } from './processDetailModel'
import { processRequirements, type Requirement, type RequirementGroupKey } from './processRequirements.mock'

const t = ru.processCard
const GROUPS: readonly RequirementGroupKey[] = ['required', 'desirable', 'environment']

interface FactProps {
  readonly label: string
  readonly value: string
  readonly grow?: boolean
}

/** Плашка «подпись — значение» на утопленном фоне (15935:1393). */
function Fact({ label, value, grow = false }: FactProps) {
  return (
    <div className={grow ? 'flex min-w-0 flex-1 flex-col gap-4 rounded-md bg-surface-sunken p-12' : 'flex shrink-0 flex-col gap-4 rounded-md bg-surface-sunken p-12'}>
      <dt className="type-caption text-text-secondary">{label}</dt>
      <dd className="type-heading text-text">{value}</dd>
    </div>
  )
}

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
      <h2 id="automation-title" className="type-overline text-text-muted">{t.automation.title}</h2>
      <dl className="flex items-stretch gap-8">
        <Fact label={t.automation.carrier} value={capitalize(process.defaults.carrier ?? t.requirements.noUnit)} />
        <Fact label={t.automation.operationClass} value={ru.processes.classOption(process.operationClass, operationClass?.name ?? '')} />
        <Fact label={t.automation.kpi} value={rateUnit(process)} />
        <Fact label={t.automation.facilities} value={facilities.join(', ')} grow />
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

function RequirementList({ title, items }: { readonly title: string; readonly items: readonly Requirement[] }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <h3 className="type-body font-semibold text-text">{title}</h3>
      <dl>
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-8 py-8">
            <dt className="type-body whitespace-nowrap text-text-secondary">{item.label}</dt>
            <dd className="type-body font-semibold whitespace-nowrap text-text">{item.unit ?? t.requirements.noUnit}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** «Что нужно знать для подбора»: какие данные процесс запрашивает у локации (PRD 9.3; 15935:1413). */
export function RequirementsSection({ process }: { readonly process: Process }) {
  const requirements = processRequirements(process, rateUnit(process))
  return (
    <Card aria-labelledby="requirements-title">
      <h2 id="requirements-title" className="type-overline text-text-muted">{t.requirements.title}</h2>
      <p className="type-body text-text-secondary">{t.requirements.lead}</p>
      <div className="flex items-start gap-16">
        {GROUPS.map((key) => <RequirementList key={key} title={t.requirements.groups[key]} items={requirements[key]} />)}
      </div>
    </Card>
  )
}
