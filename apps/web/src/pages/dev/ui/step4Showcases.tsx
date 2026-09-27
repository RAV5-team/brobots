import { Badge, type BadgeKind } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardStat, CardTitle, KpiCard } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/Table'
import type { ValueSource } from '@/domain'
import { FACILITY_PARAMETERS } from '@/mocks/fixtures/facilityParameters'
import { LOCATIONS } from '@/mocks/fixtures/locations'
import { PROJECTS } from '@/mocks/fixtures/projects'
import { formatNumber, formatRubCompact } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { ShowcaseSection } from './StateGrid'

const s = ru.dev.samples
const BADGE_BY_SOURCE: Record<ValueSource, BadgeKind> = { organizer: 'exact', user: 'exact', assumption: 'assumption', computed: 'formula' }
const KHIMKI = LOCATIONS[0]
const ROWS = KHIMKI
  ? Object.entries(KHIMKI.parameters).slice(0, 8).flatMap(([code, value]) => {
      const def = FACILITY_PARAMETERS.find((p) => p.code === code)
      return def ? [{ code, name: def.name, unit: def.unit, value }] : []
    })
  : []

export function CardShowcase() {
  return (
    <div className="flex flex-col gap-24">
      <ShowcaseSection title="Card · panel">
        <div className="w-[300px]">
          <Card>
            <CardTitle>{s.templateCheck}</CardTitle>
            <dl>
              <CardStat label={s.formulas} value="3" />
              <CardStat label={s.requiredFields} value="12" />
              <CardStat label={s.robotsWithClass} value="36" />
              <CardStat label={s.suitableLocations} value="3" />
            </dl>
            <p className="type-caption text-text-secondary">{s.templateNote}</p>
          </Card>
        </div>
      </ShowcaseSection>
      <ShowcaseSection title="Card · tile (KPI)">
        <div className="grid grid-cols-3 gap-16">
          <KpiCard label={s.kpiLocations} value={formatNumber(LOCATIONS.length)} caption={s.kpiLocationsCaption} />
          <KpiCard label={s.kpiProjects} value={formatNumber(PROJECTS.length)} />
          <KpiCard label={s.kpiManual} value={formatRubCompact(591_000_000)} caption={s.kpiManualCaption} />
        </div>
      </ShowcaseSection>
      <ShowcaseSection title="Card · inset">
        <div className="w-[234px]">
          <Card variant="inset" padding={16} gap={4}>
            <p className="type-display-lg text-text">{s.insetValue}</p>
            <p className="type-caption text-text-secondary">{s.insetCaption}</p>
          </Card>
        </div>
      </ShowcaseSection>
    </div>
  )
}

export function SectionHeaderShowcase() {
  return (
    <ShowcaseSection title="Section header">
      <SectionHeader title={s.sectionTitle} description={s.sectionDescription} />
      <SectionHeader level={3} title={s.parametersCaption} actions={<Button size="sm">{s.allProjects}</Button>} />
    </ShowcaseSection>
  )
}

export function TableShowcase() {
  return (
    <ShowcaseSection title="Table">
      <Table caption={s.parametersCaption}>
        <TableHead>
          <TableRow>
            <TableHeaderCell>{s.columnParameter}</TableHeaderCell>
            <TableHeaderCell align="end">{s.columnValue}</TableHeaderCell>
            <TableHeaderCell>{s.columnSource}</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {ROWS.map((row, index) => (
            <TableRow key={row.code} selected={index === 1}>
              <TableCell>{row.name}</TableCell>
              <TableCell align="end" className="font-semibold whitespace-nowrap">
                {typeof row.value.value === 'number' ? formatNumber(row.value.value, 1) : row.value.value} {row.unit}
              </TableCell>
              <TableCell><Badge kind={BADGE_BY_SOURCE[row.value.source]} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ShowcaseSection>
  )
}

export function ProgressShowcase() {
  return (
    <ShowcaseSection title="Progress">
      <div className="flex w-[660px] flex-col gap-16">
        {[0, 35, 66, 100].map((v) => (
          <div key={v} className="grid grid-cols-[40px_1fr] items-center gap-12">
            <span className="type-caption text-text-secondary">{v}%</span>
            <Progress label={s.sourcesPolling} value={v} />
          </div>
        ))}
      </div>
    </ShowcaseSection>
  )
}
