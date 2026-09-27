import { X } from 'lucide-react'
import { Chip } from '@/components/ui/Chip'
import { Dropzone } from '@/components/ui/Dropzone'
import { IconButton } from '@/components/ui/IconButton'
import { UPLOAD_RULES } from '@/shared/config/upload'
import { ru } from '@/shared/i18n/ru'
import { RobotFormSection } from './RobotFormParts'
import type { PhotoList, RobotPhoto } from './usePhotoList'

const t = ru.robotNew
const MAX_PHOTOS = UPLOAD_RULES.robotPhoto.maxFiles

interface PhotoTileProps {
  readonly photo: RobotPhoto
  readonly index: number
  readonly onRemove: (id: string) => void
}

/** Плитка фото 200 × 140 с подписью: у первого — плашка «обложка» (15966:6182). */
function PhotoTile({ photo, index, onRemove }: PhotoTileProps) {
  return (
    <li className="relative flex w-(--rav-robot-photo-width) flex-col gap-8">
      <img
        src={photo.url}
        alt={t.photos.alt(index, photo.name)}
        className="h-(--rav-robot-photo-height) w-full rounded-lg object-contain"
      />
      <IconButton label={t.photos.remove(photo.name)} icon={X} size={36} className="absolute top-8 right-8" onClick={() => { onRemove(photo.id) }} />
      <p className="flex min-w-0 items-center gap-8">
        {index === 0 && <Chip tone="muted">{t.photos.cover}</Chip>}
        <span className="truncate type-caption text-text-muted" title={photo.name}>{photo.name}</span>
      </p>
    </li>
  )
}

function dropMessage(count: number, overflow: number): string | undefined {
  if (count === 0) return t.photos.required
  if (overflow > 0) return t.photos.trimmed(MAX_PHOTOS, overflow)
  if (count >= MAX_PHOTOS) return t.photos.limit(MAX_PHOTOS)
  return undefined
}

/** Секция 5 «Фотографии» (PRD 6.3; 15966:6177): 1–8 фото (D-18), первое — обложка. */
export function RobotPhotosSection({ list }: { readonly list: PhotoList }) {
  const { photos, overflow, add, remove } = list
  const full = photos.length >= MAX_PHOTOS
  return (
    <RobotFormSection id="robot-photos" title={t.sections.photos.title} description={t.sections.photos.description}>
      <div className="flex flex-wrap items-start gap-16">
        {photos.length > 0 && (
          <ul className="contents">
            {photos.map((photo, index) => <PhotoTile key={photo.id} photo={photo} index={index} onRemove={remove} />)}
          </ul>
        )}
        <div className="min-w-(--rav-form-rail-width) flex-1">
          <Dropzone
            kind="robotPhoto"
            title={t.photos.dropTitle}
            uploaded={photos.length}
            onFiles={add}
            disabled={full}
            message={dropMessage(photos.length, overflow)}
            className="min-h-(--rav-robot-dropzone-height)"
          />
        </div>
      </div>
    </RobotFormSection>
  )
}
