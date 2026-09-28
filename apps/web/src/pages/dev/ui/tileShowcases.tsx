import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatTile } from '@/components/ui/StatTile'
import { Well } from '@/components/ui/Well'
import { formatRubCompact, formatYears } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { ShowcaseSection } from './StateGrid'

const economics = ru.project.economics.tiles
const automation = ru.processCard.automation
const verdict = ru.project.simulation.verdict

export function StatTileShowcase() {
  return (
    <div className="flex flex-col gap-24">
      <ShowcaseSection title="tone light · size lg / sm">
        <ul className="grid grid-cols-3 gap-8">
          <StatTile label={economics.capex} value={formatRubCompact(6_100_000)} caption={economics.capexCaption.purchase} />
          <StatTile label={economics.payback} value={formatYears(0.7)} />
          <StatTile size="sm" label={economics.effect} value={formatRubCompact(9_200_000)} caption={economics.effectCaption} />
        </ul>
      </ShowcaseSection>
      <ShowcaseSection title="tone light · size md · as term">
        <dl className="flex gap-8">
          <StatTile as="term" size="md" className="shrink-0" label={automation.carrier} value={ru.processes.title} />
          <StatTile as="term" size="md" className="min-w-0 flex-1" label={automation.facilities} value={ru.processes.lead} />
        </dl>
      </ShowcaseSection>
      <ShowcaseSection title="tone inverse · size lg">
        <Card variant="inverse" padding={20}>
          <ul className="grid grid-cols-3 gap-8">
            <StatTile tone="inverse" label={economics.opex} value={formatRubCompact(42_000_000)} caption={economics.opexCaption(formatRubCompact(51_200_000))} />
            <StatTile tone="inverse" label={economics.effect} value={formatRubCompact(9_200_000)} caption={economics.effectCaption} />
            <StatTile tone="inverse" label={economics.payback} value={formatYears(0.7)} caption={economics.paybackCaption} />
          </ul>
        </Card>
      </ShowcaseSection>
    </div>
  )
}

export function WellShowcase() {
  return (
    <Card variant="inverse" padding={20}>
      <Well title={verdict.thinnest}>
        <p className="type-body-sm text-bg">{economics.effectCaption}</p>
      </Well>
      <Well title={verdict.pilot}>
        <p className="type-body-sm text-bg">{economics.paybackCaption}</p>
      </Well>
    </Card>
  )
}

export function PageHeaderShowcase() {
  return (
    <div className="flex flex-col gap-24">
      <ShowcaseSection title="gap 4">
        <PageHeader title={ru.processes.title} lead={ru.processes.lead} />
      </ShowcaseSection>
      <ShowcaseSection title="gap 8">
        <PageHeader title={ru.processes.title} lead={ru.processes.lead} gap={8} />
      </ShowcaseSection>
      <ShowcaseSection title="actions">
        <PageHeader title={ru.processes.title} lead={ru.processes.lead} actions={<Button>{ru.processes.create}</Button>} />
      </ShowcaseSection>
    </div>
  )
}
