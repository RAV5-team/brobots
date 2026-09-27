import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardStat, CardTitle } from '@/components/ui/Card'
import { MergedButton } from '@/components/ui/MergedButton'
import { formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { REQUIRED_TOTAL } from './robotForm'

const t = ru.robotNew.rail
const PHOTOS_NOTE_ID = 'robot-photos-required'
const EXCEL_NOTE_ID = 'robot-excel-note'

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
    <aside className="sticky top-24 flex w-(--rav-form-rail-width) shrink-0 flex-col gap-16 self-start">
      <Card>
        <CardTitle>{t.title}</CardTitle>
        <dl className="flex flex-col gap-12">
          <CardStat label={t.required} value={`${formatNumber(readiness.required)} / ${formatNumber(REQUIRED_TOTAL)}`} />
          <CardStat label={t.classes} value={formatNumber(readiness.classes)} />
          <CardStat label={t.photos} value={formatNumber(readiness.photos)} />
        </dl>
        <p className="type-caption text-text-secondary">{readiness.note}</p>
      </Card>
      {message && <p role="alert" className="type-caption font-medium text-danger">{message}</p>}
      <MergedButton
        type="submit"
        block
        label={saving ? t.saving : t.save}
        icon={ArrowRight}
        disabled={noPhotos || saving}
        aria-describedby={noPhotos ? PHOTOS_NOTE_ID : undefined}
      />
      {noPhotos && <p id={PHOTOS_NOTE_ID} className="sr-only">{ru.robotNew.photos.required}</p>}
      <Button className="w-full" disabled aria-describedby={EXCEL_NOTE_ID}>{t.importExcel}</Button>
      <Button className="w-full" disabled aria-describedby={EXCEL_NOTE_ID}>{t.downloadTemplate}</Button>
      <p id={EXCEL_NOTE_ID} className="type-caption text-text-muted">{t.excelSoon}</p>
    </aside>
  )
}
