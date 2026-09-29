import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { CompareEntry } from '@/domain'
import { ValidationError } from '@/services/errors'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { CompareProvider } from './CompareProvider'
import { useCompare } from './useCompare'

const ENTRY: CompareEntry = { kind: 'robot', id: 'RB-0001' }

function Probe() {
  const { error, toggle } = useCompare()
  return (
    <>
      <button type="button" onClick={() => { toggle(ENTRY) }}>toggle</button>
      <p role="alert">{error}</p>
    </>
  )
}

function renderWithAdd(add: () => Promise<readonly CompareEntry[]>) {
  const services = createMockServices({ latencyMs: 0 })
  render(
    <MemoryRouter>
      <ServicesProvider services={{ ...services, compare: { ...services.compare, add } }}>
        <RoleProvider>
          <CompareProvider><Probe /></CompareProvider>
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'toggle' }))
}

describe('CompareProvider — текст ошибки из словаря', () => {
  it('набор полон: текст по причине и лимиту, а не message сервиса', async () => {
    renderWithAdd(() => Promise.reject(new ValidationError({ kind: 'compareLimit', limit: 4 }, 'service text')))
    expect(await screen.findByText('В сравнении уже 4 позиции — уберите одну, чтобы добавить другую')).toBeInTheDocument()
  })

  it('сетевая ошибка: общий текст вместо «Failed to fetch»', async () => {
    renderWithAdd(() => Promise.reject(new TypeError('Failed to fetch')))
    expect(await screen.findByText('Не удалось изменить набор сравнения. Попробуйте ещё раз')).toBeInTheDocument()
    expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument()
  })
})
