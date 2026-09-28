import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Checkbox } from './Checkbox'
import { Field } from './Field'
import { RadioGroup } from './RadioGroup'
import { Segmented } from './Segmented'
import { Select } from './Select'

const YES_NO = [{ value: 'no', label: 'Нет' }, { value: 'yes', label: 'Да' }] as const

function ControlledSegmented() {
  const [value, setValue] = useState('no')
  return <Segmented label="Делимый груз" options={YES_NO} value={value} onChange={setValue} />
}

describe('Segmented', () => {
  it('selects one option and never ends up empty', () => {
    render(<ControlledSegmented />)
    const yes = screen.getByRole('radio', { name: 'Да' })
    const no = screen.getByRole('radio', { name: 'Нет' })
    expect(no).toBeChecked()
    fireEvent.click(yes)
    expect(yes).toBeChecked()
    fireEvent.click(yes)
    expect(yes).toBeChecked()
  })
})

describe('Checkbox', () => {
  it('toggles and is named by its label', () => {
    render(<Checkbox label="OP-01 · Перемещение грузов" />)
    const box = screen.getByRole('checkbox', { name: 'OP-01 · Перемещение грузов' })
    expect(box).not.toBeChecked()
    fireEvent.click(box)
    expect(box).toBeChecked()
  })
})

describe('RadioGroup', () => {
  it('selects exactly one option', () => {
    render(<RadioGroup label="Способ обработки груза" options={[{ value: 'forks', label: 'Вилы' }, { value: 'platform', label: 'Платформа' }]} defaultValue="forks" />)
    expect(screen.getByRole('radiogroup', { name: 'Способ обработки груза' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Платформа' }))
    expect(screen.getByRole('radio', { name: 'Платформа' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Вилы' })).not.toBeChecked()
  })
})

describe('Select', () => {
  it('shows the selected option and is labelled by the field', () => {
    render(
      <Field label="Класс операции" hint="Ключ подбора">
        <Select options={[{ value: 'OP-01', label: 'OP-01 · Перемещение грузов' }]} defaultValue="OP-01" />
      </Field>,
    )
    const trigger = screen.getByRole('combobox', { name: 'Класс операции' })
    expect(trigger).toHaveTextContent('OP-01 · Перемещение грузов')
    expect(trigger).toHaveAccessibleDescription('Ключ подбора')
  })

  it('shows the placeholder when nothing is selected', () => {
    render(<Select aria-label="Тип объекта" placeholder="Тип объекта" variant="filter" options={[{ value: 'warehouse', label: 'Склад' }]} />)
    expect(screen.getByRole('combobox', { name: 'Тип объекта' })).toHaveTextContent('Тип объекта')
  })
})
