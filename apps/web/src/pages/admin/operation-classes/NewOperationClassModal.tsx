import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { nextOperationClassCode, type OperationClass } from '@/domain'
import { useServices } from '@/services/useServices'
import { ru } from '@/shared/i18n/ru'
import {
  EMPTY_OPERATION_CLASS_FORM,
  toNewOperationClass,
  validateOperationClassForm,
  type OperationClassField,
  type OperationClassFieldError,
  type OperationClassForm,
  type OperationClassFormErrors,
} from './operationClassForm'

const t = ru.operationClasses.create

type ExistingClass = Pick<OperationClass, 'code' | 'name' | 'unit'>

interface NewOperationClassModalProps {
  /** Классы справочника: следующий код, проверка названия, подсказки единиц. */
  readonly existing: readonly ExistingClass[]
  readonly onClose: () => void
  readonly onCreated: (created: OperationClass) => void
}

const REQUIRED_MESSAGES: Readonly<Partial<Record<OperationClassField, string>>> = {
  name: t.errors.name,
  description: t.errors.description,
  unit: t.errors.unit,
}

function errorText(field: OperationClassField, error: OperationClassFieldError | undefined): string | undefined {
  if (error === undefined) return undefined
  return error === 'required' ? REQUIRED_MESSAGES[field] : t.errors.duplicate(error.duplicateOf)
}

/**
 * Окно А10 «Новый класс операции» поверх списка А8 (PRD 6.7; 15966:8396).
 * Монтируется на время открытия: после закрытия форма начинается заново.
 */
export function NewOperationClassModal({ existing, onClose, onCreated }: NewOperationClassModalProps) {
  const { catalog } = useServices()
  const formId = useId()
  const unitsId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const [form, setForm] = useState<OperationClassForm>(EMPTY_OPERATION_CLASS_FORM)
  const [errors, setErrors] = useState<OperationClassFormErrors>({})
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'failed'>('idle')

  const code = nextOperationClassCode(existing.map((c) => c.code))
  const units = [...new Set(existing.map((c) => c.unit))]

  // После неудачной отправки фокус — на первое поле с ошибкой (ТЗ 4.5.4).
  useEffect(() => {
    if (attempt === 0) return
    formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus()
  }, [attempt])

  const update = (field: OperationClassField) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== field)))
  }

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (status === 'submitting') return
    const found = validateOperationClassForm(form, existing)
    setErrors(found)
    setAttempt((n) => n + 1)
    if (Object.keys(found).length > 0) return

    setStatus('submitting')
    catalog
      .createOperationClass(toNewOperationClass(form))
      .then(onCreated)
      .catch((error: unknown) => {
        console.error('Не удалось создать класс операции', error)
        setStatus('failed')
      })
  }

  const textField = (field: Exclude<OperationClassField, 'unit'>, options: { required?: boolean; hint?: string } = {}) => (
    <Field label={t.fields[field]} required={options.required ?? false} hint={options.hint} error={errorText(field, errors[field])}>
      <Input value={form[field]} placeholder={t.placeholders[field]} onChange={(e) => { update(field)(e.target.value) }} />
    </Field>
  )

  return (
    <Modal
      open
      onOpenChange={(open) => { if (!open) onClose() }}
      title={t.title}
      description={t.description}
      footer={
        <>
          <Button variant="secondary" className="px-24" onClick={onClose}>{t.cancel}</Button>
          <Button variant="primary" className="px-24" type="submit" form={formId} disabled={status === 'submitting'}>
            {status === 'submitting' ? t.submitting : t.submit}
          </Button>
        </>
      }
    >
      <form id={formId} ref={formRef} noValidate onSubmit={handleSubmit} className="flex flex-col gap-16">
        <Field label={t.fields.code} required>
          <Input computed value={t.codeValue(code)} />
        </Field>
        {textField('name', { required: true })}
        {textField('description', { required: true, hint: t.descriptionHint })}
        <div className="grid grid-cols-2 gap-16">
          <Field label={t.fields.unit} required error={errorText('unit', errors.unit)}>
            <Input
              value={form.unit}
              placeholder={t.placeholders.unit}
              list={unitsId}
              onChange={(e) => { update('unit')(e.target.value) }}
            />
          </Field>
          {textField('typicalCarriers')}
        </div>
        {/* PRD 6.7: единица — «текст или выбор»: свободный ввод с подсказками единиц справочника. */}
        <datalist id={unitsId}>
          {units.map((unit) => <option key={unit} value={unit} />)}
        </datalist>
        {textField('exampleProcesses')}
        {status === 'failed' && <p role="alert" className="type-caption font-medium text-danger">{t.failed}</p>}
      </form>
    </Modal>
  )
}
