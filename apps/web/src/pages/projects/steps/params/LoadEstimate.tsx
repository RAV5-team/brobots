import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { ParamsProcessEntry } from '@/domain'
import { formatNumber, formatPercent } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { defaultsOf, peakDemand, type AssumptionRow, type ValueRow } from './paramsModel'

const t = ru.project.params

interface LoadEstimateProps {
  readonly entry: ParamsProcessEntry
  readonly assumptions: readonly AssumptionRow[]
  /** Строки группы «Объём и нагрузка»: из них — статусы слагаемых разбора. */
  readonly rows: readonly ValueRow[]
  /** «Всё раскрыто»: разбор «Как рассчитано» сразу открыт. */
  readonly defaultOpen?: boolean
}

/**
 * Предварительная нагрузка в пик (16992:398): итог и «Как рассчитано» — разбор объём ÷ часы × пик × доля (PRD 11.2).
 * Считает так же, как строка «Нагрузка для роботизации в пик» отчёта: `peakDemand`. У инвентаризации без частоты — не рассчитано.
 */
export function LoadEstimate({ entry, assumptions, rows, defaultOpen = false }: LoadEstimateProps) {
  const [open, setOpen] = useState(defaultOpen)
  const peak = assumptions.find((a) => a.code === 'peak_factor')?.value ?? 1
  const demand = peakDemand(entry, defaultsOf(entry).workHoursPerDay, peak)
  const origin = (key: string) => {
    const row = rows.find((r) => r.key === key)
    return row ? ru.valueBadges[row.origin] : ''
  }
  const unit = entry.process.volumeUnit
  const perHour = (value: number) => `${formatNumber(value)} ${unit}/${ru.units.hours}`

  return (
    <Card variant="sunken" padding={20} gap={12} as="div" className="mt-8">
      <div className="flex min-h-44 items-center gap-16">
        <p className="flex min-w-0 flex-1 flex-wrap items-baseline gap-4">
          <span className="type-caption text-text-secondary">{t.load.title}</span>
          <span className="type-body font-semibold text-text">{demand ? perHour(demand.perHour) : t.rows.peakLoadNoRecounts}</span>
        </p>
        {demand && (
          <Button aria-expanded={open} aria-controls="params-load-breakdown" onClick={() => { setOpen(!open) }}>
            {open ? t.load.hide : t.load.show}
          </Button>
        )}
      </div>
      {demand && (
        <dl id="params-load-breakdown" hidden={!open} className="flex flex-col gap-4 border-t border-border pt-12">
          {[
            { key: 'volume', label: t.load.volume, value: t.process.perDay(formatNumber(demand.perDay), unit), source: origin('volume') },
            { key: 'hours', label: t.load.hours, value: `${formatNumber(demand.hours)} ${ru.units.hours}`, source: origin('hours') },
            { key: 'peak', label: t.load.peak, value: formatNumber(demand.peakFactor, 2), source: origin('peak') },
            { key: 'share', label: t.load.share, value: formatPercent(demand.share), source: origin('share') },
            { key: 'result', label: t.load.result, value: perHour(demand.perHour), source: ru.valueBadges.preliminary },
          ].map((line) => (
            <div key={line.key} className="flex items-center gap-16">
              <dt className={line.key === 'result' ? 'flex-1 type-caption font-medium text-text' : 'flex-1 type-caption text-text-secondary'}>{line.label}</dt>
              <dd className="w-(--rav-params-status-width) text-right type-body font-semibold whitespace-nowrap text-text">{line.value}</dd>
              <dd className="w-(--rav-params-action-width) type-caption text-text-muted">{line.source}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  )
}
