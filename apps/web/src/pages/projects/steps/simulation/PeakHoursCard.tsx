import { RotateCcw } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { HourGrid } from '@/components/ui/HourGrid'
import { hourText } from '@/components/ui/hourText'
import { TextButton } from '@/components/ui/TextLink'
import type { PeakHours } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { hoursFrom } from './hourlyDemand'

const t = ru.project.simulation.conditions.peaks
const FLOWS = ['inbound', 'outbound'] as const satisfies readonly (keyof PeakHours)[]

interface PeakHoursCardProps {
  readonly startHour: number
  readonly working: readonly number[]
  readonly peaks: PeakHours
  /** Пики не изменены — «Вернуть как в расчёте» не нужна. */
  readonly isDefault: boolean
  readonly error: string | null
  readonly disabled: boolean
  readonly onChange: (peaks: PeakHours) => void
  readonly onReset: () => void
}

/**
 * «Пиковые часы» (16197:1541; PRD 11.4): ряды приёмки и отгрузки от начала первой смены, клик отмечает пик (D-102).
 * Часы вне смен видны пунктиром и не отмечаются.
 */
export function PeakHoursCard({ startHour, working, peaks, isDefault, error, disabled, onChange, onReset }: PeakHoursCardProps) {
  const hours = hoursFrom(startHour)
  const offShift = hours.filter((h) => !working.includes(h))
  return (
    <Card as="section" padding={20} gap={12} aria-labelledby="simulation-peaks-title">
      <div className="flex items-center justify-between gap-16">
        <h2 id="simulation-peaks-title" className="type-overline text-text-secondary">{t.title}</h2>
        {!isDefault && !disabled && <TextButton icon={RotateCcw} onClick={onReset}>{t.reset}</TextButton>}
      </div>
      <div className="flex flex-col gap-8">
        {FLOWS.map((flow, index) => (
          <HourGrid
            key={flow}
            label={t[flow]}
            hours={hours}
            selected={peaks[flow]}
            disabledHours={offShift}
            hourLabel={(h) => t.hour(hourText(h), hourText((h + 1) % 24), t[flow])}
            showHourLabels={index === FLOWS.length - 1}
            disabled={disabled}
            onChange={(selected) => { onChange({ ...peaks, [flow]: selected }) }}
          />
        ))}
      </div>
      {error
        ? <p role="alert" className="type-caption font-medium text-danger">{error}</p>
        : <p className="type-caption text-text-secondary">{t.note}</p>}
    </Card>
  )
}
