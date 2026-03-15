export const SIDEBAR_WIDTH_STORAGE_KEY = 'nexus-sidebar-width'
export const DEFAULT_SIDEBAR_WIDTH = 320
export const MIN_SIDEBAR_WIDTH = 200
export const MAX_SIDEBAR_WIDTH = 480

export function readSidebarWidth(): number {
  if (typeof window === 'undefined') {
    return DEFAULT_SIDEBAR_WIDTH
  }

  try {
    const stored = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)
    const parsed = stored ? Number.parseInt(stored, 10) : Number.NaN
    return clampSidebarWidth(parsed)
  } catch {
    return DEFAULT_SIDEBAR_WIDTH
  }
}

export function writeSidebarWidth(width: number): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(clampSidebarWidth(width)))
  } catch {
    // Ignore localStorage write failures in restricted environments.
  }
}

function clampSidebarWidth(width: number): number {
  if (!Number.isFinite(width)) {
    return DEFAULT_SIDEBAR_WIDTH
  }

  return Math.min(Math.max(Math.round(width), MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH)
}
