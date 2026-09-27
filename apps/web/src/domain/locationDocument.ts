import type { IsoDateTime } from './common'
import type { LocationId } from './location'

export type LocationDocumentId = `DOC-${string}`

/**
 * Что за материал обследования — от этого подпись строки: «CAD-план», «фото», «Excel», «схема» (PRD 10.3, 17б).
 * scheme — PDF, который пользователь назвал схемой; загруженный PDF без пометки — pdf.
 */
export type LocationDocumentKind = 'cad' | 'photo' | 'excel' | 'csv' | 'scheme' | 'pdf'

/** Документ локации: план, фото, таблица или схема обследования. Содержимое платформа не разбирает (PRD 10.3). */
export interface LocationDocument {
  readonly id: LocationDocumentId
  readonly locationId: LocationId
  /** Имя файла; у группы фото — имя первого: «Фото зоны приёмки.jpg». */
  readonly name: string
  /** Расширение без точки, строчными: «dwg». На плашке — прописными. */
  readonly extension: string
  readonly kind: LocationDocumentKind
  /** Файлов в документе: у группы фото больше одного («фото · 10 файлов»). */
  readonly fileCount: number
  readonly uploadedAt: IsoDateTime
  /** Где открыть файл; null — файл к демо-данным не приложен (D-42). */
  readonly url: string | null
}
