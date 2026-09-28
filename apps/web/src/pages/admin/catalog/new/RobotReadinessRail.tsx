import { Card, CardStat, CardTitle } from '@/components/ui/Card'
import { FormRail } from '@/components/ui/FormRail'
import { formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { REQUIRED_TOTAL } from './robotForm'

const t = ru.robotNew.rail

export interface RobotReadiness {
  readonly required: number
  readonly classes: number
  readonly photos: number
  readonly note: string
}

interface RobotReadinessRailProps {
  readonly readiness: RobotReadiness
  readonly saving: boolean
  /** Сводка ошибок проверки или сбоя сохранения — объявляется скринридеру. */
  readonly message: string | null
}

/**
 * Правая панель «Готовность карточки» и действия (PRD 6.3; 15966:6194). Липкая: «Сохранить робота» видна
 * на всей высоте формы (D-04). Без фото кнопка недоступна (макет, 15966:6191). Excel — после экрана загрузки (PRD 6.4).
 */
export function RobotReadinessRail({ readiness, saving, message }: RobotReadinessRailProps) {
  const noPhotos = readiness.photos === 0
  return (
    <FormRail
      label={t.title}
      summary={(
        <Card>
          <CardTitle>{t.title}</CardTitle>
          <dl className="flex flex-col gap-12">
            <CardStat label={t.required} value={`${formatNumber(readiness.required)} / ${formatNumber(REQUIRED_TOTAL)}`} />
            <CardStat label={t.classes} value={formatNumber(readiness.classes)} />
            <CardStat label={t.photos} value={formatNumber(readiness.photos)} />
          </dl>
          <p className="type-caption text-text-secondary">{readiness.note}</p>
        </Card>
      )}
      message={message}
      submit={{ label: saving ? t.saving : t.save, disabled: noPhotos || saving, note: noPhotos ? ru.robotNew.photos.required : null, noteHidden: true }}
      excel={{ importLabel: t.importExcel, templateLabel: t.downloadTemplate, note: t.excelSoon }}
    />
  )
}
