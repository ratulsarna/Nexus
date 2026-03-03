import { THINKING_LEVELS, type ThinkingLevel } from '@nexus/protocol'

const ALL_THINKING_LEVELS = [...THINKING_LEVELS] as ThinkingLevel[]

export interface CreateManagerCatalogEntry {
  provider: string
  providerLabel: string
  modelId: string
  modelLabel: string
  defaultThinkingLevel: ThinkingLevel
  allowedThinkingLevels: ThinkingLevel[]
}

export interface CreateManagerSelection {
  provider: string
  modelId: string
  thinkingLevel: ThinkingLevel
}

export interface CreateManagerSelectOption {
  value: string
  label: string
}

export const CREATE_MANAGER_MODEL_CATALOG: CreateManagerCatalogEntry[] = [
  {
    provider: 'openai-codex',
    providerLabel: 'OpenAI Codex',
    modelId: 'gpt-5.3-codex',
    modelLabel: 'gpt-5.3-codex',
    defaultThinkingLevel: 'xhigh',
    allowedThinkingLevels: ALL_THINKING_LEVELS,
  },
  {
    provider: 'anthropic',
    providerLabel: 'Anthropic',
    modelId: 'claude-opus-4-6',
    modelLabel: 'claude-opus-4-6',
    defaultThinkingLevel: 'xhigh',
    allowedThinkingLevels: ALL_THINKING_LEVELS,
  },
  {
    provider: 'claude-agent-sdk',
    providerLabel: 'Claude Agent SDK',
    modelId: 'claude-opus-4-6',
    modelLabel: 'claude-opus-4-6',
    defaultThinkingLevel: 'xhigh',
    allowedThinkingLevels: ALL_THINKING_LEVELS,
  },
]

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function findCatalogEntry(provider: string, modelId: string): CreateManagerCatalogEntry | undefined {
  const normalizedProvider = normalize(provider)
  const normalizedModelId = normalize(modelId)

  return CREATE_MANAGER_MODEL_CATALOG.find(
    (entry) =>
      normalize(entry.provider) === normalizedProvider &&
      normalize(entry.modelId) === normalizedModelId,
  )
}

export function getCreateManagerProviderOptions(): CreateManagerSelectOption[] {
  const uniqueProviders = new Map<string, string>()

  for (const entry of CREATE_MANAGER_MODEL_CATALOG) {
    if (!uniqueProviders.has(entry.provider)) {
      uniqueProviders.set(entry.provider, entry.providerLabel)
    }
  }

  return [...uniqueProviders.entries()].map(([value, label]) => ({ value, label }))
}

export function getCreateManagerModelOptions(provider: string): CreateManagerSelectOption[] {
  const normalizedProvider = normalize(provider)

  return CREATE_MANAGER_MODEL_CATALOG
    .filter((entry) => normalize(entry.provider) === normalizedProvider)
    .map((entry) => ({
      value: entry.modelId,
      label: entry.modelLabel,
    }))
}

export function getCreateManagerAllowedThinkingLevels(provider: string, modelId: string): ThinkingLevel[] {
  const entry = findCatalogEntry(provider, modelId)
  if (!entry) {
    return []
  }

  return [...entry.allowedThinkingLevels]
}

export function getDefaultModelForProvider(provider: string): string | undefined {
  const normalizedProvider = normalize(provider)
  const entry = CREATE_MANAGER_MODEL_CATALOG.find(
    (candidate) => normalize(candidate.provider) === normalizedProvider,
  )

  return entry?.modelId
}

export function getDefaultThinkingLevel(provider: string, modelId: string): ThinkingLevel | undefined {
  return findCatalogEntry(provider, modelId)?.defaultThinkingLevel
}

export function getDefaultCreateManagerSelection(): CreateManagerSelection {
  const first = CREATE_MANAGER_MODEL_CATALOG[0]
  if (!first) {
    throw new Error('Create-manager model catalog must include at least one descriptor.')
  }

  return {
    provider: first.provider,
    modelId: first.modelId,
    thinkingLevel: first.defaultThinkingLevel,
  }
}
