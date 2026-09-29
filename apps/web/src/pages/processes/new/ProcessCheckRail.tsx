import { Card, CardStat, CardTitle } from '@/components/ui/Card'
import { FormRail } from '@/components/ui/FormRail'
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
  /** Итог загрузки шаблона — «В форму перенесено значений: 12». */
  readonly status?: string | null
  /** Скачать шаблон текущей формы и загрузить его обратно. */
  readonly onDownloadTemplate: () => void
  readonly onImportTemplate: (file: File) => void
}

/**
 * Правая панель проверки и действия формы процесса (PRD 9.2, 10.4; 15935:1254, 15953:5569). Липкая: кнопку сохранения
 * видно без прокрутки на всей высоте формы (D-04, D-31). Шаблон Excel — тот же лист, что у локации: меняется столбец «Значение».
 */
export function ProcessCheckRail({ copy, rows, canSave, saving, message, status = null, onDownloadTemplate, onImportTemplate }: ProcessCheckRailProps) {
  return (
    <FormRail
      label={copy.title}
      summary={(
        <Card>
          <CardTitle>{copy.title}</CardTitle>
          <dl className="flex flex-col gap-12">
            {rows.map((row) => <CardStat key={row.label} label={row.label} value={row.value} />)}
          </dl>
          <p className="type-caption text-text-secondary">{copy.note}</p>
        </Card>
      )}
      message={message}
      status={status}
      submit={{ label: saving ? t.saving : copy.save, disabled: !canSave || saving, note: canSave ? null : t.guestSave }}
      excel={{
        importLabel: t.importExcel,
        templateLabel: t.downloadTemplate,
        note: t.excelHint,
        fileLabel: t.excelFile,
        onDownload: onDownloadTemplate,
        onImport: onImportTemplate,
      }}
    />
  )
}
