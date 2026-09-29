import { Plus } from 'lucide-react'
import { useParams } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { MergedButton } from '@/components/ui/MergedButton'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { parseLocationId, type LocationDocument } from '@/domain'
import { useRole } from '@/shared/auth/useRole'
import { UPLOAD_RULES } from '@/shared/config/upload'
import { formatNumber } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { LocationHeader } from '../detail/LocationHeader'
import { DocumentRow } from './DocumentRow'
import { useDocumentUpload, type UploadMessage } from './useDocumentUpload'
import { useLocationDocuments } from './useLocationDocuments'

const t = ru.location
const td = t.documents
const RULE = UPLOAD_RULES.locationDocument

function LocationDocumentsSkeleton() {
  return (
    <div className="flex flex-col gap-16" aria-busy="true">
      <Skeleton className="h-48 w-1/3" />
      <Skeleton className="h-48" />
    </div>
  )
}

/** Итог загрузки у кнопки: живая область на месте всегда, чтобы экранный диктор прочёл сообщение. */
function UploadFeedback({ message }: { readonly message: UploadMessage | null }) {
  const isError = message?.tone === 'error'
  return (
    <p role={isError ? 'alert' : 'status'} className={isError ? 'type-caption text-danger' : 'type-caption text-text-secondary'}>
      {message?.text}
    </p>
  )
}

interface DocumentsPanelProps {
  readonly documents: readonly LocationDocument[]
  /** Может ли зритель загружать (гостю нельзя, D-14): от этого текст пустой вкладки. */
  readonly canUpload: boolean
}

/**
 * Карточка «Документы · 4» со списком (16005:1052). Пусто — приглашение с правилом форматов;
 * кнопка загрузки одна — «Добавить документ +» у вкладок.
 */
function DocumentsPanel({ documents, canUpload }: DocumentsPanelProps) {
  if (documents.length === 0) {
    return (
      <EmptyState
        title={td.empty.title}
        description={canUpload ? `${td.empty.description}. ${RULE.hint}` : td.empty.guestDescription}
      />
    )
  }
  return (
    <Card elevation="md" aria-labelledby="location-documents">
      <h2 id="location-documents" className="type-heading text-text">{td.heading(formatNumber(documents.length))}</h2>
      <ul className="flex flex-col gap-12" aria-label={td.listLabel}>
        {documents.map((d) => <DocumentRow key={d.id} document={d} />)}
      </ul>
    </Card>
  )
}

/**
 * Экран 17б «Локации · документы» (16005:1024; PRD 10.3): шапка локации, вкладки и материалы обследования —
 * планы, фото, таблицы, схемы. Платформа их хранит и показывает, содержимое не разбирает. Гость только смотрит (D-14).
 */
export function LocationDocumentsPage() {
  const locationId = parseLocationId(useParams().locationId)
  const role = useRole()
  const { state, retry, refresh } = useLocationDocuments(locationId)
  const upload = useDocumentUpload(locationId, refresh)

  if (state.status === 'loading') return <LocationDocumentsSkeleton />
  if (state.status === 'error') return <ErrorState title={t.error.title} message={t.error.message} onRetry={retry} />
  if (state.status === 'notFound') {
    return (
      <EmptyState
        title={t.notFound.title}
        description={t.notFound.description}
        action={<ButtonLink to={ROUTE_PATHS.locations}>{t.notFound.back}</ButtonLink>}
      />
    )
  }

  const isGuest = role === 'guest'
  // Демо-локация только для просмотра у всех ролей (ролевая модель, §4): документы не добавляются.
  const readOnly = isGuest || state.location.isDemo === true
  const action = readOnly ? null : (
    <div className="flex items-center gap-16">
      <UploadFeedback message={upload.message} />
      <input {...upload.inputProps} />
      <MergedButton label={upload.uploading ? td.adding : td.add} icon={Plus} disabled={upload.uploading} onClick={upload.pick} />
    </div>
  )

  return (
    <article className="flex flex-col gap-16" aria-labelledby="location-title">
      <title>{t.documentTitle(state.location.name)}</title>
      <LocationHeader
        location={state.location}
        summary={state.summary}
        facilityTypeName={state.facilityTypeName}
        isGuest={isGuest}
        activeTab="documents"
        action={action}
      />
      <DocumentsPanel documents={state.documents} canUpload={!readOnly} />
    </article>
  )
}
