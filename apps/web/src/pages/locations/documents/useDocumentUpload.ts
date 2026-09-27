import { useRef, useState, type ChangeEvent, type InputHTMLAttributes, type RefObject } from 'react'
import type { LocationId } from '@/domain'
import { useServices } from '@/services/useServices'
import { UPLOAD_RULES, validateFiles } from '@/shared/config/upload'
import { formatCount } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { groupUploads } from './locationDocumentsModel'

const td = ru.location.documents
const ACCEPT = UPLOAD_RULES.locationDocument.extensions.map((e) => `.${e}`).join(',')

export interface UploadMessage {
  readonly tone: 'status' | 'error'
  readonly text: string
}

type FileInputProps = InputHTMLAttributes<HTMLInputElement> & { readonly ref: RefObject<HTMLInputElement | null> }

export interface DocumentUpload {
  readonly uploading: boolean
  readonly message: UploadMessage | null
  /** Открыть выбор файлов. */
  readonly pick: () => void
  /** Свойства скрытого поля выбора файлов — его вставляет экран. */
  readonly inputProps: FileInputProps
}

/**
 * «Добавить документ +»: выбор файлов → проверка по правилу `locationDocument` (D-18) → загрузка документами
 * (фото одной загрузки — группой, D-42) → `onUploaded` перечитывает список без скелетона.
 */
export function useDocumentUpload(locationId: LocationId, onUploaded: () => Promise<void>): DocumentUpload {
  const services = useServices()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<UploadMessage | null>(null)

  const upload = async (files: readonly File[]) => {
    const [firstError] = validateFiles('locationDocument', files).errors
    if (firstError) {
      setMessage({ tone: 'error', text: firstError.file ? `${firstError.file}: ${firstError.message}` : firstError.message })
      return
    }
    setMessage(null)
    setUploading(true)
    let addedCount = 0
    try {
      for (const group of groupUploads(files)) {
        await services.locations.addLocationDocument(locationId, group)
        addedCount += 1
      }
      setMessage({ tone: 'status', text: formatCount(addedCount, td.added) })
    } catch (error) {
      console.error('Не удалось загрузить документ локации', error)
      setMessage({ tone: 'error', text: td.uploadFailed })
    }
    // Перечитываем и после сбоя: часть документов могла успеть загрузиться.
    try {
      await onUploaded()
    } catch (error) {
      console.error('Не удалось перечитать документы локации', error)
    }
    setUploading(false)
  }

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : []
    event.target.value = ''
    if (files.length > 0) void upload(files)
  }

  return {
    uploading,
    message,
    pick: () => inputRef.current?.click(),
    inputProps: { ref: inputRef, type: 'file', hidden: true, multiple: true, accept: ACCEPT, onChange },
  }
}
