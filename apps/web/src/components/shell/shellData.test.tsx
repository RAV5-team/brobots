import { render, renderHook, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ServicesProvider } from '@/services/ServicesProvider'
import { createMockServices } from '@/services/mock'
import { useServices } from '@/services/useServices'
import { useRole } from '@/shared/auth/useRole'
import { DemoBanner } from './DemoBanner'
import { useShellData } from './useShellData'

describe('useShellData', () => {
  it('derives counters from the services and loads the profile of the role', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const wrapper = ({ children }: { children: ReactNode }) => <ServicesProvider services={services}>{children}</ServicesProvider>
    const { result } = renderHook(() => useShellData('admin'), { wrapper })
    await waitFor(() => { expect(result.current.profile?.name).toBe('А. Соколова') })
    expect(result.current.counts).toEqual({ projects: 5, processes: 12, locations: 4, catalog: 20 })
  })

  it('keeps the menu working when data fails to load', async () => {
    const services = createMockServices({ latencyMs: 0 })
    const failing = { ...services, projects: { ...services.projects, listProjects: () => Promise.reject(new Error('down')) } }
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const wrapper = ({ children }: { children: ReactNode }) => <ServicesProvider services={failing}>{children}</ServicesProvider>
    const { result } = renderHook(() => useShellData('user'), { wrapper })
    await waitFor(() => { expect(error).toHaveBeenCalled() })
    expect(result.current.counts).toEqual({})
    error.mockRestore()
  })
})

describe('context hooks outside providers', () => {
  it('fail loudly instead of returning undefined', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => renderHook(() => useServices())).toThrow('useServices вызван вне ServicesProvider')
    expect(() => renderHook(() => useRole())).toThrow('useRole вызван вне RoleProvider')
    error.mockRestore()
  })
})

describe('DemoBanner', () => {
  it('announces the demo mode', () => {
    render(<DemoBanner />)
    expect(screen.getByRole('status')).toHaveTextContent('Демо-режим · изменения не сохраняются')
  })
})
