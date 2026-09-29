import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressPanel, type ProgressLogLine } from './ProgressPanel'

const LOG: readonly ProgressLogLine[] = [{ text: 'Источники опрошены', state: 'done' }]

describe('ProgressPanel', () => {
  it('renders a log without a label when logLabel is omitted', () => {
    render(<ProgressPanel title="Статус" label="Выполнение" value={50} log={LOG} />)

    expect(screen.getByText('Источники опрошены')).toBeInTheDocument()
    expect(screen.getByRole('list')).not.toHaveAttribute('aria-label')
  })

  it('uses logLabel as the log accessible name when provided', () => {
    render(<ProgressPanel title="Статус" label="Выполнение" value={50} log={LOG} logLabel="Журнал выполнения" />)

    expect(screen.getByRole('list', { name: 'Журнал выполнения' })).toBeInTheDocument()
  })
})
