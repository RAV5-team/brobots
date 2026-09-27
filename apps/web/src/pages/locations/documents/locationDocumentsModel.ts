import type { LocationDocument } from '@/domain'
import { IMAGE_EXTENSIONS, extensionOf } from '@/shared/config/upload'
import { formatCount, formatDayOf } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'

const t = ru.location.documents
const IMAGES: readonly string[] = IMAGE_EXTENSIONS

/** Подпись строки: «фото · 10 файлов · загружено 10.09.2026» (PRD 10.3, 16005:1065). */
export function documentCaption(document: LocationDocument): string {
  const parts = [
    t.kinds[document.kind],
    document.fileCount > 1 ? formatCount(document.fileCount, t.files) : null,
    t.uploaded(formatDayOf(document.uploadedAt)),
  ]
  return parts.filter((p): p is string => p !== null).join(' · ')
}

/** Плашка типа: расширение прописными — «DWG», «XLSX». */
export const documentBadge = (document: LocationDocument): string => document.extension.toUpperCase()

/**
 * Файлы одной загрузки → документы (D-42): изображения, выбранные вместе, — одна группа «фото · N файлов»
 * на месте первого из них, остальные файлы — каждый своим документом. Порядок выбора сохраняется.
 */
export function groupUploads(files: readonly File[]): readonly (readonly File[])[] {
  const images = files.filter((f) => IMAGES.includes(extensionOf(f.name)))
  const firstImage = images[0]
  return files.flatMap((file) => {
    if (!images.includes(file)) return [[file]]
    return file === firstImage ? [images] : []
  })
}
