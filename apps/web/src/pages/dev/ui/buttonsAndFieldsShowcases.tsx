import { ArrowRight, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'
import { MergedButtonLink } from '@/components/ui/MergedButton'
import { Search } from '@/components/ui/Search'
import { ru } from '@/shared/i18n/ru'
import { stateProps, type DemoState } from './demoState'
import { ShowcaseSection, StateGrid } from './StateGrid'

const s = ru.dev.samples
const source = ru.dataSources.create
const INTERACTIVE: readonly DemoState[] = ['default', 'hover', 'active', 'focus', 'disabled']
const LINK_STATES: readonly DemoState[] = ['default', 'hover', 'focus']
const INPUT_STATES: readonly DemoState[] = ['default', 'focus', 'invalid', 'computed', 'disabled']

export function ButtonShowcase() {
  return (
    <div className="flex flex-col gap-24">
      <ShowcaseSection title="Button">
        <StateGrid
          states={INTERACTIVE}
          rows={[
            { label: 'primary · md', render: (st) => <Button variant="primary" {...stateProps(st)}>{s.addClass}</Button> },
            { label: 'secondary · md', render: (st) => <Button {...stateProps(st)}><Plus aria-hidden size={16} />{s.addLocation}</Button> },
            { label: 'secondary · sm', render: (st) => <Button size="sm" {...stateProps(st)}>{s.allProjects}</Button> },
            { label: 'danger · md', render: (st) => <Button variant="danger" {...stateProps(st)}>{s.removeFromLocation}</Button> },
            { label: 'accent · md', render: (st) => <div className="surface-inverse rounded-xl bg-inverse p-8"><Button variant="accent" {...stateProps(st)}>{ru.adminCatalog.added.open}</Button></div> },
          ]}
        />
      </ShowcaseSection>
      <ShowcaseSection title="MergedButton">
        <StateGrid
          states={LINK_STATES}
          rows={[
            { label: 'link · 44', render: (st) => <MergedButtonLink to="#" label={ru.processes.create} icon={Plus} {...stateProps(st)} /> },
          ]}
        />
      </ShowcaseSection>
      <ShowcaseSection title="IconButton">
        <StateGrid
          states={INTERACTIVE}
          rows={[
            { label: '44', render: (st) => <IconButton label={s.openProject} icon={ArrowRight} {...stateProps(st)} /> },
            { label: '36', render: (st) => <IconButton size={36} label={s.edit} icon={Pencil} {...stateProps(st)} /> },
          ]}
        />
      </ShowcaseSection>
    </div>
  )
}

function inputState(state: DemoState) {
  return {
    ...(state === 'focus' ? { 'data-demo-state': 'focus' } : {}),
    invalid: state === 'invalid',
    computed: state === 'computed',
    disabled: state === 'disabled',
  }
}

export function InputShowcase() {
  return (
    <ShowcaseSection title="Input">
      <StateGrid
        states={INPUT_STATES}
        rows={[
          {
            label: 'md · 44',
            render: (st) => {
              const { ['data-demo-state']: demo, ...rest } = inputState(st)
              return <span data-demo-state={demo} className="block w-[176px]"><Input aria-label={s.processName} defaultValue={s.activeAreaValue} suffix={s.squareMeters} {...rest} /></span>
            },
          },
          {
            label: 'compact · 38',
            render: (st) => {
              const { ['data-demo-state']: demo, ...rest } = inputState(st)
              return <span data-demo-state={demo} className="block w-[100px]"><Input size="compact" aria-label={s.normValue} defaultValue={s.normValue} {...rest} /></span>
            },
          },
        ]}
      />
    </ShowcaseSection>
  )
}

export function SearchShowcase() {
  return (
    <ShowcaseSection title="Search">
      <StateGrid
        states={['default', 'focus', 'disabled']}
        rows={[
          {
            label: '44',
            render: (st) => (
              <span data-demo-state={st === 'focus' ? 'focus' : undefined} className="block w-[240px]">
                <Search label={s.findProcess} disabled={st === 'disabled'} />
              </span>
            ),
          },
        ]}
      />
    </ShowcaseSection>
  )
}

export function FieldShowcase() {
  return (
    <ShowcaseSection title="Field">
      <div className="grid grid-cols-2 gap-x-40 gap-y-24">
        <Field label={s.processName} required>
          <Input defaultValue={s.processValue} />
        </Field>
        <Field label={s.operationClass} required hint={s.operationClassHint}>
          <Input defaultValue={s.operationClassValue} />
        </Field>
        <Field label={s.activeArea} required error={s.activeAreaError}>
          <Input defaultValue={s.activeAreaValue} suffix={s.squareMeters} />
        </Field>
        <Field label={s.payroll}>
          <Input value={s.payrollValue} computed />
        </Field>
        {/* Действие в капсуле: «Проверить» у ссылки источника (А7б, 15966:7933). */}
        <Field label={source.fields.url} required hint={source.urlHint}>
          <Input type="url" defaultValue="https://moros.ru/catalog/amr-800" action={{ label: source.check, ariaLabel: source.checkLabel, onClick: () => undefined }} />
        </Field>
      </div>
    </ShowcaseSection>
  )
}
