import { Badge } from '@/components/ui/Badge'
import { Chip, ChipToggle } from '@/components/ui/Chip'
import { Toggle } from '@/components/ui/Toggle'
import { ru } from '@/shared/i18n/ru'
import { stateProps, type DemoState } from './demoState'
import { ShowcaseSection, StateGrid } from './StateGrid'

const s = ru.dev.samples
const STATES: readonly DemoState[] = ['default', 'hover', 'focus', 'disabled']

export function ToggleShowcase() {
  return (
    <ShowcaseSection title="Toggle">
      <StateGrid
        states={STATES}
        rows={[
          { label: 'off', render: (st) => <Toggle label={s.autoRefresh} {...stateProps(st)} /> },
          { label: 'on', render: (st) => <Toggle label={s.autoRefresh} defaultChecked {...stateProps(st)} /> },
        ]}
      />
    </ShowcaseSection>
  )
}

export function ChipShowcase() {
  return (
    <div className="flex flex-col gap-24">
      <ShowcaseSection title="Chip">
        <div className="grid grid-cols-[120px_1fr] items-center gap-x-24 gap-y-16">
          <span className="type-caption font-medium text-text-secondary">xs · 24</span>
          <div className="flex gap-8"><Chip size="xs">{s.payload}</Chip></div>
          <span className="type-caption font-medium text-text-secondary">sm · 24</span>
          <div className="flex flex-wrap gap-8">
            <Chip>OP-01</Chip>
            <Chip tone="muted">{s.missing}</Chip>
            <Chip tone="inverse">{s.needsConfirmation}</Chip>
            <Chip tone="success" checked>{s.readyToCalculate}</Chip>
            <Chip tone="accent">{ru.dataSources.status.confirmed}</Chip>
          </div>
          <span className="type-caption font-medium text-text-secondary">md · 32</span>
          <div className="flex flex-wrap gap-8">
            <Chip size="md">{s.operationClassValue}</Chip>
            <Chip size="md" tone="inverse" checked>{s.selected}</Chip>
          </div>
        </div>
      </ShowcaseSection>
      <ShowcaseSection title="ChipToggle">
        <StateGrid
          states={STATES}
          rows={[
            { label: 'off', render: (st) => <ChipToggle {...stateProps(st)}>{s.tow}</ChipToggle> },
            { label: 'on', render: (st) => <ChipToggle defaultPressed {...stateProps(st)}>{s.forks}</ChipToggle> },
          ]}
        />
      </ShowcaseSection>
    </div>
  )
}

export function BadgeShowcase() {
  return (
    <ShowcaseSection title="Badge · Pill">
      <div className="flex flex-wrap gap-8">
        <Badge kind="assumption" />
        <Badge kind="formula" />
        <Badge kind="norm" />
        <Badge kind="exact" />
      </div>
      <div className="flex flex-wrap gap-8">
        <Badge variant="pill" kind="norm" className="w-(--rav-norms-pill-width)" />
        <Badge variant="pill" kind="assumption" className="w-(--rav-norms-pill-width)" />
        <Badge variant="pill" kind="exact" />
      </div>
    </ShowcaseSection>
  )
}
