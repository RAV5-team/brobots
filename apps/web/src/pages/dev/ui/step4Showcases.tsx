import { Badge, type BadgeKind } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardStat, CardTitle, KpiCard } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import { ProgressPanel } from '@/components/ui/ProgressPanel'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/Table'
import { operationCostRub, type ValueSource } from '@/domain'
import { toSimulationRun } from '@/api/mappers/simulation'
import { toEconomics } from '@/api/mappers/economics'
import { EVALUATION_LP01 } from '@/mocks/fixtures/projectMatching'
import { SIMULATION_RUNS } from '@/mocks/fixtures/simulationRuns.generated'
import { FACILITY_PARAMETERS } from '@/mocks/fixtures/facilityParameters'
import { LOCATIONS } from '@/mocks/fixtures/locations'
import { PROJECTS } from '@/mocks/fixtures/projects'
import { formatNumber, formatPercent, formatRubCompact } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { ShowcaseSection } from './StateGrid'

const s = ru.dev.samples
const pm = ru.project.matching
const ph = ru.project.simulation.hourly

// Стоимость операции RaaS к текущему процессу — считается из итога LP-01 (D-13), как в правой колонке подбора 03.
const ECONOMICS = toEconomics(EVALUATION_LP01, 'RB-0008', { conditions: [], operationsPerDay: 2000 })
const RAAS = ECONOMICS.scenarios.find((sc) => sc.acquisition === 'raas')
const costNow = operationCostRub(ECONOMICS.current.opexRubPerYear, ECONOMICS.operationsPerDay)
const costRaas = RAAS ? operationCostRub(RAAS.opexRubPerYear, ECONOMICS.operationsPerDay) : costNow
const rub = (value: number) => `${formatNumber(value, 1, { fixed: true })} ₽`

// Часы пика прогона «нужно докупить»: доля в срок ниже цели 95 % — нарушение (07a).
const NEED_MORE_DTO = SIMULATION_RUNS.find((run) => run.status === 'needs_additions')
const PEAK_HOURS = NEED_MORE_DTO ? toSimulationRun(NEED_MORE_DTO).hourlyBefore.filter((h) => h.hour >= 7 && h.hour <= 12) : []
const ON_TIME_TARGET = 0.95
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
          <KpiCard
            label={pm.operationCost}
            value={rub(costRaas)}
            previous={pm.previous(rub(costNow))}
            change={formatPercent(costRaas / costNow - 1, 0, { signed: true })}
            caption={pm.perPallet}
          />
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
      <ShowcaseSection title="Card · inverse">
        <Card variant="inverse" padding={24} gap={16}>
          <p className="type-display-md text-bg">{ru.project.simulation.verdict.title}</p>
          <p className="rounded-lg bg-inverse-well px-16 py-16 type-body-sm text-bg">{ru.project.simulation.verdict.thinnest}</p>
        </Card>
      </ShowcaseSection>
      <ShowcaseSection title="Card · well">
        <div className="w-[491px]">
          <Card variant="well" padding={16} gap={4}>
            <p className="type-title-lg text-text">{s.wellValue}</p>
            <p className="type-caption text-text-secondary">{s.wellCaption}</p>
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
      <Table caption={ph.caption}>
        <TableHead>
          <TableRow>
            <TableHeaderCell>{ph.hour}</TableHeaderCell>
            {PEAK_HOURS.map((h) => <TableHeaderCell key={h.hour} align="end">{String(h.hour).padStart(2, '0')}</TableHeaderCell>)}
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>{ph.onTime}</TableCell>
            {PEAK_HOURS.map((h) => (
              <TableCell key={h.hour} align="end" tone={h.onTime !== null && h.onTime < ON_TIME_TARGET ? 'violation' : 'default'}>
                {h.onTime === null ? '—' : formatNumber(h.onTime * 100)}
              </TableCell>
            ))}
          </TableRow>
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
      <div className="w-[660px]">
        <ProgressPanel title={s.pollingTitle} label={s.sourcesPolling} value={66}>{s.pollingDetail}</ProgressPanel>
      </div>
    </ShowcaseSection>
  )
}
