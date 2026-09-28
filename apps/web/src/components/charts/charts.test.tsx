import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BarChart } from './BarChart'
import { RangeBar } from './RangeBar'
import { StackedBar } from './StackedBar'

const fmt = (v: number) => String(v).replace('-', '−')

describe('BarChart', () => {
  const HOURS = [
    { key: '07', label: '07', values: [50] },
    { key: '08', label: '08', values: [130], highlight: true },
    { key: '09', label: '09', values: [0] },
  ]

  it('график — изображение с именем, числа — в скрытой таблице', () => {
    render(<BarChart label="Потребность по часам" categoryLabel="Час" series={[{ key: 'demand', label: 'Потребность', tone: 'muted' }]} data={HOURS} formatValue={fmt} />)
    expect(screen.getByRole('img', { name: 'Потребность по часам' })).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Потребность по часам' })
    expect(within(table).getAllByRole('row').map((r) => r.textContent)).toEqual(['ЧасПотребность', '0750', '08130', '090'])
  })

  it('одиночная серия: выделенный столбец — тоном выделения (пиковые часы 05)', () => {
    const { container } = render(<BarChart label="x" categoryLabel="Час" series={[{ key: 'd', label: 'd', tone: 'muted' }]} highlightTone="strong" data={HOURS} formatValue={fmt} />)
    const bars = container.querySelectorAll('[data-bar]')
    expect(bars).toHaveLength(3)
    expect(bars[1]).toHaveClass('fill-inverse')
    expect(bars[0]).toHaveClass('fill-surface-sunken')
  })

  it('парные столбцы: по столбцу на серию в каждой колонке; нарушение — рамка колонки', () => {
    const { container } = render(
      <BarChart
        label="Загрузка по часам"
        categoryLabel="Час"
        series={[{ key: 'demand', label: 'потребность', tone: 'muted' }, { key: 'done', label: 'выполнено', tone: 'strong' }]}
        data={[{ key: '08', label: '08', values: [130, 122], violation: true }, { key: '09', label: '09', values: [120, 120] }]}
        formatValue={fmt}
        legend
      />,
    )
    expect(container.querySelectorAll('[data-bar]')).toHaveLength(4)
    expect(container.querySelectorAll('[data-violation]')).toHaveLength(1)
    expect(screen.getByRole('table', { name: 'Загрузка по часам' })).toHaveTextContent('08130122')
  })

  it('отрицательное значение — вниз от нулевой линии, подпись значения красным (денежный поток 08)', () => {
    const { container } = render(
      <BarChart label="Денежный поток" categoryLabel="Год" series={[{ key: 'flow', label: 'Накоплено', tone: 'strong' }]} showValues
        data={[{ key: '0', label: 'год 0', values: [-6.1] }, { key: '1', label: 'год 1', values: [3.1] }]} formatValue={fmt} height={100} />,
    )
    const [negative, positive] = [...container.querySelectorAll('[data-bar]')]
    expect(Number(negative?.getAttribute('y'))).toBeGreaterThanOrEqual(Number(positive?.getAttribute('y')) + Number(positive?.getAttribute('height')) - 1)
    expect(screen.getByText('−6.1', { selector: '[aria-hidden] *' })).toHaveClass('text-danger')
  })

  it('опорная линия «пик, на который рассчитан подбор»', () => {
    render(<BarChart label="x" categoryLabel="Час" series={[{ key: 'd', label: 'd', tone: 'muted' }]} data={HOURS} formatValue={fmt} reference={{ value: 130, label: 'пик подбора' }} />)
    expect(screen.getByRole('img')).toHaveAccessibleDescription('пик подбора: 130')
  })
})

describe('StackedBar', () => {
  const SEGMENTS = [
    { key: 'work', label: 'в работе', tone: 'strong' as const },
    { key: 'charge', label: 'зарядка', tone: 'accent' as const },
    { key: 'idle', label: 'свободен', tone: 'subtle' as const },
  ]

  it('полосы 100 %: доли сегментов, подпись строки, легенда и таблица долей', () => {
    const { container } = render(
      <StackedBar label="На что уходит время робота" segments={SEGMENTS} formatShare={(s) => `${String(Math.round(s * 100))} %`}
        rows={[{ key: 'a', label: 'Из подбора: 18 роботов', values: { work: 2, charge: 1, idle: 1 } }]} />,
    )
    const rects = [...container.querySelectorAll('[data-segment]')]
    expect(rects.map((r) => r.getAttribute('width'))).toEqual(['50%', '25%', '25%'])
    expect(rects.map((r) => r.getAttribute('x'))).toEqual(['0%', '50%', '75%'])
    expect(screen.getByText('Из подбора: 18 роботов', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'На что уходит время робота' })).toHaveTextContent('Из подбора: 18 роботов50 %25 %25 %')
  })
})

describe('RangeBar', () => {
  it('диапазон на общей шкале: подпись, полоса от минимума до максимума, значение', () => {
    const { container } = render(
      <RangeBar label="Устойчивость: окупаемость при ±20 %" valueLabel="Окупаемость, лет"
        rows={[{ key: 'labor', label: 'Стоимость труда', from: 0.5, to: 1, valueText: '0,5 — 1,0 года' }, { key: 'tariff', label: 'Тариф RaaS', from: 0.5, to: 0.8, valueText: '0,5 — 0,8 года' }]} />,
    )
    const ranges = [...container.querySelectorAll('[data-range]')]
    expect(ranges.map((r) => [r.getAttribute('x'), r.getAttribute('width')])).toEqual([['50%', '50%'], ['50%', '30%']])
    expect(screen.getByRole('table', { name: 'Устойчивость: окупаемость при ±20 %' })).toHaveTextContent('Стоимость труда0,5 — 1,0 года')
  })
})
