import { describe, expect, it } from 'vitest'
import { shortenFilePath } from './FileDiffView'

describe('shortenFilePath', () => {
  it('extracts parent/filename from a deep Unix absolute path', () => {
    const result = shortenFilePath('/Users/ratulsarna/Developer/staipete/CodexBar/CHANGELOG.md')
    expect(result.display).toBe('CodexBar/CHANGELOG.md')
    expect(result.full).toBe('/Users/ratulsarna/Developer/staipete/CodexBar/CHANGELOG.md')
  })

  it('returns the filename alone when there is only one segment', () => {
    const result = shortenFilePath('CHANGELOG.md')
    expect(result.display).toBe('CHANGELOG.md')
    expect(result.full).toBe('CHANGELOG.md')
  })

  it('returns both segments when path has exactly two', () => {
    const result = shortenFilePath('src/index.ts')
    expect(result.display).toBe('src/index.ts')
    expect(result.full).toBe('src/index.ts')
  })

  it('shows parent/filename for three or more segments', () => {
    const result = shortenFilePath('a/b/c/d.ts')
    expect(result.display).toBe('c/d.ts')
    expect(result.full).toBe('a/b/c/d.ts')
  })

  it('returns empty strings for an empty path', () => {
    const result = shortenFilePath('')
    expect(result.display).toBe('')
    expect(result.full).toBe('')
  })

  it('handles Windows-style backslash paths', () => {
    const result = shortenFilePath('C:\\Users\\dev\\project\\file.ts')
    expect(result.display).toBe('project/file.ts')
    expect(result.full).toBe('C:\\Users\\dev\\project\\file.ts')
  })
})
