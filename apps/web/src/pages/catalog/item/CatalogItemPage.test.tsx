import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { CompareProvider } from '@/shared/compare/CompareProvider'
import { CatalogItemPage } from './CatalogItemPage'

const renderItem = (id: string) =>
  render(
    <MemoryRouter initialEntries={[`/catalog/${id}`]}>
      <ServicesProvider services={createMockServices({ latencyMs: 0 })}>
        <RoleProvider>
          <CompareProvider>
            <Routes><Route path="/catalog/:itemId" element={<CatalogItemPage />} /></Routes>
          </CompareProvider>
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )

const section = (name: string) => within(screen.getByRole('region', { name }))

afterEach(() => { sessionStorage.clear() })

describe('CatalogItemPage (экран К-4)', () => {
  it('shows AMR 800 with the facts of К-4: price, TRL and 7 of 8 key specs (PRD 7.7)', async () => {
    renderItem('RB-0008')
    expect(await screen.findByRole('heading', { level: 1, name: 'AMR 800' })).toBeInTheDocument()
    expect(screen.getByText('ООО «Морос» · Москва')).toBeInTheDocument()
    expect(screen.getByText('7 из 8')).toBeInTheDocument()
    expect(screen.getByText('УГТ 9')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Фото: AMR 800' })).toHaveAttribute('src', '/catalog/rb-0008.webp')
  })

  it('counts completeness and confirmedness instead of storing them (D-77)', async () => {
    renderItem('RB-0008')
    await screen.findByRole('heading', { level: 1, name: 'AMR 800' })
    const quality = section('Качество данных')
    expect(quality.getByText('27 из 30 полей')).toBeInTheDocument()
    expect(quality.getByText('17 подтверждено · 10 оценка · 3 нет данных')).toBeInTheDocument()
    expect(section('Идентификация').getByText('RB-0008')).toBeInTheDocument()
  })

  it('lists the launch part: 4 required from 3,9 million, 4 conditional, arrows to item pages (D-78, D-79)', async () => {
    renderItem('RB-0008')
    await screen.findByRole('heading', { level: 1, name: 'AMR 800' })
    expect(screen.getByText(/от 3,9 млн ₽ на проект/)).toBeInTheDocument()
    expect(section('Обязательно').getAllByRole('link')).toHaveLength(4)
    expect(section('В зависимости от объекта').getAllByRole('link')).toHaveLength(4)
    expect(screen.getByRole('link', { name: 'Открыть позицию: Коннектор WMS' })).toHaveAttribute('href', '/catalog/SI-SW-02')
    expect(screen.getByRole('link', { name: 'Посмотреть все совместимые компоненты' })).toHaveAttribute('href', '/catalog?tab=infrastructure&compat=RB-0008')
    expect(screen.getByRole('link', { name: /Сайт производителя: морос\.рф\/amr-800/ })).toHaveAttribute('href', 'https://морос.рф/amr-800')
  })

  it('shows AK-2000-2 with many «нет данных» and no vendor site button (D-76, D-79)', async () => {
    renderItem('RB-0014')
    expect(await screen.findByRole('heading', { level: 1, name: 'AK-2000-2' })).toBeInTheDocument()
    expect(screen.getByText('0 из 8')).toBeInTheDocument()
    expect(section('Инфраструктура').getAllByText('нет данных').length).toBeGreaterThan(5)
    expect(screen.queryByRole('link', { name: /Сайт производителя/ })).toBeNull()
    expect(screen.queryByRole('region', { name: 'В зависимости от объекта' })).toBeNull()
  })

  it('shows the charging station CS-400 as a launch item: type label, compatibility, no robot blocks (D-79)', async () => {
    renderItem('SI-INF-01')
    expect(await screen.findByRole('heading', { level: 1, name: 'Зарядная станция CS-400' })).toBeInTheDocument()
    expect(screen.getByText('INF')).toBeInTheDocument()
    expect(screen.getByText('5 из 5')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Робот-штабелёр RoboCV' })).toHaveAttribute('href', '/catalog/RB-0015')
    expect(screen.queryByRole('link', { name: /Проверить на своём объекте/ })).toBeNull()
    expect(screen.queryByText('Требования к объекту')).toBeNull()
  })

  it('adds the solution to the comparison and switches the button like К-1 (D-67)', async () => {
    renderItem('RB-0008')
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить в сравнение' }))
    await waitFor(() => { expect(screen.getByRole('button', { name: 'В сравнении' })).toHaveAttribute('aria-pressed', 'true') })
  })

  it('says the position is not found for an unknown id', async () => {
    renderItem('RB-9999')
    expect(await screen.findByText('Позиция не найдена')).toBeInTheDocument()
  })
})
