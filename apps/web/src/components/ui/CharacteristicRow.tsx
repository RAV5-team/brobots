import type { CharacteristicStatus } from '@/domain'
import { formatDate } from '@/shared/format/date'
import { ru } from '@/shared/i18n/ru'
import { Chip, type ChipTone } from './Chip'

/** Плашка статуса (16777:991, 16777:1019, 16777:861): подтверждено — лаймовая, оценка — нейтральная, нет данных — приглушённая. */
const STATUS_TONES: Record<CharacteristicStatus, ChipTone> = { confirmed: 'accent', estimate: 'neutral', missing: 'muted' }

function StatusChip({ status }: { readonly status: CharacteristicStatus }) {
  return <Chip tone={STATUS_TONES[status]}>{ru.characteristicStatus[status]}</Chip>
}

interface CharacteristicRowProps {
  readonly label: string
  /** Значение; null — «нет данных» серым (статус `missing`). */
  readonly value: string | null
  readonly status: CharacteristicStatus
  readonly source: string
  /** `YYYY-MM-DD` — дата значения у источника: «морос.рф · 19.09.2026». */
  readonly date?: string | undefined
}

/**
 * Строка характеристики (components.md: CharacteristicRow; К-4, 16777:987): подпись 160, значение, плашка статуса 128,
 * источник и дата 172; разделитель снизу. Статусы — общие с серыми ячейками сравнения К-3 (D-76).
 */
export function CharacteristicRow({ label, value, status, source, date }: CharacteristicRowProps) {
  return (
    <div className="flex items-start gap-12 border-b border-border py-8">
      <dt className="w-(--rav-characteristic-label-width) shrink-0 type-body text-text-secondary">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-start gap-12">
        <span className={value === null ? 'min-w-0 flex-1 type-body font-medium text-text-secondary' : 'min-w-0 flex-1 type-body font-medium text-text'}>
          {value ?? ru.characteristicStatus.missing}
        </span>
        <span className="flex w-(--rav-characteristic-status-width) shrink-0"><StatusChip status={status} /></span>
        <span className="w-(--rav-characteristic-source-width) shrink-0 type-caption text-text-secondary">
          {date ? `${source} · ${formatDate(date)}` : source}
        </span>
      </dd>
    </div>
  )
}
