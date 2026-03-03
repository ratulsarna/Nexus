import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type MutableRefObject,
  type SetStateAction,
} from 'react'
import { chooseFallbackAgentId } from '@/lib/agent-hierarchy'
import { resolveApiEndpoint } from '@/lib/api-endpoint'
import {
  getCreateManagerAllowedThinkingLevels,
  getCreateManagerModelOptions,
  getCreateManagerProviderOptions,
  getDefaultCreateManagerSelection,
  getDefaultModelForProvider,
  getDefaultThinkingLevel,
} from '@/lib/create-manager-model-catalog'
import { ManagerWsClient } from '@/lib/ws-client'
import type { ManagerWsState } from '@/lib/ws-state'
import type {
  AgentDescriptor,
  ThinkingLevel,
} from '@nexus/protocol'
import type { AppRouteState } from './use-route-state'

interface UseManagerActionsOptions {
  wsUrl: string
  clientRef: MutableRefObject<ManagerWsClient | null>
  agents: AgentDescriptor[]
  activeAgent: AgentDescriptor | null
  activeAgentId: string | null
  isActiveManager: boolean
  navigateToRoute: (nextRouteState: AppRouteState, replace?: boolean) => void
  setState: Dispatch<SetStateAction<ManagerWsState>>
  clearPendingResponseForAgent: (agentId: string) => void
}

const DEFAULT_CREATE_MANAGER_SELECTION = getDefaultCreateManagerSelection()

export function useManagerActions({
  wsUrl,
  clientRef,
  agents,
  activeAgent,
  activeAgentId,
  isActiveManager,
  navigateToRoute,
  setState,
  clearPendingResponseForAgent,
}: UseManagerActionsOptions): {
  isCreateManagerDialogOpen: boolean
  newManagerName: string
  newManagerCwd: string
  newManagerProvider: string
  newManagerModelId: string
  newManagerThinkingLevel: ThinkingLevel
  createManagerProviderOptions: Array<{ value: string; label: string }>
  createManagerModelOptions: Array<{ value: string; label: string }>
  createManagerThinkingOptions: Array<{ value: ThinkingLevel; label: string }>
  createManagerSelectionHint: string | null
  createManagerError: string | null
  browseError: string | null
  isCreatingManager: boolean
  isValidatingDirectory: boolean
  isPickingDirectory: boolean
  handleNewManagerNameChange: (value: string) => void
  handleNewManagerCwdChange: (value: string) => void
  handleNewManagerProviderChange: (value: string) => void
  handleNewManagerModelIdChange: (value: string) => void
  handleNewManagerThinkingLevelChange: (value: ThinkingLevel) => void
  handleOpenCreateManagerDialog: () => void
  handleCreateManagerDialogOpenChange: (open: boolean) => void
  handleBrowseDirectory: () => Promise<void>
  handleCreateManager: (event: FormEvent<HTMLFormElement>) => Promise<void>
  managerToDelete: AgentDescriptor | null
  deleteManagerError: string | null
  isDeletingManager: boolean
  handleRequestDeleteManager: (managerId: string) => void
  handleConfirmDeleteManager: () => Promise<void>
  handleCloseDeleteManagerDialog: () => void
  isCompactingManager: boolean
  handleCompactManager: (customInstructions?: string) => Promise<void>
  isStoppingAllAgents: boolean
  handleStopAllAgents: () => Promise<void>
} {
  const [isCreateManagerDialogOpen, setIsCreateManagerDialogOpen] = useState(false)
  const [newManagerName, setNewManagerName] = useState('')
  const [newManagerCwd, setNewManagerCwd] = useState('')
  const [newManagerProvider, setNewManagerProvider] = useState(DEFAULT_CREATE_MANAGER_SELECTION.provider)
  const [newManagerModelId, setNewManagerModelId] = useState(DEFAULT_CREATE_MANAGER_SELECTION.modelId)
  const [newManagerThinkingLevel, setNewManagerThinkingLevel] = useState<ThinkingLevel>(
    DEFAULT_CREATE_MANAGER_SELECTION.thinkingLevel,
  )
  const [createManagerSelectionHint, setCreateManagerSelectionHint] = useState<string | null>(null)
  const [createManagerError, setCreateManagerError] = useState<string | null>(null)
  const [isCreatingManager, setIsCreatingManager] = useState(false)
  const [isValidatingDirectory, setIsValidatingDirectory] = useState(false)

  const [browseError, setBrowseError] = useState<string | null>(null)
  const [isPickingDirectory, setIsPickingDirectory] = useState(false)

  const [managerToDelete, setManagerToDelete] = useState<AgentDescriptor | null>(null)
  const [deleteManagerError, setDeleteManagerError] = useState<string | null>(null)
  const [isDeletingManager, setIsDeletingManager] = useState(false)

  const [isCompactingManager, setIsCompactingManager] = useState(false)
  const [isStoppingAllAgents, setIsStoppingAllAgents] = useState(false)

  const handleNewManagerNameChange = useCallback((value: string) => {
    setNewManagerName(value)
  }, [])

  const handleNewManagerCwdChange = useCallback((value: string) => {
    setNewManagerCwd(value)
    setCreateManagerError(null)
  }, [])

  const createManagerProviderOptions = useMemo(() => getCreateManagerProviderOptions(), [])

  const createManagerModelOptions = useMemo(
    () => getCreateManagerModelOptions(newManagerProvider),
    [newManagerProvider],
  )

  const createManagerThinkingOptions = useMemo(
    () =>
      getCreateManagerAllowedThinkingLevels(newManagerProvider, newManagerModelId).map(
        (thinkingLevel) => ({
          value: thinkingLevel,
          label: thinkingLevel,
        }),
      ),
    [newManagerProvider, newManagerModelId],
  )

  const handleNewManagerProviderChange = useCallback((value: string) => {
    setNewManagerProvider(value)
    setCreateManagerError(null)
    setCreateManagerSelectionHint(null)

    const nextModelId =
      getDefaultModelForProvider(value) ?? getCreateManagerModelOptions(value)[0]?.value ?? ''
    const shouldResetModel = nextModelId !== newManagerModelId
    setNewManagerModelId(nextModelId)

    const nextThinkingOptions = getCreateManagerAllowedThinkingLevels(value, nextModelId)
    const defaultThinkingLevel = getDefaultThinkingLevel(value, nextModelId)
    const fallbackThinkingLevel =
      (defaultThinkingLevel && nextThinkingOptions.includes(defaultThinkingLevel)
        ? defaultThinkingLevel
        : nextThinkingOptions[0]) ?? DEFAULT_CREATE_MANAGER_SELECTION.thinkingLevel

    const nextThinkingLevel = nextThinkingOptions.includes(newManagerThinkingLevel)
      ? newManagerThinkingLevel
      : fallbackThinkingLevel
    const shouldResetThinking = nextThinkingLevel !== newManagerThinkingLevel
    setNewManagerThinkingLevel(nextThinkingLevel)

    if (shouldResetModel && shouldResetThinking) {
      setCreateManagerSelectionHint('Model and thinking were reset for the selected provider.')
      return
    }

    if (shouldResetModel) {
      setCreateManagerSelectionHint('Model was reset for the selected provider.')
      return
    }

    if (shouldResetThinking) {
      setCreateManagerSelectionHint('Thinking was reset for the selected provider.')
    }
  }, [newManagerModelId, newManagerThinkingLevel])

  const handleNewManagerModelIdChange = useCallback((value: string) => {
    const normalizedModelId = value.trim()
    const nextModelId = normalizedModelId || getDefaultModelForProvider(newManagerProvider) || ''
    setNewManagerModelId(nextModelId)
    setCreateManagerError(null)
    setCreateManagerSelectionHint(null)

    const nextThinkingOptions = getCreateManagerAllowedThinkingLevels(newManagerProvider, nextModelId)
    const defaultThinkingLevel = getDefaultThinkingLevel(newManagerProvider, nextModelId)
    const fallbackThinkingLevel =
      (defaultThinkingLevel && nextThinkingOptions.includes(defaultThinkingLevel)
        ? defaultThinkingLevel
        : nextThinkingOptions[0]) ?? DEFAULT_CREATE_MANAGER_SELECTION.thinkingLevel
    const nextThinkingLevel = nextThinkingOptions.includes(newManagerThinkingLevel)
      ? newManagerThinkingLevel
      : fallbackThinkingLevel

    if (nextThinkingLevel !== newManagerThinkingLevel) {
      setCreateManagerSelectionHint(
        normalizedModelId
          ? 'Thinking was reset for the selected model.'
          : 'Model and thinking were reset for the selected provider.',
      )
      setNewManagerThinkingLevel(nextThinkingLevel)
    }
  }, [newManagerProvider, newManagerThinkingLevel])

  const handleNewManagerThinkingLevelChange = useCallback((value: ThinkingLevel) => {
    setNewManagerThinkingLevel(value)
    setCreateManagerError(null)
    setCreateManagerSelectionHint(null)
  }, [])

  const handleCompactManager = useCallback(async (customInstructions?: string) => {
    if (!isActiveManager || !activeAgentId) {
      return
    }

    setIsCompactingManager(true)

    try {
      await requestManagerCompaction(wsUrl, activeAgentId, customInstructions)
      setState((previous) => ({
        ...previous,
        lastError: null,
      }))
    } catch (error) {
      setState((previous) => ({
        ...previous,
        lastError: `Failed to compact manager context: ${toErrorMessage(error)}`,
      }))
    } finally {
      setIsCompactingManager(false)
    }
  }, [activeAgentId, isActiveManager, setState, wsUrl])

  const handleStopAllAgents = useCallback(async () => {
    const client = clientRef.current
    if (!client || activeAgent?.role !== 'manager') {
      return
    }

    setIsStoppingAllAgents(true)

    try {
      await client.stopAllAgents(activeAgent.agentId)
      clearPendingResponseForAgent(activeAgent.agentId)
      setState((previous) => ({
        ...previous,
        lastError: null,
      }))
    } catch (error) {
      setState((previous) => ({
        ...previous,
        lastError: `Failed to stop manager and workers: ${toErrorMessage(error)}`,
      }))
    } finally {
      setIsStoppingAllAgents(false)
    }
  }, [activeAgent, clearPendingResponseForAgent, clientRef, setState])

  const handleOpenCreateManagerDialog = useCallback(() => {
    const defaultCwd =
      activeAgent?.cwd ??
      agents.find((agent) => agent.role === 'manager')?.cwd ??
      ''

    setNewManagerName('')
    setNewManagerCwd(defaultCwd)
    setNewManagerProvider(DEFAULT_CREATE_MANAGER_SELECTION.provider)
    setNewManagerModelId(DEFAULT_CREATE_MANAGER_SELECTION.modelId)
    setNewManagerThinkingLevel(DEFAULT_CREATE_MANAGER_SELECTION.thinkingLevel)
    setCreateManagerSelectionHint(null)
    setBrowseError(null)
    setCreateManagerError(null)
    setIsCreateManagerDialogOpen(true)
  }, [activeAgent, agents])

  const handleCreateManagerDialogOpenChange = useCallback((open: boolean) => {
    if (!open && isCreatingManager) {
      return
    }

    setIsCreateManagerDialogOpen(open)
  }, [isCreatingManager])

  const handleBrowseDirectory = useCallback(async () => {
    const client = clientRef.current
    if (!client) {
      return
    }

    setBrowseError(null)
    setIsPickingDirectory(true)

    try {
      const pickedPath = await client.pickDirectory(newManagerCwd)
      if (!pickedPath) {
        return
      }

      setNewManagerCwd(pickedPath)
      setCreateManagerError(null)
    } catch (error) {
      setBrowseError(toErrorMessage(error))
    } finally {
      setIsPickingDirectory(false)
    }
  }, [clientRef, newManagerCwd])

  const handleCreateManager = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const client = clientRef.current
    if (!client) {
      return
    }

    const name = newManagerName.trim()
    const cwd = newManagerCwd.trim()

    if (!name) {
      setCreateManagerError('Manager name is required.')
      return
    }

    if (!cwd) {
      setCreateManagerError('Manager working directory is required.')
      return
    }

    if (!newManagerProvider) {
      setCreateManagerError('Provider selection is required.')
      return
    }

    if (!newManagerModelId) {
      setCreateManagerError('Model selection is required.')
      return
    }

    if (!newManagerThinkingLevel) {
      setCreateManagerError('Thinking selection is required.')
      return
    }

    setCreateManagerError(null)
    setIsCreatingManager(true)

    try {
      setIsValidatingDirectory(true)
      const validation = await client.validateDirectory(cwd)
      setIsValidatingDirectory(false)

      if (!validation.valid) {
        setCreateManagerError(validation.message ?? 'Directory is not valid.')
        return
      }

      const manager = await client.createManager({
        name,
        cwd: validation.path || cwd,
        provider: newManagerProvider,
        modelId: newManagerModelId,
        thinkingLevel: newManagerThinkingLevel,
      })

      navigateToRoute({ view: 'chat', agentId: manager.agentId })
      client.subscribeToAgent(manager.agentId)

      setIsCreateManagerDialogOpen(false)
      setNewManagerName('')
      setNewManagerCwd('')
      setNewManagerProvider(DEFAULT_CREATE_MANAGER_SELECTION.provider)
      setNewManagerModelId(DEFAULT_CREATE_MANAGER_SELECTION.modelId)
      setNewManagerThinkingLevel(DEFAULT_CREATE_MANAGER_SELECTION.thinkingLevel)
      setCreateManagerSelectionHint(null)
      setBrowseError(null)
      setCreateManagerError(null)
    } catch (error) {
      setCreateManagerError(toErrorMessage(error))
    } finally {
      setIsValidatingDirectory(false)
      setIsCreatingManager(false)
    }
  }, [
    clientRef,
    navigateToRoute,
    newManagerCwd,
    newManagerModelId,
    newManagerName,
    newManagerProvider,
    newManagerThinkingLevel,
  ])

  const handleRequestDeleteManager = useCallback((managerId: string) => {
    const manager = agents.find(
      (agent) => agent.agentId === managerId && agent.role === 'manager',
    )
    if (!manager) {
      return
    }

    setDeleteManagerError(null)
    setManagerToDelete(manager)
  }, [agents])

  const handleConfirmDeleteManager = useCallback(async () => {
    const manager = managerToDelete
    const client = clientRef.current
    if (!manager || !client) {
      return
    }

    setDeleteManagerError(null)
    setIsDeletingManager(true)

    try {
      await client.deleteManager(manager.agentId)

      if (activeAgentId === manager.agentId) {
        const remainingAgents = agents.filter(
          (agent) =>
            agent.agentId !== manager.agentId &&
            agent.managerId !== manager.agentId,
        )
        const fallbackAgentId = chooseFallbackAgentId(remainingAgents)
        if (fallbackAgentId) {
          navigateToRoute({ view: 'chat', agentId: fallbackAgentId })
          client.subscribeToAgent(fallbackAgentId)
        }
      }

      setManagerToDelete(null)
      setDeleteManagerError(null)
    } catch (error) {
      setDeleteManagerError(toErrorMessage(error))
    } finally {
      setIsDeletingManager(false)
    }
  }, [activeAgentId, agents, clientRef, managerToDelete, navigateToRoute])

  const handleCloseDeleteManagerDialog = useCallback(() => {
    if (isDeletingManager) {
      return
    }

    setManagerToDelete(null)
    setDeleteManagerError(null)
  }, [isDeletingManager])

  return {
    isCreateManagerDialogOpen,
    newManagerName,
    newManagerCwd,
    newManagerProvider,
    newManagerModelId,
    newManagerThinkingLevel,
    createManagerProviderOptions,
    createManagerModelOptions,
    createManagerThinkingOptions,
    createManagerSelectionHint,
    createManagerError,
    browseError,
    isCreatingManager,
    isValidatingDirectory,
    isPickingDirectory,
    handleNewManagerNameChange,
    handleNewManagerCwdChange,
    handleNewManagerProviderChange,
    handleNewManagerModelIdChange,
    handleNewManagerThinkingLevelChange,
    handleOpenCreateManagerDialog,
    handleCreateManagerDialogOpenChange,
    handleBrowseDirectory,
    handleCreateManager,
    managerToDelete,
    deleteManagerError,
    isDeletingManager,
    handleRequestDeleteManager,
    handleConfirmDeleteManager,
    handleCloseDeleteManagerDialog,
    isCompactingManager,
    handleCompactManager,
    isStoppingAllAgents,
    handleStopAllAgents,
  }
}

async function requestManagerCompaction(
  wsUrl: string,
  agentId: string,
  customInstructions?: string,
): Promise<void> {
  const endpoint = resolveApiEndpoint(
    wsUrl,
    `/api/agents/${encodeURIComponent(agentId)}/compact`,
  )

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(
      customInstructions && customInstructions.trim().length > 0
        ? { customInstructions: customInstructions.trim() }
        : {},
    ),
  })

  if (response.ok) {
    return
  }

  let errorMessage: string | undefined
  try {
    const payload = (await response.json()) as { error?: unknown }
    if (typeof payload.error === 'string' && payload.error.trim().length > 0) {
      errorMessage = payload.error.trim()
    }
  } catch {
    // Ignore JSON parsing errors and fall back to status-based error text.
  }

  throw new Error(errorMessage ?? `Compaction request failed with status ${response.status}`)
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'An unexpected error occurred.'
}
