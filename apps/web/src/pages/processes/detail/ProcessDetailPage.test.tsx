import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { Services } from '@/services'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { ProcessDetailPage } from './ProcessDetailPage'

const renderPage = (path = '/processes/PR-0001', services: Services = createMockServices({ latencyMs: 0 })) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ServicesProvider services={services}>
        <RoleProvider>
          <Routes>
            <Route path="/processes/:processId" element={<ProcessDetailPage />} />
          </Routes>
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )

const section = async (name: string) => within(await screen.findByRole('region', { name }))

describe('ProcessDetailPage (экран 11)', () => {
  it('shows the header with class, facility types and description (PRD 9.3)', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'Перемещение паллет' })).toBeInTheDocument()
    expect(screen.getByText('OP-01 Перемещение грузов · Склад')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Процессы' })).toHaveAttribute('href', '/processes')
    expect(screen.getByRole('button', { name: 'Изменить процесс' })).toBeDisabled()
  })

  it('lists what is automated and the typical route points', async () => {
    renderPage()
    const block = await section('Что автоматизируем')
    expect(block.getByText('Паллета на полу')).toBeInTheDocument()
    expect(block.getByText('OP-01 · Перемещение грузов')).toBeInTheDocument()
    expect(block.getAllByRole('listitem')).toHaveLength(2)
  })

  it('groups the data the process needs from a location', async () => {
    renderPage()
    const block = await section('Что нужно знать для подбора')
    expect(block.getByRole('heading', { name: 'Обязательно' })).toBeInTheDocument()
    expect(block.getByText('Люди на маршруте')).toBeInTheDocument()
  })

  it('counts robots with the class and shows six solution cards', async () => {
    renderPage()
    const block = await section('Роботы с классом OP-01')
    expect(block.getByText('16 роботов')).toBeInTheDocument()
    expect(within(block.getByRole('list', { name: 'Решения с классом процесса' })).getAllByRole('listitem')).toHaveLength(6)
  })

  it('shows locations using the process with a shortcut to a new project', async () => {
    renderPage()
    const block = await section('Процесс на локациях')
    expect(block.getByRole('heading', { name: 'РЦ Химки · Склад' })).toBeInTheDocument()
    expect(block.getByRole('link', { name: 'Создать проект: Даркстор Юг' })).toHaveAttribute(
      'href',
      '/processes/PR-0001?new=1&locationId=LOC-02&locationProcessId=LP-06',
    )
  })

  it('links the rail to the catalog filtered by class', async () => {
    renderPage()
    expect(await screen.findByRole('link', { name: 'Открыть каталог по процессу' })).toHaveAttribute('href', '/catalog?class=OP-01')
    expect(screen.getByRole('heading', { name: 'Как это работает' })).toBeInTheDocument()
  })

  it('shows empty blocks for a process without locations', async () => {
    renderPage('/processes/PR-0006')
    expect(await screen.findByText('Процесс ещё не добавлен ни на одну локацию')).toBeInTheDocument()
  })

  it('shows "not found" for an unknown process', async () => {
    renderPage('/processes/PR-9999')
    expect(await screen.findByRole('heading', { name: 'Процесс не найден' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'К списку процессов' })).toHaveAttribute('href', '/processes')
  })

  it('shows an error with retry when the service fails (D-07)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const services = createMockServices({ latencyMs: 0 })
    let calls = 0
    const flaky: Services = {
      ...services,
      catalog: {
        ...services.catalog,
        listRobots: (filter) => (calls++ === 0 ? Promise.reject(new Error('down')) : services.catalog.listRobots(filter)),
      },
    }
    renderPage('/processes/PR-0001', flaky)
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось открыть процесс')
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Перемещение паллет' })).toBeInTheDocument()
  })
})
