import { clsx } from 'clsx'
import { useId, useRef } from 'react'
import { UPLOAD_RULES, validateFiles, type UploadKind } from '@/shared/config/upload'
import { formatFileSize } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { INLINE_ACTION_CLASSES } from './buttonStyles'
import { useFieldControl } from './useFieldControl'

/** Выбранный файл: достаточно имени и размера — сам File держит форма. */
export interface FileInputValue {
  readonly name: string
  readonly size: number
}

interface FileInputProps {
  /** Правило загрузки из общего конфига (D-18). */
  readonly kind: UploadKind
  /** Подпись поля — входит в имя кнопки: «Заменить: Файл или ссылка». */
  readonly label: string
  readonly file: FileInputValue | null
  readonly onChange: (file: File) => void
  /** Файл не прошёл правило: текст со способом исправления (ТЗ 4.5.4) — показать ошибкой поля. */
  readonly onReject: (message: string) => void
  readonly disabled?: boolean
  /** Для витрины: состояние кнопки выбора. */
  readonly 'data-demo-state'?: string | undefined
}

/**
 * Один файл во вдавленной капсуле 44 px: «имя · размер» и действие справа — «Выбрать файл» / «Заменить»
 * (components.md: FileInput; 15966:7670). Формат и размер проверяются до отправки.
 */
export function FileInput({ kind, label, file, onChange, onReject, disabled = false, ...demo }: FileInputProps) {
  const field = useFieldControl()
  const valueId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const rule = UPLOAD_RULES[kind]
  const invalid = field?.invalid ?? false
  const action = file ? ru.ui.replaceFile : ru.ui.chooseFile

  const accept = (list: FileList | null) => {
    const picked = list?.[0]
    if (!picked) return
    const [error] = validateFiles(kind, [picked]).errors
    if (error) onReject(error.message)
    else onChange(picked)
  }

  return (
    <span
      className={clsx(
        'flex h-44 w-full items-center gap-8 rounded-full px-20 transition-colors',
        'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--rav-focus-ring-color)',
        invalid ? 'border-(length:--rav-border-width-control) border-danger-border bg-danger-bg shadow-inset-sm' : 'bg-surface-muted shadow-inset-sm',
        disabled && 'cursor-not-allowed opacity-(--rav-disabled-opacity)',
      )}
    >
      <span id={valueId} className={clsx('min-w-0 flex-1 truncate type-body', file ? 'font-semibold text-text' : 'text-text-muted')}>
        {file ? `${file.name} · ${formatFileSize(file.size)}` : ru.ui.noFile}
      </span>
      {/* Системный выбор файла скрыт: действие — видимая кнопка, одна остановка табуляции. */}
      <input
        ref={inputRef}
        type="file"
        tabIndex={-1}
        aria-hidden
        accept={rule.extensions.map((e) => `.${e}`).join(',')}
        disabled={disabled}
        onChange={(event) => { accept(event.target.files); event.target.value = '' }}
        className="sr-only"
      />
      <button
        type="button"
        id={field?.id}
        aria-label={ru.ui.fileActionLabel(action, label)}
        aria-describedby={clsx(valueId, field?.describedBy)}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        data-demo-state={demo['data-demo-state']}
        onClick={() => inputRef.current?.click()}
        className={INLINE_ACTION_CLASSES}
      >
        {action}
      </button>
    </span>
  )
}
