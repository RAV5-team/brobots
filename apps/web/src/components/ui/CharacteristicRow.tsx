import type { CharacteristicStatus } from '@/domain'
import { formatDate } from '@/shared/format/date'
import { ru } from '@/shared/i18n/ru'
import { Badge, type VerificationStatus } from './Badge'
import { Chip, type ChipTone } from './Chip'

/** Плашка статуса (16777:991, 16777:1019, 16777:861): подтверждено — лаймовая, оценка — нейтральная, нет данных — приглушённая. */
const STATUS_TONES: Record<CharacteristicStatus, ChipTone> = { confirmed: 'accent', estimate: 'neutral', missing: 'muted' }

function StatusChip({ status }: { readonly status: CharacteristicStatus }) {
  return <Chip tone={STATUS_TONES[status]}>{ru.characteristicStatus[status]}</Chip>
}

interface BaseProps {
  readonly label: string
  /** Значение; null — «нет данных» серым. */
  readonly value: string | null
}

/** К-4: подпись, значение, плашка статуса каталога (Chip), источник и дата колонкой. */
interface DefaultRowProps extends BaseProps {
  readonly variant?: 'default'
  readonly status: CharacteristicStatus
  readonly source: string
  /** `YYYY-MM-DD` — дата значения у источника: «морос.рф · 19.09.2026». */
  readonly date?: string | undefined
}

/** 2.1а «Технические»: источник и дата под значением, плашка статуса проверки (Badge) справа, колонки источника нет. */
interface StackedRowProps extends BaseProps {
  readonly variant: 'stacked'
  readonly verification?: VerificationStatus | undefined
  readonly source?: string | undefined
  readonly date?: string | undefined
}

/** 2.1а «Обзор»: только «подпись — значение», без плашки и источника. */
interface PlainRowProps extends BaseProps {
  readonly variant: 'plain'
}

type CharacteristicRowProps = DefaultRowProps | StackedRowProps | PlainRowProps

const sourceLine = (source: string, date: string | undefined) => (date ? `${source} · ${formatDate(date)}` : source)

function Value({ value }: { readonly value: string | null }) {
  return (
    <span className={value === null ? 'min-w-0 flex-1 type-body font-medium text-text-secondary' : 'min-w-0 flex-1 type-body font-medium text-text'}>
      {value ?? ru.characteristicStatus.missing}
    </span>
  )
}

/**
 * Строка характеристики (components.md: CharacteristicRow; К-4, 16777:987): подпись 160, значение, плашка статуса 128,
 * источник и дата 172; разделитель снизу. Статусы — общие с серыми ячейками сравнения К-3 (D-76).
 * `variant="stacked"` / `"plain"` — окно решения 2.1а (16830:10, 16666:10): тон плашки задаёт вариант, а не статус —
 * «подтверждено» на К-4 лаймовое, в 2.1а серое.
 */
export function CharacteristicRow(props: CharacteristicRowProps) {
  const { label, value } = props
  if (props.variant === 'plain' || props.variant === 'stacked') {
    return (
      <div className="flex items-start gap-12 border-b border-border py-8">
        <dt className="w-(--rav-characteristic-label-width) shrink-0 type-body text-text-secondary">{label}</dt>
        <dd className="flex min-w-0 flex-1 items-start gap-12">
          {props.variant === 'plain'
            ? <Value value={value} />
            : (
                <>
                  <span className="flex min-w-0 flex-1 flex-col gap-4">
                    <Value value={value} />
                    {props.source && <span className="type-caption text-text-secondary">{sourceLine(props.source, props.date)}</span>}
                  </span>
                  {props.verification && <Badge kind={props.verification} />}
                </>
              )}
        </dd>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-12 border-b border-border py-8">
      <dt className="w-(--rav-characteristic-label-width) shrink-0 type-body text-text-secondary">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-start gap-12">
        <Value value={value} />
        <span className="flex w-(--rav-characteristic-status-width) shrink-0"><StatusChip status={props.status} /></span>
        <span className="w-(--rav-characteristic-source-width) shrink-0 type-caption text-text-secondary">
          {sourceLine(props.source, props.date)}
        </span>
      </dd>
    </div>
  )
}
