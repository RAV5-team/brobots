/**
 * Правила загрузки файлов — в одном месте (D-18).
 * Документы локации 17б (.dwg, группа из 10 фото) общему правилу противоречат — для них своё правило
 * `locationDocument` (предложение, D-18 open, PRD 15 · №55).
 */

import { ru } from '@/shared/i18n/ru'

const MB = 1024 * 1024

const DOCUMENT_EXTENSIONS = ['pdf', 'xlsx', 'xls', 'csv', 'png', 'jpg', 'jpeg', 'webp'] as const
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const
/** Материалы обследования локации: к общему правилу добавлен CAD-план .dwg (PRD 10.3). */
const LOCATION_DOCUMENT_EXTENSIONS = [...DOCUMENT_EXTENSIONS, 'dwg'] as const

/** Лимиты правила; тексты подсказок и ошибок — в словаре `ru.upload` и строятся от этих чисел. */
interface UploadLimits {
  readonly extensions: readonly string[]
  readonly maxSizeMb: number
  readonly minFiles: number
  readonly maxFiles: number
}

export interface UploadRule extends UploadLimits {
  /** Подсказка под полем загрузки. */
  readonly hint: string
}

const DOCUMENT: UploadLimits = { extensions: DOCUMENT_EXTENSIONS, maxSizeMb: 20, minFiles: 1, maxFiles: Number.POSITIVE_INFINITY }
/**
 * Документы локации 17б: план .dwg и группа фото за раз (PRD 10.3). Предложение до решения команды (D-18, D-42):
 * 20 МБ на файл, как у общего правила; до 20 файлов за одну загрузку — группа из 10 фото помещается с запасом.
 */
const LOCATION_DOCUMENT: UploadLimits = { extensions: LOCATION_DOCUMENT_EXTENSIONS, maxSizeMb: 20, minFiles: 1, maxFiles: 20 }
/** Фото робота в карточке А2: минимум 1, максимум 8. */
const ROBOT_PHOTO: UploadLimits = { extensions: IMAGE_EXTENSIONS, maxSizeMb: 20, minFiles: 1, maxFiles: 8 }

export const UPLOAD_RULES = {
  /** Общее правило форм: источники данных (А7), шаблоны, документы. */
  document: { ...DOCUMENT, hint: ru.upload.document.hint(DOCUMENT) },
  locationDocument: { ...LOCATION_DOCUMENT, hint: ru.upload.locationDocument.hint(LOCATION_DOCUMENT) },
  robotPhoto: { ...ROBOT_PHOTO, hint: ru.upload.robotPhoto.hint(ROBOT_PHOTO) },
} as const satisfies Record<string, UploadRule>

export type UploadKind = keyof typeof UPLOAD_RULES

export interface UploadError {
  /** Имя файла; null — ошибка относится ко всему набору. */
  readonly file: string | null
  readonly message: string
}

/** Расширение файла строчными без точки: «План.DWG» → «dwg». */
export const extensionOf = (name: string): string => name.slice(name.lastIndexOf('.') + 1).toLowerCase()

const u = ru.upload

function validateCount(kind: UploadKind, count: number): UploadError | null {
  const rule = UPLOAD_RULES[kind]
  if (count < rule.minFiles) return { file: null, message: u[kind].empty }
  if (count > rule.maxFiles) return { file: null, message: u.errors.tooMany(rule.maxFiles, u[kind].countNoun, count - rule.maxFiles) }
  return null
}

function validateFile(kind: UploadKind, file: File): UploadError | null {
  const rule = UPLOAD_RULES[kind]
  const extension = extensionOf(file.name)
  if (!rule.extensions.includes(extension)) return { file: file.name, message: u.errors.format(extension, u[kind].formatFix) }
  if (file.size > rule.maxSizeMb * MB) return { file: file.name, message: u.errors.size(rule.maxSizeMb) }
  return null
}

/** Проверка набора файлов; тексты ошибок — со способом исправления (ТЗ 4.5.4). */
export function validateFiles(kind: UploadKind, files: readonly File[]): { readonly errors: readonly UploadError[] } {
  const countError = validateCount(kind, files.length)
  const fileErrors = files.map((f) => validateFile(kind, f)).filter((e): e is UploadError => e !== null)
  return { errors: countError ? [countError, ...fileErrors] : fileErrors }
}
