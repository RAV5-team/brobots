import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ButtonLink } from './Button'
import { StatusBanner } from './StatusBanner'

describe('StatusBanner', () => {
  it('announces the result as a status with its title', () => {
    render(<StatusBanner variant="inverse" title="Каталог обновлён" />)
    expect(screen.getByRole('status')).toHaveTextContent('Каталог обновлён')
  })

  it('renders the action next to the title', () => {
    render(
      <MemoryRouter>
        <StatusBanner variant="inverse" title="Каталог обновлён" action={<ButtonLink variant="accent" to="/catalog">Открыть в каталоге</ButtonLink>} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Открыть в каталоге' })).toHaveAttribute('href', '/catalog')
  })
})
