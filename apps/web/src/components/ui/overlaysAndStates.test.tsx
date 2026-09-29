import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import { Dropzone } from './Dropzone'
import { Modal } from './Modal'
import { EmptyState, ErrorState, Skeleton } from './States'

const sized = (name: string, sizeMb: number) => {
  const f = new File([new Uint8Array(0)], name)
  Object.defineProperty(f, 'size', { value: Math.round(sizeMb * 1024 * 1024) })
  return f
}

describe('Modal', () => {
  it('opens as a named dialog, closes with Escape and returns focus', async () => {
    render(
      <Modal title="Новый источник данных" description="Источник попадёт в отчёты" trigger={<Button>Добавить</Button>} footer={<Button variant="primary">Добавить источник</Button>}>
        <p>Поля</p>
      </Modal>,
    )
    const trigger = screen.getByRole('button', { name: 'Добавить' })
    fireEvent.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: 'Новый источник данных' })
    expect(dialog).toHaveAccessibleDescription('Источник попадёт в отчёты')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => { expect(screen.queryByRole('dialog')).not.toBeInTheDocument() })
    expect(trigger).toHaveFocus()
  })

  it('renders the confirmation size without children (17в)', async () => {
    render(<Modal size="sm" title="Удалить?" description="Только с этой локации" trigger={<Button>Удалить</Button>} footer={<Button>Отмена</Button>} />)
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))
    const dialog = await screen.findByRole('dialog', { name: 'Удалить?' })
    expect(dialog).toHaveClass('w-(--rav-modal-sm-width)', 'p-32', 'gap-20')
    expect(dialog.querySelector('footer')).toHaveClass('pb-24')
  })

  it('side panel: 560 px on the right edge, focus inside, Escape closes, the body scrolls (03a, 16202:979)', async () => {
    render(
      <Modal size="side" title="Как рассчитано" description="AMR 800 · RaaS" trigger={<Button>Как рассчитано</Button>} footer={<Button>Понятно</Button>}>
        <p>Шаги расчёта</p>
      </Modal>,
    )
    const trigger = screen.getByRole('button', { name: 'Как рассчитано' })
    fireEvent.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: 'Как рассчитано' })
    expect(dialog).toHaveClass('right-0', 'h-full', 'w-(--rav-modal-side-width)', 'rounded-l-3xl')
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    const body = screen.getByRole('region', { name: 'Как рассчитано' })
    expect(body).toHaveClass('overflow-y-auto')
    expect(body).toHaveTextContent('Шаги расчёта')
    expect(dialog.querySelector('footer')).toHaveClass('bg-surface-muted')
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => { expect(screen.queryByRole('dialog')).not.toBeInTheDocument() })
    expect(trigger).toHaveFocus()
  })

  it('has a labelled close button', async () => {
    render(<Modal title="Окно" trigger={<Button>Открыть</Button>}><p /></Modal>)
    fireEvent.click(screen.getByRole('button', { name: 'Открыть' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Закрыть' }))
    await waitFor(() => { expect(screen.queryByRole('dialog')).not.toBeInTheDocument() })
  })
})

describe('Dropzone', () => {
  it('passes valid files and reports rule violations with a fix', () => {
    const onFiles = vi.fn()
    render(<Dropzone kind="robotPhoto" title="Перетащите фото сюда" onFiles={onFiles} />)
    const input = screen.getByLabelText('Выбрать файлы', { selector: 'input' })
    fireEvent.change(input, { target: { files: [sized('spec.pdf', 1)] } })
    expect(onFiles).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Формат .pdf не поддерживается. Загрузите изображение')
    fireEvent.change(input, { target: { files: [sized('robot.jpg', 2)] } })
    expect(onFiles).toHaveBeenCalledWith([expect.objectContaining({ name: 'robot.jpg' })])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('accepts dropped files', () => {
    const onFiles = vi.fn()
    render(<Dropzone kind="document" title="Перетащите файл" onFiles={onFiles} />)
    fireEvent.drop(screen.getByText('Перетащите файл').closest('[data-dropzone]') as HTMLElement, { dataTransfer: { files: [sized('data.csv', 1)] } })
    expect(onFiles).toHaveBeenCalledTimes(1)
  })
})

describe('States (D-07)', () => {
  it('empty state offers the next action', () => {
    render(<EmptyState title="Процессов пока нет" description="Добавьте первый процесс" action={<Button>Добавить процесс</Button>} />)
    expect(screen.getByRole('heading', { name: 'Процессов пока нет' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Добавить процесс' })).toBeInTheDocument()
  })

  it('error state is announced and offers retry', () => {
    const onRetry = vi.fn()
    render(<ErrorState title="Не удалось загрузить" message="Проверьте подключение и повторите" onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Проверьте подключение и повторите')
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('skeleton is hidden from assistive tech', () => {
    const { container } = render(<Skeleton className="h-44" />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })
})
