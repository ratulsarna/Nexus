export const MESSAGE_DRAFTS_STORAGE_KEY = 'nexus-message-drafts'

type DraftRecord = Record<string, string>

export function readMessageDraft(agentId: string | null | undefined): string {
  if (!agentId || typeof window === 'undefined') {
    return ''
  }

  const drafts = readMessageDrafts()
  return drafts[agentId] ?? ''
}

export function writeMessageDraft(agentId: string | null | undefined, draft: string): void {
  if (!agentId || typeof window === 'undefined') {
    return
  }

  const nextDraft = draft.trim()
  const drafts = readMessageDrafts()

  if (nextDraft.length === 0) {
    if (!(agentId in drafts)) {
      return
    }

    delete drafts[agentId]
  } else {
    drafts[agentId] = draft
  }

  persistMessageDrafts(drafts)
}

export function pruneMessageDrafts(activeAgentIds: string[]): void {
  if (typeof window === 'undefined') {
    return
  }

  const activeIds = new Set(activeAgentIds.filter((agentId) => agentId.trim().length > 0))
  const drafts = readMessageDrafts()
  let changed = false

  for (const agentId of Object.keys(drafts)) {
    if (activeIds.has(agentId)) {
      continue
    }

    delete drafts[agentId]
    changed = true
  }

  if (changed) {
    persistMessageDrafts(drafts)
  }
}

function readMessageDrafts(): DraftRecord {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const stored = window.localStorage.getItem(MESSAGE_DRAFTS_STORAGE_KEY)
    if (!stored) {
      return {}
    }

    const parsed = JSON.parse(stored) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([agentId, draft]) => agentId.trim().length > 0 && typeof draft === 'string',
      ),
    )
  } catch {
    return {}
  }
}

function persistMessageDrafts(drafts: DraftRecord): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (Object.keys(drafts).length === 0) {
      window.localStorage.removeItem(MESSAGE_DRAFTS_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(MESSAGE_DRAFTS_STORAGE_KEY, JSON.stringify(drafts))
  } catch {
    // Ignore localStorage write failures in restricted environments.
  }
}
