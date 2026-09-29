import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Services } from '@/services'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { ProjectStepPage } from '../ProjectStepPage'
import { MatchingStep } from './MatchingStep'
import { matchingViewState } from './matchingView'

const renderAt = (path: string, services: Services = createMockServices({ latencyMs: 0 }), state: unknown = null) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: path.split('?')[0] ?? path, search: path.includes('?') ? `?${path.split('?')[1] ?? ''}` : '', state }]}>
      <ServicesProvider services={services}>
        <RoleProvider>
          <Routes>
            <Route path="/projects/:projectId/matching" element={<ProjectStepPage step="matching" Step={MatchingStep} />} />
            <Route path="*" element={<p>другая страница</p>} />
          </Routes>
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )

const ranking = () => screen.getByRole('radiogroup', { name: 'Рейтинг вариантов подбора' })
const row = (name: string) => within(ranking()).getByRole('radio', { name })

afterEach(() => { sessionStorage.clear() })

describe('Шаг 2 «Подбор решений» (2.1, 16325:101; PRD 11.3)', () => {
  it('условия, рейтинг 8 вариантов с разбором балла, 4 исключённых, рекомендация в правой колонке', async () => {
    renderAt('/projects/PJ-DEMO/matching?as=user')
    expect(await screen.findByRole('heading', { level: 1, name: 'Подбор решений' })).toBeInTheDocument()
    expect(await screen.findByText('Перемещение паллет · 130 паллет/ч к роботизации в пик · 8 вариантов в рейтинге')).toBeInTheDocument()
    expect(screen.getByText(/6 жёстких фильтров из параметров процесса и локации · 8 вариантов прошли · 4 решения исключены/)).toBeInTheDocument()
    expect(within(ranking()).getAllByRole('radio')).toHaveLength(8)
    expect(row('AMR 800 · RaaS')).toBeChecked()
    // Разбор балла раскрыт у выбранной строки: 8 полос, вклад — доля веса (D-88).
    const pill = screen.getByRole('button', { name: /0,91, из чего складывается балл AMR 800 · RaaS/ })
    expect(pill).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Из чего складывается балл 0,91 · шкала 0–1')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Окупаемость: вклад 0,30 из 0,30' })).toBeInTheDocument()
    const excluded = screen.getByRole('region', { name: 'Исключённые решения' })
    expect(within(excluded).getAllByRole('button', { name: /Добавить вручную/ })).toHaveLength(4)
    const recommendation = screen.getByRole('region', { name: 'AMR 800 · RaaS' })
    expect(recommendation).toHaveTextContent('Рекомендация системы · место 1')
    expect(recommendation).toHaveTextContent('0,83 млн ₽')
    expect(within(recommendation).getByRole('button', { name: 'Подробнее о решении' })).toBeInTheDocument()
  })

  it('пилюля балла раскрывает и сворачивает разбор под строкой', async () => {
    renderAt('/projects/PJ-DEMO/matching?as=user')
    const pill = await screen.findByRole('button', { name: /из чего складывается балл Ronavi H1500 · RaaS/ })
    expect(pill).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(pill)
    expect(pill).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Из чего складывается балл 0,78 · шкала 0–1')).toBeVisible()
  })

  it('выбор другого варианта радиокнопкой сохраняется в черновик (D-21)', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const update = vi.spyOn(services.projects, 'updateInputs')
    renderAt('/projects/PJ-DEMO/matching?as=user', services)
    await screen.findByRole('radiogroup', { name: 'Рейтинг вариантов подбора' })
    fireEvent.click(row('AMR 800 · Покупка'))
    expect(update).toHaveBeenCalledWith('PJ-DEMO', { matching: { selection: { solutionId: 'RB-0008', acquisition: 'purchase' } } })
    await waitFor(() => { expect(row('AMR 800 · Покупка')).toBeChecked() })
    // «Переход к симуляции» (PRD 11.3): что уйдёт в симуляцию.
    expect(screen.getByText(/^Выбрано: AMR 800 · Покупка · 18 роботов/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/Черновик сохранён/)
  })

  it('фильтр «RaaS» и сортировка по CAPEX', async () => {
    renderAt('/projects/PJ-DEMO/matching?as=user')
    await screen.findByRole('radiogroup', { name: 'Рейтинг вариантов подбора' })
    fireEvent.click(screen.getByRole('radio', { name: 'RaaS' }))
    expect(within(ranking()).getAllByRole('radio')).toHaveLength(4)
  })

  it('правка «Параметров расчёта» делает подбор устаревшим, пересчёт снимает пометку (D-89)', async () => {
    renderAt('/projects/PJ-DEMO/matching?as=user')
    fireEvent.click(await screen.findByRole('button', { name: /Изменить параметры расчёта/ }))
    const panel = await screen.findByRole('dialog', { name: 'Параметры расчёта' })
    fireEvent.change(within(panel).getByRole('textbox', { name: 'Коэффициент загрузки' }), { target: { value: '1,5' } })
    fireEvent.click(within(panel).getByRole('button', { name: 'Готово' }))
    expect(await within(panel).findByText('Введите число от 0,05 до 1')).toBeInTheDocument()
    fireEvent.change(within(panel).getByRole('textbox', { name: 'Коэффициент загрузки' }), { target: { value: '0,7' } })
    fireEvent.click(within(panel).getByRole('button', { name: 'Готово' }))
    expect(await screen.findByText('Параметры изменились — рейтинг посчитан по прежним значениям')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Перейти к симуляции' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Пересчитать' }))
    await waitFor(() => { expect(screen.queryByText('Параметры изменились — рейтинг посчитан по прежним значениям')).not.toBeInTheDocument() })
    expect(screen.getByRole('button', { name: 'Перейти к симуляции' })).toBeEnabled()
  })

  it('ручное добавление: строка вне рейтинга в конце, «Убрать», сравнение с ней', async () => {
    renderAt('/projects/PJ-DEMO/matching?as=user')
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить вручную: Ronavi SD' }))
    const manual = within(ranking()).getByRole('radio', { name: 'Ronavi SD' })
    expect(manual).toBeDisabled()
    expect(manual).toHaveTextContent(/вне рейтинга/)
    expect(manual).toHaveTextContent(/Критическое несоответствие: класс операции/)
    fireEvent.click(screen.getByRole('button', { name: 'Сравнить' }))
    const group = screen.getByRole('group', { name: 'Варианты для сравнения' })
    fireEvent.click(within(group).getByRole('checkbox', { name: 'AMR 800 · RaaS' }))
    fireEvent.click(within(group).getByRole('checkbox', { name: 'Ronavi SD' }))
    fireEvent.click(screen.getByRole('button', { name: 'Сравнить · 2' }))
    const dialog = await screen.findByRole('dialog', { name: 'Сравнение вариантов' })
    const compare = await within(dialog).findByRole('table', { name: 'Сравнение выбранных вариантов подбора' })
    expect(within(compare).getAllByText('не рассчитано').length).toBeGreaterThan(0)
    // «×» — назад к 2.1: режим «Сравнить» и отметки сохранены.
    fireEvent.click(within(dialog).getByRole('button', { name: /Закрыть/ }))
    await waitFor(() => { expect(screen.queryByRole('dialog')).not.toBeInTheDocument() })
    expect(within(screen.getByRole('group', { name: 'Варианты для сравнения' })).getByRole('checkbox', { name: 'AMR 800 · RaaS' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Сравнить · 2' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Убрать из рейтинга: Ronavi SD' }))
    expect(screen.queryByRole('checkbox', { name: 'Ronavi SD' })).not.toBeInTheDocument()
  })

  it('гость: выбор на странице без сохранения, демо-плашка вместо статуса (D-14)', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const update = vi.spyOn(services.projects, 'updateInputs')
    renderAt('/projects/PJ-DEMO/matching?as=guest', services)
    await screen.findByRole('radiogroup', { name: 'Рейтинг вариантов подбора' })
    fireEvent.click(row('Ronavi H1500 · RaaS'))
    expect(row('Ronavi H1500 · RaaS')).toBeChecked()
    expect(update).not.toHaveBeenCalled()
    expect(screen.queryByText(/Черновик сохранён/)).not.toBeInTheDocument()
  })

  it('сохранённая оценка — только просмотр (readOnly): выбор не меняется, разбор балла у всех строк, нет ручного добавления и параметров (D-17)', async () => {
    renderAt('/projects/PJ-01/matching?as=user')
    await screen.findByRole('radiogroup', { name: 'Рейтинг вариантов подбора' })
    expect(ranking()).toHaveAttribute('aria-readonly', 'true')
    const checked = within(ranking()).getAllByRole('radio').find((r) => r.getAttribute('aria-checked') === 'true')
    fireEvent.click(row('AMR 800 · Покупка'))
    expect(row('AMR 800 · Покупка')).not.toBeChecked()
    expect(checked).toBeChecked()
    expect(screen.queryByRole('button', { name: /Добавить вручную/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Изменить параметры расчёта/ })).not.toBeInTheDocument()
    // Разбор балла доступен у всех строк.
    const pill = screen.getByRole('button', { name: /из чего складывается балл AMR 800 · Покупка/ })
    expect(pill).toBeEnabled()
    fireEvent.click(pill)
    expect(pill).toHaveAttribute('aria-expanded', 'true')
  })

  it('«всё раскрыто» (17093:10): разбор балла у всех 8 строк, пилюли тёмные', async () => {
    renderAt('/projects/PJ-DEMO/matching?as=user', undefined, matchingViewState({ expandAll: true }))
    await screen.findByRole('radiogroup', { name: 'Рейтинг вариантов подбора' })
    expect(screen.getAllByRole('button', { expanded: true, name: /из чего складывается балл/ })).toHaveLength(8)
    expect(screen.getByText('Из чего складывается балл 0,26 · шкала 0–1')).toBeVisible()
  })

  it('режим «Сравнить» (16834:5): флажки вместо радио, отмечены два варианта, разбор свёрнут', async () => {
    renderAt('/projects/PJ-DEMO/matching?as=user', undefined, matchingViewState({ compare: ['RB-0008:raas', 'RB-0001:raas'] }))
    const group = await screen.findByRole('group', { name: 'Варианты для сравнения' })
    expect(within(group).getAllByRole('checkbox', { checked: true }).map((c) => c.getAttribute('aria-label'))).toEqual(['AMR 800 · RaaS', 'Ronavi H1500 · RaaS'])
    expect(screen.getByRole('button', { name: 'Сравнить · 2' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Отмена' })).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { expanded: true, name: /из чего складывается балл/ })).toHaveLength(0)
  })

  it('окно 2.1а: «Подробнее о решении» открывает «Обзор» рекомендации, «×» возвращает к 2.1', async () => {
    renderAt('/projects/PJ-DEMO/matching?as=user')
    fireEvent.click(await screen.findByRole('button', { name: 'Подробнее о решении' }))
    const dialog = await screen.findByRole('dialog', { name: 'AMR 800' })
    expect(within(dialog).getByText('Место 1 в рейтинге · балл 0,91')).toBeInTheDocument()
    expect(within(dialog).getByRole('tab', { name: 'Обзор', selected: true })).toBeInTheDocument()
    expect(await within(dialog).findByText('AMR 800 · базовая комплектация')).toBeInTheDocument()
    expect(within(dialog).getByRole('region', { name: 'Почему подходит' })).toHaveTextContent('Грузоподъёмность 800 кг')
    expect(within(dialog).getByRole('status')).toHaveTextContent('Выбран')
    fireEvent.click(within(dialog).getByRole('button', { name: /Закрыть/ }))
    await waitFor(() => { expect(screen.queryByRole('dialog')).not.toBeInTheDocument() })
  })

  it('окно 2.1а: «Покупка» — просмотр другого варианта, «Выбрать этот вариант» выбирает и закрывает окно', async () => {
    renderAt('/projects/PJ-DEMO/matching?as=user&details=RB-0008:raas')
    const dialog = await screen.findByRole('dialog', { name: 'AMR 800' })
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Покупка' }))
    expect(await within(dialog).findByText('Место 4 в рейтинге · балл 0,72')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Выбрать этот вариант' }))
    await waitFor(() => { expect(screen.queryByRole('dialog')).not.toBeInTheDocument() })
    expect(row('AMR 800 · Покупка')).toBeChecked()
  })

  it('окно 2.1а: «Добавить к сравнению» включает режим «Сравнить» с этим вариантом', async () => {
    renderAt('/projects/PJ-DEMO/matching?as=user&details=RB-0001:raas')
    const dialog = await screen.findByRole('dialog', { name: 'Ronavi H1500' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Добавить к сравнению' }))
    const group = await screen.findByRole('group', { name: 'Варианты для сравнения' })
    expect(within(group).getByRole('checkbox', { name: 'Ronavi H1500 · RaaS' })).toBeChecked()
  })

  it('окно 2.1а, вкладка «Экономика»: числа выбранной модели совпадают с рейтингом', async () => {
    renderAt('/projects/PJ-DEMO/matching?as=user&details=RB-0008:purchase')
    const dialog = await screen.findByRole('dialog', { name: 'AMR 800' })
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Экономика' }))
    const panel = within(dialog).getByRole('tabpanel')
    expect(within(panel).getByRole('region', { name: /CAPEX 47,4/ })).toBeInTheDocument()
    expect(within(panel).getByRole('region', { name: 'Как рассчитано' })).toHaveTextContent('= 2,8')
    expect(within(panel).queryByRole('region', { name: 'Условия RaaS' })).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('radio', { name: 'RaaS' }))
    expect(await within(dialog).findByRole('region', { name: 'Условия RaaS' })).toHaveTextContent('0,83')
  })

  it('окно 2.1а: «Технические», «Инфраструктура», «Качество данных» — строки характеристик К-4 со статусами', async () => {
    renderAt('/projects/PJ-DEMO/matching?as=user&details=RB-0008:raas')
    const dialog = await screen.findByRole('dialog', { name: 'AMR 800' })
    await within(dialog).findByRole('region', { name: 'Идентификация' })
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Технические' }))
    expect(within(dialog).getByRole('region', { name: 'Технические характеристики' })).toHaveTextContent('подтверждено')
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Инфраструктура' }))
    expect(within(dialog).getAllByText('требует проверки')).toHaveLength(2)
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Качество данных' }))
    expect(within(dialog).getByRole('region', { name: 'Качество данных' })).toHaveTextContent('требования площадки без проверки')
  })

  it('окно 2.1а в сохранённой оценке: выбрать нельзя (D-17)', async () => {
    renderAt('/projects/PJ-01/matching?as=user&details=RB-0001:raas')
    const dialog = await screen.findByRole('dialog', { name: 'Ronavi H1500' })
    expect(within(dialog).queryByRole('button', { name: 'Выбрать этот вариант' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Добавить к сравнению' })).toBeInTheDocument()
  })

  it('панели «Как рассчитано» (03a, удалена с 2.2) нет', async () => {
    renderAt('/projects/PJ-DEMO/matching?as=user')
    await screen.findByRole('radiogroup', { name: 'Рейтинг вариантов подбора' })
    expect(screen.queryByRole('button', { name: /Как рассчитан/ })).not.toBeInTheDocument()
  })
})
