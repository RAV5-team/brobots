import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Card, CardTitle } from './Card'
import { FormRail } from './FormRail'
import { NumberField } from './NumberField'
import { SkeletonList } from './States'
import { StatusBanner } from './StatusBanner'

const EXCEL = { importLabel: 'Загрузить из Excel', templateLabel: 'Скачать шаблон', note: 'Появится позже' }

describe('FormRail', () => {
  it('is a named aside with the summary, submit and disabled Excel actions explained by one note', () => {
    render(<FormRail label="Проверка шаблона" summary={<p>Сводка</p>} submit={{ label: 'Сохранить', disabled: false }} excel={EXCEL} />)
    expect(screen.getByRole('complementary', { name: 'Проверка шаблона' })).toHaveClass('sticky', 'w-(--rav-form-rail-width)')
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Сохранить' })).not.toHaveAttribute('aria-describedby')
    for (const name of ['Загрузить из Excel', 'Скачать шаблон']) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
      expect(screen.getByRole('button', { name })).toHaveAccessibleDescription('Появится позже')
    }
  })

  it('explains a disabled submit with a visible or screen-reader-only note', () => {
    const { rerender } = render(<FormRail label="Панель" summary={null} submit={{ label: 'Сохранить', disabled: true, note: 'Гость не сохраняет' }} />)
    expect(screen.getByRole('button', { name: 'Сохранить' })).toHaveAccessibleDescription('Гость не сохраняет')
    expect(screen.getByText('Гость не сохраняет')).toHaveClass('type-caption')
    rerender(<FormRail label="Панель" summary={null} submit={{ label: 'Сохранить', disabled: true, note: 'Добавьте фото', noteHidden: true }} />)
    expect(screen.getByText('Добавьте фото')).toHaveClass('sr-only')
  })

  it('announces the error message and the save status', () => {
    render(<FormRail label="Панель" summary={null} message="Проверьте поля: 2" status="Изменения сохранены · 14:32" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Проверьте поля: 2')
    expect(screen.getByRole('status')).toHaveTextContent('Изменения сохранены · 14:32')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('NumberField', () => {
  it('renders a decimal input with the unit and reports the raw text', () => {
    const onChange = vi.fn()
    render(<NumberField label="Объём операций в сутки" unit="оп./сут" required value="2000" onChange={onChange} />)
    const input = screen.getByRole('textbox', { name: /Объём операций в сутки/ })
    expect(input).toHaveAttribute('inputmode', 'decimal')
    expect(input).toHaveAttribute('autocomplete', 'off')
    expect(screen.getByText('оп./сут')).toBeInTheDocument()
    fireEvent.change(input, { target: { value: '2 500' } })
    expect(onChange).toHaveBeenCalledWith('2 500')
  })

  it('shows the error instead of the hint and marks the input invalid', () => {
    render(<NumberField label="Минимальная ширина прохода" hint="В метрах" error="Заполните поле" value="" onChange={vi.fn()} />)
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Заполните поле')).toBeInTheDocument()
    expect(screen.queryByText('В метрах')).not.toBeInTheDocument()
  })

  it('accepts a list of numbers as text and a cross-field error', () => {
    render(<NumberField label="Габариты" inputMode="text" invalid value="1 200 × 800" onChange={vi.fn()} />)
    expect(screen.getByRole('textbox')).toHaveAttribute('inputmode', 'text')
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('StatusBanner · accent', () => {
  it('without an action or extra lines is a compact status: title and description', () => {
    render(<StatusBanner variant="accent" title="Прогон устарел" description="Запустите заново" />)
    const banner = screen.getByRole('status', { name: 'Прогон устарел' })
    expect(banner).toHaveClass('bg-accent-surface', 'gap-4')
    expect(screen.getByRole('heading', { level: 2, name: 'Прогон устарел' })).toHaveClass('text-on-accent')
  })

  it('with an action puts it to the right and extra lines below', () => {
    render(
      <StatusBanner variant="accent" title="Параметры изменились" description="Пересчитайте" action={<button type="button">Пересчитать</button>}>
        <p>Расчёт в демо — по данным датасета</p>
      </StatusBanner>,
    )
    const banner = screen.getByRole('status', { name: 'Параметры изменились' })
    expect(banner).toHaveClass('gap-8')
    expect(banner.lastElementChild).toHaveTextContent('Расчёт в демо — по данным датасета')
    expect(screen.getByRole('button', { name: 'Пересчитать' }).parentElement).toHaveClass('justify-between')
  })
})

describe('SkeletonList', () => {
  it('renders busy rows of the given height', () => {
    const { container } = render(<SkeletonList rows={3} rowClassName="h-44" className="py-16" />)
    const list = container.firstElementChild
    expect(list).toHaveAttribute('aria-busy', 'true')
    expect(list).toHaveClass('flex', 'flex-col', 'gap-8', 'py-16')
    expect(list?.children).toHaveLength(3)
    expect(list?.firstElementChild).toHaveClass('h-44', 'motion-safe:animate-pulse')
  })
})

describe('CardTitle', () => {
  it('is h3 by default and h2 with an id when the card is labelled by it', () => {
    render(
      <Card as="section" aria-labelledby="checks-title">
        <CardTitle as="h2" id="checks-title">Проверки</CardTitle>
        <CardTitle>Внутри</CardTitle>
      </Card>,
    )
    expect(screen.getByRole('region', { name: 'Проверки' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Проверки' })).toHaveClass('type-overline', 'text-text-muted')
    expect(screen.getByRole('heading', { level: 3, name: 'Внутри' })).toBeInTheDocument()
  })
})
