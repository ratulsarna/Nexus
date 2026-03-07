/** @vitest-environment jsdom */

import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useContextWindow } from './use-context-window'
import type { AgentDescriptor, ConversationEntry } from '@nexus/protocol'

function makeAgent(model: Partial<AgentDescriptor['model']>): AgentDescriptor {
  return {
    agentId: 'manager-1',
    managerId: 'manager-1',
    displayName: 'manager-1',
    role: 'manager',
    status: 'idle',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    cwd: '/tmp',
    model: {
      provider: 'openai-codex-app-server',
      modelId: 'gpt-5.4',
      thinkingLevel: 'high',
      ...model,
    },
    sessionFile: '/tmp/manager-1.jsonl',
  }
}

function HookProbe({
  activeAgent,
  messages,
}: {
  activeAgent: AgentDescriptor
  messages: ConversationEntry[]
}) {
  const { contextWindowUsage } = useContextWindow({
    activeAgent,
    activeAgentId: activeAgent.agentId,
    messages,
    statuses: {},
  })

  return (
    <output data-testid="context-window">
      {contextWindowUsage
        ? `${contextWindowUsage.usedTokens}:${contextWindowUsage.contextWindow}`
        : 'missing'}
    </output>
  )
}

function renderHookProbe(activeAgent: AgentDescriptor, messages: ConversationEntry[]) {
  root = createRoot(container)

  flushSync(() => {
    root?.render(
      createElement(HookProbe, {
        activeAgent,
        messages,
      }),
    )
  })
}

let container: HTMLDivElement
let root: Root | null = null

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  if (root) {
    flushSync(() => {
      root?.unmount()
    })
  }

  root = null
  container.remove()
})

describe('useContextWindow', () => {
  it('falls back to the codex preset context window for canonical descriptors', () => {
    renderHookProbe(
      makeAgent({
        provider: 'openai-codex-app-server',
        modelId: 'gpt-5.4',
      }),
      [
        {
          type: 'conversation_message',
          agentId: 'manager-1',
          role: 'user',
          text: '12345678',
          timestamp: '2026-01-01T00:00:00.000Z',
          source: 'user_input',
        },
      ],
    )

    expect(container.querySelector('[data-testid="context-window"]')?.textContent).toBe('2:1048576')
  })

  it('uses the claude preset fallback instead of the codex fallback for non-codex providers', () => {
    renderHookProbe(
      makeAgent({
        provider: 'claude-agent-sdk',
        modelId: 'claude-2',
      }),
      [
        {
          type: 'conversation_message',
          agentId: 'manager-1',
          role: 'user',
          text: '12345678',
          timestamp: '2026-01-01T00:00:00.000Z',
          source: 'user_input',
        },
      ],
    )

    expect(container.querySelector('[data-testid="context-window"]')?.textContent).toBe('2:200000')
  })

  it('returns missing when the agent provider is absent and no fallback preset can be inferred', () => {
    renderHookProbe(
      makeAgent({
        provider: undefined as unknown as string,
      }),
      [
        {
          type: 'conversation_message',
          agentId: 'manager-1',
          role: 'user',
          text: '12345678',
          timestamp: '2026-01-01T00:00:00.000Z',
          source: 'user_input',
        },
      ],
    )

    expect(container.querySelector('[data-testid="context-window"]')?.textContent).toBe('missing')
  })

  it('handles empty messages arrays when using a preset fallback', () => {
    renderHookProbe(
      makeAgent({
        provider: 'openai-codex-app-server',
        modelId: 'gpt-5.4',
      }),
      [],
    )

    expect(container.querySelector('[data-testid="context-window"]')?.textContent).toBe('0:1048576')
  })
})
