import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useParams } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Services } from '@/services'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { ProcessNewPage } from './ProcessNewPage'

function CreatedProcess() {
  const { processId } = useParams()
  return <p>{`created ${processId ?? ''}`}</p>
}

const renderPage = (search = '', services: Services = createMockServices({ latencyMs: 0 })) =>
  render(
    <MemoryRouter initialEntries={[`/processes/new${search}`]}>
      <ServicesProvider services={services}>
        <RoleProvider>
          <Routes>
            <Route path="/processes/new" element={<ProcessNewPage />} />
            <Route path="/processes/:processId" element={<CreatedProcess />} />
          </Routes>
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )

const nbsp = (text: string | null) => (text ?? '').replace(/\u00a0/g, ' ')

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('ProcessNewPage (экран 09а)', () => {
  it('renders five sections, the section nav and the template check (PRD 9.2)', async () => {
    renderPage('?as=user')
    expect(await screen.findByRole('heading', { level: 1, name: 'Новый процесс' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Разделы формы' })
    expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual(['Процесс', 'Объём', 'Маршрут', 'Исполнители', 'Затраты'])
    expect(within(nav).getByRole('link', { current: 'location' })).toHaveTextContent('Процесс')
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      '1. Процесс и груз', '2. Объём и пик', '3. Маршрут и среда', '4. Исполнители и замещение труда', '5. Эксплуатация и объектные затраты',
    ])
    expect(screen.getByText('Обязательных полей').nextSibling).toHaveTextContent('12')
    expect(screen.getByRole('link', { name: 'Процессы' })).toHaveAttribute('href', '/processes')
  })

  it('recalculates peak intensity when the daily volume changes', async () => {
    renderPage('?as=user')
    const volume = await screen.findByRole('textbox', { name: /Объём операций в сутки/ })
    fireEvent.change(volume, { target: { value: '4 000' } })
    expect(screen.getByText((_, el) => el?.tagName === 'DD' && nbsp(el.textContent) === '273 оп./ч')).toBeInTheDocument()
  })

  it('shows the autosave pill and stores the draft for users', async () => {
    renderPage('?as=user')
    expect(await screen.findByText(/^Черновик сохранён · \d\d:\d\d$/)).toBeInTheDocument()
    await waitFor(() => { expect(localStorage.getItem('rav5.draft.process-new.v1')).not.toBeNull() })
  })

  it('lets a guest look but not save (D-31)', async () => {
    renderPage('?as=guest')
    expect(await screen.findByText('Демо-режим · изменения не сохраняются')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Сохранить процесс' })).toBeDisabled()
    expect(localStorage.getItem('rav5.draft.process-new.v1')).toBeNull()
  })

  it('marks invalid fields and does not save', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const create = vi.spyOn(services.processes, 'createProcess')
    renderPage('?as=user', services)
    fireEvent.change(await screen.findByRole('textbox', { name: /Название процесса/ }), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить процесс' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Проверьте поля с ошибками: 1')
    expect(screen.getByRole('textbox', { name: /Название процесса/ })).toHaveAttribute('aria-invalid', 'true')
    expect(create).not.toHaveBeenCalled()
  })

  it('fills the form from an edited process template', async () => {
    renderPage('?as=user')
    expect(await screen.findByRole('heading', { level: 1, name: 'Новый процесс' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Скачать шаблон' })).toBeEnabled()
    const csv = [
      'Код параметра;Группа;Параметр;Ед. изм.;Значение',
      'proc_name;Процесс;Название;;Ночная отгрузка',
      'dailyVolume;Объём;Объём;;4 000',
    ].join('\n')
    const file = new File([csv], 'шаблон-процесса.csv', { type: 'text/csv' })
    fireEvent.change(screen.getByLabelText('Файл шаблона процесса'), { target: { files: [file] } })
    expect(await screen.findByRole('textbox', { name: /Название процесса/ })).toHaveValue('Ночная отгрузка')
    expect(screen.getByRole('textbox', { name: /Объём операций в сутки/ })).toHaveValue('4 000')
    expect(screen.getByText('В форму перенесено значений: 2')).toBeInTheDocument()
  })

  it('saves the process, clears the draft and opens its card', async () => {
    renderPage('?as=user')
    fireEvent.click(await screen.findByRole('button', { name: 'Сохранить процесс' }))
    expect(await screen.findByText('created PR-0013')).toBeInTheDocument()
    expect(localStorage.getItem('rav5.draft.process-new.v1')).toBeNull()
  })

  it('shows a retryable error when reference data fails to load', async () => {
    const services = createMockServices({ latencyMs: 0 })
    vi.spyOn(services.catalog, 'listOperationClasses').mockRejectedValueOnce(new Error('down'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderPage('?as=user', services)
    expect(await screen.findByText('Не удалось открыть форму')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Новый процесс' })).toBeInTheDocument()
  })
})
