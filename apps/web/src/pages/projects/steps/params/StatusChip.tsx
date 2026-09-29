import { ArrowDown, ArrowRight, CircleHelp } from 'lucide-react'
import { useState } from 'react'
import { generatePath } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { ButtonLink } from '@/components/ui/Button'
import { Chip, type ChipTone } from '@/components/ui/Chip'
import { Popover } from '@/components/ui/Popover'
import type { LocationId, LocationProcessId } from '@/domain'
import { formatCount } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import type { MissingItem } from './paramsModel'

const t = ru.project.params.process

interface StatusChipProps {
  readonly processId: LocationProcessId
  readonly processName: string
  readonly locationId: LocationId
  readonly missing: readonly MissingItem[]
  /** Выбранный процесс: тёмный чип, пункты поповера ведут к строкам («↓»). */
  readonly selected: boolean
  readonly onReveal: (item: MissingItem) => void
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * Колонка «Данные для оценки» (16969:10): чип-кнопка с поповером. Красный — только «Блокирует подбор» (правило cap 1.1);
 * «Не хватает данных» у выбранного процесса — тёмный, у остальных — серый. Поповер: что не заполнено и где это заполнить.
 */
export function StatusChip({ processId, processName, locationId, missing, selected, onReveal }: StatusChipProps) {
  const [open, setOpen] = useState(false)
  if (missing.length === 0) return <Chip tone="ready">{t.allFilled}</Chip>

  const blocking = missing.filter((m) => m.impact === 'blocks')
  const tone: ChipTone = blocking.length > 0 ? 'danger' : selected ? 'inverse' : 'neutral'
  const [block] = blocking
  const title = block
    ? (blocking.length === 1 ? t.blockedTitles[block.code] : undefined) ?? t.blockedTitle(blocking.map((m) => m.label).join(', '))
    : t.missingTitle(formatCount(missing.length, ru.plural.values))
  // Почему подбор недоступен и когда станет доступен (17009:2734).
  const reason = block ? [...blocking.map((m) => t.blockReasons[m.code]).filter((r): r is string => r !== undefined), t.blockedHint].join(' ') : null
  const status = blocking.length > 0 ? t.blocksMatching : t.needsData
  const hasSite = missing.some((m) => m.scope === 'site')
  const action = blocking.length === 0 && hasSite
    ? <ButtonLink to={generatePath(ROUTE_PATHS.locationParams, { locationId })}>{t.refineSite}</ButtonLink>
    : (
        <ButtonLink to={generatePath(ROUTE_PATHS.locationProcess, { locationId, locationProcessId: processId })}>
          {t.editProcess}<ArrowRight aria-hidden size={16} />
        </ButtonLink>
      )

  return (
    <Popover
      title={title}
      open={open}
      onOpenChange={setOpen}
      action={action}
      trigger={(
        <button type="button" aria-label={t.statusOf(status, processName)} className="rounded-full transition-shadow hover:shadow-raised-sm">
          <Chip tone={tone}>{status}<CircleHelp aria-hidden size={14} /></Chip>
        </button>
      )}
    >
      {reason && <p className="type-caption text-text-secondary">{reason}</p>}
      <ul className="flex flex-wrap gap-8">
        {missing.map((item) => (
          <li key={item.code}>
            {selected
              ? (
                  <button
                    type="button"
                    aria-label={t.goToValue(item.label)}
                    className="rounded-full transition-shadow hover:shadow-raised-sm"
                    onClick={() => {
                      setOpen(false)
                      onReveal(item)
                    }}
                  >
                    <Chip>{capitalize(item.label)}<ArrowDown aria-hidden size={12} /></Chip>
                  </button>
                )
              : <Chip>{capitalize(item.label)}</Chip>}
          </li>
        ))}
      </ul>
      <p className="type-caption text-text-secondary">{t.fillHint}</p>
    </Popover>
  )
}
