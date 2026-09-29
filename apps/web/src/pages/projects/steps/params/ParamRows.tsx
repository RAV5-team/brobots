import { clsx } from 'clsx'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Chip } from '@/components/ui/Chip'
import type { ValueOrigin } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import type { ValueRow } from './paramsModel'

const t = ru.project.params

/** Подтверждённые значения на доске залиты лаймом (16992:354); у Badge лаймового тона нет — берём Chip ready. */
const LIME: readonly ValueOrigin[] = ['file', 'specified', 'computed', 'location']
/** «нет данных» и «вне расчёта» — серая заливка (16992:207, 16992:199). */
const GREY: readonly ValueOrigin[] = ['missing', 'outOfScope']

function OriginMark({ origin }: { readonly origin: ValueOrigin }) {
  const mark = LIME.includes(origin)
    ? <Chip tone="ready">{ru.valueBadges[origin]}</Chip>
    : GREY.includes(origin) ? <Chip>{ru.valueBadges[origin]}</Chip> : <Badge kind={origin} />
  return <span className="flex w-(--rav-norms-pill-width) shrink-0 justify-center">{mark}</span>
}

interface ParamRowsProps {
  readonly label: string
  readonly rows: readonly ValueRow[]
  /** Подпись под «нет данных»: ссылка в профиль локации или процесса. */
  readonly missingAction?: (row: ValueRow) => ReactNode
}

/**
 * Значения группы шага 1 только для чтения (доска 16325, 16992:354): подпись и пояснение · статус · значение справа.
 * Строка с якорем — цель «↓» из поповера статуса процесса; фокус на неё переводит `useGroupReveal`.
 */
export function ParamRows({ label, rows, missingAction }: ParamRowsProps) {
  return (
    <dl aria-label={label} className="flex flex-col">
      {rows.map((row) => {
        const missing = row.value === null
        return (
          <div
            key={row.key}
            {...(row.anchor ? { id: row.anchor, tabIndex: -1 } : {})}
            // «вне расчёта» приглушена целиком, как неактивная (16992:492).
            className={clsx('flex items-center gap-12 rounded-xs py-8', row.origin === 'outOfScope' && 'opacity-(--rav-disabled-opacity)')}
          >
            <dt className="flex min-w-0 flex-1 flex-col">
              <span className="type-body text-text-secondary">{row.label}</span>
              {row.note && !missing && <span className="type-caption text-text-muted">{row.note}</span>}
            </dt>
            <dd className="flex shrink-0 items-center gap-12">
              <OriginMark origin={row.origin} />
              {/* Нет данных: «нет данных» — одно слово в чипе (правило cap 1.1), в значении — где заполнить (16992:691). */}
              <span className="flex w-(--rav-params-label-width) flex-col items-end text-right">
                {!missing && <span className="type-body font-semibold text-balance text-text">{row.value}</span>}
                {missing && (row.note
                  ? (missingAction ? missingAction(row) : <span className="type-caption text-text-muted">{row.note}</span>)
                  : <span className="type-body text-text-muted">{t.rows.noData}</span>)}
              </span>
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
