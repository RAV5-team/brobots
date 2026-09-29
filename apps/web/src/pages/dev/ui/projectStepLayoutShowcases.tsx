import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { Stepper, type StepperStep } from '@/components/ui/Stepper'
import { SIMULATION_STAGES } from '@/domain'
import { LOCATIONS } from '@/mocks/fixtures/locations'
import { DEMO_PROJECT } from '@/mocks/fixtures/projects'
import { ru } from '@/shared/i18n/ru'
import { ProjectStepLayout } from '../../projects/steps/ProjectStepLayout'
import { ShowcaseSection } from './StateGrid'

const p = ru.project
const LOCATION = LOCATIONS.find((l) => l.id === DEMO_PROJECT.locationId)?.name ?? DEMO_PROJECT.locationId
const SAVED_AT = '15.09 14:32'

const STAGES: readonly StepperStep[] = SIMULATION_STAGES.map((stage, index) => ({
  key: stage,
  label: p.simulation.stages[stage],
  state: index === 0 ? 'current' : 'locked',
  to: `#${stage}`,
}))

/** Рамка витрины: каркас отдаёт фрагмент — строки идут столбиком с зазором 16, как в `<main>` AppShell. */
function Frame({ children }: { readonly children: ReactNode }) {
  return <div className="flex flex-col gap-16 rounded-xl border border-border p-24">{children}</div>
}

const placeholder = (text: string) => <Card><p className="type-body text-text-secondary">{text}</p></Card>

/**
 * Каркас шага проекта на демо-проекте: crumbs — секция 15877:2 (эталоны 02–08), board — доска 16325
 * («← Проекты» и статус, короткий степпер, заголовок во всю ширину, этапы и колонки с зазором 24).
 */
export function ProjectStepLayoutShowcase() {
  const rail = placeholder('Правая колонка 300 · главное действие шага')
  return (
    <div className="flex flex-col gap-24">
      <ShowcaseSection title="ProjectStepLayout · crumbs">
        <Frame>
          <ProjectStepLayout project={DEMO_PROJECT} locationName={LOCATION} step="simulation" isGuest={false} title={ru.projectStepTitles.simulation} rail={rail}>
            {placeholder('Содержание шага')}
          </ProjectStepLayout>
        </Frame>
      </ShowcaseSection>
      <ShowcaseSection title="ProjectStepLayout · board">
        <Frame>
          <ProjectStepLayout
            layout="board"
            project={DEMO_PROJECT}
            locationName={LOCATION}
            step="simulation"
            isGuest={false}
            title={ru.projectStepTitles.simulation}
            status={<Chip tone="muted" size="md"><span role="status">{p.params.save.draftSaved(SAVED_AT)}</span></Chip>}
            stages={<Stepper variant="capsule" label={p.simulation.stagesNav} steps={STAGES} />}
            rail={rail}
          >
            {placeholder('Содержание шага')}
          </ProjectStepLayout>
        </Frame>
        <Frame>
          <ProjectStepLayout layout="board" project={DEMO_PROJECT} locationName={LOCATION} step="params" isGuest title={ru.projectStepTitles.params}>
            {placeholder('Содержание шага')}
          </ProjectStepLayout>
        </Frame>
      </ShowcaseSection>
    </div>
  )
}
