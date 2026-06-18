export const SPLIT_MIN_PANE_PX = 300
export const SPLIT_DIVIDER_PX = 6
export const SPLIT_DEFAULT_RATIO = 0.5

export type SplitPane = 'left' | 'right'

export type SplitSession = {
  id: string
  leftTabId: number
  rightTabId: number
  /** Left pane width fraction (0–1) of available space excluding divider. */
  ratio: number
  focusedPane: SplitPane
}

export type PersistedSplitPane = {
  url: string
  pinned?: boolean
  muted?: boolean
}

export type PersistedSplitSession = {
  right: PersistedSplitPane
  ratio: number
  focusedPane: SplitPane
}

export function clampSplitRatio(ratio: number, totalWidth: number): number {
  const divider = SPLIT_DIVIDER_PX
  const avail = Math.max(0, totalWidth - divider)
  if (avail <= SPLIT_MIN_PANE_PX * 2) return SPLIT_DEFAULT_RATIO
  const minRatio = SPLIT_MIN_PANE_PX / avail
  const maxRatio = 1 - minRatio
  if (!Number.isFinite(ratio)) return SPLIT_DEFAULT_RATIO
  return Math.min(maxRatio, Math.max(minRatio, ratio))
}

export function computeSplitWidths(
  totalWidth: number,
  ratio: number
): { leftW: number; rightW: number; ratio: number } {
  const divider = SPLIT_DIVIDER_PX
  const w = Math.max(0, Math.floor(totalWidth))
  const clamped = clampSplitRatio(ratio, w)
  const avail = Math.max(0, w - divider)
  let leftW = Math.floor(avail * clamped)
  let rightW = avail - leftW
  if (leftW < SPLIT_MIN_PANE_PX) {
    leftW = SPLIT_MIN_PANE_PX
    rightW = avail - leftW
  }
  if (rightW < SPLIT_MIN_PANE_PX) {
    rightW = SPLIT_MIN_PANE_PX
    leftW = avail - rightW
  }
  const nextRatio = avail > 0 ? leftW / avail : SPLIT_DEFAULT_RATIO
  return { leftW, rightW, ratio: nextRatio }
}

export function splitPrimaryTabId(session: SplitSession): number {
  return session.leftTabId
}

export function splitTabIdForPane(session: SplitSession, pane: SplitPane): number {
  return pane === 'left' ? session.leftTabId : session.rightTabId
}

export function splitPaneForTabId(session: SplitSession, tabId: number): SplitPane | null {
  if (tabId === session.leftTabId) return 'left'
  if (tabId === session.rightTabId) return 'right'
  return null
}
