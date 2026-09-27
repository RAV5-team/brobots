import { Button } from '@/components/ui/Button'
import { Dropzone } from '@/components/ui/Dropzone'
import { Field } from '@/components/ui/Field'
import { FileInput } from '@/components/ui/FileInput'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { ru } from '@/shared/i18n/ru'
import { stateProps, type DemoState } from './demoState'
import { ShowcaseSection, StateGrid } from './StateGrid'

const s = ru.dev.samples
const r = ru.location.removeProcess
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
      <Modal
        size="sm"
        title={r.title('Перемещение паллет', 'РЦ Химки')}
        description={r.description}
        trigger={<Button className="self-start">{s.openConfirm}</Button>}
        footer={<><Button className="px-20">{r.cancel}</Button><Button variant="danger" className="px-20">{r.confirm}</Button></>}
      />
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
      <ShowcaseSection title="EmptyState · lg">
        <EmptyState size="lg" title={s.emptyTitle} description={s.emptyDescription} action={<Button>{s.addProcess}</Button>} />
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

const FILE_LABEL = ru.dataSources.create.fields.locator
const SAMPLE_FILE = { name: s.sourceFile, size: 2.4 * 1024 * 1024 }

function DemoFileInput({ state, filled, error }: { state: DemoState; filled: boolean; error?: string }) {
  const input = <FileInput kind="document" label={FILE_LABEL} file={filled ? SAMPLE_FILE : null} onChange={ignore} onReject={ignore} {...stateProps(state)} />
  return (
    <span className="block w-[360px]">
      {error ? <Field label={FILE_LABEL} required error={error}>{input}</Field> : input}
    </span>
  )
}

export function FileInputShowcase() {
  return (
    <ShowcaseSection title="FileInput">
      <StateGrid
        states={['default', 'hover', 'focus', 'disabled']}
        rows={[
          { label: s.fileEmpty, render: (st) => <DemoFileInput state={st} filled={false} /> },
          { label: s.fileFilled, render: (st) => <DemoFileInput state={st} filled /> },
          { label: s.fileError, render: (st) => <DemoFileInput state={st} filled={false} error={ru.dataSources.create.errors.file} /> },
        ]}
      />
    </ShowcaseSection>
  )
}
