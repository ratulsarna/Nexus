import { memo, useState } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { DiffHunk, DiffLine, FileDiffData } from '@/lib/diff-utils'

const TRUNCATE_LINE_THRESHOLD = 500

export function shortenFilePath(filePath: string): { display: string; full: string } {
  if (!filePath) return { display: '', full: '' }

  const segments = filePath.replace(/\\/g, '/').split('/').filter(Boolean)

  if (segments.length <= 2) {
    return { display: segments.join('/'), full: filePath }
  }

  return {
    display: `${segments[segments.length - 2]}/${segments[segments.length - 1]}`,
    full: filePath,
  }
}

export const FileDiffView = memo(function FileDiffView({ data }: { data: FileDiffData }) {
  const totalLines = data.hunks.reduce((sum, h) => sum + h.lines.length, 0)
  const shouldTruncate = data.isNewFile && totalLines > TRUNCATE_LINE_THRESHOLD
  const [showAll, setShowAll] = useState(false)
  const { display: shortPath, full: fullPath } = shortenFilePath(data.filePath)

  return (
    <div className="overflow-hidden rounded-md border border-border/70">
      <div className="flex items-center gap-2 border-b border-border/70 bg-muted/40 px-3 py-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground/80">
              {shortPath}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6} className="px-2 py-1 text-[10px]">
            {fullPath}
          </TooltipContent>
        </Tooltip>
        {data.isNewFile && (
          <span className="shrink-0 rounded-sm bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            New file
          </span>
        )}
      </div>

      <div className="max-h-96 overflow-auto font-mono text-[11px] leading-5">
        {data.hunks.map((hunk, i) => (
          <DiffHunkBlock
            key={i}
            hunk={hunk}
            showSeparator={i > 0}
            truncateAfter={shouldTruncate && !showAll ? TRUNCATE_LINE_THRESHOLD : undefined}
          />
        ))}
      </div>

      {shouldTruncate && !showAll && (
        <button
          type="button"
          className="w-full border-t border-border/70 bg-muted/30 px-3 py-1.5 text-center text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
          onClick={() => setShowAll(true)}
        >
          Show all {totalLines} lines
        </button>
      )}
    </div>
  )
})

function DiffHunkBlock({
  hunk,
  showSeparator,
  truncateAfter,
}: {
  hunk: DiffHunk
  showSeparator: boolean
  truncateAfter?: number
}) {
  const lines = truncateAfter ? hunk.lines.slice(0, truncateAfter) : hunk.lines

  return (
    <div>
      {showSeparator && (
        <div className="border-t border-border/50" />
      )}
      <div className="bg-blue-500/5 px-3 py-0.5 text-[10px] text-blue-600 select-none dark:text-blue-400">
        {hunk.header}
      </div>
      <table className="min-w-full border-collapse">
        <tbody>
          {lines.map((line, i) => (
            <DiffLineRow key={i} line={line} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DiffLineRow({ line }: { line: DiffLine }) {
  return (
    <tr
      className={cn(
        line.type === 'added' && 'bg-emerald-500/10 dark:bg-emerald-500/8',
        line.type === 'removed' && 'bg-red-500/10 dark:bg-red-500/8',
      )}
    >
      <td className="w-8 select-none pr-0 text-right align-top text-muted-foreground/50">
        {line.oldLineNumber ?? ''}
      </td>
      <td className="w-8 select-none pr-0 text-right align-top text-muted-foreground/50">
        {line.newLineNumber ?? ''}
      </td>
      <td className="w-4 select-none text-center align-top">
        <span
          className={cn(
            line.type === 'added' && 'text-emerald-600 dark:text-emerald-400',
            line.type === 'removed' && 'text-red-600 dark:text-red-400',
          )}
        >
          {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
        </span>
      </td>
      <td className="whitespace-pre pl-1">
        {line.content}
      </td>
    </tr>
  )
}
