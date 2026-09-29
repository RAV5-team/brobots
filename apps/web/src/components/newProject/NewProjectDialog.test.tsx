import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '@/components/shell/AppShell'
import type { Services } from '@/services'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'

function WhereAmI() {
  const { pathname, search } = useLocation()
  return <p data-testid="location">{pathname + search}</p>
}

const renderAt = (url: string, services: Services = createMockServices({ latencyMs: 0 })) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <ServicesProvider services={services}>
        <RoleProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="*" element={<WhereAmI />} />
            </Route>
          </Routes>
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )

const dialog = () => screen.findByRole('dialog', { name: 'Выберите локацию нового проекта' })
const radios = async () => within(await dialog()).findAllByRole('radio')
const radio = async (index: number) => {
  const found = (await radios())[index]
  if (!found) throw new Error(`Нет строки ${String(index)}`)
  return found
}
const continueButton = () => screen.getByRole('button', { name: 'Продолжить' })
const location = () => screen.getByTestId('location').textContent

afterEach(() => { vi.restoreAllMocks() })

describe('NewProjectDialog (A2)', () => {
  it('opens over the current page from the sidebar button, keeping its parameters', async () => {
    renderAt('/?as=user')
    fireEvent.click(screen.getByRole('link', { name: /Новый проект/ }))
    expect(await dialog()).toBeInTheDocument()
    expect(location()).toBe('/?as=user&new=1')
  })

  it('lists the user locations with area, staff and the same manual labour as the dashboard', async () => {
    renderAt('/projects?new=1')
    const rows = await radios()
    expect(rows.map((r) => r.getAttribute('aria-label')?.replace(/[\s\u2060]+/g, ' '))).toEqual([
      'РЦ Химки, склад · данные от 14.09.2026; площадь 20 000 м², персонал 180 чел, ручной труд 231 млн ₽/год',
      'Даркстор Юг, склад · данные от 09.09.2026; площадь 10 500 м², персонал 62 чел, ручной труд 84 млн ₽/год',
      'Терминал Внуково-2, аэропорт · данные от 11.09.2026; площадь 85 000 м², персонал 500 чел, ручной труд 183 млн ₽/год',
      'ГКБ №17, медучреждение · данные от 12.09.2026; площадь 45 000 м², персонал 111 чел, ручной труд 93 млн ₽/год',
    ])
  })

  it('keeps «Продолжить» disabled until a location is chosen, arrows move the choice', async () => {
    renderAt('/projects?new=1')
    const first = await radio(0)
    expect(continueButton()).toBeDisabled()
    fireEvent.click(first)
    expect(first).toHaveAttribute('aria-checked', 'true')
    expect(continueButton()).toBeEnabled()
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    await waitFor(async () => { expect(await radio(1)).toHaveAttribute('aria-checked', 'true') })
  })

  it('creates a draft «Новый проект · <локация>» on Enter and goes to step 1', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const create = vi.spyOn(services.projects, 'createDraft')
    renderAt('/catalog/RB-0008?new=1&solution=RB-0008', services)
    const darkstore = await radio(1)
    fireEvent.click(darkstore)
    fireEvent.keyDown(darkstore, { key: 'Enter' })
    await waitFor(() => { expect(location()).toMatch(/^\/projects\/PJ-\d+\/params$/) })
    expect(create).toHaveBeenCalledWith({ name: 'Новый проект · Даркстор Юг', locationId: 'LOC-02', solutionId: 'RB-0008' })
    const draft = await (create.mock.results[0]?.value as ReturnType<typeof services.projects.createDraft> | undefined)
    expect(location()).toBe(`/projects/${draft?.id ?? ''}/params`)
    expect(draft).toMatchObject({ status: 'draft', step: 'params', pinnedSolutionId: 'RB-0008' })
  })

  it('preselects the location and passes the process when opened from a process card', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const create = vi.spyOn(services.projects, 'createDraft')
    renderAt('/processes/PR-0001?new=1&locationId=LOC-02&locationProcessId=LP-06', services)
    const rows = await radios()
    expect(rows[1]).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(continueButton())
    await waitFor(() => { expect(create).toHaveBeenCalledWith({ name: 'Новый проект · Даркстор Юг', locationId: 'LOC-02', locationProcessId: 'LP-06' }) })
  })

  it('closes with Esc, «×» and «Отменить», leaving the page parameters', async () => {
    renderAt('/catalog?q=amr&new=1&solution=RB-0008')
    await dialog()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await waitFor(() => { expect(screen.queryByRole('dialog')).not.toBeInTheDocument() })
    expect(location()).toBe('/catalog?q=amr')
  })

  it('returns focus to the button that opened it', async () => {
    renderAt('/?as=user')
    const opener = screen.getByRole('link', { name: /Новый проект/ })
    opener.focus()
    fireEvent.click(opener)
    await dialog()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await waitFor(() => { expect(screen.getByRole('link', { name: /Новый проект/ })).toHaveFocus() })
  })

  it('closes with «Отменить»', async () => {
    renderAt('/projects?new=1')
    await dialog()
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }))
    await waitFor(() => { expect(screen.queryByRole('dialog')).not.toBeInTheDocument() })
    expect(location()).toBe('/projects')
  })

  it('offers to create a location when the user has none', async () => {
    const services = createMockServices({ latencyMs: 0 })
    vi.spyOn(services.locations, 'listLocations').mockResolvedValue([])
    vi.spyOn(services.locations, 'listLocationSummaries').mockResolvedValue([])
    renderAt('/projects?new=1', services)
    const window = within(await dialog())
    expect(await window.findByRole('heading', { name: 'Локаций пока нет' })).toBeInTheDocument()
    expect(window.getByRole('link', { name: 'Создать локацию' })).toHaveAttribute('href', '/locations/new')
    expect(window.queryByRole('button', { name: 'Продолжить' })).not.toBeInTheDocument()
  })

  it('shows a retryable error when locations fail to load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const services = createMockServices({ latencyMs: 0 })
    vi.spyOn(services.locations, 'listLocations').mockRejectedValueOnce(new Error('offline'))
    renderAt('/projects?new=1', services)
    fireEvent.click(await within(await dialog()).findByRole('button', { name: /Повторить/ }))
    expect(await radios()).toHaveLength(4)
  })

  it('never opens for a guest', async () => {
    renderAt('/catalog?as=guest&new=1')
    expect(await screen.findByRole('link', { name: /Открыть демо-проект/ })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
