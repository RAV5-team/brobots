import { ArrowDown } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { IconButton } from '@/components/ui/IconButton'
import { RadioGroup, type RadioOption } from '@/components/ui/RadioGroup'
import type { LocationProcessId } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import type { MissingItem, ParamsView, ProcessCard } from './paramsModel'
import { valueAnchor } from './paramsModel'
import { ValueTable } from '../../shared/ValueTable'

const t = ru.project.params

interface ProcessBlockProps {
  readonly view: ParamsView
  readonly onSelect: (id: LocationProcessId) => void
  readonly readOnly: boolean
}

function CardBody({ card }: { readonly card: ProcessCard }) {
  return (
    <span className="flex flex-col gap-8">
      <span className="type-caption text-text-secondary">{card.workers}</span>
      <span className="type-body font-semibold text-text">{card.volume}</span>
      {card.object && <span className="type-caption text-text-secondary">{card.object}</span>}
      {card.missing.length > 0 && (
        <span className="type-caption text-text-secondary">{t.process.missingLine(card.missing.map((m) => m.label).join(', '))}</span>
      )}
      <span className="flex">
        <Chip tone={card.canMatch ? 'ready' : 'unconfirmed'} size="sm">{card.canMatch ? t.process.canMatch : t.process.blocked}</Chip>
      </span>
    </span>
  )
}

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** «↓»: React Router `Link` на `#…` не скроллит — ведём к строке сами (PRD 11.2). */
function goToValue(code: string) {
  const el = document.getElementById(valueAnchor(code))
  if (!el) return
  el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' })
  if (el instanceof HTMLElement) el.focus({ preventScroll: true })
}

/** Плашка незаполненных значений выбранного процесса: «↓» ведёт к значению в блоке (PRD 11.2). */
function MissingPlate({ items }: { readonly items: readonly MissingItem[] }) {
  if (items.length === 0) return <p className="type-caption text-text-secondary">{t.process.allFilled}</p>
  return (
    <Card variant="sunken" padding={16} gap={8} as="div">
      <h3 className="type-overline font-medium text-text-muted">{t.process.missingTitle}</h3>
      <ul className="flex flex-col gap-4">
        {items.map((item) => (
          <li key={item.code} className="flex items-center justify-between gap-12">
            <span className="type-body text-text">
              {item.label}
              <span className="type-caption text-text-secondary"> · {t.impact[item.impact]}</span>
            </span>
            <IconButton label={t.process.goToValue(item.label)} icon={ArrowDown} size={36} onClick={() => { goToValue(item.code) }} />
          </li>
        ))}
      </ul>
    </Card>
  )
}

/** Блок 1 «Выбор процесса»: процессы локации карточками, у выбранного — незаполненные значения и группы А–Г. */
export function ProcessBlock({ view, onSelect, readOnly }: ProcessBlockProps) {
  const options: readonly RadioOption<LocationProcessId>[] = view.cards.map((card) => ({
    value: card.id,
    label: card.name,
    description: <CardBody card={card} />,
  }))
  const selectedName = view.cards.find((c) => c.id === view.selected?.locationProcess.id)?.name
  return (
    <Card aria-labelledby="params-process-title" gap={16}>
      <header className="flex flex-col gap-4">
        <h2 id="params-process-title" className="type-heading text-text">{t.process.title}</h2>
        <p className="type-caption text-text-secondary">{t.process.hint}</p>
      </header>
      <RadioGroup
        label={t.process.choice}
        variant="cards"
        columns={3}
        options={options}
        {...(view.selected ? { value: view.selected.locationProcess.id } : {})}
        onChange={onSelect}
        disabled={readOnly}
      />
      {view.selected && selectedName && (
        <section aria-label={t.process.groupsCaption(selectedName)} className="flex flex-col gap-16">
          <MissingPlate items={view.missing} />
          {view.groups.map((group) => <ValueTable key={group.key} title={group.title} rows={group.rows} />)}
        </section>
      )}
    </Card>
  )
}
