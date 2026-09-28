import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SimulationTrace } from '@/domain'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { Spike2dPage } from './Spike2dPage'

/** Маленькие трассы вместо файлов по 1,7 МБ: настоящие проверяет mocks/fixtures/traces.test.ts. */
const trace = (name: string): SimulationTrace => ({
  name, stepS: 15, robots: 1, chargers: 1, clockOffsetH: 7, states: ['idle', 'to_drop'],
  layout: { nodes: [{ id: 'J0', x: 0, y: 0, type: 'junction' }, { id: 'J1', x: 10, y: 20, type: 'junction' }], edges: [{ from: 'J0', to: 'J1', kind: 'main' }], chargerSlots: [[0, 0]], width: 10, depth: 20 },
  frames: Array.from({ length: 241 }, (_, i) => ({ t: i * 15, robots: [[0, i % 20, i % 2]] as const })),
})
const LOAD = { timeout: 5_000 }

function renderPage() {
  const services = createMockServices({ latencyMs: 0 })
  vi.spyOn(services.projects, 'getSimulationTraces').mockResolvedValue([trace('Из подбора: 18/6'), trace('Рекомендация: 16/5')])
  return render(<ServicesProvider services={services}><Spike2dPage /></ServicesProvider>)
}

describe('Spike2dPage — /dev/spike-2d', () => {
  it('два плеера записанных прогонов с общим временем', async () => {
    renderPage()
    expect(await screen.findByRole('img', { name: 'Из подбора: 18/6' }, LOAD)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Рекомендация: 16/5' })).toBeInTheDocument()
    expect(screen.getByText('07:00')).toBeInTheDocument()
  })

  it('перемотка меняет время обоих плееров; «Пуск» переключается на «Пауза»', async () => {
    renderPage()
    const slider = await screen.findByRole('slider', { name: 'Время дня' }, LOAD)
    fireEvent.keyDown(slider, { key: 'End' })
    expect(screen.getByText('08:00')).toBeInTheDocument()
    expect(slider).toHaveAttribute('aria-valuetext', '08:00')
    fireEvent.click(screen.getByRole('button', { name: 'Пуск' }))
    expect(screen.getByRole('button', { name: 'Пауза' })).toBeInTheDocument()
  })

  it('скорости ×120 · ×600 · ×1800', async () => {
    renderPage()
    await screen.findByRole('img', { name: 'Из подбора: 18/6' }, LOAD)
    expect(['×120', '×600', '×1800'].map((name) => screen.getByRole('radio', { name }).getAttribute('aria-checked'))).toEqual(['true', 'false', 'false'])
  })
})
