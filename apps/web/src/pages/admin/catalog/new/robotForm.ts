import type {
  DataConfidence,
  HandlingMethodCode,
  NewRobot,
  OperationClass,
  OperationClassCode,
  Process,
  Robot,
  RobotReadiness,
  RobotSpecs,
} from '@/domain'
import { isSameRobot } from '@/domain'
import { formatCount, pluralize } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'

const t = ru.robotNew

export type ReadinessChoice = Exclude<RobotReadiness, 'unknown'>
export type YesNo = 'yes' | 'no'

/** Поля формы А2 строками, как их вводит администратор (PRD 6.3). Фото — отдельно: в черновик браузера не пишутся (D-53). */
export interface RobotForm {
  readonly name: string
  readonly manufacturer: string
  readonly readiness: ReadinessChoice | ''
  readonly trl: string
  readonly price: string
  /** «Тип|Подтип» каталога. */
  readonly solutionType: string
  readonly classes: readonly OperationClassCode[]
  readonly payloadKg: string
  readonly maxSpeedMps: string
  readonly autonomyH: string
  readonly chargeTimeMin: string
  readonly dimensions: string
  readonly minTempC: string
  readonly avgPowerKw: string
  readonly loadUnload: string
  readonly handlingMethod: HandlingMethodCode | ''
  readonly indoor: YesNo | ''
  readonly outdoor: YesNo | ''
  readonly confidence: DataConfidence | ''
  readonly sourceText: string
}

export type RobotFormKey = keyof RobotForm
export type RobotFormErrors = Readonly<Partial<Record<RobotFormKey, string>>>

/** Значения макета — примеры в плейсхолдерах, а не предзаполнение: робот новый (как D-45, D-51). */
export const EMPTY_ROBOT_FORM: RobotForm = {
  name: '',
  manufacturer: '',
  readiness: '',
  trl: '',
  price: '',
  solutionType: '',
  classes: [],
  payloadKg: '',
  maxSpeedMps: '',
  autonomyH: '',
  chargeTimeMin: '',
  dimensions: '',
  minTempC: '',
  avgPowerKw: '',
  loadUnload: '',
  handlingMethod: '',
  indoor: '',
  outdoor: '',
  confidence: '',
  sourceText: '',
}

/** Числовые технические параметры одной величиной; габариты и загрузка / разгрузка разбираются отдельно. */
export const SIMPLE_SPECS = ['payloadKg', 'maxSpeedMps', 'autonomyH', 'chargeTimeMin', 'minTempC', 'avgPowerKw'] as const
type SimpleSpec = (typeof SIMPLE_SPECS)[number]

/** Может быть нулём или меньше: температура. Остальные величины — строго больше нуля. */
const SIGNED_SPECS: ReadonlySet<SimpleSpec> = new Set(['minTempC'])

const REQUIRED_TEXT = ['name', 'manufacturer', 'readiness', 'trl', 'price', 'solutionType'] as const

/**
 * Позиции со звёздочкой на форме: шесть полей секции 1, идентификатор, классы, фото — девять (PRD 15 · №34, D-53).
 * Идентификатор присваивает система — он заполнен всегда.
 */
export const REQUIRED_TOTAL = REQUIRED_TEXT.length + 3

/** Число из ввода: «1 800 000», «1,5», «-25». Пусто или не число — null. */
export function parseNumber(raw: string): number | null {
  const text = raw.replace(/\s/g, '').replace(',', '.')
  if (text === '' || !/^-?\d+(\.\d+)?$/.test(text)) return null
  return Number(text)
}

/** Несколько чисел через разделитель: «940 × 640 × 230», «45 / 45». Нужное количество — иначе null. */
function parseList(raw: string, separator: RegExp, count: number): readonly number[] | null {
  const parts = raw.split(separator).map(parseNumber)
  if (parts.length !== count || parts.some((n) => n === null || n <= 0)) return null
  return parts as number[]
}

const DIMENSION_SEPARATOR = /[×xхX*]/
const LOAD_SEPARATOR = /\//

function validateSpecs(form: RobotForm): RobotFormErrors {
  const errors: Partial<Record<RobotFormKey, string>> = {}
  for (const key of SIMPLE_SPECS) {
    if (form[key].trim() === '') continue
    const value = parseNumber(form[key])
    if (value === null) errors[key] = t.errors.number
    else if (!SIGNED_SPECS.has(key) && value <= 0) errors[key] = t.errors.positive
  }
  if (form.dimensions.trim() !== '' && !parseList(form.dimensions, DIMENSION_SEPARATOR, 3)) errors.dimensions = t.errors.dimensions
  if (form.loadUnload.trim() !== '' && !parseList(form.loadUnload, LOAD_SEPARATOR, 2)) errors.loadUnload = t.errors.loadUnload
  return errors
}

function validateMain(form: RobotForm, catalog: readonly Robot[]): RobotFormErrors {
  const errors: Partial<Record<RobotFormKey, string>> = {}
  for (const key of REQUIRED_TEXT) {
    if (form[key].trim() === '') errors[key] = t.errors.required
  }
  const trl = parseNumber(form.trl)
  if (!errors.trl && (trl === null || !Number.isInteger(trl) || trl < 1 || trl > 9)) errors.trl = t.errors.trl
  const price = parseNumber(form.price)
  if (!errors.price && (price === null || price <= 0)) errors.price = t.errors.price
  const twin = errors.name || errors.manufacturer ? undefined : catalog.find((robot) => isSameRobot(robot, form))
  if (twin) errors.name = t.errors.duplicate(twin.id)
  return errors
}

/** Проверка перед сохранением; тексты — со способом исправления (ТЗ 4.5.4). Фото проверяет кнопка: без них она недоступна. */
export function validateRobotForm(form: RobotForm, catalog: readonly Robot[]): RobotFormErrors {
  const classes = form.classes.length === 0 ? { classes: t.errors.classes } : {}
  return { ...validateMain(form, catalog), ...classes, ...validateSpecs(form) }
}

const yesNo = (value: YesNo | ''): boolean | undefined => (value === '' ? undefined : value === 'yes')

function toSpecs(form: RobotForm): RobotSpecs {
  const simple = Object.fromEntries(
    SIMPLE_SPECS.map((key) => [key, parseNumber(form[key])] as const).filter(([, value]) => value !== null),
  ) as Partial<Record<SimpleSpec, number>>
  const [lengthMm, widthMm, heightMm] = parseList(form.dimensions, DIMENSION_SEPARATOR, 3) ?? []
  const [loadTimeS, unloadTimeS] = parseList(form.loadUnload, LOAD_SEPARATOR, 2) ?? []
  const optional = {
    lengthMm, widthMm, heightMm, loadTimeS, unloadTimeS,
    handlingMethod: form.handlingMethod === '' ? undefined : form.handlingMethod,
    indoor: yesNo(form.indoor),
    outdoor: yesNo(form.outdoor),
    sourceText: form.sourceText.trim() === '' ? undefined : form.sourceText.trim(),
  }
  const defined = Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== undefined))
  // «ТТХ подтверждены» не указано — данные считаем неподтверждёнными (качество данных, PRD 3.4).
  return { ...simple, ...defined, confidence: form.confidence === '' ? 'unconfirmed' : form.confidence }
}

/** Проверенная форма → запрос на создание. Вызывать после validateRobotForm без ошибок. */
export function toNewRobot(form: RobotForm, photos: readonly string[]): NewRobot {
  const [type = '', subtype = ''] = form.solutionType.split('|')
  return {
    name: form.name.trim(),
    manufacturer: form.manufacturer.trim(),
    type,
    subtype,
    readiness: form.readiness === '' ? 'unknown' : form.readiness,
    trl: parseNumber(form.trl),
    priceRub: parseNumber(form.price),
    operationClasses: form.classes.map((code) => ({ code })),
    specs: toSpecs(form),
    photos,
  }
}

/** Заполнено позиций со звёздочкой (панель «Обязательные поля X / 9»); идентификатор — всегда. */
export function filledRequired(form: RobotForm, photoCount: number): number {
  const text = REQUIRED_TEXT.filter((key) => form[key].trim() !== '').length
  return text + 1 + (form.classes.length > 0 ? 1 : 0) + (photoCount > 0 ? 1 : 0)
}

const lowerFirst = (text: string) => text.charAt(0).toLocaleLowerCase('ru') + text.slice(1)

/** Короткие пояснения плашек из макета А2 (15966:6055, PRD 6.3); у новых классов — описание из справочника. */
const CHIP_HINTS: Readonly<Record<string, string>> = {
  'OP-01': 'паллеты, тележки, короба',
  'OP-02': 'отбор по строкам',
  'OP-03': 'по направлениям',
  'OP-04': 'стеллажи, АСХ',
  'OP-05': 'линии, паллетайзеры',
  'OP-06': 'пересчёт и контроль',
  'OP-07': 'сухая и влажная',
  'OP-08': 'по точкам маршрута',
  'OP-09': 'обходы, видео',
  'OP-10': 'датчики, осмотр',
}

export function classChipHint(cls: OperationClass): string {
  return CHIP_HINTS[cls.code] ?? lowerFirst(cls.description)
}

/**
 * Подсказка под плашками: сколько процессов справочника увидят робота (PRD 6.3).
 * Считается по справочнику, а не текстом макета: для OP-01 и OP-08 — шесть процессов (PRD 15 · №33).
 */
export function classesHint(classes: readonly OperationClassCode[], processes: readonly Process[]): string {
  if (classes.length === 0) return t.classesHint.none
  const checked = `${pluralize(classes.length, t.classesHint.checked)} ${formatCount(classes.length, ru.plural.classes)}`
  const matched = processes.filter((p) => classes.includes(p.operationClass))
  if (matched.length === 0) return t.classesHint.noProcesses(checked)
  const names = matched.map((p) => lowerFirst(p.name)).join(', ')
  return t.classesHint.matched(checked, formatCount(matched.length, ru.plural.processesOf), names)
}

/** «OP-01 и OP-08», «OP-01, OP-03 и OP-08». */
function joinCodes(codes: readonly string[]): string {
  if (codes.length <= 1) return codes.join('')
  return `${codes.slice(0, -1).join(', ')} и ${codes.at(-1) ?? ''}`
}

/** Подпись правой панели: что произойдёт после сохранения (PRD 6.3). */
export function railNote(classes: readonly OperationClassCode[]): string {
  if (classes.length === 0) return t.rail.note
  return t.rail.note + t.rail.noteClasses(joinCodes(classes), classes.length > 1)
}

export interface SolutionTypeOption {
  readonly value: string
  readonly label: string
}

/** Список «Тип решения»: пары «тип · подтип» каталога без повторов, по алфавиту (Доп. 3.2). */
export function solutionTypeOptions(catalog: readonly Robot[]): readonly SolutionTypeOption[] {
  const pairs = new Map(catalog.map((r) => [`${r.type}|${r.subtype}`, `${r.type} · ${r.subtype}`]))
  return [...pairs].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'ru'))
}

/** Черновик из браузера той же версии формы: строки на месте, классы — массив. */
export function isRobotForm(value: unknown): value is RobotForm {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<Record<RobotFormKey, unknown>>
  const keys = Object.keys(EMPTY_ROBOT_FORM) as RobotFormKey[]
  return keys.every((key) => (key === 'classes' ? Array.isArray(v.classes) : typeof v[key] === 'string'))
}
