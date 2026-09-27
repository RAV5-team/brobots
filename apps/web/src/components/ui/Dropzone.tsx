import { clsx } from 'clsx'
import { useId, useRef, useState, type DragEvent } from 'react'
import { UPLOAD_RULES, validateFiles, type UploadKind } from '@/shared/config/upload'
import { ru } from '@/shared/i18n/ru'
import { buttonClasses } from './buttonStyles'

interface DropzoneProps {
  /** Правило загрузки из общего конфига (D-18). */
  readonly kind: UploadKind
  readonly title: string
  /** Уже загружено — для подписи «загружено 1 из 8». */
  readonly uploaded?: number
  readonly onFiles: (files: File[]) => void
  readonly disabled?: boolean
  /** Предупреждение формы под подсказкой: «Без фото кнопка «Сохранить робота» недоступна». */
  readonly message?: string | undefined
  /** Размер в раскладке экрана: высота по соседней плитке фото (А2, 15966:6188). */
  readonly className?: string
  /** Для витрины: показать состояние перетаскивания. */
  readonly 'data-demo-state'?: string | undefined
}

/** Зона загрузки файлов (components.md: Dropzone; 15966:6188). Проверяет формат и размер до отправки. */
export function Dropzone({ kind, title, uploaded, onFiles, disabled = false, message, className, ...demo }: DropzoneProps) {
  const rule = UPLOAD_RULES[kind]
  const inputId = useId()
  const hintId = `${inputId}-hint`
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const accept = (list: FileList | null) => {
    const files = list ? Array.from(list) : []
    if (files.length === 0) return
    const { errors } = validateFiles(kind, files)
    const first = errors[0]
    if (first) {
      setError(first.message)
      return
    }
    setError(null)
    onFiles(files)
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    if (!disabled) accept(event.dataTransfer.files)
  }

  const counter = uploaded !== undefined && Number.isFinite(rule.maxFiles) ? ` · ${ru.ui.uploadedOf(uploaded, rule.maxFiles)}` : ''

  return (
    <div
      data-dropzone
      data-dragging={dragging || demo['data-demo-state'] === 'hover' || undefined}
      onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true) }}
      onDragLeave={() => { setDragging(false) }}
      onDrop={onDrop}
      className={clsx(
        'flex flex-col items-center justify-center gap-8 rounded-lg border border-dashed border-border-control bg-surface-muted p-24 text-center transition-colors',
        'data-dragging:border-solid data-dragging:bg-surface-sunken',
        disabled && 'cursor-not-allowed opacity-(--rav-disabled-opacity)',
        className,
      )}
    >
      <p className="type-heading text-text">{title}</p>
      <p id={hintId} className="type-caption text-text-secondary">
        {ru.ui.orChooseFiles}{counter} · {rule.hint}
      </p>
      {(error ?? message) && <p role="alert" className="type-caption text-danger">{error ?? message}</p>}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple={rule.maxFiles > 1}
        accept={rule.extensions.map((e) => `.${e}`).join(',')}
        aria-label={ru.ui.chooseFiles}
        aria-describedby={hintId}
        disabled={disabled}
        onChange={(event) => { accept(event.target.files); event.target.value = '' }}
        className="sr-only"
      />
      <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} className={buttonClasses({ variant: 'secondary' }, 'px-20')}>
        {ru.ui.chooseFiles}
      </button>
    </div>
  )
}
