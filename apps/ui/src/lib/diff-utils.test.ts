import { describe, expect, it } from 'vitest'
import { detectFileToolKind, extractFileDiffData } from './diff-utils'

describe('detectFileToolKind', () => {
  it('maps known tool names', () => {
    expect(detectFileToolKind('write')).toBe('write')
    expect(detectFileToolKind('Write')).toBe('write')
    expect(detectFileToolKind('edit')).toBe('edit')
    expect(detectFileToolKind('apply_patch')).toBe('apply_patch')
    expect(detectFileToolKind('file_change')).toBe('write')
  })

  it('returns unknown for unrecognized names', () => {
    expect(detectFileToolKind('bash')).toBe('unknown')
    expect(detectFileToolKind(undefined)).toBe('unknown')
    expect(detectFileToolKind('')).toBe('unknown')
  })
})

describe('extractFileDiffData - write tool', () => {
  it('produces all-added lines', () => {
    const payload = JSON.stringify({ file_path: '/foo.ts', content: 'line1\nline2\nline3' })
    const result = extractFileDiffData('write', payload)

    expect(result).not.toBeNull()
    expect(result!.filePath).toBe('/foo.ts')
    expect(result!.toolKind).toBe('write')
    expect(result!.isNewFile).toBe(true)
    expect(result!.hunks).toHaveLength(1)

    const lines = result!.hunks[0].lines
    expect(lines).toHaveLength(3)
    expect(lines.every((l) => l.type === 'added')).toBe(true)
    expect(lines[0].content).toBe('line1')
    expect(lines[0].newLineNumber).toBe(1)
    expect(lines[2].newLineNumber).toBe(3)
  })

  it('uses path key as fallback', () => {
    const payload = JSON.stringify({ path: '/bar.ts', content: 'x' })
    const result = extractFileDiffData('write', payload)
    expect(result!.filePath).toBe('/bar.ts')
  })

  it('returns null when content is missing', () => {
    const payload = JSON.stringify({ file_path: '/foo.ts' })
    expect(extractFileDiffData('write', payload)).toBeNull()
  })
})

describe('extractFileDiffData - edit tool', () => {
  it('produces correct diff for replacement', () => {
    const payload = JSON.stringify({
      file_path: '/foo.ts',
      old_string: 'const x = 1;\nconst y = 2;\n',
      new_string: 'const x = 1;\nconst y = 3;\n',
    })
    const result = extractFileDiffData('edit', payload)

    expect(result).not.toBeNull()
    expect(result!.filePath).toBe('/foo.ts')
    expect(result!.toolKind).toBe('edit')
    expect(result!.isNewFile).toBe(false)
    expect(result!.hunks).toHaveLength(1)

    const lines = result!.hunks[0].lines
    const removed = lines.filter((l) => l.type === 'removed')
    const added = lines.filter((l) => l.type === 'added')
    expect(removed.length).toBeGreaterThan(0)
    expect(added.length).toBeGreaterThan(0)
  })

  it('handles pure insertion (empty old_string)', () => {
    const payload = JSON.stringify({
      file_path: '/foo.ts',
      old_string: '',
      new_string: 'new line\n',
    })
    const result = extractFileDiffData('edit', payload)

    expect(result).not.toBeNull()
    const addedLines = result!.hunks[0].lines.filter((l) => l.type === 'added')
    expect(addedLines.length).toBeGreaterThan(0)
  })

  it('handles pure deletion (empty new_string)', () => {
    const payload = JSON.stringify({
      file_path: '/foo.ts',
      old_string: 'removed line\n',
      new_string: '',
    })
    const result = extractFileDiffData('edit', payload)

    expect(result).not.toBeNull()
    const removedLines = result!.hunks[0].lines.filter((l) => l.type === 'removed')
    expect(removedLines.length).toBeGreaterThan(0)
  })

  it('returns null when old_string/new_string are missing', () => {
    const payload = JSON.stringify({ file_path: '/foo.ts', old_string: 'x' })
    expect(extractFileDiffData('edit', payload)).toBeNull()
  })
})

describe('extractFileDiffData - apply_patch tool', () => {
  it('parses unified diff', () => {
    const patch = `--- a/foo.ts
+++ b/foo.ts
@@ -1,3 +1,3 @@
 const x = 1;
-const y = 2;
+const y = 3;
 const z = 3;`

    const payload = JSON.stringify({ patch })
    const result = extractFileDiffData('apply_patch', payload)

    expect(result).not.toBeNull()
    expect(result!.filePath).toBe('b/foo.ts')
    expect(result!.toolKind).toBe('apply_patch')
    expect(result!.hunks).toHaveLength(1)

    const lines = result!.hunks[0].lines
    expect(lines.filter((l) => l.type === 'context')).toHaveLength(2)
    expect(lines.filter((l) => l.type === 'removed')).toHaveLength(1)
    expect(lines.filter((l) => l.type === 'added')).toHaveLength(1)
    expect(lines.find((l) => l.type === 'removed')!.content).toBe('const y = 2;')
    expect(lines.find((l) => l.type === 'added')!.content).toBe('const y = 3;')
  })

  it('returns null when patch is missing', () => {
    const payload = JSON.stringify({ file_path: '/foo.ts' })
    expect(extractFileDiffData('apply_patch', payload)).toBeNull()
  })
})

describe('extractFileDiffData - edge cases', () => {
  it('returns null for unknown tool', () => {
    const payload = JSON.stringify({ content: 'x' })
    expect(extractFileDiffData('bash', payload)).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    expect(extractFileDiffData('write', 'not json')).toBeNull()
  })

  it('returns null for null payload', () => {
    expect(extractFileDiffData('write', undefined)).toBeNull()
  })

  it('returns null for array JSON', () => {
    expect(extractFileDiffData('write', '[1,2,3]')).toBeNull()
  })

  it('does not crash when patch field contains non-diff content (e.g. raw markdown)', () => {
    const payload = JSON.stringify({
      path: '/docs/RAT-83.md',
      patch: '---\ntitle: RAT-83\n---\n# RAT-83 Gate A Discovery\n\nSome content here.',
    })

    // Should not throw — malformed patches should be caught and fall through
    expect(() => extractFileDiffData('file_change', payload)).not.toThrow()
    // Should still return a result (falls through to extractWriteDiff or returns null)
    const result = extractFileDiffData('file_change', payload)
    // Result can be null (no content key) or a write diff — either is acceptable, just no crash
    expect(result === null || result.filePath === '/docs/RAT-83.md').toBe(true)
  })

  it('does not crash when apply_patch receives non-diff content', () => {
    const payload = JSON.stringify({
      patch: '# RAT-83 Gate A Discovery\n\nThis is not a diff.',
    })

    expect(() => extractFileDiffData('apply_patch', payload)).not.toThrow()
  })

  it('does not crash when patch contains content that triggers parsePatch error', () => {
    // Simulates a Codex file_change where the patch field has diff-like headers
    // followed by non-diff content, causing parsePatch to throw "Unknown line"
    const payload = JSON.stringify({
      path: '/docs/RAT-83.md',
      patch: '--- a/docs/RAT-83.md\n+++ b/docs/RAT-83.md\n@@ -1,3 +1,3 @@\n# RAT-83 Gate A Discovery',
    })

    expect(() => extractFileDiffData('apply_patch', payload)).not.toThrow()
    expect(() => extractFileDiffData('file_change', payload)).not.toThrow()
  })
})
