import { ArrowRight, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { ROUTE_PATHS } from '@/app/routePaths'
import { Button, ButtonLink } from '@/components/ui/Button'
import { iconButtonClasses } from '@/components/ui/iconButtonStyles'
import { Modal } from '@/components/ui/Modal'
import { Search } from '@/components/ui/Search'
import { EmptyState } from '@/components/ui/States'
import type { ProcessCode } from '@/domain'
import { ConflictError } from '@/services/errors'
import { ru } from '@/shared/i18n/ru'
import { searchTemplates, type TemplateOption } from './templatePickerModel'

const t = ru.location.templatePicker

interface TemplateRowProps {
  readonly option: TemplateOption
  readonly isPending: boolean
  readonly isBusy: boolean
  readonly onAdd: (code: ProcessCode) => void
}

/** Строка шаблона (15950:3034): вся строка — кнопка «добавить», круг «→» справа — её часть, а не отдельная остановка Tab. */
function TemplateRow({ option, isPending, isBusy, onAdd }: TemplateRowProps) {
  if (option.isOnLocation) {
    return (
      <li aria-disabled="true" className="flex items-center gap-12 rounded-md p-12 text-text-muted">
        <span className="flex min-w-0 flex-1 flex-col gap-4">
          <span className="type-body">{option.name}</span>
          <span className="type-caption">{option.details}</span>
        </span>
        <span className="type-caption shrink-0">{t.onLocation}</span>
      </li>
    )
  }
  return (
    <li>
      <button
        type="button"
        aria-label={t.add(option.name)}
        aria-describedby={`template-${option.code}`}
        disabled={isBusy}
        onClick={() => { onAdd(option.code) }}
        className="group flex w-full items-center gap-12 rounded-md p-12 text-left transition-colors not-disabled:hover:bg-surface-sunken focus-visible:bg-surface-sunken disabled:cursor-not-allowed"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-4">
          <span className="type-body font-medium text-text">{option.name}</span>
          <span id={`template-${option.code}`} className="type-caption text-text-muted">{option.details}</span>
        </span>
        <span aria-hidden className={iconButtonClasses(36, 'raised', 'default', 'group-not-disabled:group-active:shadow-inset-sm')}>
          {isPending ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" /> : <ArrowRight size={16} />}
        </span>
      </button>
    </li>
  )
}

interface TemplatePickerModalProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly locationName: string
  readonly options: readonly TemplateOption[]
  /** Привязать копию шаблона; ошибку окно покажет само и останется открытым. */
  readonly onAdd: (code: ProcessCode) => Promise<void>
}

/**
 * Окно 15а «Процесс из шаблона» (PRD 10.4; 15950:3023): поиск по справочнику, шаблоны своего типа объекта первыми,
 * уже добавленные — недоступны. Выбор строки сразу привязывает копию к локации и закрывает окно (D-38).
 */
export function TemplatePickerModal({ open, onOpenChange, locationName, options, onAdd }: TemplatePickerModalProps) {
  const [query, setQuery] = useState('')
  const [pending, setPending] = useState<ProcessCode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const visible = searchTemplates(options, query)

  const handleOpenChange = (next: boolean) => {
    if (pending !== null) return
    if (!next) {
      setQuery('')
      setError(null)
    }
    onOpenChange(next)
  }

  const add = (code: ProcessCode) => {
    setPending(code)
    setError(null)
    onAdd(code)
      .then(() => {
        setPending(null)
        handleOpenChange(false)
      })
      .catch((reason: unknown) => {
        setPending(null)
        setError(reason instanceof ConflictError ? t.conflict : t.error)
      })
  }

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      title={t.title}
      description={t.description(locationName)}
      footer={
        <>
          <Button className="px-24" disabled={pending !== null} onClick={() => { handleOpenChange(false) }}>{t.cancel}</Button>
          <ButtonLink className="px-24" to={ROUTE_PATHS.processNew}>{t.createProcess}</ButtonLink>
        </>
      }
    >
      <Search label={t.search} value={query} onChange={(e) => { setQuery(e.target.value) }} />
      {error && <p role="alert" className="type-body-sm text-danger">{error}</p>}
      {visible.length === 0
        ? <EmptyState title={t.notFound.title} description={t.notFound.description} />
        : (
          <ul
            aria-label={t.listLabel}
            aria-busy={pending !== null}
            className="flex max-h-(--rav-template-list-height) flex-col gap-4 overflow-y-auto pr-8 [scrollbar-color:var(--rav-color-text-secondary)_var(--rav-color-surface-muted)] [scrollbar-width:thin]"
          >
            {visible.map((option) => (
              <TemplateRow key={option.code} option={option} isPending={pending === option.code} isBusy={pending !== null} onAdd={add} />
            ))}
          </ul>
        )}
    </Modal>
  )
}
