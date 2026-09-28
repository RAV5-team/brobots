import { ArrowRight } from 'lucide-react'
import { Chip } from '@/components/ui/Chip'
import { IconButton, IconButtonAnchor } from '@/components/ui/IconButton'
import type { LocationDocument } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { documentBadge, documentCaption } from './locationDocumentsModel'

const t = ru.location.documents

/** Строка документа: плашка типа, имя и подпись, «→» открыть (16005:1054). */
export function DocumentRow({ document }: { readonly document: LocationDocument }) {
  return (
    <li className="flex items-center gap-12 rounded-md bg-surface-muted p-12 shadow-inset-md">
      <Chip size="md">{documentBadge(document)}</Chip>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <h3 className="truncate type-body font-semibold text-text">{document.name}</h3>
        <p className="type-caption text-text-secondary">{documentCaption(document)}</p>
      </div>
      {document.url === null ? (
        // Файлов к демо-документам нет (D-42): кнопка на месте, но недоступна с пояснением.
        <IconButton icon={ArrowRight} size={36} label={t.noFile(document.name)} disabled />
      ) : (
        <IconButtonAnchor icon={ArrowRight} size={36} label={t.open(document.name)} href={document.url} />
      )}
    </li>
  )
}
