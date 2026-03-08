import { useId, useState } from 'react'
import { ChevronRight, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ToolLogRow } from './ToolLogRow'
import type { ToolExecutionDisplayEntry } from './types'

export function ToolExecutionGroup({ entries }: { entries: ToolExecutionDisplayEntry[] }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const contentId = useId()

  const pendingCount = entries.filter(
    (e) => e.latestKind !== 'tool_execution_end',
  ).length

  const label = pendingCount > 0
    ? `Running ${pendingCount} of ${entries.length} tools`
    : `Used ${entries.length} tools`

  return (
    <div className="rounded-md">
      <Button
        type="button"
        variant="ghost"
        className={cn(
          'group h-auto w-full items-start justify-start gap-1.5 rounded-md px-1 py-1 text-left text-sm font-normal text-foreground/70 italic transition-colors',
          'hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
        )}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center">
          <Wrench className="size-3.5 text-muted-foreground" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">{label}</span>
        <ChevronRight
          className={cn(
            'mt-0.5 size-3.5 shrink-0 text-muted-foreground/80 opacity-0 transition-all group-hover:opacity-100',
            isExpanded && 'rotate-90',
          )}
          aria-hidden="true"
        />
      </Button>

      <div
        id={contentId}
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="ml-2 space-y-0.5 border-l border-border/50 pl-2">
            {entries.map((entry) => (
              <ToolLogRow key={entry.id} type="tool_execution" entry={entry} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
