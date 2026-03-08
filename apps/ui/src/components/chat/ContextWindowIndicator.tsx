import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface ContextWindowIndicatorProps {
  usedTokens: number
  contextWindow: number
}

const RING_RADIUS = 7
const RING_STROKE_WIDTH = 1.75
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function formatTokens(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(Math.max(0, Math.round(value)))
}

export function ContextWindowIndicator({
  usedTokens,
  contextWindow,
}: ContextWindowIndicatorProps) {
  if (contextWindow <= 0) return null

  const fillRatio = usedTokens / contextWindow
  const clampedFillRatio = Math.min(Math.max(fillRatio, 0), 1)
  const percentFull = Math.min(Math.max(Math.round(fillRatio * 100), 0), 100)
  const progressOffset = RING_CIRCUMFERENCE * (1 - clampedFillRatio)

  const progressColorClass =
    fillRatio >= 0.95
      ? 'stroke-red-500'
      : fillRatio >= 0.8
        ? 'stroke-amber-500'
        : 'stroke-emerald-500'

  const usageToneClass =
    fillRatio >= 0.95
      ? 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300'
      : fillRatio >= 0.8
        ? 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-accent/70 hover:text-foreground"
          aria-label={`Context window ${percentFull}% full, ${formatTokens(usedTokens)} of ${formatTokens(contextWindow)} tokens used`}
        >
          <svg
            viewBox="0 0 20 20"
            className="size-4 -rotate-90"
            role="img"
            aria-hidden="true"
          >
            <circle
              cx="10"
              cy="10"
              r={RING_RADIUS}
              strokeWidth={RING_STROKE_WIDTH}
              fill="none"
              className="stroke-muted-foreground/25"
            />
            <circle
              cx="10"
              cy="10"
              r={RING_RADIUS}
              strokeWidth={RING_STROKE_WIDTH}
              strokeLinecap="round"
              fill="none"
              className={progressColorClass}
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={progressOffset}
            />
          </svg>
        </Button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="end"
        sideOffset={6}
        className="w-64 rounded-lg border border-background/15 px-3 py-3 text-xs shadow-md"
      >
        <div className="space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] opacity-[0.65]">
                Context window
              </p>
              <p className="text-sm font-semibold leading-none tabular-nums">
                {percentFull}% full
              </p>
            </div>
            <span
              className={cn(
                'inline-flex shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums',
                usageToneClass,
              )}
            >
              {formatTokens(usedTokens)} used
            </span>
          </div>

          <div className="rounded-md border border-background/15 bg-background/10 px-2.5 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="opacity-[0.65]">Used</span>
              <span className="whitespace-nowrap font-medium tabular-nums">{formatTokens(usedTokens)} tokens</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <span className="opacity-[0.65]">Capacity</span>
              <span className="whitespace-nowrap font-medium tabular-nums">{formatTokens(contextWindow)} tokens</span>
            </div>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
