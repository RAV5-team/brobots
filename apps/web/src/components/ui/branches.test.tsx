import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Checkbox } from './Checkbox'
import { Dropzone } from './Dropzone'
import { IconButton } from './IconButton'
import { RadioGroup } from './RadioGroup'
import { Select } from './Select'
import { Toggle } from './Toggle'
import { Plus } from 'lucide-react'

describe('controlled and disabled branches', () => {
  it('Checkbox reports changes as boolean and respects disabled', () => {
    const onChange = vi.fn()
    const { rerender } = render(<Checkbox label="Класс" checked={false} onCheckedChange={onChange} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledWith(true)
    rerender(<Checkbox label="Класс" checked onCheckedChange={onChange} disabled hideLabel />)
    expect(screen.getByRole('checkbox')).toBeDisabled()
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('RadioGroup reports the chosen value', () => {
    const onChange = vi.fn()
    render(<RadioGroup label="Способ" orientation="horizontal" options={[{ value: 'a', label: 'А' }, { value: 'b', label: 'Б' }]} value="a" onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Б' }))
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('Toggle can be controlled and disabled', () => {
    render(<Toggle label="Авто" checked disabled hideLabel />)
    const toggle = screen.getByRole('switch', { name: 'Авто' })
    expect(toggle).toBeChecked()
    expect(toggle).toBeDisabled()
  })

  it('Select shows a controlled value and can be disabled', () => {
    render(<Select aria-label="Класс" options={[{ value: 'OP-01', label: 'OP-01' }]} value="OP-01" onChange={vi.fn()} disabled />)
    expect(screen.getByRole('combobox', { name: 'Класс' })).toBeDisabled()
  })

  it('IconButton has a 36 px variant', () => {
    render(<IconButton size={36} label="Добавить" icon={Plus} />)
    expect(screen.getByRole('button', { name: 'Добавить' })).toHaveClass('size-36')
  })
})

describe('Dropzone interactions', () => {
  const file = (name: string) => new File([new Uint8Array(0)], name)

  it('marks itself while a file is dragged over and resets on leave', () => {
    render(<Dropzone kind="document" title="Перетащите" onFiles={vi.fn()} />)
    const zone = screen.getByText('Перетащите').closest('[data-dropzone]') as HTMLElement
    fireEvent.dragOver(zone)
    expect(zone).toHaveAttribute('data-dragging')
    fireEvent.dragLeave(zone)
    expect(zone).not.toHaveAttribute('data-dragging')
  })

  it('ignores drops while disabled and opens the file dialog from the button', () => {
    const onFiles = vi.fn()
    render(<Dropzone kind="document" title="Перетащите" onFiles={onFiles} disabled />)
    const zone = screen.getByText('Перетащите').closest('[data-dropzone]') as HTMLElement
    fireEvent.drop(zone, { dataTransfer: { files: [file('a.csv')] } })
    expect(onFiles).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Выбрать файлы' })).toBeDisabled()
  })

  it('shows the upload counter and a form message', () => {
    render(<Dropzone kind="robotPhoto" title="Фото" uploaded={1} message="Без фото сохранить нельзя" onFiles={vi.fn()} />)
    expect(screen.getByText(/загружено 1 из 8/)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Без фото сохранить нельзя')
  })

  it('clicking the button forwards to the hidden file input', () => {
    render(<Dropzone kind="document" title="Файл" onFiles={vi.fn()} />)
    const input = screen.getByLabelText('Выбрать файлы', { selector: 'input' })
    const click = vi.spyOn(input, 'click')
    fireEvent.click(screen.getByRole('button', { name: 'Выбрать файлы' }))
    expect(click).toHaveBeenCalled()
  })

  it('does nothing when the file dialog is cancelled', () => {
    const onFiles = vi.fn()
    render(<Dropzone kind="document" title="Файл" onFiles={onFiles} />)
    fireEvent.change(screen.getByLabelText('Выбрать файлы', { selector: 'input' }), { target: { files: [] } })
    expect(onFiles).not.toHaveBeenCalled()
  })
})
