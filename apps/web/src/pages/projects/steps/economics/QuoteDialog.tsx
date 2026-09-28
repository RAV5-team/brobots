import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { ru } from '@/shared/i18n/ru'

const t = ru.project.economics.quote

export interface QuoteSummary {
  readonly manufacturer: string
  readonly solution: string
  readonly scenario: string
  readonly fleet: string
  readonly location: string
}

interface QuoteDialogProps {
  readonly summary: QuoteSummary
  readonly pending: boolean
  readonly error: string | null
  readonly onSubmit: () => Promise<boolean>
}

/**
 * «Запросить КП» (08b, D-106): кнопка подвала открывает подтверждение `Modal size="sm"` с тем, что уйдёт производителю;
 * после отправки подвал показывает «КП запрошено · дата». Запрос не меняет оценку.
 */
export function QuoteDialog({ summary, pending, error, onSubmit }: QuoteDialogProps) {
  const [open, setOpen] = useState(false)
  const rows = [
    [t.rows.solution, summary.solution],
    [t.rows.scenario, summary.scenario],
    [t.rows.fleet, summary.fleet],
    [t.rows.location, summary.location],
  ] as const
  const submit = () => {
    void onSubmit().then((ok) => { if (ok) setOpen(false) })
  }
  return (
    <Modal
      size="sm"
      title={t.title}
      description={t.description(summary.manufacturer)}
      open={open}
      onOpenChange={setOpen}
      trigger={<Button size="sm">{t.action}<ArrowRight aria-hidden size={16} /></Button>}
      footer={(
        <>
          <Button onClick={() => { setOpen(false) }}>{t.cancel}</Button>
          <Button variant="primary" disabled={pending} onClick={submit}>{pending ? t.sending : t.submit}</Button>
        </>
      )}
    >
      <div className="flex flex-col gap-12">
        <dl className="flex flex-col gap-8 rounded-lg bg-surface-sunken p-16">
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-16">
              <dt className="w-1/4 shrink-0 type-body-sm text-text-secondary">{label}</dt>
              <dd className="type-body-sm font-medium text-text">{value}</dd>
            </div>
          ))}
        </dl>
        {error && <p role="alert" className="type-body-sm text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
