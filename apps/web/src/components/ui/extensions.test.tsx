import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Badge } from './Badge'
import { KpiCard } from './Card'
import { FieldGrid } from './FormSection'
import { FormulaStats } from './FormulaStats'
import { RadioGroup } from './RadioGroup'
import { Table, TableBody, TableCell, TableRow } from './Table'

describe('Badge — одно перечисление происхождения значения', () => {
  it('метки условий симуляции: «из задачи», «по умолчанию», «допущение»', () => {
    render(<><Badge kind="task" /><Badge kind="default" /><Badge kind="assumption" /></>)
    expect(screen.getByText('из задачи')).toBeInTheDocument()
    expect(screen.getByText('по умолчанию')).toBeInTheDocument()
    expect(screen.getByText('допущение')).toBeInTheDocument()
  })

  it('новые метки берут вид из тех же тонов, отдельных цветов нет', () => {
    render(<><Badge kind="task" /><Badge kind="exact" /><Badge kind="default" /><Badge kind="norm" /></>)
    expect(screen.getByText('из задачи').className).toBe(screen.getByText('точное значение').className)
    expect(screen.getByText('по умолчанию').className).toBe(screen.getByText('норматив').className)
  })
})

describe('KpiCard — слоты «было» и изменение', () => {
  it('без слотов — как раньше: подпись, значение, пояснение', () => {
    const { container } = render(<KpiCard label="Роботов" value="18" caption="резерв 15 %" />)
    expect(container.querySelectorAll('p')).toHaveLength(2)
  })

  it('«было 64,2 ₽» и «−20 %» — строка под значением', () => {
    render(<KpiCard label="Стоимость операции" value="51,6 ₽" previous="было 64,2 ₽" change="−20 %" />)
    const card = screen.getByRole('article')
    expect(within(card).getByText('было 64,2 ₽')).toBeInTheDocument()
    expect(within(card).getByText('−20 %')).toHaveClass('font-semibold')
  })
})

describe('RadioGroup — карточки', () => {
  const OPTIONS = [
    { value: 'LP-01', label: 'Перемещение паллет', description: <span>2 000 паллет/сут</span> },
    { value: 'LP-02', label: 'Комплектация заказов', description: <span>100 000 строк/сут</span> },
    { value: 'LP-05', label: 'Инвентаризация', description: <span>подбор недоступен</span>, disabled: true },
  ] as const

  it('радио названо по заголовку карточки, описание — отдельно', () => {
    render(<RadioGroup variant="cards" label="Процесс проекта" options={OPTIONS} defaultValue="LP-01" />)
    const radio = screen.getByRole('radio', { name: 'Перемещение паллет' })
    expect(radio).toBeChecked()
    expect(radio).toHaveAccessibleDescription('2 000 паллет/сут')
  })

  it('щелчок по карточке выбирает её; недоступная карточка не выбирается', () => {
    const onChange = vi.fn()
    render(<RadioGroup variant="cards" columns={3} label="Процесс проекта" options={OPTIONS} onChange={onChange} />)
    fireEvent.click(screen.getByText('100 000 строк/сут'))
    expect(onChange).toHaveBeenCalledWith('LP-02')
    expect(screen.getByRole('radio', { name: 'Инвентаризация' })).toBeDisabled()
  })

  it('список по умолчанию — как раньше', () => {
    render(<RadioGroup label="Тип" options={[{ value: 'a', label: 'A' }]} />)
    expect(screen.getByRole('radio', { name: 'A' })).toBeInTheDocument()
    expect(screen.getByRole('radiogroup')).toHaveClass('flex-col')
  })
})

describe('FormulaStats — список', () => {
  it('строки «подпись и формула — значение» в одном dl', () => {
    render(<FormulaStats layout="list" label="Потребность" stats={[{ key: 'peak', label: 'Пик к роботизации', value: '130 рейсов/ч', formula: '2 000 ÷ 22 ч × 1,5 × охват 95%' }]} />)
    const list = screen.getByLabelText('Потребность')
    expect(list.tagName).toBe('DL')
    expect(list).not.toHaveClass('shadow-inset-md')
    expect(within(list).getByRole('term')).toHaveTextContent('Пик к роботизации')
    expect(within(list).getAllByRole('definition').map((d) => d.textContent)).toEqual(['130 рейсов/ч', '2 000 ÷ 22 ч × 1,5 × охват 95%'])
  })

  it('по умолчанию — вдавленная панель в колонки, как раньше', () => {
    render(<FormulaStats label="Расчёт" stats={[{ key: 'a', label: 'A', value: '1', formula: '= 1' }]} />)
    expect(screen.getByLabelText('Расчёт')).toHaveClass('shadow-inset-md')
  })
})

describe('FieldGrid — колонки', () => {
  it('по умолчанию 2 колонки, по запросу 3 и 4', () => {
    const { container, rerender } = render(<FieldGrid><span /></FieldGrid>)
    expect(container.firstChild).toHaveClass('grid-cols-2')
    rerender(<FieldGrid columns={4}><span /></FieldGrid>)
    expect(container.firstChild).toHaveClass('grid-cols-4')
  })
})

describe('TableCell — тон «нарушение»', () => {
  it('danger-bg и danger, как ✕ в К-3; по умолчанию — без тона', () => {
    render(
      <Table caption="По часам"><TableBody><TableRow>
        <TableCell tone="violation">97</TableCell><TableCell>84</TableCell>
      </TableRow></TableBody></Table>,
    )
    expect(screen.getByText('97')).toHaveClass('bg-danger-bg', 'text-danger')
    expect(screen.getByText('84')).not.toHaveClass('bg-danger-bg')
  })
})
