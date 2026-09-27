import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { Services } from '@/services'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { ProcessesPage } from './ProcessesPage'

const renderPage = (search = '', services: Services = createMockServices({ latencyMs: 0 })) =>
  render(
    <MemoryRouter initialEntries={[`/processes${search}`]}>
      <ServicesProvider services={services}>
        <RoleProvider>
          <ProcessesPage />
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )

const cards = async () => within(await screen.findByRole('list', { name: 'Библиотека процессов' })).getAllByRole('article')

describe('ProcessesPage (экран 07)', () => {
  it('shows one card per process of the library (PRD 9.1)', async () => {
    renderPage()
    expect(await cards()).toHaveLength(12)
  })

  it('shows the class chip, robot count and a link to the process card', async () => {
    renderPage()
    const card = within(await screen.findByRole('article', { name: 'Перемещение паллет' }))
    expect(card.getByText('OP-01 · Перемещение грузов')).toBeInTheDocument()
    expect(card.getByText(/^\d+\s(робот|робота|роботов)$|по этому классу роботов/)).toBeInTheDocument()
    expect(card.getByRole('link', { name: 'Подробнее о процессе «Перемещение паллет»' })).toHaveAttribute('href', '/processes/PR-0001')
  })

  it('filters cards by the search query', async () => {
    renderPage()
    await cards()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Найти процесс' }), { target: { value: 'багаж' } })
    expect((await cards()).map((c) => c.getAttribute('aria-labelledby'))).toEqual(['process-PR-0008'])
  })

  it('offers to reset filters when nothing matches', async () => {
    renderPage()
    await cards()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Найти процесс' }), { target: { value: 'нет такого' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }))
    expect(await cards()).toHaveLength(12)
  })

  it('links «Создать новый процесс» to the form 09а for a user', async () => {
    renderPage('?as=user')
    expect(await screen.findByRole('link', { name: 'Создать новый процесс' })).toHaveAttribute('href', '/processes/new')
  })

  it('hides process creation from a guest (D-30)', async () => {
    renderPage('?as=guest')
    await cards()
    expect(screen.queryByRole('link', { name: 'Создать новый процесс' })).not.toBeInTheDocument()
  })

  it('shows an error with retry when the service fails (D-07)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const services = createMockServices({ latencyMs: 0 })
    const failing: Services = { ...services, processes: { ...services.processes, listProcesses: () => Promise.reject(new Error('down')) } }
    renderPage('', failing)
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить процессы')
  })
})
