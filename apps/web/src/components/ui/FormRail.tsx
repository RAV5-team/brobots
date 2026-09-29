import { ArrowRight } from 'lucide-react'
import { useId, useRef, type ChangeEvent, type ReactNode } from 'react'
import { Button } from './Button'
import { MergedButton } from './MergedButton'

export interface FormRailSubmit {
  readonly label: string
  readonly disabled: boolean
  /** Почему кнопка недоступна: «Гость не сохраняет» (D-14). Связан с кнопкой через aria-describedby. */
  readonly note?: string | null
  /** Пояснение только для скринридера: на макете причины нет, кнопка просто недоступна (А2 без фото, 15966:6191). */
  readonly noteHidden?: boolean
}

export interface FormRailExcel {
  readonly importLabel: string
  readonly templateLabel: string
  /** Пояснение: почему кнопки недоступны или как заполнить шаблон. */
  readonly note: string
  /** Имя скрытого поля файла для скринридера. */
  readonly fileLabel?: string
  /** Скачать шаблон. Без обработчика кнопка недоступна. */
  readonly onDownload?: () => void
  /** Загрузить заполненный шаблон. Без обработчика кнопка недоступна. */
  readonly onImport?: (file: File) => void
}

interface FormRailProps {
  /** Имя области для скринридера — у формы с меню кабинета два `aside`. */
  readonly label: string
  /** Сводка формы: карточка готовности или проверки. */
  readonly summary: ReactNode
  /** Сводка ошибок проверки или сбоя сохранения — объявляется скринридеру. */
  readonly message?: string | null
  /** Итог сохранения: «Изменения сохранены · 14:32» (17а). */
  readonly status?: string | null
  /** Главное действие — отправка формы («Сохранить …»). */
  readonly submit?: FormRailSubmit
  /** Импорт из Excel и шаблон. Без обработчиков кнопки недоступны, с пояснением. */
  readonly excel?: FormRailExcel
  /** Прочее под действиями. */
  readonly children?: ReactNode
}

/**
 * Правая панель формы (components.md: FormRail; 09а 15935:1254, 14 15950:2157, А2 15966:6194): сводка, сообщения,
 * отправка и Excel. Липкая: кнопку сохранения видно на всей высоте формы (D-04, D-31).
 */
export function FormRail({ label, summary, message, status, submit, excel, children }: FormRailProps) {
  const submitNoteId = useId()
  const excelNoteId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const submitNote = submit?.note ?? null
  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) excel?.onImport?.(file)
  }
  return (
    <aside aria-label={label} className="sticky top-24 flex w-(--rav-form-rail-width) shrink-0 flex-col gap-16 self-start">
      {summary}
      {message && <p role="alert" className="type-caption font-medium text-danger">{message}</p>}
      {status && <p role="status" className="type-caption text-text-secondary">{status}</p>}
      {submit && (
        <MergedButton
          type="submit"
          block
          label={submit.label}
          icon={ArrowRight}
          disabled={submit.disabled}
          aria-describedby={submitNote ? submitNoteId : undefined}
        />
      )}
      {submitNote && <p id={submitNoteId} className={submit?.noteHidden ? 'sr-only' : 'type-caption text-text-secondary'}>{submitNote}</p>}
      {excel && (
        <>
          <Button className="w-full" disabled={excel.onImport === undefined} aria-describedby={excelNoteId} onClick={() => { fileRef.current?.click() }}>{excel.importLabel}</Button>
          <Button className="w-full" disabled={excel.onDownload === undefined} aria-describedby={excelNoteId} onClick={() => { excel.onDownload?.() }}>{excel.templateLabel}</Button>
          {excel.onImport && (
            <input ref={fileRef} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" aria-label={excel.fileLabel ?? excel.importLabel} onChange={chooseFile} />
          )}
          <p id={excelNoteId} className="type-caption text-text-muted">{excel.note}</p>
        </>
      )}
      {children}
    </aside>
  )
}
