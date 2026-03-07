import { describe, expect, it } from 'vitest'
import { inferModelPreset } from './model-preset'
import type { AgentDescriptor } from '@nexus/protocol'

function makeAgent(model: Partial<AgentDescriptor['model']>): AgentDescriptor {
  return {
    agentId: 'agent-1',
    managerId: 'agent-1',
    displayName: 'agent-1',
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
    sessionFile: '/tmp/agent-1.jsonl',
  }
}

describe('inferModelPreset', () => {
  it('treats canonical codex app-server descriptors as codex-app', () => {
    expect(
      inferModelPreset(
        makeAgent({
          provider: 'openai-codex-app-server',
          modelId: 'gpt-5.4',
        }),
      ),
    ).toBe('codex-app')
  })

  it("returns 'codex-app' for provider 'openai-codex-app-server'", () => {
    expect(
      inferModelPreset(
        makeAgent({
          provider: 'openai-codex-app-server',
          modelId: 'default',
        }),
      ),
    ).toBe('codex-app')
  })

  it('uses provider-level inference for claude agent sdk descriptors', () => {
    expect(
      inferModelPreset(
        makeAgent({
          provider: 'claude-agent-sdk',
          modelId: 'claude-sonnet-4-5',
        }),
      ),
    ).toBe('claude-agent-sdk')
  })
})
