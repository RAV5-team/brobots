import { useState } from 'react'
import { toSimulationRun } from '@/api/mappers/simulation'
import { Badge } from '@/components/ui/Badge'
import { Field } from '@/components/ui/Field'
import { FieldGrid } from '@/components/ui/FormSection'
import { Input } from '@/components/ui/Input'
import { NumberStepper } from '@/components/ui/NumberStepper'
import { Stepper, type StepperStep, type StepperStepState } from '@/components/ui/Stepper'
import { PROJECT_STEPS, SIMULATION_STAGES, type ProjectStep, type SimulationStage } from '@/domain'
import { SIMULATION_RUNS } from '@/mocks/fixtures/simulationRuns.generated'
import { formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { stateProps, type DemoState } from './demoState'
import { ShowcaseSection, StateGrid } from './StateGrid'

const p = ru.project
const STATES: readonly DemoState[] = ['default', 'hover', 'focus', 'disabled']

/** Шаги проекта по состояниям: черновик на симуляции — пройдены 1–2, 4 закрыт; сохранённая оценка — все пройдены. */
const projectSteps = (current: ProjectStep, stateOf: (index: number) => StepperStepState): readonly StepperStep[] =>
  PROJECT_STEPS.map((step, index) => ({
    key: step,
    label: ru.projectStepTitles[step],
    state: step === current ? 'current' : stateOf(index),
    to: `#${step}`,
  }))

const stages = (current: SimulationStage): readonly StepperStep[] =>
  SIMULATION_STAGES.map((stage, index) => ({
    key: stage,
    label: p.simulation.stages[stage],
    state: stage === current ? 'current' : index < SIMULATION_STAGES.indexOf(current) ? 'done' : 'locked',
  }))

/** Степпер шагов проекта (pills, 16197:1120) и этапов симуляции (segments, 16197:1147). 4 шага по PRD 0.9 (D-54). */
export function StepperShowcase() {
  return (
    <div className="flex flex-col gap-24">
      <ShowcaseSection title="Stepper · pills">
        <StateGrid
          states={['default', 'hover', 'focus']}
          rows={[
            { label: 'draft · simulation', render: (st) => <Stepper label={p.stepsNav} steps={projectSteps('simulation', (i) => (i < 2 ? 'done' : 'locked'))} {...stateProps(st)} /> },
          ]}
        />
        <Stepper label={p.stepsNav} steps={projectSteps('matching', (i) => (i < 1 ? 'done' : i === 2 ? 'available' : 'locked'))} />
        <Stepper label={p.stepsNav} steps={projectSteps('economics', () => 'done')} />
      </ShowcaseSection>
      <ShowcaseSection title="Stepper · segments">
        {SIMULATION_STAGES.map((stage) => <Stepper key={stage} variant="segments" label={p.simulation.stagesNav} steps={stages(stage)} />)}
      </ShowcaseSection>
    </div>
  )
}

function DemoFleet({ state, withPlan }: { readonly state: DemoState; readonly withPlan: boolean }) {
  const [robots, setRobots] = useState(withPlan ? 16 : 18)
  const delta = robots - 18
  return (
    <div className="w-[520px]">
      <NumberStepper
        label={p.simulation.fleet.robots}
        value={robots}
        min={1}
        max={60}
        onChange={setRobots}
        {...(withPlan ? { previous: p.simulation.fleet.previous(18) } : { description: p.simulation.fleet.perStation(3) })}
        {...(withPlan && delta !== 0 ? { delta: formatNumber(delta, 0, { signed: true }) } : {})}
        {...stateProps(state)}
      />
    </div>
  )
}

/** Строка числа ±: «Состав для проверки» 04 (16197:1213) и план вердикта 07 со слотами «было» и дельтой. */
export function NumberStepperShowcase() {
  return (
    <ShowcaseSection title="NumberStepper">
      <StateGrid
        states={STATES}
        rows={[
          { label: 'scope (04)', render: (st) => <DemoFleet state={st} withPlan={false} /> },
          { label: 'plan (07)', render: (st) => <DemoFleet state={st} withPlan /> },
        ]}
      />
    </ShowcaseSection>
  )
}

const needMoreDto = SIMULATION_RUNS.find((run) => run.status === 'needs_additions')
if (!needMoreDto) throw new Error('Фикстура прогона «нужно докупить» не найдена')
const needMore = toSimulationRun(needMoreDto)

/** Сетка полей в 2, 3 и 4 колонки — условия симуляции 05 (16197:1286); метки — одно перечисление Badge. */
export function FieldGridShowcase() {
  const f = p.simulation.fleet
  return (
    <ShowcaseSection title="FieldGrid · columns">
      {([2, 3, 4] as const).map((columns) => (
        <FieldGrid key={columns} columns={columns}>
          {Array.from({ length: columns }, (_, i) => (
            <Field key={i} label={i % 2 === 0 ? f.robots : f.stations} badge={<Badge kind={i === 0 ? 'task' : i === 1 ? 'default' : 'assumption'} />}>
              <Input defaultValue={formatNumber(i % 2 === 0 ? needMore.from.robots : needMore.from.stations)} />
            </Field>
          ))}
        </FieldGrid>
      ))}
    </ShowcaseSection>
  )
}
