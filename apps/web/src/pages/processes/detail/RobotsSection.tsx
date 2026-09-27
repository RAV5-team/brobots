import { Card } from '@/components/ui/Card'
import { formatCount, formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { CONFIDENCE_ORDER, robotCard, type RobotSummary } from './processDetailModel'

const t = ru.processCard.robots

interface RobotsSectionProps {
  readonly classCode: string
  readonly summary: RobotSummary
}

/**
 * «Роботы с классом OP-01»: совпадение по классу до проверки условий, разбивка по качеству данных (PRD 3.4, 9.3; 15935:1462).
 * Карточки решений — 88 px, как в макете: длинные названия и производители обрезаются, полный текст — в подсказке.
 */
export function RobotsSection({ classCode, summary }: RobotsSectionProps) {
  return (
    <Card aria-labelledby="robots-title">
      <div className="flex items-start justify-between gap-16">
        <div className="flex flex-col gap-4">
          <h2 id="robots-title" className="type-overline text-text-muted">{t.title(classCode)}</h2>
          <p className="type-caption text-text-secondary">{t.lead}</p>
        </div>
        <p className="type-heading whitespace-nowrap text-text">{formatCount(summary.total, ru.plural.robots)}</p>
      </div>

      {summary.total === 0 ? (
        <p className="type-body text-text-secondary">{t.empty}</p>
      ) : (
        <>
          <ul className="grid grid-cols-3 gap-8">
            {CONFIDENCE_ORDER.map((confidence) => (
              <li key={confidence}>
                <Card as="div" variant="inset" padding={16} gap={4} className="h-108">
                  <p className="type-display-lg text-text">{formatNumber(summary.byConfidence[confidence])}</p>
                  <p className="type-caption text-text-secondary">{t.confidence[confidence]}</p>
                </Card>
              </li>
            ))}
          </ul>
          <ul aria-label={t.listLabel} className="grid grid-cols-3 gap-8">
            {summary.featured.map(robotCard).map((robot) => (
              <li key={robot.id} className="flex h-88 min-w-0 flex-col gap-4 rounded-md bg-surface-sunken p-12">
                <h3 title={robot.name} className="truncate type-body font-semibold text-text">{robot.name}</h3>
                <p title={robot.vendor} className="truncate type-caption text-text-secondary">{robot.vendor}</p>
                <div className="flex items-start justify-between gap-8">
                  <p className="type-caption font-medium text-text-secondary">{robot.trl}</p>
                  <p className="type-body font-semibold whitespace-nowrap text-text">{robot.price}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="type-caption text-text-secondary">{t.footnote}</p>
    </Card>
  )
}
