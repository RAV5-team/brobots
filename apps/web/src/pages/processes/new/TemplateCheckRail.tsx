import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardStat, CardTitle } from '@/components/ui/Card'
import { MergedButton } from '@/components/ui/MergedButton'
import { formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'

const t = ru.processNew.rail

export interface TemplateCheck {
  readonly formulas: number
  readonly required: number
  readonly robots: number
  readonly locations: number
}

interface TemplateCheckRailProps {
  readonly check: TemplateCheck
  readonly canSave: boolean
  readonly saving: boolean
  /** Сводка ошибок проверки или сбоя сохранения — объявляется скринридеру. */
  readonly message: string | null
}

/**
 * Правая панель «Проверка шаблона» и действия формы (PRD 9.2; 15935:1254). Липкая: «Сохранить процесс» видно
 * без прокрутки на всей высоте формы (D-04, D-31). Excel — после экрана загрузки (PRD 9.4), пока недоступно с подсказкой.
 */
export function TemplateCheckRail({ check, canSave, saving, message }: TemplateCheckRailProps) {
  return (
    <aside className="sticky top-24 flex w-(--rav-form-rail-width) shrink-0 flex-col gap-16 self-start">
      <Card>
        <CardTitle>{t.title}</CardTitle>
        <dl className="flex flex-col gap-12">
          <CardStat label={t.formulas} value={formatNumber(check.formulas)} />
          <CardStat label={t.required} value={formatNumber(check.required)} />
          <CardStat label={t.robots} value={formatNumber(check.robots)} />
          <CardStat label={t.locations} value={formatNumber(check.locations)} />
        </dl>
        <p className="type-caption text-text-secondary">{t.note}</p>
      </Card>
      {message && <p role="alert" className="type-caption font-medium text-danger">{message}</p>}
      <MergedButton
        type="submit"
        block
        label={saving ? t.saving : t.save}
        icon={ArrowRight}
        disabled={!canSave || saving}
        aria-describedby={canSave ? undefined : 'guest-save-note'}
      />
      {!canSave && <p id="guest-save-note" className="type-caption text-text-secondary">{t.guestSave}</p>}
      <Button className="w-full" disabled aria-describedby="excel-note">{t.importExcel}</Button>
      <Button className="w-full" disabled aria-describedby="excel-note">{t.downloadTemplate}</Button>
      <p id="excel-note" className="type-caption text-text-muted">{t.excelSoon}</p>
    </aside>
  )
}
