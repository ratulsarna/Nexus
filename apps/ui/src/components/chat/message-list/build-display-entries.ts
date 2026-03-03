import type { ConversationEntry } from '@nexus/protocol'
import { classifyToolCall } from '@/lib/tool-call-classifier'
import type {
  ConversationLogEntry,
  ToolExecutionDisplayEntry,
  ToolExecutionEvent,
  ToolExecutionLogEntry,
} from './types'

export type MessageListDisplayEntry =
  | {
      type: 'conversation_message'
      id: string
      message: Extract<ConversationEntry, { type: 'conversation_message' }>
    }
  | {
      type: 'agent_message'
      id: string
      message: Extract<ConversationEntry, { type: 'agent_message' }>
    }
  | {
      type: 'tool_execution'
      id: string
      entry: ToolExecutionDisplayEntry
    }
  | {
      type: 'runtime_error_log'
      id: string
      entry: ConversationLogEntry
    }

function isToolExecutionLog(entry: ConversationLogEntry): entry is ToolExecutionLogEntry {
  return (
    entry.kind === 'tool_execution_start' ||
    entry.kind === 'tool_execution_update' ||
    entry.kind === 'tool_execution_end'
  )
}

function isToolExecutionEvent(entry: ConversationEntry): entry is ToolExecutionEvent {
  if (entry.type === 'agent_tool_call') {
    return true
  }

  return entry.type === 'conversation_log' && isToolExecutionLog(entry)
}

function resolveToolExecutionEventActorAgentId(event: ToolExecutionEvent): string {
  return event.type === 'agent_tool_call' ? event.actorAgentId : event.agentId
}

function hydrateToolDisplayEntry(
  displayEntry: ToolExecutionDisplayEntry,
  event: ToolExecutionEvent,
  canOverrideToolName: boolean,
): void {
  displayEntry.actorAgentId = resolveToolExecutionEventActorAgentId(event)

  if (canOverrideToolName) {
    displayEntry.toolName = event.toolName ?? displayEntry.toolName
  }

  displayEntry.toolCallId = event.toolCallId ?? displayEntry.toolCallId
  displayEntry.timestamp = event.timestamp
  displayEntry.latestKind = event.kind

  if (event.kind === 'tool_execution_start') {
    displayEntry.inputPayload = event.text
    displayEntry.latestPayload = event.text
    displayEntry.outputPayload = undefined
    displayEntry.isError = false
    return
  }

  if (event.kind === 'tool_execution_update') {
    displayEntry.latestPayload = event.text
    return
  }

  displayEntry.outputPayload = event.text
  displayEntry.latestPayload = event.text
  displayEntry.isError = event.isError
}

export function buildDisplayEntries(messages: ConversationEntry[]): MessageListDisplayEntry[] {
  const displayEntries: MessageListDisplayEntry[] = []
  const toolEntriesByCallId = new Map<string, ToolExecutionDisplayEntry>()

  for (const [index, message] of messages.entries()) {
    if (message.type === 'conversation_message') {
      displayEntries.push({
        type: 'conversation_message',
        id: `message-${message.timestamp}-${index}`,
        message,
      })
      continue
    }

    if (message.type === 'agent_message') {
      displayEntries.push({
        type: 'agent_message',
        id: `agent-message-${message.timestamp}-${index}`,
        message,
      })
      continue
    }

    if (isToolExecutionEvent(message)) {
      const actorAgentId = resolveToolExecutionEventActorAgentId(message)
      const callId = message.toolCallId?.trim()
      const classification = classifyToolCall(message.toolName, {
        entryType: message.type,
        eventKind: message.kind,
        source: message.type === 'conversation_log' ? message.source : undefined,
        toolCallId: message.toolCallId,
      })

      if (callId) {
        const toolGroupKey = `${actorAgentId}:${callId}`
        let displayEntry = toolEntriesByCallId.get(toolGroupKey)

        if (!displayEntry && !classification.callable) {
          continue
        }

        if (!displayEntry) {
          displayEntry = {
            id: `tool-${toolGroupKey}`,
            actorAgentId,
            toolName: message.toolName,
            toolCallId: callId,
            timestamp: message.timestamp,
            latestKind: message.kind,
            callable: classification.callable,
            classification,
          }

          displayEntries.push({
            type: 'tool_execution',
            id: displayEntry.id,
            entry: displayEntry,
          })

          toolEntriesByCallId.set(toolGroupKey, displayEntry)
        }

        displayEntry.callable = displayEntry.callable || classification.callable

        if (classification.callable) {
          displayEntry.classification = classification
        }

        hydrateToolDisplayEntry(displayEntry, message, classification.callable)
        continue
      }

      if (!classification.callable) {
        continue
      }

      const displayEntry: ToolExecutionDisplayEntry = {
        id: `tool-${message.timestamp}-${index}`,
        actorAgentId,
        toolName: message.toolName,
        toolCallId: message.toolCallId,
        timestamp: message.timestamp,
        latestKind: message.kind,
        callable: true,
        classification,
      }

      hydrateToolDisplayEntry(displayEntry, message, true)

      displayEntries.push({
        type: 'tool_execution',
        id: displayEntry.id,
        entry: displayEntry,
      })
      continue
    }

    if (message.type === 'conversation_log' && message.isError) {
      displayEntries.push({
        type: 'runtime_error_log',
        id: `runtime-log-${message.timestamp}-${index}`,
        entry: message,
      })
    }
  }

  return displayEntries
}
