import { useState, type SyntheticEvent } from 'react'
import { useActiveSection } from '@/shared/dom/useActiveSection'
import { clearDraft, readDraft, useDraftAutosave } from '@/shared/dom/useDraftAutosave'
import { formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { validateForm, type FormErrors } from './processCalc'
import { NUMERIC_SPECS, SECTION_IDS, type NumericKey, type ProcessForm, type SectionId } from './processForm'

const t = ru.processNew

/** Черновик из браузера годится, если у него форма той же версии: класс, список групп, способы. */
function isProcessForm(value: unknown): value is ProcessForm {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<ProcessForm>
  return typeof v.operationClass === 'string' && Array.isArray(v.staff) && Array.isArray(v.handling) && typeof v.dailyVolume === 'string'
}

/** Секция первой ошибки — туда ведём после неудачной проверки. */
function firstErrorSection(errors: FormErrors): SectionId {
  const keys = Object.keys(errors)
  if (keys.some((k) => ['name', 'carrier', 'category', 'handling', 'unitMassKg'].includes(k))) return 'process'
  const numeric = keys.find((k): k is NumericKey => k in NUMERIC_SPECS)
  if (numeric && NUMERIC_SPECS[numeric].section !== 'staff') return NUMERIC_SPECS[numeric].section
  return 'staff'
}

interface ProcessFormStateOptions {
  /** Ключ черновика в браузере (D-21). */
  readonly draftKey: string
  readonly initialForm: ProcessForm
  /** Гость: без черновика и сохранения (D-14). */
  readonly canSave: boolean
  /** Черновик подходит этой форме: например, класс копии не отличается от шаблона. */
  readonly acceptDraft?: (draft: ProcessForm) => boolean
  /** Сохранить проверенную форму; ошибка — сообщение `saveFailed` в панели, черновик остаётся. */
  readonly onSave: (form: ProcessForm) => Promise<void>
}

/**
 * Общее состояние форм процесса 09а и 16: значения, автосохранение черновика, активная секция, проверка и сохранение.
 * Черновик создаётся при открытии и очищается после успешного сохранения (D-21, D-31).
 */
export function useProcessFormState({ draftKey, initialForm, canSave, acceptDraft, onSave }: ProcessFormStateOptions) {
  const [form, setForm] = useState<ProcessForm>(() => {
    const draft = canSave ? readDraft(draftKey, isProcessForm) : null
    return draft && (acceptDraft?.(draft) ?? true) ? draft : initialForm
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const savedAt = useDraftAutosave(draftKey, form, canSave)
  const { activeId, select } = useActiveSection(SECTION_IDS)

  const update = (patch: Partial<ProcessForm>) => { setForm((prev) => ({ ...prev, ...patch })) }

  const submit = async (event: SyntheticEvent) => {
    event.preventDefault()
    const found = validateForm(form)
    setErrors(found)
    const count = Object.keys(found).length
    if (count > 0) {
      setMessage(t.errors.summary(formatNumber(count)))
      select(firstErrorSection(found))
      return
    }
    setMessage(null)
    setSaving(true)
    try {
      await onSave(form)
      clearDraft(draftKey)
    } catch (error) {
      console.error('Не удалось сохранить процесс', error)
      setMessage(t.errors.saveFailed)
      setSaving(false)
    }
  }

  return { form, update, errors, message, saving, savedAt, activeId, select, submit }
}

export type ProcessFormState = ReturnType<typeof useProcessFormState>
