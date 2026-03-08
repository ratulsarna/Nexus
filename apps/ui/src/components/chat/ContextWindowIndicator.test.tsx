// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ContextWindowIndicator } from './ContextWindowIndicator'

describe('ContextWindowIndicator', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows a readable context usage breakdown in the tooltip', async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <ContextWindowIndicator usedTokens={12_345} contextWindow={200_000} />
      </TooltipProvider>,
    )

    const trigger = screen.getByRole('button', {
      name: 'Context window 6% full, 12.3K of 200K tokens used',
    })

    fireEvent.mouseEnter(trigger)
    fireEvent.focus(trigger)

    const getTooltipContent = (): HTMLElement | null =>
      document.body.querySelector('[data-slot="tooltip-content"]') as HTMLElement | null

    await waitFor(() => {
      expect(getTooltipContent()).toBeTruthy()
    })

    const tooltipContent = getTooltipContent()
    if (tooltipContent === null) {
      throw new Error('Expected tooltip content to be rendered')
    }

    const tooltipText = tooltipContent.textContent ?? ''
    expect(tooltipText).toContain('Context window')
    expect(tooltipText).toContain('6% full')
    expect(tooltipText).toContain('Used')
    expect(tooltipText).toContain('12.3K tokens')
    expect(tooltipText).toContain('Capacity')
    expect(tooltipText).toContain('200K tokens')
  })
})
