import { diffLines, parsePatch } from 'diff'

export type FileToolKind = 'write' | 'edit' | 'apply_patch' | 'unknown'

export interface DiffLine {
  type: 'added' | 'removed' | 'context'
  content: string
  oldLineNumber?: number
  newLineNumber?: number
}

export interface DiffHunk {
  header: string
  lines: DiffLine[]
}

export interface FileDiffData {
  filePath: string
  toolKind: FileToolKind
  hunks: DiffHunk[]
  isNewFile: boolean
}

const FILE_TOOL_KINDS: Record<string, FileToolKind> = {
  write: 'write',
  edit: 'edit',
  apply_patch: 'apply_patch',
  file_change: 'write',
}

export function detectFileToolKind(toolName: string | undefined): FileToolKind {
  const normalized = (toolName ?? '').trim().toLowerCase()
  return FILE_TOOL_KINDS[normalized] ?? 'unknown'
}

export function extractFileDiffData(
  toolName: string | undefined,
  inputPayload: string | undefined,
): FileDiffData | null {
  if (!inputPayload) return null

  const kind = detectFileToolKind(toolName)
  if (kind === 'unknown') return null

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(inputPayload)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  } catch {
    return null
  }

  switch (kind) {
    case 'write':
      return extractWriteDiff(parsed)
    case 'edit':
      return extractEditDiff(parsed)
    case 'apply_patch':
      return extractApplyPatchDiff(parsed)
    default:
      return null
  }
}

function pickPath(parsed: Record<string, unknown>): string {
  for (const key of ['file_path', 'path', 'targetPath']) {
    const value = parsed[key]
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  }
  return '(unknown file)'
}

function extractWriteDiff(parsed: Record<string, unknown>): FileDiffData | null {
  const content = parsed.content
  if (typeof content !== 'string') return null

  const filePath = pickPath(parsed)
  const lines = content.split('\n')
  const diffLines: DiffLine[] = []

  for (let i = 0; i < lines.length; i++) {
    diffLines.push({
      type: 'added',
      content: lines[i],
      newLineNumber: i + 1,
    })
  }

  return {
    filePath,
    toolKind: 'write',
    hunks: [{ header: `@@ -0,0 +1,${lines.length} @@`, lines: diffLines }],
    isNewFile: true,
  }
}

function extractEditDiff(parsed: Record<string, unknown>): FileDiffData | null {
  const oldString = parsed.old_string
  const newString = parsed.new_string
  if (typeof oldString !== 'string' || typeof newString !== 'string') return null

  const filePath = pickPath(parsed)
  const changes = diffLines(oldString, newString)

  const hunkLines: DiffLine[] = []
  let oldLine = 1
  let newLine = 1

  for (const change of changes) {
    const changeLines = splitChangeLines(change.value)

    for (const line of changeLines) {
      if (change.added) {
        hunkLines.push({ type: 'added', content: line, newLineNumber: newLine++ })
      } else if (change.removed) {
        hunkLines.push({ type: 'removed', content: line, oldLineNumber: oldLine++ })
      } else {
        hunkLines.push({ type: 'context', content: line, oldLineNumber: oldLine++, newLineNumber: newLine++ })
      }
    }
  }

  const oldTotal = oldLine - 1
  const newTotal = newLine - 1

  return {
    filePath,
    toolKind: 'edit',
    hunks: [{ header: `@@ -1,${oldTotal} +1,${newTotal} @@`, lines: hunkLines }],
    isNewFile: false,
  }
}

function extractApplyPatchDiff(parsed: Record<string, unknown>): FileDiffData | null {
  const patch = parsed.patch
  if (typeof patch !== 'string') return null

  const patches = parsePatch(patch)
  if (patches.length === 0) return null

  const first = patches[0]
  const filePath = first.newFileName ?? first.oldFileName ?? pickPath(parsed)

  const hunks: DiffHunk[] = first.hunks.map((hunk) => {
    const lines: DiffLine[] = []
    let oldLine = hunk.oldStart
    let newLine = hunk.newStart

    for (const rawLine of hunk.lines) {
      const prefix = rawLine[0]
      const content = rawLine.slice(1)

      if (prefix === '+') {
        lines.push({ type: 'added', content, newLineNumber: newLine++ })
      } else if (prefix === '-') {
        lines.push({ type: 'removed', content, oldLineNumber: oldLine++ })
      } else {
        lines.push({ type: 'context', content, oldLineNumber: oldLine++, newLineNumber: newLine++ })
      }
    }

    return {
      header: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
      lines,
    }
  })

  return {
    filePath,
    toolKind: 'apply_patch',
    hunks,
    isNewFile: first.oldFileName === '/dev/null',
  }
}

function splitChangeLines(value: string): string[] {
  if (value.length === 0) return ['']

  const lines = value.split('\n')
  // diffLines() includes a trailing newline in each chunk — drop the empty trailing element
  if (lines.length > 1 && lines[lines.length - 1] === '') {
    lines.pop()
  }
  return lines
}
