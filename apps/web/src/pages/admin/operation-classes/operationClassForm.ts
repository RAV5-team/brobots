import type { NewOperationClass, OperationClass, OperationClassCode } from '@/domain'

/** Значения формы А10 как их ввёл администратор: перечисления — одной строкой через запятую. */
export interface OperationClassForm {
  readonly name: string
  readonly description: string
  readonly unit: string
  readonly typicalCarriers: string
  readonly exampleProcesses: string
}

export type OperationClassField = keyof OperationClassForm

/** Ошибка поля: пусто или название повторяет класс справочника. */
export type OperationClassFieldError = 'required' | { readonly duplicateOf: OperationClassCode }

export type OperationClassFormErrors = Readonly<Partial<Record<OperationClassField, OperationClassFieldError>>>

export const EMPTY_OPERATION_CLASS_FORM: OperationClassForm = {
  name: '',
  description: '',
  unit: '',
  typicalCarriers: '',
  exampleProcesses: '',
}

/** Обязательные поля по PRD 6.7; код присваивает система. */
const REQUIRED: readonly OperationClassField[] = ['name', 'description', 'unit']

const LIST_SEPARATOR = ','

/** Название для сравнения: без регистра, лишних пробелов и различия «е» / «ё». */
const normalizeName = (name: string): string => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru').replaceAll('ё', 'е')

const splitList = (value: string): readonly string[] =>
  value.split(LIST_SEPARATOR).map((item) => item.trim()).filter((item) => item.length > 0)

/**
 * Проверка перед созданием. Уникальность справочника — по коду, но дубль названия
 * запутает администратора и пользователя, поэтому его ловим здесь (предложение PRD 6.7).
 */
export function validateOperationClassForm(
  form: OperationClassForm,
  existing: readonly Pick<OperationClass, 'code' | 'name'>[],
): OperationClassFormErrors {
  const missing = Object.fromEntries(
    REQUIRED.filter((field) => form[field].trim() === '').map((field) => [field, 'required' as const]),
  ) as OperationClassFormErrors
  if (missing.name) return missing

  const duplicate = existing.find((c) => normalizeName(c.name) === normalizeName(form.name))
  return duplicate ? { ...missing, name: { duplicateOf: duplicate.code } } : missing
}

export function toNewOperationClass(form: OperationClassForm): NewOperationClass {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    unit: form.unit.trim(),
    typicalCarriers: splitList(form.typicalCarriers),
    exampleProcesses: splitList(form.exampleProcesses),
  }
}
