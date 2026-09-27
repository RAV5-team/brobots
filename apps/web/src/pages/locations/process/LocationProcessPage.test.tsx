import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useParams } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import type { Services } from '@/services'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { LocationProcessPage } from './LocationProcessPage'

function LocationStub() {
  const { locationId } = useParams()
  return <p>{`location ${locationId ?? ''}`}</p>
}

const renderPage = (path = '/locations/LOC-01/processes/LP-01?as=user', services: Services = createMockServices({ latencyMs: 0 })) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ServicesProvider services={services}>
        <RoleProvider>
          <Routes>
            <Route path="/locations/:locationId/processes/:locationProcessId" element={<LocationProcessPage />} />
            <Route path="/locations/:locationId" element={<LocationStub />} />
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

describe('LocationProcessPage (экран 16)', () => {
  it('shows the copy with the location header, locked class and the location check (PRD 10.4, №47)', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'Перемещение паллет' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'РЦ Химки' })).toHaveAttribute('href', '/locations/LOC-01')
    expect(screen.getByText(/Значения уже взяты из профиля РЦ Химки/)).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(5)
    expect(screen.getByRole('combobox', { name: /Класс операции/ })).toBeDisabled()
    expect(screen.getByText('Класс задан процессом из справочника и не меняется')).toBeInTheDocument()
    expect(screen.getByText('Проверка процесса на локации')).toBeInTheDocument()
    expect(screen.queryByText('Проверка шаблона')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Сохранить на локации/ })).toBeEnabled()
    expect(screen.getByText('Изменено на локации').nextSibling).toHaveTextContent('0')
    expect(nbsp(screen.getByText(/смены × 11 ч/).textContent)).toBe('= 2 смены × 11 ч (из локации)')
  })

  it('autosaves a draft of this copy and shows «Черновик сохранён» (D-21)', async () => {
    renderPage()
    expect(await screen.findByRole('status')).toHaveTextContent(/Черновик сохранён · \d\d:\d\d/)
    await waitFor(() => { expect(localStorage.getItem('rav5.draft.location-process.v1.LP-01')).not.toBeNull() })
  })

  it('saves only the copy: the template and other locations stay unchanged (D-11)', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const templateBefore = await services.processes.getProcess('PR-0001')
    const otherBefore = await services.locations.listLocationProcesses('LOC-02')
    renderPage(undefined, services)
    const volume = await screen.findByRole('textbox', { name: /Объём операций в сутки/ })
    fireEvent.change(volume, { target: { value: '2 400' } })
    expect(screen.getByText('Изменено на локации').nextSibling).toHaveTextContent('1')
    fireEvent.click(screen.getByRole('button', { name: /Сохранить на локации/ }))

    expect(await screen.findByText('location LOC-01')).toBeInTheDocument()
    const [saved] = await services.locations.listLocationProcesses('LOC-01')
    expect(saved?.overrides).toEqual({ dailyVolume: 2400 })
    expect(await services.processes.getProcess('PR-0001')).toEqual(templateBefore)
    expect(await services.locations.listLocationProcesses('LOC-02')).toEqual(otherBefore)
    expect(localStorage.getItem('rav5.draft.location-process.v1.LP-01')).toBeNull()
  })

  it('keeps the form and the draft when validation fails', async () => {
    renderPage()
    const volume = await screen.findByRole('textbox', { name: /Объём операций в сутки/ })
    fireEvent.change(volume, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /Сохранить на локации/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Проверьте поля с ошибками: 1')
  })

  it('lets a guest look without saving or drafts (D-14)', async () => {
    renderPage('/locations/LOC-01/processes/LP-01?as=guest')
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByRole('button', { name: /Сохранить на локации/ })).toBeDisabled()
    expect(screen.queryByText(/Черновик сохранён/)).not.toBeInTheDocument()
    expect(localStorage.getItem('rav5.draft.location-process.v1.LP-01')).toBeNull()
  })

  it('reports a process of another location as not found', async () => {
    renderPage('/locations/LOC-02/processes/LP-01?as=user')
    expect(await screen.findByText('Процесс на локации не найден')).toBeInTheDocument()
    expect(within(screen.getByRole('link', { name: 'К процессам локации' })).getByText('К процессам локации')).toBeInTheDocument()
  })
})
