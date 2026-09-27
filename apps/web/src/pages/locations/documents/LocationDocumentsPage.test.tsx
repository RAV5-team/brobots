import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Services } from '@/services'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { LocationDocumentsPage } from './LocationDocumentsPage'

const renderPage = (path = '/locations/LOC-01/documents', services: Services = createMockServices({ latencyMs: 0 })) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ServicesProvider services={services}>
        <RoleProvider>
          <Routes>
            <Route path="/locations/:locationId/documents" element={<LocationDocumentsPage />} />
          </Routes>
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )

const list = () => within(screen.getByRole('list', { name: 'Документы обследования' }))
const fileInput = () => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error('нет поля выбора файлов')
  return input
}
const pickFiles = (...names: string[]) => {
  fireEvent.change(fileInput(), { target: { files: names.map((n) => new File(['x'], n)) } })
}

afterEach(() => { sessionStorage.clear() })

describe('LocationDocumentsPage (экран 17б)', () => {
  it('shows the header, the active tab and the four survey documents (PRD 10.3)', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'РЦ Химки' })).toBeInTheDocument()
    const tabs = within(screen.getByRole('navigation', { name: 'Разделы локации' }))
    expect(tabs.getByRole('link', { name: 'Документы' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { name: 'Документы · 4' })).toBeInTheDocument()
    expect(list().getAllByRole('listitem')).toHaveLength(4)
    expect(list().getByText('DWG')).toBeInTheDocument()
    expect(list().getByText('фото · 10 файлов · загружено 10.09.2026')).toBeInTheDocument()
  })

  it('keeps the open button of demo documents disabled with an explanation (D-42)', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Документы · 4' })
    expect(list().getByRole('button', { name: 'Файл «План склада, этаж 1.dwg» к демо-данным не приложен' })).toBeDisabled()
  })

  it('uploads a CAD plan and a photo group, then lists them without a skeleton', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Документы · 4' })
    expect(fileInput()).toHaveAttribute('accept', expect.stringContaining('.dwg'))
    pickFiles('План, этаж 2.dwg', 'Стеллажи 1.jpg', 'Стеллажи 2.jpg')

    expect(await screen.findByRole('heading', { name: 'Документы · 6' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('2 документа добавлено')
    expect(list().getByText('План, этаж 2.dwg')).toBeInTheDocument()
    expect(list().getByText(/^фото · 2 файла · загружено/)).toBeInTheDocument()
  })

  it('rejects an unsupported format before uploading, with a way to fix it', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Документы · 4' })
    pickFiles('Модель.skp')
    expect(await screen.findByRole('alert')).toHaveTextContent('Модель.skp: Формат .skp не поддерживается. Загрузите PDF, Excel, CSV, DWG или изображение')
    expect(screen.getByRole('heading', { name: 'Документы · 4' })).toBeInTheDocument()
  })

  it('reports a failed upload and keeps the list', async () => {
    const services = createMockServices({ latencyMs: 0 })
    vi.spyOn(services.locations, 'addLocationDocument').mockRejectedValue(new Error('network'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    renderPage(undefined, services)
    await screen.findByRole('heading', { name: 'Документы · 4' })
    pickFiles('Отчёт.pdf')
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить документ')
    await waitFor(() => { expect(screen.getByRole('button', { name: /Добавить документ/ })).toBeEnabled() })
    expect(list().getAllByRole('listitem')).toHaveLength(4)
  })

  it('invites to attach documents when a location has none', async () => {
    renderPage('/locations/LOC-02/documents')
    expect(await screen.findByRole('heading', { name: 'Документов пока нет' })).toBeInTheDocument()
    expect(screen.getByText(/DWG или изображения, каждый файл до 20 МБ/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Добавить документ/ })).toHaveLength(1)
  })

  it('lets a guest only view: no upload (D-14)', async () => {
    renderPage('/locations/LOC-01/documents?as=guest')
    await screen.findByRole('heading', { name: 'Документы · 4' })
    expect(screen.queryByRole('button', { name: /Добавить документ/ })).not.toBeInTheDocument()
    expect(document.querySelector('input[type="file"]')).toBeNull()
  })

  it('shows «not found» for an unknown location', async () => {
    renderPage('/locations/LOC-99/documents')
    expect(await screen.findByRole('heading', { name: 'Локация не найдена' })).toBeInTheDocument()
  })
})
