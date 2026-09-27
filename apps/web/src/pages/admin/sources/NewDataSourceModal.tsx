import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { FileInput } from '@/components/ui/FileInput'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Segmented } from '@/components/ui/Segmented'
import { Select } from '@/components/ui/Select'
import { Toggle } from '@/components/ui/Toggle'
import { DATA_SOURCE_REFRESH_PERIODS, type DataSource, type DataSourceKind, type DataSourceLocator, type DataSourceRefreshPeriod, type DataSourceStatus } from '@/domain'
import { useServices } from '@/services/useServices'
import { UPLOAD_RULES } from '@/shared/config/upload'
import { formatDateOf, parseDate } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import {
  DATA_SOURCE_KINDS,
  EMPTY_DATA_SOURCE_FORM,
  toNewDataSource,
  validateDataSourceForm,
  type DataSourceField,
  type DataSourceFieldError,
  type DataSourceForm,
  type DataSourceFormErrors,
} from './dataSourceForm'
import { useUrlCheck, type UrlCheckState } from './useUrlCheck'

const t = ru.dataSources.create

const KIND_OPTIONS = DATA_SOURCE_KINDS.map((kind) => ({ value: kind, label: ru.dataSources.kinds[kind] }))
const STATUS_OPTIONS = (['confirmed', 'estimate'] as const).map((status) => ({ value: status, label: ru.dataSources.status[status] }))
// «Файл» — окно А7, «Ссылка» — А7б (15966:7926).
const LOCATOR_OPTIONS = [
  { value: 'file', label: t.locatorKinds.file },
  { value: 'url', label: t.locatorKinds.url },
] as const
const PERIOD_OPTIONS = DATA_SOURCE_REFRESH_PERIODS.map((period) => ({ value: period, label: t.periods[period] }))
const FILE_HINT = `${UPLOAD_RULES.document.hint}. ${t.fileHint}`

const REQUIRED_MESSAGES: Readonly<Record<DataSourceField, string>> = {
  name: t.errors.name,
  kind: t.errors.kind,
  file: t.errors.file,
  url: t.errors.url,
  actualizedOn: t.errors.actualizedOn,
}

function errorText(field: DataSourceField, error: DataSourceFieldError | undefined): string | undefined {
  if (error === undefined) return undefined
  return error === 'required' ? REQUIRED_MESSAGES[field] : t.errors[error]
}

/** Итог «Проверить» под ссылкой: открылась — подсказкой, не открылась или сбой — ошибкой у поля (добавлению не мешает). */
function urlCheckMessage(state: UrlCheckState): { readonly hint?: string; readonly error?: string } {
  if (state.status === 'failed') return { error: t.checkFailed }
  if (state.status !== 'done') return {}
  if (!state.result.reachable) return { error: t.checkUnreachable }
  return { hint: t.checkOk(state.result.lastModified === null ? null : formatDateOf(state.result.lastModified)) }
}

interface NewDataSourceModalProps {
  /** Реестр источников: проверка, что такого названия ещё нет. */
  readonly existing: readonly Pick<DataSource, 'name'>[]
  readonly onClose: () => void
  readonly onCreated: (created: DataSource) => void
}

/**
 * Окно А7 / А7б «Новый источник данных» поверх реестра А6 (PRD 6.10; 15966:7646, 15966:7907).
 * «Файл · Ссылка» меняет поле источника и автообновление: у файла оно выключено, у ссылки — период.
 * Монтируется на время открытия: после закрытия форма начинается заново.
 */
export function NewDataSourceModal({ existing, onClose, onCreated }: NewDataSourceModalProps) {
  const { admin } = useServices()
  const formId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  // Дата актуализации по умолчанию — сегодня по Москве: источник обычно добавляют в день получения.
  const [today] = useState(() => formatDateOf(new Date().toISOString()))
  const [form, setForm] = useState<DataSourceForm>({ ...EMPTY_DATA_SOURCE_FORM, actualizedOn: today })
  const [errors, setErrors] = useState<DataSourceFormErrors>({})
  const [fileRejection, setFileRejection] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'failed'>('idle')
  const urlCheck = useUrlCheck()
  const isLink = form.locatorKind === 'url'

  // После неудачной отправки фокус — на первое поле с ошибкой (ТЗ 4.5.4).
  useEffect(() => {
    if (attempt === 0) return
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [attempt])

  const update = <K extends keyof DataSourceForm>(field: K, value: DataSourceForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== field)))
  }

  const pickFile = (file: File) => {
    setFileRejection(null)
    update('file', { name: file.name, size: file.size })
  }

  // Ошибка прежнего варианта к новому не относится: «Выберите файл» не должна ждать под ссылкой.
  const switchLocator = (kind: DataSourceLocator['kind']) => {
    update('locatorKind', kind)
    setFileRejection(null)
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== 'file' && key !== 'url')))
  }

  const typeUrl = (url: string) => {
    urlCheck.reset()
    update('url', url)
  }

  // «Проверить» сначала сверяет адрес теми же правилами, что и отправка: кривую ссылку нет смысла открывать.
  const checkUrl = () => {
    const { url } = validateDataSourceForm(form, existing, parseDate(today) ?? '')
    if (url !== undefined) {
      setErrors((prev) => ({ ...prev, url }))
      return
    }
    urlCheck.check(form.url.trim())
  }

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (status === 'submitting') return
    const found = validateDataSourceForm(form, existing, parseDate(today) ?? '')
    setErrors(found)
    setAttempt((n) => n + 1)
    if (Object.keys(found).length > 0) return

    setStatus('submitting')
    admin
      .createDataSource(toNewDataSource(form))
      .then(onCreated)
      .catch((error: unknown) => {
        console.error('Не удалось добавить источник данных', error)
        setStatus('failed')
      })
  }

  const urlMessage = urlCheckMessage(urlCheck.state)
  // Введённые файл и ссылка сохраняются при переключении: в источник пойдёт выбранный вариант.
  const locatorSwitch = (
    <Segmented<DataSourceLocator['kind']>
      label={t.fields.locator}
      fit="content"
      options={LOCATOR_OPTIONS}
      value={form.locatorKind}
      onChange={switchLocator}
    />
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
        <Field label={t.fields.name} required error={errorText('name', errors.name)}>
          <Input value={form.name} placeholder={t.placeholders.name} onChange={(e) => { update('name', e.target.value) }} />
        </Field>
        <Field label={t.fields.kind} required error={errorText('kind', errors.kind)}>
          <Select<DataSourceKind>
            options={KIND_OPTIONS}
            value={form.kind}
            placeholder={t.placeholders.kind}
            onChange={(kind) => { update('kind', kind) }}
          />
        </Field>
        {isLink ? (
          <Field label={t.fields.url} required hint={urlMessage.hint ?? t.urlHint} error={errorText('url', errors.url) ?? urlMessage.error}>
            <div className="flex flex-col gap-8">
              {locatorSwitch}
              <Input
                type="url"
                inputMode="url"
                autoComplete="url"
                value={form.url}
                placeholder={t.urlPlaceholder}
                onChange={(e) => { typeUrl(e.target.value) }}
                action={{
                  label: urlCheck.state.status === 'checking' ? t.checking : t.check,
                  ariaLabel: t.checkLabel,
                  disabled: urlCheck.state.status === 'checking',
                  onClick: checkUrl,
                }}
              />
            </div>
          </Field>
        ) : (
          <Field label={t.fields.locator} required hint={FILE_HINT} error={fileRejection ?? errorText('file', errors.file)}>
            <div className="flex flex-col gap-8">
              {locatorSwitch}
              <FileInput kind="document" label={t.fields.locator} file={form.file} onChange={pickFile} onReject={setFileRejection} />
            </div>
          </Field>
        )}
        <Field label={t.fields.actualizedOn} required error={errorText('actualizedOn', errors.actualizedOn)}>
          <Input
            value={form.actualizedOn}
            placeholder={t.placeholders.actualizedOn}
            inputMode="numeric"
            autoComplete="off"
            onChange={(e) => { update('actualizedOn', e.target.value) }}
          />
        </Field>
        <div className="grid grid-cols-2 gap-16">
          <Field label={t.fields.status} required>
            <Segmented<DataSourceStatus> label={t.fields.status} fit="content" options={STATUS_OPTIONS} value={form.status} onChange={(value) => { update('status', value) }} />
          </Field>
          {/* PRD 6.10: автообновление — только у ссылки; у файла переключатель выключен и заблокирован. */}
          {isLink ? (
            <Field
              label={t.fields.refresh}
              badge={<Toggle label={t.refreshToggle} hideLabel checked={form.autoRefresh} onCheckedChange={(on) => { update('autoRefresh', on) }} />}
            >
              <Select<DataSourceRefreshPeriod>
                options={PERIOD_OPTIONS}
                value={form.refreshPeriod}
                disabled={!form.autoRefresh}
                aria-label={t.periodLabel}
                onChange={(period) => { update('refreshPeriod', period) }}
              />
            </Field>
          ) : (
            <Field label={t.fields.refresh}>
              <div className="flex items-center gap-12 py-8">
                <Toggle label={t.refreshToggle} hideLabel checked={false} disabled />
                <span className="type-body-sm text-text-muted">{t.refreshFile}</span>
              </div>
            </Field>
          )}
        </div>
        {status === 'failed' && <p role="alert" className="type-caption font-medium text-danger">{t.failed}</p>}
      </form>
    </Modal>
  )
}
