/**
 * Правила загрузки файлов — в одном месте (D-18).
 * Документы локации 17б (.dwg, группа из 10 фото) общему правилу противоречат — для них своё правило
 * `locationDocument` (предложение, D-18 open, PRD 15 · №55).
 */

const MB = 1024 * 1024

const DOCUMENT_EXTENSIONS = ['pdf', 'xlsx', 'xls', 'csv', 'png', 'jpg', 'jpeg', 'webp'] as const
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const
/** Материалы обследования локации: к общему правилу добавлен CAD-план .dwg (PRD 10.3). */
const LOCATION_DOCUMENT_EXTENSIONS = [...DOCUMENT_EXTENSIONS, 'dwg'] as const

export interface UploadRule {
  readonly extensions: readonly string[]
  readonly maxSizeMb: number
  readonly minFiles: number
  readonly maxFiles: number
  /** Подсказка под полем загрузки. */
  readonly hint: string
  /** Что предложить при неверном формате. */
  readonly formatFix: string
  /** Текст, если файлов нет. */
  readonly emptyMessage: string
  /** Что считаем при превышении лимита: «фото», «файлов». */
  readonly countNoun: string
}

export const UPLOAD_RULES = {
  /** Общее правило форм: источники данных (А7), шаблоны, документы. */
  document: {
    extensions: DOCUMENT_EXTENSIONS,
    maxSizeMb: 20,
    minFiles: 1,
    maxFiles: Number.POSITIVE_INFINITY,
    hint: 'PDF, Excel, CSV или изображение до 20 МБ',
    formatFix: 'Загрузите PDF, Excel, CSV или изображение',
    emptyMessage: 'Добавьте файл',
    countNoun: 'файлов',
  },
  /**
   * Документы локации 17б: план .dwg и группа фото за раз (PRD 10.3). Предложение до решения команды (D-18, D-42):
   * 20 МБ на файл, как у общего правила; до 20 файлов за одну загрузку — группа из 10 фото помещается с запасом.
   */
  locationDocument: {
    extensions: LOCATION_DOCUMENT_EXTENSIONS,
    maxSizeMb: 20,
    minFiles: 1,
    maxFiles: 20,
    hint: 'PDF, Excel, CSV, DWG или изображения, каждый файл до 20 МБ',
    formatFix: 'Загрузите PDF, Excel, CSV, DWG или изображение',
    emptyMessage: 'Добавьте файл',
    countNoun: 'файлов',
  },
  /** Фото робота в карточке А2: минимум 1, максимум 8. */
  robotPhoto: {
    extensions: IMAGE_EXTENSIONS,
    maxSizeMb: 20,
    minFiles: 1,
    maxFiles: 8,
    hint: 'От 1 до 8 изображений, каждое до 20 МБ',
    formatFix: 'Загрузите изображение',
    emptyMessage: 'Добавьте хотя бы одно фото',
    countNoun: 'фото',
  },
} as const satisfies Record<string, UploadRule>

export type UploadKind = keyof typeof UPLOAD_RULES

export interface UploadError {
  /** Имя файла; null — ошибка относится ко всему набору. */
  readonly file: string | null
  readonly message: string
}

/** Расширение файла строчными без точки: «План.DWG» → «dwg». */
export const extensionOf = (name: string): string => name.slice(name.lastIndexOf('.') + 1).toLowerCase()

function validateCount(rule: UploadRule, count: number): UploadError | null {
  if (count < rule.minFiles) return { file: null, message: rule.emptyMessage }
  if (count > rule.maxFiles) {
    const extra = String(count - rule.maxFiles)
    return { file: null, message: `Не больше ${String(rule.maxFiles)} ${rule.countNoun}. Уберите лишние: ${extra}` }
  }
  return null
}

function validateFile(rule: UploadRule, file: File): UploadError | null {
  const extension = extensionOf(file.name)
  if (!rule.extensions.includes(extension)) {
    return { file: file.name, message: `Формат .${extension} не поддерживается. ${rule.formatFix}` }
  }
  if (file.size > rule.maxSizeMb * MB) {
    return { file: file.name, message: `Файл больше ${String(rule.maxSizeMb)} МБ. Уменьшите размер или разделите файл` }
  }
  return null
}

/** Проверка набора файлов; тексты ошибок — со способом исправления (ТЗ 4.5.4). */
export function validateFiles(kind: UploadKind, files: readonly File[]): { readonly errors: readonly UploadError[] } {
  const rule = UPLOAD_RULES[kind]
  const countError = validateCount(rule, files.length)
  const fileErrors = files.map((f) => validateFile(rule, f)).filter((e): e is UploadError => e !== null)
  return { errors: countError ? [countError, ...fileErrors] : fileErrors }
}
