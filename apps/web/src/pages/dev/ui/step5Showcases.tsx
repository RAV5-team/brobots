import { Button } from '@/components/ui/Button'
import { Dropzone } from '@/components/ui/Dropzone'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { ru } from '@/shared/i18n/ru'
import { ShowcaseSection } from './StateGrid'

const s = ru.dev.samples
const ignore = () => undefined

export function ModalShowcase() {
  return (
    <ShowcaseSection title="Modal">
      <Modal
        title={s.modalTitle}
        description={s.modalDescription}
        trigger={<Button variant="primary" className="self-start">{s.openModal}</Button>}
        footer={<><Button className="px-24">{s.cancel}</Button><Button variant="primary" className="px-24">{s.addSource}</Button></>}
      >
        <Field label={s.sourceName} required><Input defaultValue={s.sourceNameValue} /></Field>
        <Field label={s.sourceType} required>
          <Select options={[{ value: 'specs', label: s.sourceTypeValue }]} defaultValue="specs" />
        </Field>
        <Dropzone kind="document" title={s.dropPhotos} onFiles={ignore} />
      </Modal>
    </ShowcaseSection>
  )
}

export function DropzoneShowcase() {
  return (
    <ShowcaseSection title="Dropzone">
      <div className="grid grid-cols-2 gap-24">
        <Dropzone kind="robotPhoto" title={s.dropPhotos} uploaded={1} onFiles={ignore} message={s.noPhoto} />
        <Dropzone kind="robotPhoto" title={s.dropPhotos} uploaded={1} onFiles={ignore} data-demo-state="hover" />
        <Dropzone kind="document" title={s.dropPhotos} onFiles={ignore} />
        <Dropzone kind="document" title={s.dropPhotos} onFiles={ignore} disabled />
      </div>
    </ShowcaseSection>
  )
}

export function StatesShowcase() {
  return (
    <div className="flex flex-col gap-24">
      <ShowcaseSection title="EmptyState">
        <EmptyState title={s.emptyTitle} description={s.emptyDescription} action={<Button variant="primary">{s.addProcess}</Button>} />
      </ShowcaseSection>
      <ShowcaseSection title="ErrorState">
        <ErrorState title={s.errorTitle} message={s.errorMessage} onRetry={ignore} />
      </ShowcaseSection>
      <ShowcaseSection title="Skeleton">
        <div className="flex flex-col gap-12">
          <Skeleton className="h-24 w-[240px]" />
          <Skeleton className="h-44" />
          <div className="grid grid-cols-3 gap-16">
            <Skeleton className="h-[148px] rounded-lg" />
            <Skeleton className="h-[148px] rounded-lg" />
            <Skeleton className="h-[148px] rounded-lg" />
          </div>
        </div>
      </ShowcaseSection>
    </div>
  )
}
