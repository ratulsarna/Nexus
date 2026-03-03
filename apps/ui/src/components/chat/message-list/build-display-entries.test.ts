import { describe, expect, it } from 'vitest'
import type { ConversationEntry } from '@nexus/protocol'
import { buildDisplayEntries } from './build-display-entries'

function logEvent(overrides: Partial<Extract<ConversationEntry, { type: 'conversation_log' }>> = {}) {
  return {
    type: 'conversation_log' as const,
    agentId: 'manager',
    timestamp: '2026-03-03T10:00:00.000Z',
    source: 'runtime_log' as const,
    kind: 'tool_execution_start' as const,
    toolName: 'exec_command',
    toolCallId: 'call-1',
    text: '{}',
    ...overrides,
  }
}

describe('buildDisplayEntries', () => {
  it('excludes non-callable labels from tool execution rows', () => {
    const entries = buildDisplayEntries([
      logEvent({
        toolName: 'item/started',
        toolCallId: 'non-callable-1',
      }),
    ])

    expect(entries.find((entry) => entry.type === 'tool_execution')).toBeUndefined()
  })

  it('keeps unknown callable names on the tool-row path with deterministic fallback', () => {
    const entries = buildDisplayEntries([
      logEvent({
        toolName: 'future_tool_xyz',
        toolCallId: 'unknown-1',
      }),
    ])

    const toolEntry = entries.find((entry) => entry.type === 'tool_execution')
    expect(toolEntry?.type).toBe('tool_execution')

    if (toolEntry?.type === 'tool_execution') {
      expect(toolEntry.entry.callable).toBe(true)
      expect(toolEntry.entry.classification.category).toBe('unknown')
      expect(toolEntry.entry.classification.displayKind).toBe('callable-unknown')
    }
  })

  it('retains codex tool-like names as callable rows in tool-call contexts', () => {
    const toolNames = [
      'command_execution',
      'file_change',
      'web_search',
      'image_view',
      'mcp:linear/list_issues',
    ] as const

    const messages: ConversationEntry[] = toolNames.map((toolName, index) => ({
      type: 'agent_tool_call',
      agentId: 'manager',
      actorAgentId: 'worker-1',
      timestamp: `2026-03-03T10:00:0${index}.000Z`,
      kind: 'tool_execution_start',
      toolName,
      toolCallId: `call-${index + 1}`,
      text: '{}',
    }))

    const entries = buildDisplayEntries(messages)
    const toolEntries = entries.filter((entry) => entry.type === 'tool_execution')
    expect(toolEntries).toHaveLength(toolNames.length)

    const byToolName = new Map(
      toolEntries
        .filter((entry): entry is Extract<typeof entry, { type: 'tool_execution' }> => entry.type === 'tool_execution')
        .map((entry) => [entry.entry.toolName, entry.entry]),
    )

    expect(byToolName.get('command_execution')?.classification.category).toBe('shell')
    expect(byToolName.get('file_change')?.classification.category).toBe('file')
    expect(byToolName.get('web_search')?.classification.category).toBe('web')
    expect(byToolName.get('image_view')?.classification.category).toBe('image')
    expect(byToolName.get('mcp:linear/list_issues')?.classification.category).toBe('mcp')

    for (const entry of byToolName.values()) {
      expect(entry.callable).toBe(true)
    }
  })

  it('retains codex tool-like names for conversation_log events with toolCallId', () => {
    const toolNames = [
      'command_execution',
      'file_change',
      'web_search',
      'image_view',
      'mcp:linear/list_issues',
    ] as const

    const messages: ConversationEntry[] = toolNames.map((toolName, index) => ({
      type: 'conversation_log',
      agentId: 'worker-1',
      timestamp: `2026-03-03T10:01:0${index}.000Z`,
      source: 'runtime_log',
      kind: 'tool_execution_start',
      toolName,
      toolCallId: `worker-call-${index + 1}`,
      text: '{}',
    }))

    const entries = buildDisplayEntries(messages)
    const toolEntries = entries.filter((entry) => entry.type === 'tool_execution')
    expect(toolEntries).toHaveLength(toolNames.length)

    const byToolName = new Map(
      toolEntries
        .filter((entry): entry is Extract<typeof entry, { type: 'tool_execution' }> => entry.type === 'tool_execution')
        .map((entry) => [entry.entry.toolName, entry.entry]),
    )

    expect(byToolName.get('command_execution')?.classification.category).toBe('shell')
    expect(byToolName.get('file_change')?.classification.category).toBe('file')
    expect(byToolName.get('web_search')?.classification.category).toBe('web')
    expect(byToolName.get('image_view')?.classification.category).toBe('image')
    expect(byToolName.get('mcp:linear/list_issues')?.classification.category).toBe('mcp')

    for (const entry of byToolName.values()) {
      expect(entry.callable).toBe(true)
    }
  })

  it('preserves grouped tool rows when later events in the same call are non-callable labels', () => {
    const messages: ConversationEntry[] = [
      {
        type: 'agent_tool_call',
        agentId: 'manager',
        actorAgentId: 'worker-1',
        timestamp: '2026-03-03T10:00:00.000Z',
        kind: 'tool_execution_start',
        toolName: 'exec_command',
        toolCallId: 'sticky-1',
        text: '{"command":"ls"}',
      },
      {
        type: 'agent_tool_call',
        agentId: 'manager',
        actorAgentId: 'worker-1',
        timestamp: '2026-03-03T10:00:01.000Z',
        kind: 'tool_execution_update',
        toolName: 'item/commandExecution/outputDelta',
        toolCallId: 'sticky-1',
        text: 'progress line',
      },
      {
        type: 'agent_tool_call',
        agentId: 'manager',
        actorAgentId: 'worker-1',
        timestamp: '2026-03-03T10:00:02.000Z',
        kind: 'tool_execution_end',
        toolName: 'item/completed',
        toolCallId: 'sticky-1',
        text: '{"ok":true}',
        isError: false,
      },
    ]

    const entries = buildDisplayEntries(messages)
    const toolEntries = entries.filter((entry) => entry.type === 'tool_execution')

    expect(toolEntries).toHaveLength(1)

    const [toolEntry] = toolEntries
    if (toolEntry.type === 'tool_execution') {
      expect(toolEntry.entry.callable).toBe(true)
      expect(toolEntry.entry.latestKind).toBe('tool_execution_end')
      expect(toolEntry.entry.toolName).toBe('exec_command')
      expect(toolEntry.entry.outputPayload).toContain('ok')
    }
  })
})
