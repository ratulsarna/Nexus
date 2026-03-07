import type { AgentDescriptor, ManagerModelPreset } from '@nexus/protocol'

export function inferModelPreset(agent: AgentDescriptor): ManagerModelPreset | undefined {
  const provider =
    typeof agent.model.provider === 'string' ? agent.model.provider.trim().toLowerCase() : ''

  if (!provider) {
    return undefined
  }

  if (provider === 'openai-codex-app-server') {
    return 'codex-app'
  }

  if (provider === 'claude-agent-sdk') {
    return 'claude-agent-sdk'
  }

  return undefined
}
