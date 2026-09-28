import { ROUTE_PATHS } from '@/app/routePaths'
import { Button, ButtonLink } from '@/components/ui/Button'
import { FormulaStats } from '@/components/ui/FormulaStats'
import { Modal } from '@/components/ui/Modal'
import { ru } from '@/shared/i18n/ru'
import { howCalcSections, type HowCalcInput } from './howCalculatedModel'

const t = ru.project.matching
const h = t.howCalc

interface HowCalculatedPanelProps extends HowCalcInput {
  /** Пользователь менял «Параметры расчёта»: в демо-расчёте они не отражены. */
  readonly paramsChanged: boolean
  readonly onClose: () => void
}

/**
 * «Как рассчитано» (03a, 16202:490; PRD 11.3, ТЗ 3.4.5, 3.5.8): боковая панель поверх 03 — потребность, цикл и парк,
 * деньги и балл рейтинга выбранного варианта. Только чтение: веса менять нельзя (03b не делаем, D-54, D-88).
 */
export function HowCalculatedPanel({ paramsChanged, onClose, ...input }: HowCalculatedPanelProps) {
  const variant = t.variantName(input.variant.solutionName, t.acquisition[input.variant.acquisition])
  return (
    <Modal
      size="side"
      title={h.title}
      description={h.lead(variant, input.processName)}
      open
      onOpenChange={(open) => { if (!open) onClose() }}
      footer={(
        <>
          <ButtonLink to={ROUTE_PATHS.help}>{h.methodology}</ButtonLink>
          <Button variant="primary" onClick={onClose}>{h.close}</Button>
        </>
      )}
    >
      {howCalcSections(input).map((section) => (
        <section key={section.key} aria-labelledby={`how-calc-${section.key}`} className="flex flex-col gap-8">
          <h3 id={`how-calc-${section.key}`} className="type-heading text-text">{section.title}</h3>
          <FormulaStats layout="list" label={h.formulasLabel(section.title)} stats={section.stats} />
        </section>
      ))}
      <div className="flex flex-col gap-4 rounded-lg bg-surface-sunken px-16 py-12">
        <p className="type-caption font-semibold text-text">{h.note.title}</p>
        <p className="type-caption text-text-secondary">{h.note.text}</p>
        {paramsChanged && <p className="type-caption font-medium text-text">{h.note.changed}</p>}
      </div>
    </Modal>
  )
}
