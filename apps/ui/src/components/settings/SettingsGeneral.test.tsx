// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentDescriptor, ManagerModelCatalogResponse } from '@nexus/protocol'
import { SettingsGeneral } from './SettingsGeneral'
import * as settingsApi from './settings-api'
import type { ClaudeOutputStyleState } from './settings-types'
import type { UpdateManagerInput, UpdateManagerResult } from '@/lib/ws-client'

vi.mock('./settings-api', async () => {
  const actual = await vi.importActual<typeof import('./settings-api')>('./settings-api')
  return {
    ...actual,
    fetchClaudeOutputStyle: vi.fn(),
    updateClaudeOutputStyle: vi.fn(),
  }
})

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function createClaudeManager(agentId: string, displayName: string): AgentDescriptor {
  const now = '2026-01-01T00:00:00.000Z'
  return {
    agentId,
    managerId: agentId,
    displayName,
    role: 'manager',
    status: 'idle',
    createdAt: now,
    updatedAt: now,
    cwd: `/tmp/${agentId}`,
    model: {
      provider: 'claude-agent-sdk',
      modelId: 'claude-opus-4-6',
      thinkingLevel: 'medium',
    },
    sessionFile: `/tmp/${agentId}.jsonl`,
  }
}

function createManager(
  agentId: string,
  displayName: string,
  model: AgentDescriptor['model'],
  promptOverride?: string,
): AgentDescriptor {
  const now = '2026-01-01T00:00:00.000Z'
  return {
    agentId,
    managerId: agentId,
    displayName,
    role: 'manager',
    status: 'idle',
    createdAt: now,
    updatedAt: now,
    cwd: `/tmp/${agentId}`,
    model,
    promptOverride,
    sessionFile: `/tmp/${agentId}.jsonl`,
  }
}

function createUpdateManagerMock(
  implementation?: (input: UpdateManagerInput) => Promise<UpdateManagerResult>,
) {
  return vi.fn(
    implementation ??
      (async () => {
        throw new Error('Unexpected manager update call in test.')
      }),
  )
}

function createRuntimeCatalogResponse(): ManagerModelCatalogResponse {
  return {
    fetchedAt: '2026-01-01T00:00:00.000Z',
    providers: [
      {
        provider: 'openai-codex',
        providerLabel: 'OpenAI Codex',
        surfaces: ['create_manager', 'manager_settings'],
        models: [
          {
            modelId: 'gpt-5.3-codex',
            modelLabel: 'gpt-5.3-codex',
            allowedThinkingLevels: ['off', 'high'],
            defaultThinkingLevel: 'high',
          },
          {
            modelId: 'gpt-5.3-mini',
            modelLabel: 'gpt-5.3-mini',
            allowedThinkingLevels: ['off', 'low'],
            defaultThinkingLevel: 'low',
          },
        ],
      },
      {
        provider: 'anthropic',
        providerLabel: 'Anthropic',
        surfaces: ['manager_settings'],
        models: [
          {
            modelId: 'claude-opus-4-6',
            modelLabel: 'claude-opus-4-6',
            allowedThinkingLevels: ['off', 'medium', 'high'],
            defaultThinkingLevel: 'high',
          },
        ],
      },
      {
        provider: 'openai-codex-app-server',
        providerLabel: 'OpenAI Codex App Server',
        surfaces: ['create_manager'],
        models: [
          {
            modelId: 'default',
            modelLabel: 'default',
            allowedThinkingLevels: ['off', 'high'],
            defaultThinkingLevel: 'high',
          },
        ],
      },
    ],
  }
}

async function waitForRuntimeCatalogReady(): Promise<void> {
  await waitFor(() => {
    expect(screen.queryByText('Loading runtime model catalog...')).toBeNull()
  })
}

describe('SettingsGeneral', () => {
  const originalResizeObserver = globalThis.ResizeObserver
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
  const originalFetch = globalThis.fetch
  let mockRuntimeCatalogStatus = 200
  let mockRuntimeCatalogError = 'Runtime catalog unavailable.'
  let mockRuntimeCatalogResponse: ManagerModelCatalogResponse = createRuntimeCatalogResponse()

  beforeEach(() => {
    mockRuntimeCatalogStatus = 200
    mockRuntimeCatalogError = 'Runtime catalog unavailable.'
    mockRuntimeCatalogResponse = createRuntimeCatalogResponse()

    ;(globalThis as { fetch?: typeof fetch }).fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url

      if (url.includes('/api/models/manager-catalog')) {
        if (mockRuntimeCatalogStatus !== 200) {
          return new Response(
            JSON.stringify({ error: mockRuntimeCatalogError }),
            {
              status: mockRuntimeCatalogStatus,
              headers: { 'content-type': 'application/json' },
            },
          )
        }

        return new Response(
          JSON.stringify(mockRuntimeCatalogResponse),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        )
      }

      throw new Error(`Unexpected fetch request: ${url}`)
    }) as unknown as typeof fetch

    class MockResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    ;(globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver =
      MockResizeObserver as unknown as typeof ResizeObserver
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: () => {},
    })
  })

  afterEach(() => {
    cleanup()
    ;(globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver = originalResizeObserver
    ;(globalThis as { fetch?: typeof fetch }).fetch = originalFetch
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: originalScrollIntoView,
    })
    vi.resetAllMocks()
  })

  it('ignores stale style-load responses from a previously selected manager', async () => {
    const managerA = createClaudeManager('manager-a', 'Manager A')
    const managerB = createClaudeManager('manager-b', 'Manager B')

    const deferredA = createDeferred<ClaudeOutputStyleState>()
    const deferredB = createDeferred<ClaudeOutputStyleState>()

    vi.mocked(settingsApi.fetchClaudeOutputStyle).mockImplementation((_wsUrl, managerId) => {
      if (managerId === managerA.agentId) {
        return deferredA.promise
      }
      if (managerId === managerB.agentId) {
        return deferredB.promise
      }
      throw new Error(`Unexpected manager id: ${managerId}`)
    })

    const { rerender } = render(
      <SettingsGeneral
        wsUrl="ws://127.0.0.1:47187"
        managers={[managerA, managerB]}
        onUpdateManager={createUpdateManagerMock()}
      />,
    )

    await waitFor(() => {
      expect(vi.mocked(settingsApi.fetchClaudeOutputStyle)).toHaveBeenCalledWith(
        'ws://127.0.0.1:47187',
        managerA.agentId,
      )
    })

    rerender(
      <SettingsGeneral
        wsUrl="ws://127.0.0.1:47187"
        managers={[managerB]}
        onUpdateManager={createUpdateManagerMock()}
      />,
    )

    await waitFor(() => {
      expect(vi.mocked(settingsApi.fetchClaudeOutputStyle)).toHaveBeenCalledWith(
        'ws://127.0.0.1:47187',
        managerB.agentId,
      )
    })

    await act(async () => {
      deferredB.resolve({
        managerId: managerB.agentId,
        selectedStyle: 'concise',
        availableStyles: ['concise'],
        warning: 'warning-from-b',
      })
      await Promise.resolve()
    })

    await screen.findByText('warning-from-b')

    await act(async () => {
      deferredA.resolve({
        managerId: managerA.agentId,
        selectedStyle: 'default',
        availableStyles: ['default'],
        warning: 'warning-from-a',
      })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.queryByText('warning-from-a')).toBeNull()
    })
    expect(screen.getByText('warning-from-b')).toBeTruthy()
  })

  it('clears saving lock when switching managers during an in-flight style save', async () => {
    const managerA = createClaudeManager('manager-a', 'Manager A')
    const managerB = createClaudeManager('manager-b', 'Manager B')
    const saveDeferred = createDeferred<ClaudeOutputStyleState>()

    vi.mocked(settingsApi.fetchClaudeOutputStyle).mockImplementation(async (_wsUrl, managerId) => ({
      managerId,
      selectedStyle: null,
      availableStyles: ['concise', 'technical'],
    }))
    vi.mocked(settingsApi.updateClaudeOutputStyle).mockImplementation(async (_wsUrl, managerId) => {
      if (managerId !== managerA.agentId) {
        throw new Error(`Unexpected save manager id: ${managerId}`)
      }
      return saveDeferred.promise
    })

    render(
      <SettingsGeneral
        wsUrl="ws://127.0.0.1:47187"
        managers={[managerA, managerB]}
        onUpdateManager={createUpdateManagerMock()}
      />,
    )

    await waitFor(() => {
      expect(vi.mocked(settingsApi.fetchClaudeOutputStyle)).toHaveBeenCalledWith(
        'ws://127.0.0.1:47187',
        managerA.agentId,
      )
    })

    const refreshButton = screen.getByRole('button', { name: 'Refresh styles' })
    await waitFor(() => {
      expect((refreshButton as HTMLButtonElement).disabled).toBe(false)
    })

    const managerSelect = screen.getByRole('combobox', { name: 'Claude manager' })
    const outputStyleSelect = screen.getByRole('combobox', { name: 'Claude output style' })
    fireEvent.click(outputStyleSelect)
    fireEvent.click(await screen.findByRole('option', { name: 'concise' }))

    await waitFor(() => {
      expect(vi.mocked(settingsApi.updateClaudeOutputStyle)).toHaveBeenCalledWith(
        'ws://127.0.0.1:47187',
        managerA.agentId,
        'concise',
      )
    })

    expect((refreshButton as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(managerSelect)
    fireEvent.click(await screen.findByRole('option', { name: 'Manager B' }))

    await waitFor(() => {
      expect(vi.mocked(settingsApi.fetchClaudeOutputStyle)).toHaveBeenCalledWith(
        'ws://127.0.0.1:47187',
        managerB.agentId,
      )
    })

    await waitFor(() => {
      expect((refreshButton as HTMLButtonElement).disabled).toBe(false)
    })

    await act(async () => {
      saveDeferred.resolve({
        managerId: managerA.agentId,
        selectedStyle: 'concise',
        availableStyles: ['concise', 'technical'],
      })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect((refreshButton as HTMLButtonElement).disabled).toBe(false)
    })
  })

  it('saves manager runtime settings with explicit descriptor fields and no-reset feedback', async () => {
    const manager = createManager(
      'manager-a',
      'Manager A',
      {
        provider: 'openai-codex',
        modelId: 'gpt-5.3-codex',
        thinkingLevel: 'high',
      },
      'Current override',
    )

    const onUpdateManager = createUpdateManagerMock(async () => ({
      manager: {
        ...manager,
        promptOverride: 'Current override',
      },
      resetApplied: false,
    }))

    render(
      <SettingsGeneral
        wsUrl="ws://127.0.0.1:47187"
        managers={[manager]}
        onUpdateManager={onUpdateManager}
      />,
    )

    await waitForRuntimeCatalogReady()
    fireEvent.click(screen.getByRole('button', { name: 'Save manager settings' }))

    await waitFor(() => {
      expect(onUpdateManager).toHaveBeenCalledTimes(1)
    })

    expect(onUpdateManager).toHaveBeenCalledWith({
      managerId: 'manager-a',
      provider: 'openai-codex',
      modelId: 'gpt-5.3-codex',
      thinkingLevel: 'high',
    })

    expect(
      screen.getByText('Manager settings saved. No runtime reset was needed.'),
    ).toBeTruthy()
  })

  it('renders runtime descriptor options from dynamic catalog and updates thinking options when model changes', async () => {
    const manager = createManager(
      'manager-a',
      'Manager A',
      {
        provider: 'openai-codex',
        modelId: 'gpt-5.3-codex',
        thinkingLevel: 'high',
      },
    )

    render(
      <SettingsGeneral
        wsUrl="ws://127.0.0.1:47187"
        managers={[manager]}
        onUpdateManager={createUpdateManagerMock()}
      />,
    )

    await waitFor(() => {
      expect(screen.queryByText('Loading runtime model catalog...')).toBeNull()
    })

    const providerSelect = screen.getByRole('combobox', { name: 'Manager runtime provider' })
    fireEvent.click(providerSelect)
    const providerOptions = await screen.findAllByRole('option')
    expect(providerOptions.map((option) => option.textContent?.trim())).toEqual([
      'OpenAI Codex',
      'Anthropic',
    ])
    fireEvent.click(await screen.findByRole('option', { name: 'OpenAI Codex' }))

    const modelSelect = screen.getByRole('combobox', { name: 'Manager runtime model' })
    fireEvent.click(modelSelect)
    fireEvent.click(await screen.findByRole('option', { name: 'gpt-5.3-mini' }))

    const thinkingSelect = screen.getByRole('combobox', { name: 'Manager runtime thinking' })
    fireEvent.click(thinkingSelect)
    const thinkingOptions = await screen.findAllByRole('option')
    expect(thinkingOptions.map((option) => option.textContent?.trim())).toEqual(['off', 'low'])
  })

  it('blocks runtime save when stale thinking level is no longer supported by selected model', async () => {
    const staleThinkingManager = createManager(
      'manager-stale',
      'Stale Thinking Manager',
      {
        provider: 'openai-codex',
        modelId: 'gpt-5.3-codex',
        thinkingLevel: 'xhigh',
      },
    )
    const onUpdateManager = createUpdateManagerMock()

    render(
      <SettingsGeneral
        wsUrl="ws://127.0.0.1:47187"
        managers={[staleThinkingManager]}
        onUpdateManager={onUpdateManager}
      />,
    )

    await waitFor(() => {
      expect(screen.queryByText('Loading runtime model catalog...')).toBeNull()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save manager settings' }))

    await waitFor(() => {
      expect(screen.getByText('Selected thinking level is not available for this model.')).toBeTruthy()
    })
    expect(onUpdateManager).not.toHaveBeenCalled()
  })

  it('allows prompt-only save for unsupported descriptors', async () => {
    const unsupportedManager = createManager(
      'manager-unsupported',
      'Unsupported Manager',
      {
        provider: 'custom-provider',
        modelId: 'custom-model',
        thinkingLevel: 'medium',
      },
      'old prompt',
    )

    const onUpdateManager = createUpdateManagerMock(async (input) => ({
      manager: {
        ...unsupportedManager,
        promptOverride: String(input.promptOverride ?? ''),
      },
      resetApplied: false,
    }))

    render(
      <SettingsGeneral
        wsUrl="ws://127.0.0.1:47187"
        managers={[unsupportedManager]}
        onUpdateManager={onUpdateManager}
      />,
    )

    await waitFor(() => {
      expect(screen.queryByText('Loading runtime model catalog...')).toBeNull()
    })

    fireEvent.change(screen.getByLabelText('Manager runtime prompt override'), {
      target: { value: 'new prompt' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save manager settings' }))

    await waitFor(() => {
      expect(onUpdateManager).toHaveBeenCalledTimes(1)
    })
    expect(onUpdateManager).toHaveBeenCalledWith({
      managerId: 'manager-unsupported',
      promptOverride: 'new prompt',
    })
  })

  it('preserves runtime save feedback after same-manager props refresh', async () => {
    const manager = createManager(
      'manager-a',
      'Manager A',
      {
        provider: 'openai-codex',
        modelId: 'gpt-5.3-codex',
        thinkingLevel: 'high',
      },
      'Current override',
    )
    const updatedManager: AgentDescriptor = {
      ...manager,
      updatedAt: '2026-01-01T00:00:01.000Z',
    }

    const onUpdateManager = createUpdateManagerMock(async () => ({
      manager: updatedManager,
      resetApplied: true,
    }))

    const { rerender } = render(
      <SettingsGeneral
        wsUrl="ws://127.0.0.1:47187"
        managers={[manager]}
        onUpdateManager={onUpdateManager}
      />,
    )

    await waitForRuntimeCatalogReady()
    fireEvent.click(screen.getByRole('button', { name: 'Save manager settings' }))

    await waitFor(() => {
      expect(onUpdateManager).toHaveBeenCalledTimes(1)
    })

    await screen.findByText('Manager settings saved. Runtime was reset.')

    rerender(
      <SettingsGeneral
        wsUrl="ws://127.0.0.1:47187"
        managers={[
          {
            ...updatedManager,
            updatedAt: '2026-01-01T00:00:02.000Z',
          },
        ]}
        onUpdateManager={onUpdateManager}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Manager settings saved. Runtime was reset.')).toBeTruthy()
    })
  })

  it('preserves no-reset runtime save feedback after same-manager props refresh', async () => {
    const manager = createManager(
      'manager-a',
      'Manager A',
      {
        provider: 'openai-codex',
        modelId: 'gpt-5.3-codex',
        thinkingLevel: 'high',
      },
      'Current override',
    )
    const updatedManager: AgentDescriptor = {
      ...manager,
      updatedAt: '2026-01-01T00:00:01.000Z',
    }

    const onUpdateManager = createUpdateManagerMock(async () => ({
      manager: updatedManager,
      resetApplied: false,
    }))

    const { rerender } = render(
      <SettingsGeneral
        wsUrl="ws://127.0.0.1:47187"
        managers={[manager]}
        onUpdateManager={onUpdateManager}
      />,
    )

    await waitForRuntimeCatalogReady()
    fireEvent.click(screen.getByRole('button', { name: 'Save manager settings' }))

    await waitFor(() => {
      expect(onUpdateManager).toHaveBeenCalledTimes(1)
    })

    await screen.findByText('Manager settings saved. No runtime reset was needed.')

    rerender(
      <SettingsGeneral
        wsUrl="ws://127.0.0.1:47187"
        managers={[
          {
            ...updatedManager,
            updatedAt: '2026-01-01T00:00:02.000Z',
          },
        ]}
        onUpdateManager={onUpdateManager}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Manager settings saved. No runtime reset was needed.')).toBeTruthy()
    })
  })

  it('blocks manager runtime save when selected descriptor is unsupported', async () => {
    const unsupportedManager = createManager(
      'manager-unsupported',
      'Unsupported Manager',
      {
        provider: 'custom-provider',
        modelId: 'custom-model',
        thinkingLevel: 'medium',
      },
    )
    const onUpdateManager = createUpdateManagerMock()

    render(
      <SettingsGeneral
        wsUrl="ws://127.0.0.1:47187"
        managers={[unsupportedManager]}
        onUpdateManager={onUpdateManager}
      />,
    )

    await waitForRuntimeCatalogReady()
    fireEvent.click(screen.getByRole('button', { name: 'Save manager settings' }))

    await waitFor(() => {
      expect(
        screen.getByText('Current model is unsupported in this editor. Choose a supported model to save.'),
      ).toBeTruthy()
    })
    expect(onUpdateManager).not.toHaveBeenCalled()
  })

  it('shows runtime catalog API failure and keeps runtime save gated safely', async () => {
    mockRuntimeCatalogStatus = 500
    mockRuntimeCatalogError = 'Runtime catalog request failed.'

    const manager = createManager(
      'manager-a',
      'Manager A',
      {
        provider: 'openai-codex',
        modelId: 'gpt-5.3-codex',
        thinkingLevel: 'high',
      },
    )
    const onUpdateManager = createUpdateManagerMock()

    render(
      <SettingsGeneral
        wsUrl="ws://127.0.0.1:47187"
        managers={[manager]}
        onUpdateManager={onUpdateManager}
      />,
    )

    await screen.findByText('Runtime catalog request failed.')

    fireEvent.click(screen.getByRole('button', { name: 'Save manager settings' }))

    await waitFor(() => {
      expect(
        screen.getByText('Current model is unsupported in this editor. Choose a supported model to save.'),
      ).toBeTruthy()
    })
    expect(onUpdateManager).not.toHaveBeenCalled()
  })

  it('handles empty runtime catalog responses without crashing and keeps save blocked', async () => {
    mockRuntimeCatalogResponse = {
      fetchedAt: '2026-01-01T00:00:00.000Z',
      providers: [
        {
          provider: 'openai-codex',
          providerLabel: 'OpenAI Codex',
          surfaces: ['create_manager'],
          models: [
            {
              modelId: 'gpt-5.3-codex',
              modelLabel: 'gpt-5.3-codex',
              allowedThinkingLevels: ['off', 'high'],
              defaultThinkingLevel: 'high',
            },
          ],
        },
      ],
    }

    const manager = createManager(
      'manager-a',
      'Manager A',
      {
        provider: 'openai-codex',
        modelId: 'gpt-5.3-codex',
        thinkingLevel: 'high',
      },
    )
    const onUpdateManager = createUpdateManagerMock()

    render(
      <SettingsGeneral
        wsUrl="ws://127.0.0.1:47187"
        managers={[manager]}
        onUpdateManager={onUpdateManager}
      />,
    )

    await screen.findByText('No runtime model options are available right now.')

    fireEvent.click(screen.getByRole('button', { name: 'Save manager settings' }))

    await waitFor(() => {
      expect(
        screen.getByText('Current model is unsupported in this editor. Choose a supported model to save.'),
      ).toBeTruthy()
    })
    expect(onUpdateManager).not.toHaveBeenCalled()
  })
})
