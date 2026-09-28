import { Card } from '@/components/ui/Card'
import { Button, ButtonLink } from '@/components/ui/Button'
import { StatusBanner } from '@/components/ui/StatusBanner'
import { formatDate } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { QuoteDialog, type QuoteSummary } from './QuoteDialog'

const t = ru.project.economics.footer
const q = ru.project.economics.quote

export type FooterMode = 'draft' | 'saved' | 'guest'

interface EconomicsFooterProps {
  readonly mode: FooterMode
  /** «AMR 800 · RaaS · Целесообразно при выполнении условий». */
  readonly summary: string
  readonly savedAt: string | null
  readonly saving: boolean
  readonly error: string | null
  readonly hasRun: boolean
  /** «Новый расчёт на основе»: окно A2 поверх страницы с локацией, процессом и решением (D-84). */
  readonly basedOnTo: string
  readonly onSave: () => void
  readonly onTables: () => void
  readonly onSimulation: () => void
  readonly onReport: () => void
  readonly quote: {
    readonly summary: QuoteSummary
    readonly requestedAt: string | null
    readonly pending: boolean
    readonly onRequest: () => Promise<boolean>
  } | null
}

/**
 * Нижняя панель итога (PRD 11.6; 16197:2270): вывод строкой, дисклеймер (ТЗ 3.7.5), выгрузки и главное действие.
 * Черновик — «Сохранить оценку» (при скачивании сохраняем текущую версию), сохранённая — «Новый расчёт на основе»,
 * гость — только выгрузки (D-14). «Запросить КП» и его состояние после отправки — 08b (D-106).
 */
export function EconomicsFooter({
  mode, summary, savedAt, saving, error, hasRun, basedOnTo, onSave, onTables, onSimulation, onReport, quote,
}: EconomicsFooterProps) {
  const hint = mode === 'guest' ? t.guestHint : mode === 'saved' && savedAt ? t.savedHint(formatDate(savedAt.slice(0, 10))) : t.saveHint
  return (
    <Card as="section" padding={24} gap={16} aria-label={t.label}>
      {quote?.requestedAt && (
        <StatusBanner title={q.sent(formatDate(quote.requestedAt.slice(0, 10)))} description={q.sentText(quote.summary.manufacturer)} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-16">
        <div className="flex min-w-0 flex-col gap-4">
          <p className="type-body font-semibold text-text">{summary}</p>
          <p className="type-caption text-text-secondary">{hint}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-12">
          <Button size="sm" onClick={onTables}>{t.csv}</Button>
          <Button size="sm" disabled={!hasRun} onClick={onSimulation}>{t.simulationCsv}</Button>
          <Button size="sm" onClick={onReport}>{t.report}</Button>
          {quote && !quote.requestedAt && (
            <QuoteDialog summary={quote.summary} pending={quote.pending} error={error} onSubmit={quote.onRequest} />
          )}
          {mode === 'draft' && <Button variant="primary" disabled={saving} onClick={onSave}>{saving ? t.saving : t.save}</Button>}
          {mode === 'saved' && <ButtonLink variant="primary" to={basedOnTo}>{t.basedOn}</ButtonLink>}
        </div>
      </div>
      {error && <p role="alert" className="type-body-sm text-danger">{error}</p>}
      <p className="type-caption text-text-secondary">{t.disclaimer}</p>
    </Card>
  )
}
