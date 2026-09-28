import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BarChart } from './BarChart'
import { ChartLegend } from './ChartLegend'
import { stackBoxes } from './chartScale'
import { BOARD_TIME_TONES } from './chartTones'
import { HourlyTable, type HourlyTableGroup } from './HourlyTable'
import { filterDiffering, isDiffering } from './hourlyDiff'
import { StackedBar } from './StackedBar'

const fmt = (v: number) => String(v)
const SERIES = [
  { key: 'demand', label: 'Потребность', tone: 'muted' as const },
  { key: 'from', label: 'Из подбора', tone: 'strong' as const },
  { key: 'to', label: 'С изменениями', tone: 'accent' as const },
]

describe('BarChart — варианты доски 16325', () => {
  it('stacked: серии стопкой в одном столбце, первая — снизу; домен по сумме', () => {
    const { container } = render(
      <BarChart label="Потребность" categoryLabel="Час" stacked height={100} formatValue={fmt}
        series={[{ key: 'in', label: 'приёмка', tone: 'strong' }, { key: 'out', label: 'отгрузка', tone: 'secondary' }]}
        data={[{ key: '07', label: '07', values: [60, 40] }, { key: '08', label: '08', values: [30, 20] }]} />,
    )
    const bars = [...container.querySelectorAll('[data-bar]')]
    expect(bars.map((b) => [b.getAttribute('y'), b.getAttribute('height'), b.getAttribute('width')])).toEqual([
      ['40', '60', '100%'], ['0', '40', '100%'], ['70', '30', '100%'], ['50', '20', '100%'],
    ])
    expect(bars[1]).toHaveClass('fill-border-control')
  })

  it('stackBoxes: отрицательное в стопке не рисуется', () => {
    expect(stackBoxes([10, -5, 10], { min: 0, max: 20 }, 100)).toEqual([{ top: 50, height: 50 }, { top: 50, height: 0 }, { top: 0, height: 50 }])
  })

  it('axis, peakMark, красный пунктир, подпись под столбцом, легенда слева с пунктами вызывающего', () => {
    const { container } = render(
      <BarChart label="Загрузка по часам" categoryLabel="Час" series={SERIES} formatValue={fmt} height={100}
        data={[{ key: '07', label: '07', values: [50, 50, 50] }, { key: '08', label: '08', axisLabel: '', values: [130, 107, 130], highlight: true }]}
        axis={{ ticks: [0, 65, 130], unit: 'рейсов в час' }} peakMark legend legendPosition="left"
        legendItems={[...SERIES, { key: 'peak', label: 'Пиковый час', tone: 'strong', marker: 'dash' }]}
        reference={{ value: 130, label: 'пик подбора', tone: 'danger' }} />,
    )
    expect([...container.querySelectorAll('[data-axis-tick]')].map((t) => [t.textContent, (t as HTMLElement).style.top])).toEqual([['0', '100px'], ['65', '50px'], ['130', '0px']])
    expect(screen.getByText('рейсов в час')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-peak]')).toHaveLength(1)
    expect(container.querySelector('[data-highlight]')).toBeNull()
    expect(container.querySelector('[data-reference="danger"]')).toHaveClass('border-danger')
    expect(container.querySelector('[data-marker="dash"]')).toHaveClass('h-4', 'w-12', 'bg-inverse')
    // Подпись под столбцом пустая, в таблице — полная.
    expect(screen.getByRole('table', { name: 'Загрузка по часам' })).toHaveTextContent('08130107130')
    expect(container.querySelectorAll('[data-bar]')).toHaveLength(6)
  })

  it('без новых пропов — прежняя разметка: нет оси, черты, подписи пунктира', () => {
    const { container } = render(<BarChart label="x" categoryLabel="Час" series={SERIES.slice(0, 2)} formatValue={fmt}
      data={[{ key: '08', label: '08', values: [130, 120], highlight: true }]} reference={{ value: 130, label: 'пик' }} />)
    expect(container.querySelector('[data-axis-tick], [data-peak], [data-reference]')).toBeNull()
    expect(container.querySelector('[data-highlight]')).not.toBeNull()
  })
})

describe('ChartLegend — формы знаков и вторая строка', () => {
  it('знаки: круг-обводка, ромб, рамка; итог второй строкой', () => {
    const { container } = render(
      <ChartLegend layout="column" series={[
        { key: 'a', label: 'свободен', tone: 'secondary', marker: 'ring' },
        { key: 'b', label: 'станция', tone: 'light', marker: 'diamond' },
        { key: 'c', label: 'Красная рамка', detail: 'ниже требования', tone: 'danger', marker: 'frame' },
      ]} />,
    )
    expect(container.querySelector('ul')).toHaveClass('flex-col')
    expect(container.querySelector('[data-marker="ring"]')).toHaveClass('rounded-full', 'border-border-control')
    expect(container.querySelector('[data-marker="diamond"]')).toHaveClass('rotate-45', 'bg-border-strong')
    expect(container.querySelector('[data-marker="frame"]')).toHaveClass('border-danger')
    expect(screen.getByText('ниже требования')).toHaveClass('text-text-muted')
  })
})

describe('StackedBar — тона доски', () => {
  it('tones заменяет тона сегментов по ключу: ремонт — лайм, ожидание — серый', () => {
    const { container } = render(
      <StackedBar label="Время" formatShare={String} tones={BOARD_TIME_TONES} legendShape="dot"
        segments={[{ key: 'blocked', label: 'ждёт', tone: 'danger' }, { key: 'down', label: 'ремонт', tone: 'danger-soft' }]}
        rows={[{ key: 'a', label: 'Из подбора', values: { blocked: 1, down: 1 } }]} />,
    )
    const rects = [...container.querySelectorAll('[data-segment]')]
    expect(rects.map((r) => r.getAttribute('class'))).toEqual(['fill-border-control', 'fill-accent'])
    expect(container.querySelectorAll('li > span.rounded-full')).toHaveLength(2)
  })
})

const row = (key: string, label: string, values: readonly string[], violated: readonly number[] = []) => ({
  key, label, cells: values.map((value, i) => ({ value, violation: violated.includes(i) })),
})
const GROUPS: readonly HourlyTableGroup[] = [
  { key: 'load', title: 'Нагрузка на парк', metrics: [
    { key: 'idle', label: 'Свободны, роботов', rows: [row('i1', 'Из подбора', ['1', '2']), row('i2', 'С изменениями', ['1', '2'])] },
    { key: 'queue', label: 'Очередь к станции', rows: [row('q1', 'Из подбора', ['0', '0']), row('q2', 'С изменениями', ['0', '0'])] },
  ] },
  { key: 'result', title: 'Результат', metrics: [
    { key: 'done', label: 'Выполнено, рейсов', requirement: 'требование — вся потребность часа', rows: [row('d1', 'Из подбора', ['50', '107'], [1]), row('d2', 'С изменениями', ['50', '130'])] },
  ] },
]

describe('фильтр различий HourlyTable', () => {
  it('isDiffering: совпали все часы — не различается; одна строка — различается', () => {
    const [load, result] = GROUPS
    const [idle] = load?.metrics ?? []
    const [done] = result?.metrics ?? []
    expect(idle && isDiffering(idle)).toBe(false)
    expect(done && isDiffering(done)).toBe(true)
    expect(isDiffering({ key: 'x', label: 'x', rows: [row('a', 'a', ['1'])] })).toBe(true)
  })

  it('filterDiffering: считает скрытые всегда, убирает пустые группы только при apply', () => {
    expect(filterDiffering(GROUPS, false)).toEqual({ groups: GROUPS, hidden: 2 })
    const applied = filterDiffering(GROUPS, true)
    expect(applied.hidden).toBe(2)
    expect(applied.groups.map((g) => g.key)).toEqual(['result'])
  })
})

describe('HourlyTable — группы, пары строк, рамка нарушения', () => {
  it('группы с требованием; строка состава для чтения с экрана — с именем показателя; нарушение — рамкой', () => {
    render(
      <>
        <h2 id="h">Загрузка по часам</h2>
        <HourlyTable labelledBy="h" categoryLabel="Час" columns={['07', '08']} violationLabel="нарушение" violation="outline"
          rows={[row('demand', 'Потребность, рейсов', ['50', '130'])]} groups={GROUPS} onlyDiffering
          toggle={{ showAll: (n) => `Показать все строки · ${String(n)}`, onlyDiffering: 'Только различия' }} />
      </>,
    )
    const table = screen.getByRole('table', { name: 'Загрузка по часам' })
    expect(within(table).getByRole('rowheader', { name: 'Выполнено, рейсов: Из подбора' })).toBeInTheDocument()
    expect(within(table).getByText('требование — вся потребность часа')).toBeInTheDocument()
    expect(within(table).queryByText('Нагрузка на парк')).not.toBeInTheDocument()
    const violated = within(table).getByText('107').closest('td')
    expect(violated).toHaveClass('ring-1', 'ring-danger-border')
    expect(violated).not.toHaveClass('bg-danger-bg')

    fireEvent.click(screen.getByRole('button', { name: 'Показать все строки · 2' }))
    expect(within(table).getByText('Нагрузка на парк')).toBeInTheDocument()
    expect(within(table).getByRole('rowheader', { name: 'Очередь к станции: С изменениями' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Только различия' })).toBeInTheDocument()
  })

  it('без групп — кнопки нет, заливка нарушений прежняя', () => {
    render(<><h2 id="h2">t</h2><HourlyTable labelledBy="h2" categoryLabel="Час" columns={['07']} violationLabel="нарушение"
      rows={[row('d', 'x', ['1'], [0])]} toggle={{ showAll: String, onlyDiffering: 'y' }} /></>)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('cell')).toHaveClass('bg-danger-bg')
  })
})
