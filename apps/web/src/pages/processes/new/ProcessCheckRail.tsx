import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardStat, CardTitle } from '@/components/ui/Card'
import { MergedButton } from '@/components/ui/MergedButton'
import { ru } from '@/shared/i18n/ru'

const t = ru.processNew.rail

export interface CheckRow {
  readonly label: string
  readonly value: string
}

/** Тексты панели: у шаблона 09а — «Проверка шаблона», у копии на локации 16 — «Проверка процесса на локации» (PRD 15 · №47). */
export interface CheckRailCopy {
  readonly title: string
  readonly note: string
  readonly save: string
}

interface ProcessCheckRailProps {
  readonly copy: CheckRailCopy
  readonly rows: readonly CheckRow[]
  readonly canSave: boolean
  readonly saving: boolean
  /** Сводка ошибок проверки или сбоя сохранения — объявляется скринридеру. */
  readonly message: string | null
}

/**
 * Правая панель проверки и действия формы процесса (PRD 9.2, 10.4; 15935:1254, 15953:5569). Липкая: кнопку сохранения
 * видно без прокрутки на всей высоте формы (D-04, D-31). Excel — после экрана загрузки (PRD 9.4), пока недоступно с подсказкой.
 */
export function ProcessCheckRail({ copy, rows, canSave, saving, message }: ProcessCheckRailProps) {
  return (
    <aside className="sticky top-24 flex w-(--rav-form-rail-width) shrink-0 flex-col gap-16 self-start">
      <Card>
        <CardTitle>{copy.title}</CardTitle>
        <dl className="flex flex-col gap-12">
          {rows.map((row) => <CardStat key={row.label} label={row.label} value={row.value} />)}
        </dl>
        <p className="type-caption text-text-secondary">{copy.note}</p>
      </Card>
      {message && <p role="alert" className="type-caption font-medium text-danger">{message}</p>}
      <MergedButton
        type="submit"
        block
        label={saving ? t.saving : copy.save}
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
