import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import type { LocationProcessId } from '@/domain'
import { NotFoundError } from '@/services/errors'
import { ru } from '@/shared/i18n/ru'

const t = ru.location.removeProcess

/** Процесс, который снимают с локации: id копии и её название на карточке. */
export interface RemoveTarget {
  readonly id: LocationProcessId
  readonly name: string
}

interface RemoveProcessDialogProps {
  /** null — окно закрыто. */
  readonly target: RemoveTarget | null
  readonly locationName: string
  readonly onClose: () => void
  /** Снять копию с локации; ошибку окно покажет само и останется открытым. */
  readonly onRemove: (id: LocationProcessId) => Promise<void>
  /**
   * Вернуть фокус после закрытия. Radix возвращает его только на `Dialog.Trigger`, а окно открывает кнопка карточки;
   * после удаления карточки нет — фокус нужен в другом месте.
   */
  readonly onAfterClose: (isRemoved: boolean) => void
}

/**
 * Окно 17в «Удалить процесс с локации» (PRD 10.4; 16036:573, D-43): снимается только копия на этой локации,
 * шаблон в справочнике и другие локации не меняются (PRD 3.4, D-11).
 */
export function RemoveProcessDialog({ target, locationName, onClose, onRemove, onAfterClose }: RemoveProcessDialogProps) {
  const [isPending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRemoved, setRemoved] = useState(false)

  const close = () => {
    if (isPending) return
    setError(null)
    onClose()
  }

  const confirm = () => {
    if (!target) return
    setPending(true)
    setError(null)
    onRemove(target.id)
      .then(() => {
        setPending(false)
        setRemoved(true)
        onClose()
      })
      .catch((reason: unknown) => {
        setPending(false)
        setError(reason instanceof NotFoundError ? t.notFound : t.error)
      })
  }

  const handleCloseAutoFocus = (event: Event) => {
    event.preventDefault()
    setRemoved(false)
    onAfterClose(isRemoved)
  }

  return (
    <Modal
      size="sm"
      open={target !== null}
      onOpenChange={(open) => { if (!open) close() }}
      onCloseAutoFocus={handleCloseAutoFocus}
      title={target ? t.title(target.name, locationName) : ''}
      description={t.description}
      footer={
        <>
          <Button className="px-20" disabled={isPending} onClick={close}>{t.cancel}</Button>
          <Button variant="danger" className="px-20" disabled={isPending} aria-busy={isPending} onClick={confirm}>
            {isPending ? t.removing : t.confirm}
          </Button>
        </>
      }
    >
      {error && <p role="alert" className="type-body-sm text-danger">{error}</p>}
    </Modal>
  )
}
