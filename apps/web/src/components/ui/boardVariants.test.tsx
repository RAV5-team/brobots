import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Badge } from './Badge'
import { Button } from './Button'
import { CardStat } from './Card'
import { CharacteristicRow } from './CharacteristicRow'
import { Chip } from './Chip'
import { CompareTable } from './CompareTable'
import { Modal } from './Modal'
import { RadioTable, type RadioTableRow } from './RadioTable'

// Доработки доски 16325:2 (шаги 1–2): новые варианты; без новых пропсов вывод прежний.

describe('Chip — тон danger', () => {
  it('красная обводка «Блокирует подбор» (16969:10)', () => {
    render(<Chip tone="danger">Блокирует подбор</Chip>)
    expect(screen.getByText('Блокирует подбор')).toHaveClass('border', 'border-danger-border', 'bg-bg', 'text-danger')
  })
})

describe('Badge — «вне расчёта» и статусы проверки', () => {
  it.each([
    ['outOfScope', 'вне расчёта'], ['confirmed', 'подтверждено'], ['analog', 'по аналогу'],
    ['estimate', 'оценка'], ['pending', 'ещё не проверено'], ['needsCheck', 'требует проверки'],
  ] as const)('%s → «%s»', (kind, text) => {
    render(<Badge kind={kind} />)
    expect(screen.getByText(text)).toBeInTheDocument()
  })

  it('«требует проверки» — красная обводка; «подтверждено» — серая заливка; «по аналогу» — пунктир', () => {
    render(<><Badge kind="needsCheck" /><Badge kind="confirmed" /><Badge kind="analog" /></>)
    expect(screen.getByText('требует проверки')).toHaveClass('border-danger-border', 'text-danger')
    expect(screen.getByText('подтверждено')).toHaveClass('bg-surface-sunken')
    expect(screen.getByText('по аналогу')).toHaveClass('border-dashed')
  })
})

describe('CharacteristicRow — варианты stacked и plain', () => {
  it('stacked: источник под значением, плашка статуса проверки — Badge, колонки источника нет', () => {
    render(<dl><CharacteristicRow variant="stacked" label="Грузоподъёмность" value="800 кг" verification="confirmed" source="Технический паспорт" date="2026-03-01" /></dl>)
    const status = screen.getByText('подтверждено')
    expect(status).toHaveClass('bg-surface-sunken')
    expect(status).not.toHaveClass('bg-accent-surface')
    expect(screen.getByText('Технический паспорт · 01.03.2026')).toBeInTheDocument()
    expect(document.querySelector('.w-\\(--rav-characteristic-source-width\\)')).toBeNull()
  })

  it('plain: только подпись и значение', () => {
    render(<dl><CharacteristicRow variant="plain" label="Производитель" value="Морос" /></dl>)
    expect(screen.getByRole('term')).toHaveTextContent('Производитель')
    expect(screen.getByRole('definition')).toHaveTextContent(/^Морос$/)
  })

  it('по умолчанию (К-4) — лаймовая плашка Chip и колонка источника, как раньше', () => {
    render(<dl><CharacteristicRow label="Габариты" value="940 мм" status="confirmed" source="морос.рф" /></dl>)
    expect(screen.getByText('подтверждено')).toHaveClass('bg-accent-surface')
    expect(screen.getByText('морос.рф')).toHaveClass('w-(--rav-characteristic-source-width)')
  })
})

describe('CompareTable и CardStat — подписи второй строкой', () => {
  it('подпись у показателя и у колонки', () => {
    render(
      <CompareTable
        caption="Сравнение с текущим процессом"
        columns={[{ key: 'base', label: 'Текущий процесс', header: 'Текущий процесс', caption: 'без роботизации · база' }]}
        groups={[{ key: 'g', title: 'Экономика', rows: [{ key: 'capex', label: 'Стартовые вложения', caption: 'CAPEX', cells: [{ key: 'base', content: '—' }] }] }]}
      />,
    )
    expect(screen.getByRole('columnheader', { name: 'Текущий процесс' })).toHaveTextContent('без роботизации · база')
    expect(screen.getByRole('rowheader')).toHaveTextContent('Стартовые вложенияCAPEX')
  })

  it('CardStat: пояснение под подписью; без него — одна строка', () => {
    const { rerender } = render(<dl><CardStat label="Роботов" value="18" caption="+ 6 зарядных станций" /></dl>)
    expect(screen.getByRole('term')).toHaveTextContent('Роботов+ 6 зарядных станций')
    rerender(<dl><CardStat label="Роботов" value="18" /></dl>)
    expect(screen.getByRole('term').innerHTML).toBe('Роботов')
  })
})

describe('Modal — размер detail', () => {
  it('640 по центру, строка под заголовком в шапке, прокручивается тело; плашка рядом с заголовком', async () => {
    render(
      <Modal size="detail" title="AMR 800" titleAside={<Chip tone="inverse">Место 1</Chip>} headerExtra={<p>Морос · AMR</p>} trigger={<Button>Подробнее</Button>} footer={<Button>Выбрать</Button>}>
        <p>Идентификация</p>
      </Modal>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Подробнее' }))
    const dialog = await screen.findByRole('dialog', { name: 'AMR 800' })
    expect(dialog).toHaveClass('w-(--rav-modal-wide-width)', 'overflow-hidden')
    expect(within(dialog).getByText('Место 1')).toBeInTheDocument()
    const body = within(dialog).getByRole('region', { name: 'AMR 800' })
    expect(body).toHaveClass('overflow-y-auto')
    expect(body).toHaveTextContent('Идентификация')
    expect(body).not.toHaveTextContent('Морос · AMR')
  })

  it.each([[3, 'w-(--rav-modal-compare-3-width)'], [4, 'w-(--rav-modal-compare-4-width)']] as const)('сравнение на %i колонки — %s', async (columns, width) => {
    render(<Modal size="detail" columns={columns} title="Сравнение вариантов" open><p>Таблица</p></Modal>)
    expect(await screen.findByRole('dialog')).toHaveClass(width)
  })
})

type Loc = 'a' | 'b' | 'c'
const COLUMNS = [{ key: 'name', label: 'Решение' }, { key: 'capex', label: 'CAPEX', widthClass: 'w-(--rav-new-project-area-width)' }] as const
const TRAILING = { key: 'score', label: 'Балл', widthClass: 'w-(--rav-new-project-labor-width)' }
const rows = (extra: Partial<Record<Loc, Partial<RadioTableRow<Loc>>>> = {}): readonly RadioTableRow<Loc>[] =>
  (['a', 'b', 'c'] as const).map((v) => ({ value: v, label: `Вариант ${v}`, cells: [`Вариант ${v}`, '6,1'], ...extra[v] }))

describe('RadioTable — колонка trailing, раскрытие, тон, флажки', () => {
  it('кнопка в trailing — вне кнопки строки; раскрытие — под выбранной строкой', () => {
    const onScore = vi.fn()
    function Demo() {
      const [value, setValue] = useState<Loc | null>('a')
      return (
        <RadioTable
          label="Рейтинг"
          columns={COLUMNS}
          trailingColumn={TRAILING}
          value={value}
          onChange={setValue}
          rows={rows({
            a: { trailing: <button type="button" onClick={onScore}>0,91</button>, detail: <p>Разбор a</p> },
            b: { detail: <p>Разбор b</p> },
          })}
        />
      )
    }
    render(<Demo />)
    const score = screen.getByRole('button', { name: '0,91' })
    expect(score.closest('[role="radio"]')).toBeNull()
    fireEvent.click(score)
    expect(onScore).toHaveBeenCalledOnce()
    expect(screen.getByRole('radio', { name: 'Вариант a' })).toBeChecked()
    expect(screen.getByText('Разбор a')).toBeInTheDocument()
    expect(screen.queryByText('Разбор b')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Вариант b' }))
    expect(screen.getByText('Разбор b')).toBeInTheDocument()
    expect(screen.queryByText('Разбор a')).not.toBeInTheDocument()
  })

  it('Enter на кнопке в trailing или detail не подтверждает выбор; на строке — подтверждает', () => {
    const onConfirm = vi.fn()
    render(
      <RadioTable
        label="Рейтинг"
        columns={COLUMNS}
        trailingColumn={TRAILING}
        value="a"
        onChange={vi.fn()}
        onConfirm={onConfirm}
        rows={rows({ a: { trailing: <button type="button">0,91</button>, detail: <button type="button">Уточнить</button> } })}
      />,
    )
    fireEvent.keyDown(screen.getByRole('button', { name: '0,91' }), { key: 'Enter' })
    fireEvent.keyDown(screen.getByRole('button', { name: 'Уточнить' }), { key: 'Enter' })
    expect(onConfirm).not.toHaveBeenCalled()
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Вариант a' }), { key: 'Enter' })
    expect(onConfirm).toHaveBeenCalledWith('a')
  })

  it('expanded раскрывает строку независимо от выбора; тон danger красит числа', () => {
    render(<RadioTable label="Рейтинг" columns={COLUMNS} value={null} onChange={vi.fn()} rows={rows({ c: { tone: 'danger', expanded: true, detail: <p>Вне рейтинга</p> } })} />)
    expect(screen.getByText('Вне рейтинга')).toBeInTheDocument()
    expect(screen.getAllByText('6,1')[2]).toHaveClass('text-danger')
    expect(screen.getAllByText('6,1')[0]).toHaveClass('text-text')
  })

  it('selection="multiple": строки — флажки, отмечаются несколько', () => {
    function Demo() {
      const [values, setValues] = useState<readonly Loc[]>(['a'])
      return <RadioTable selection="multiple" label="Сравнить" columns={COLUMNS} values={values} onValuesChange={setValues} rows={rows({ c: { disabled: true } })} />
    }
    render(<Demo />)
    expect(screen.getByRole('group', { name: 'Сравнить' })).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Вариант b' }))
    expect(screen.getByRole('checkbox', { name: 'Вариант a' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Вариант b' })).toBeChecked()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Вариант a' }))
    expect(screen.getByRole('checkbox', { name: 'Вариант a' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Вариант c' })).toBeDisabled()
  })

  it('без новых пропсов строка — прежняя кнопка с линией и подложкой', () => {
    render(<RadioTable label="Локации" columns={COLUMNS} value="a" onChange={vi.fn()} rows={rows()} />)
    const radio = screen.getByRole('radio', { name: 'Вариант a' })
    expect(radio).toHaveClass('border-b', 'p-12', 'data-[state=checked]:bg-surface-sunken')
    expect(radio.parentElement).toHaveAttribute('role', 'radiogroup')
  })
})

describe('RadioTable — только просмотр (readOnly)', () => {
  const renderReadOnly = (onChange = vi.fn(), onScore = vi.fn()) => {
    render(
      <RadioTable
        readOnly
        label="Рейтинг"
        columns={COLUMNS}
        trailingColumn={TRAILING}
        value="a"
        onChange={onChange}
        rows={rows({ a: { trailing: <button type="button" onClick={onScore}>0,91</button>, detail: <button type="button">Разбор балла</button> } })}
      />,
    )
    return { onChange, onScore }
  }

  it('группа — aria-readonly, строки не выключены', () => {
    renderReadOnly()
    expect(screen.getByRole('radiogroup', { name: 'Рейтинг' })).toHaveAttribute('aria-readonly', 'true')
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeEnabled()
  })

  it('щелчок и стрелки выбор не меняют', () => {
    const { onChange } = renderReadOnly()
    fireEvent.click(screen.getByRole('radio', { name: 'Вариант b' }))
    const first = screen.getByRole('radio', { name: 'Вариант a' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    expect(onChange).not.toHaveBeenCalled()
    expect(first).toBeChecked()
  })

  it('кнопки в trailing и detail доступны', () => {
    const { onScore } = renderReadOnly()
    fireEvent.click(screen.getByRole('button', { name: '0,91' }))
    expect(onScore).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Разбор балла' })).toBeEnabled()
  })

  it('без readOnly aria-readonly нет', () => {
    render(<RadioTable label="Локации" columns={COLUMNS} value="a" onChange={vi.fn()} rows={rows()} />)
    expect(screen.getByRole('radiogroup')).not.toHaveAttribute('aria-readonly')
  })
})
