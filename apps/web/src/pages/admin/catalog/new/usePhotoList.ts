import { useCallback, useEffect, useRef, useState } from 'react'
import { UPLOAD_RULES } from '@/shared/config/upload'

export interface RobotPhoto {
  readonly id: string
  readonly name: string
  /** Адрес предпросмотра `blob:`; освобождается при удалении и уходе со страницы. */
  readonly url: string
}

export interface PhotoList {
  readonly photos: readonly RobotPhoto[]
  /** Сколько файлов не поместилось в лимит при последнем добавлении. */
  readonly overflow: number
  readonly add: (files: readonly File[]) => void
  readonly remove: (id: string) => void
}

const MAX_PHOTOS = UPLOAD_RULES.robotPhoto.maxFiles

/**
 * Фото карточки А2: до 8 (D-18), первое — обложка. Формат и размер проверяет Dropzone,
 * здесь — общий лимит: лишние файлы отбрасываются, число отброшенных возвращается для подсказки.
 */
export function usePhotoList(): PhotoList {
  const [photos, setPhotos] = useState<readonly RobotPhoto[]>([])
  const [overflow, setOverflow] = useState(0)
  const urls = useRef(new Set<string>())

  useEffect(() => {
    const owned = urls.current
    return () => {
      owned.forEach((url) => { URL.revokeObjectURL(url) })
      owned.clear()
    }
  }, [])

  // Обновление без побочных эффектов внутри setState: в StrictMode функция-обновитель вызывается дважды.
  const add = (files: readonly File[]) => {
    const room = Math.max(0, MAX_PHOTOS - photos.length)
    const added = files.slice(0, room).map((file) => {
      const url = URL.createObjectURL(file)
      urls.current.add(url)
      return { id: url, name: file.name, url }
    })
    setOverflow(Math.max(0, files.length - room))
    setPhotos([...photos, ...added])
  }

  const remove = useCallback((id: string) => {
    setOverflow(0)
    setPhotos((prev) => prev.filter((photo) => photo.id !== id))
    URL.revokeObjectURL(id)
    urls.current.delete(id)
  }, [])

  return { photos, overflow, add, remove }
}
