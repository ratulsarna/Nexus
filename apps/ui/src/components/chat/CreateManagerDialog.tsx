import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ThinkingLevel } from '@nexus/protocol'

interface CreateManagerDialogProps {
  open: boolean
  isCreatingManager: boolean
  isValidatingDirectory: boolean
  isPickingDirectory: boolean
  newManagerName: string
  newManagerCwd: string
  newManagerProvider: string
  newManagerModelId: string
  newManagerThinkingLevel: ThinkingLevel
  isLoadingCreateManagerCatalog: boolean
  createManagerCatalogError: string | null
  isCreateManagerSubmitDisabled: boolean
  providerOptions: Array<{ value: string; label: string }>
  modelOptions: Array<{ value: string; label: string }>
  thinkingOptions: Array<{ value: ThinkingLevel; label: string }>
  createManagerSelectionHint: string | null
  createManagerError: string | null
  browseError: string | null
  onOpenChange: (open: boolean) => void
  onNameChange: (value: string) => void
  onCwdChange: (value: string) => void
  onProviderChange: (value: string) => void
  onModelIdChange: (value: string) => void
  onThinkingLevelChange: (value: ThinkingLevel) => void
  onBrowseDirectory: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function CreateManagerDialog({
  open,
  isCreatingManager,
  isValidatingDirectory,
  isPickingDirectory,
  newManagerName,
  newManagerCwd,
  newManagerProvider,
  newManagerModelId,
  newManagerThinkingLevel,
  isLoadingCreateManagerCatalog,
  createManagerCatalogError,
  isCreateManagerSubmitDisabled,
  providerOptions,
  modelOptions,
  thinkingOptions,
  createManagerSelectionHint,
  createManagerError,
  browseError,
  onOpenChange,
  onNameChange,
  onCwdChange,
  onProviderChange,
  onModelIdChange,
  onThinkingLevelChange,
  onBrowseDirectory,
  onSubmit,
}: CreateManagerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create manager</DialogTitle>
          <DialogDescription>
            Create a new manager with a name and working directory.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="manager-name" className="text-xs font-medium text-muted-foreground">
              Name
            </Label>
            <Input
              id="manager-name"
              placeholder="release-manager"
              value={newManagerName}
              onChange={(event) => onNameChange(event.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="manager-cwd" className="text-xs font-medium text-muted-foreground">
              Working directory
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="manager-cwd"
                placeholder="/path/to/project"
                value={newManagerCwd}
                onChange={(event) => onCwdChange(event.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={onBrowseDirectory}
                disabled={isPickingDirectory || isCreatingManager}
              >
                {isPickingDirectory ? 'Browsing...' : 'Browse'}
              </Button>
            </div>

            {browseError ? (
              <p className="text-xs text-destructive">{browseError}</p>
            ) : null}

            <p className="text-[11px] text-muted-foreground">
              Use Browse to open the native folder picker, or enter a path manually.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manager-provider" className="text-xs font-medium text-muted-foreground">
              Provider
            </Label>
            <Select
              value={newManagerProvider}
              onValueChange={onProviderChange}
              disabled={isCreatingManager || isPickingDirectory || isLoadingCreateManagerCatalog || providerOptions.length === 0}
            >
              <SelectTrigger id="manager-provider" className="w-full">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {providerOptions.map((providerOption) => (
                  <SelectItem key={providerOption.value} value={providerOption.value}>
                    {providerOption.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manager-model" className="text-xs font-medium text-muted-foreground">
              Model
            </Label>
            <Select
              value={newManagerModelId}
              onValueChange={onModelIdChange}
              disabled={
                isCreatingManager ||
                isPickingDirectory ||
                isLoadingCreateManagerCatalog ||
                modelOptions.length === 0
              }
            >
              <SelectTrigger id="manager-model" className="w-full">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {modelOptions.map((modelOption) => (
                  <SelectItem key={modelOption.value} value={modelOption.value}>
                    {modelOption.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manager-thinking" className="text-xs font-medium text-muted-foreground">
              Thinking
            </Label>
            <Select
              value={newManagerThinkingLevel}
              onValueChange={(value) => onThinkingLevelChange(value as ThinkingLevel)}
              disabled={
                isCreatingManager ||
                isPickingDirectory ||
                isLoadingCreateManagerCatalog ||
                thinkingOptions.length === 0
              }
            >
              <SelectTrigger id="manager-thinking" className="w-full">
                <SelectValue placeholder="Select thinking" />
              </SelectTrigger>
              <SelectContent>
                {thinkingOptions.map((thinkingOption) => (
                  <SelectItem key={thinkingOption.value} value={thinkingOption.value}>
                    {thinkingOption.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {createManagerSelectionHint ? (
            <p className="text-[11px] text-muted-foreground">{createManagerSelectionHint}</p>
          ) : null}

          {isLoadingCreateManagerCatalog ? (
            <p className="text-[11px] text-muted-foreground">Loading model catalog...</p>
          ) : null}

          {!isLoadingCreateManagerCatalog && createManagerCatalogError ? (
            <p className="text-xs text-destructive">{createManagerCatalogError}</p>
          ) : null}

          {!isLoadingCreateManagerCatalog &&
          !createManagerCatalogError &&
          providerOptions.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              No manager model options are available right now.
            </p>
          ) : null}

          {createManagerError ? (
            <p className="text-xs text-destructive">{createManagerError}</p>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreatingManager}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreateManagerSubmitDisabled}>
              {isCreatingManager
                ? isValidatingDirectory
                  ? 'Validating...'
                  : 'Creating...'
                : 'Create manager'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
