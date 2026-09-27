import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Field } from './Field'
import { FileInput } from './FileInput'
import { Segmented } from './Segmented'

const sized = (name: string, sizeMb: number) => {
  const f = new File([new Uint8Array(0)], name)
  Object.defineProperty(f, 'size', { value: Math.round(sizeMb * 1024 * 1024) })
  return f
}

const hiddenInput = (container: HTMLElement) => {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error('нет поля файла')
  return input
}

describe('FileInput', () => {
  it('offers to choose a file while empty and describes the empty value', () => {
    render(<Field label="Файл или ссылка" required hint="PDF, Excel, CSV или изображение до 20 МБ"><FileInput kind="document" label="Файл или ссылка" file={null} onChange={vi.fn()} onReject={vi.fn()} /></Field>)
    const action = screen.getByRole('button', { name: 'Выбрать файл: Файл или ссылка' })
    expect(action).toHaveAccessibleDescription('Файл не выбран PDF, Excel, CSV или изображение до 20 МБ')
  })

  it('shows the picked file with its size and offers to replace it (А7, 15966:7670)', () => {
    render(<FileInput kind="document" label="Файл" file={{ name: 'moros_amr800_spec.pdf', size: 2.4 * 1024 * 1024 }} onChange={vi.fn()} onReject={vi.fn()} />)
    expect(screen.getByText(/^moros_amr800_spec\.pdf · 2,4\sМБ$/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Заменить: Файл' })).toBeEnabled()
  })

  it('passes a valid file and rejects a wrong one with a fix, by the shared upload rule (D-18)', () => {
    const onChange = vi.fn()
    const onReject = vi.fn()
    const { container } = render(<FileInput kind="document" label="Файл" file={null} onChange={onChange} onReject={onReject} />)
    fireEvent.change(hiddenInput(container), { target: { files: [sized('plan.dwg', 1)] } })
    expect(onReject).toHaveBeenCalledWith('Формат .dwg не поддерживается. Загрузите PDF, Excel, CSV или изображение')
    fireEvent.change(hiddenInput(container), { target: { files: [sized('big.pdf', 21)] } })
    expect(onReject).toHaveBeenLastCalledWith('Файл больше 20 МБ. Уменьшите размер или разделите файл')
    fireEvent.change(hiddenInput(container), { target: { files: [sized('spec.pdf', 2)] } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'spec.pdf' }))
  })

  it('is marked invalid inside a Field with an error', () => {
    render(<Field label="Файл" error="Выберите файл источника"><FileInput kind="document" label="Файл" file={null} onChange={vi.fn()} onReject={vi.fn()} /></Field>)
    const action = screen.getByRole('button', { name: 'Выбрать файл: Файл' })
    expect(action).toHaveAttribute('aria-invalid', 'true')
    expect(action).toHaveAccessibleDescription('Файл не выбран Выберите файл источника')
  })

  it('cannot be used when disabled', () => {
    render(<FileInput kind="document" label="Файл" file={null} onChange={vi.fn()} onReject={vi.fn()} disabled />)
    expect(screen.getByRole('button', { name: 'Выбрать файл: Файл' })).toBeDisabled()
  })
})

describe('Segmented · fit="content" and disabled options', () => {
  it('keeps a disabled option out of the choice', () => {
    const onChange = vi.fn()
    render(
      <Segmented
        label="Файл или ссылка"
        fit="content"
        options={[{ value: 'file', label: 'Файл' }, { value: 'url', label: 'Ссылка', disabled: true }]}
        value="file"
        onChange={onChange}
      />,
    )
    const url = screen.getByRole('radio', { name: 'Ссылка' })
    expect(url).toBeDisabled()
    fireEvent.click(url)
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('radio', { name: 'Файл' })).toHaveAttribute('aria-checked', 'true')
  })
})
