import { ArrowRight } from 'lucide-react'
import { Card, CardStat, CardTitle } from '@/components/ui/Card'
import { FormRail } from '@/components/ui/FormRail'
import { IconButton } from '@/components/ui/IconButton'
import { Progress } from '@/components/ui/Progress'
import { formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import type { Readiness } from './locationCheck'

const t = ru.locationNew.rail
const PERCENT = 100

/** Почему «Сохранить» недоступна: гость (D-14) или тип без разделов (D-36). */
export type SaveBlock = 'guest' | 'otherType' | null

interface ProfileReadinessRailProps {
  readonly readiness: Readiness
  readonly saveBlock: SaveBlock
  readonly saving: boolean
  /** Сводка ошибок проверки или сбоя сохранения — объявляется скринридеру. */
  readonly message: string | null
  readonly onGoToError: () => void
  /** Режим просмотра 17а: панель приглушена, как контролы формы (16068:440). */
  readonly dimmed?: boolean
  /** Итог сохранения — «Изменения сохранены · 14:32» (17а). */
  readonly status?: string | null
  /** Скачать шаблон текущей формы и загрузить его обратно. Без обработчиков кнопки остаются недоступны. */
  readonly onDownloadTemplate?: () => void
  readonly onImportTemplate?: (file: File) => void
}

function ErrorsValue({ count, onGo }: { readonly count: number; readonly onGo: () => void }) {
  if (count === 0) return formatNumber(0)
  return (
    <span className="inline-flex items-center gap-8 text-danger">
      {formatNumber(count)}
      <IconButton size={24} tone="danger" icon={ArrowRight} label={t.goToError} onClick={onGo} />
    </span>
  )
}

/**
 * Правая панель «Готовность профиля» и действия формы (PRD 10.2; 15950:2157). Счётчики вычисляются (`readiness`),
 * правило «N / M» — PRD 15 · №44, D-36. Липкая, как на 09а: «Сохранить» видно на всей высоте формы (D-04).
 */
export function ProfileReadinessRail({
  readiness, saveBlock, saving, message, onGoToError, dimmed = false, status = null, onDownloadTemplate, onImportTemplate,
}: ProfileReadinessRailProps) {
  const { requiredDone, requiredTotal } = readiness
  const note = saveBlock === 'guest' ? t.guestSave : saveBlock === 'otherType' ? t.otherTypeSave : null
  return (
    <FormRail
      label={t.title}
      summary={(
        <Card className={dimmed ? 'opacity-(--rav-disabled-opacity)' : undefined}>
          <CardTitle>{t.title}</CardTitle>
          <p className="flex items-end gap-8">
            <span className="type-display-lg text-text">{`${formatNumber(requiredDone)} / ${formatNumber(requiredTotal)}`}</span>
            <span className="type-caption text-text-secondary">{t.requiredLabel}</span>
          </p>
          <Progress tone="inverse" label={t.requiredProgress} value={requiredTotal === 0 ? 0 : (requiredDone / requiredTotal) * PERCENT} />
          <dl className="flex flex-col gap-12">
            <CardStat label={t.filled} value={t.filledValue(formatNumber(readiness.filled), formatNumber(readiness.filledTotal))} />
            <CardStat label={t.errors} value={<ErrorsValue count={readiness.errors} onGo={onGoToError} />} />
            <CardStat label={t.assumptions} value={formatNumber(readiness.assumptions)} />
            <CardStat label={t.optionalEmpty} value={formatNumber(readiness.optionalEmpty)} />
          </dl>
        </Card>
      )}
      message={message}
      status={status}
      submit={{ label: saving ? t.saving : t.save, disabled: saveBlock !== null || saving, note }}
      excel={{
        importLabel: t.importExcel,
        templateLabel: t.downloadTemplate,
        note: onDownloadTemplate ? t.excelHint : t.excelSoon,
        ...(onDownloadTemplate ? { fileLabel: t.excelFile, onDownload: onDownloadTemplate } : {}),
        ...(onImportTemplate ? { onImport: onImportTemplate } : {}),
      }}
    />
  )
}
